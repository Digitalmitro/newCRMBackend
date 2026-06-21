const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const User = require("../models/User");
const Admin = require("../models/Admin");
const Client = require("../models/Client");
const DirectMessage = require("../models/DirectMessage");
const ChannelMessage = require("../models/ChannelMessage");
const Attendance = require("../models/Attendance");
const Notification = require("../models/Notifications");
const { getAttendanceDate, getTodayBounds, TIMEZONE } = require("../utils/attendanceDay");
const moments = require("moment-timezone");

// ─── POST /mobile/login ────────────────────────────────────────────────────
// Unified login for Employee, Admin, SuperAdmin, Client
// Body: { email, password }
// Returns: { token, userType, user }
exports.mobileLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required." });
    }

    // Try Employee first
    let user = await User.findOne({ email, isDeleted: { $ne: true } });
    if (user) {
      const valid = await bcrypt.compare(password, user.password);
      if (!valid) return res.status(401).json({ success: false, message: "Invalid credentials." });
      const token = user.generateAuthToken
        ? await user.generateAuthToken()
        : require("jsonwebtoken").sign({ userId: user._id, name: user.name }, process.env.JWT_SECRET, { expiresIn: "30d" });
      return res.json({
        success: true,
        token,
        userType: "employee",
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatar: user.avatar || "",
          type: user.type,
          empId: user.empId || "",
          employeeType: user.employeeType,
        },
      });
    }

    // Try Admin / SuperAdmin
    let admin = await Admin.findOne({ email });
    if (admin) {
      const valid = await bcrypt.compare(password, admin.password);
      if (!valid) return res.status(401).json({ success: false, message: "Invalid credentials." });
      const token = await admin.generateAuthToken();
      return res.json({
        success: true,
        token,
        userType: admin.role === "superadmin" ? "superadmin" : "admin",
        user: {
          _id: admin._id,
          name: admin.name,
          email: admin.email,
          phone: admin.phone,
          avatar: admin.avatar || "",
          role: admin.role,
          permissions: admin.permissions || {},
        },
      });
    }

    // Try Client
    let client = await Client.findOne({ email });
    if (client) {
      const valid = await bcrypt.compare(password, client.password);
      if (!valid) return res.status(401).json({ success: false, message: "Invalid credentials." });
      const token = require("jsonwebtoken").sign(
        { userId: client._id, name: client.name },
        process.env.JWT_SECRET,
        { expiresIn: "30d" }
      );
      return res.json({
        success: true,
        token,
        userType: "client",
        user: {
          _id: client._id,
          name: client.name,
          email: client.email,
          avatar: client.avatar || "",
        },
      });
    }

    return res.status(404).json({ success: false, message: "No account found with this email." });
  } catch (err) {
    console.error("mobileLogin error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── POST /mobile/fcm-token ────────────────────────────────────────────────
// Register or update FCM device token for push notifications.
// Body: { token }  (the FCM registration token from Flutter)
exports.registerFcmToken = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { token } = req.body;
    if (!token) return res.status(400).json({ success: false, message: "FCM token required." });

    // Update in whichever model the user belongs to
    const updated =
      (await User.findByIdAndUpdate(userId, { fcmToken: token })) ||
      (await Admin.findByIdAndUpdate(userId, { fcmToken: token })) ||
      (await Client.findByIdAndUpdate(userId, { fcmToken: token }));

    if (!updated) return res.status(404).json({ success: false, message: "User not found." });
    res.json({ success: true, message: "FCM token registered." });
  } catch (err) {
    console.error("registerFcmToken error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── DELETE /mobile/fcm-token ─────────────────────────────────────────────
// Clear FCM token on logout (stops notifications when logged out).
exports.clearFcmToken = async (req, res) => {
  try {
    const userId = req.user?.userId;
    await Promise.allSettled([
      User.findByIdAndUpdate(userId, { fcmToken: "" }),
      Admin.findByIdAndUpdate(userId, { fcmToken: "" }),
      Client.findByIdAndUpdate(userId, { fcmToken: "" }),
    ]);
    res.json({ success: true, message: "FCM token cleared." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── GET /mobile/profile ──────────────────────────────────────────────────
// Full profile for the logged-in user (any type).
exports.getMobileProfile = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const user =
      (await User.findById(userId).select("-password -fcmToken").lean()) ||
      (await Admin.findById(userId).select("-password -otp -otpExpiration -fcmToken").lean()) ||
      (await Client.findById(userId).select("-password -fcmToken").lean());

    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    const userType = user.role
      ? (user.role === "superadmin" ? "superadmin" : "admin")
      : user.type
      ? "employee"
      : "client";

    res.json({ success: true, userType, user });
  } catch (err) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── GET /mobile/dashboard ────────────────────────────────────────────────
// Home screen data in a single API call.
// Returns: today's attendance, unread DM count, pending tasks count,
//          recent notifications, online status.
exports.getMobileDashboard = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { start: todayStart, end: todayEnd } = getTodayBounds();
    const todayDate = getAttendanceDate();

    const [attendance, notifications, unreadDMs, recentDMs] = await Promise.all([
      // Today's attendance record
      Attendance.findOne({
        user_id: userId,
        currentDate: { $gte: todayStart, $lte: todayEnd },
      }).lean(),
      // Last 5 notifications
      Notification.find({ userId }).sort({ createdAt: -1 }).limit(5).lean(),
      // Unread DM count
      DirectMessage.countDocuments({
        receiver: userId,
        seen: false,
      }),
      // Recent DMs
      DirectMessage.aggregate([
        { $match: { $or: [{ sender: new mongoose.Types.ObjectId(userId) }, { receiver: new mongoose.Types.ObjectId(userId) }] } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: { $cond: [{ $eq: ["$sender", new mongoose.Types.ObjectId(userId)] }, "$receiver", "$sender"] }, lastMessage: { $first: "$$ROOT" } } },
        { $limit: 10 },
      ]),
    ]);

    // Night shift fallback: if no record for today, check yesterday
    let todayAttendance = attendance;
    if (!todayAttendance) {
      const yesterday = moments.tz(TIMEZONE).subtract(1, "day").format("YYYY-MM-DD");
      todayAttendance = await Attendance.findOne({
        user_id: userId,
        currentDate: yesterday,
        isPunchedIn: true,
      }).lean();
    }

    res.json({
      success: true,
      dashboard: {
        todayAttendance: todayAttendance || null,
        unreadDMs,
        recentDMs,
        notifications,
        date: todayDate,
      },
    });
  } catch (err) {
    console.error("getMobileDashboard error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── GET /mobile/channels ─────────────────────────────────────────────────
// Channel list with unread counts + last message for the logged-in user.
exports.getMobileChannels = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const Channel = require("../models/Channels");
    const { getAdminScope } = require("../utils/adminScope");
    const scope = await getAdminScope(userId);

    let channelFilter;
    if (scope && !scope.isSuperAdmin && !scope.allChannels && scope.allowedChannels.length > 0) {
      channelFilter = { _id: { $in: scope.allowedChannels.map(id => new mongoose.Types.ObjectId(id)) } };
    } else {
      channelFilter = { members: { $in: [userId] } };
    }

    const channels = await Channel.find(channelFilter).lean();

    // Attach unread count + last message to each channel
    const enriched = await Promise.all(
      channels.map(async (ch) => {
        const [unread, lastMessage] = await Promise.all([
          ChannelMessage.countDocuments({
            channelId: ch._id,
            sender: { $ne: userId },
            seenBy: { $nin: [userId] },
          }),
          ChannelMessage.findOne({ channelId: ch._id })
            .sort({ createdAt: -1 })
            .select("message sender createdAt")
            .lean(),
        ]);
        return { ...ch, unreadCount: unread, lastMessage: lastMessage || null };
      })
    );

    // Sort by last message time
    enriched.sort((a, b) => {
      const aTime = a.lastMessage?.createdAt || a.createdAt;
      const bTime = b.lastMessage?.createdAt || b.createdAt;
      return new Date(bTime) - new Date(aTime);
    });

    res.json({ success: true, channels: enriched });
  } catch (err) {
    console.error("getMobileChannels error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── GET /mobile/dms ──────────────────────────────────────────────────────
// Recent DM conversations with last message + unread count.
exports.getMobileDMs = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const userObjId = new mongoose.Types.ObjectId(userId);

    // Get all unique conversation partners
    const conversations = await DirectMessage.aggregate([
      {
        $match: {
          $or: [{ sender: userObjId }, { receiver: userObjId }],
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: {
            $cond: [{ $eq: ["$sender", userObjId] }, "$receiver", "$sender"],
          },
          lastMessage: { $first: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ["$receiver", userObjId] }, { $eq: ["$seen", false] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { "lastMessage.createdAt": -1 } },
      { $limit: 50 },
    ]);

    // Resolve user info for each conversation partner
    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const partnerId = conv._id;
        const partner =
          (await User.findById(partnerId).select("name avatar email").lean()) ||
          (await Admin.findById(partnerId).select("name avatar email").lean()) ||
          (await Client.findById(partnerId).select("name avatar email").lean());
        return {
          partnerId,
          partner: partner || { name: "Unknown", avatar: "" },
          lastMessage: conv.lastMessage,
          unreadCount: conv.unreadCount,
        };
      })
    );

    res.json({ success: true, conversations: enriched });
  } catch (err) {
    console.error("getMobileDMs error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── GET /mobile/socket-info ──────────────────────────────────────────────
// Returns socket server URL and event names for Flutter socket_io_client.
exports.getSocketInfo = async (req, res) => {
  const socketUrl = process.env.SOCKET_URL || process.env.BACKEND_URL || "https://your-backend.onrender.com";
  res.json({
    success: true,
    socket: {
      url: socketUrl,
      transports: ["websocket"],
      auth: { token: "Bearer <your-jwt-token>" },
      events: {
        emit: {
          join_room:    "Join a DM room. Payload: { userId }",
          join_channel: "Join a channel room. Payload: { channelId }",
          send_message: "Send a DM. Payload: { senderId, receiverId, message }",
        },
        on: {
          "new-message":           "New DM received. Payload: { message object }",
          "new-channel-message":   "New channel message. Payload: { channelId, message }",
          "direct-message-updated":"DM edited/deleted. Payload: { updated message }",
          "dm-message-pinned":     "DM pinned. Payload: { messageId, isPinned }",
          "updateUnread":          "Trigger unread count refresh",
          "receive-notification":  "New in-app notification",
          "user-status":           "User online/offline. Payload: { userId, status }",
          "soft-refresh":          "Trigger data refresh",
        },
      },
    },
  });
};
