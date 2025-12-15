const DirectMessage = require("../models/DirectMessage");
const User = require("../models/User");
const Admin = require("../models/Admin");
const Client = require("../models/Client");

const { getIo, onlineUsers } = require("../utils/socket");
const sendMail = require("../services/sendMail");

// Resolve a user-like entity (employee/admin/client) by id so notifications use the correct sender name.
const resolveUserEntity = async (id) => {
  if (!id) return null;
  return (
    (await User.findById(id)) ||
    (await Admin.findById(id)) ||
    (await Client.findById(id))
  );
};

// Send a new message
const sendMessage = async (req, res) => {
  try {
    const { sender, receiver, message } = req.body;

    if (!sender || !receiver || !message) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    const senderEntity = await resolveUserEntity(sender);
    const receiverEntity = await resolveUserEntity(receiver);
    const senderName = senderEntity?.name || "Unknown Sender";
    const isSelfMessage =
      sender?.toString && receiver?.toString
        ? sender.toString() === receiver.toString()
        : sender === receiver;

    // Save message to database
    const newMessage = new DirectMessage({ sender, receiver, message });
    await newMessage.save();

    const io = getIo(); // Get the initialized Socket.io instance

    // Emit the message to both sender and receiver if online
    const senderSocket = onlineUsers.get(sender);
    const receiverSocket = onlineUsers.get(receiver);

    if (receiverSocket) {
      io.to(receiverSocket).emit("new-message", newMessage);
      io.to(receiverSocket).emit("updateUnread");
      if (!isSelfMessage) {
        io.to(receiverSocket).emit("receive-notification", {
          title: `${senderName} sent a message`,
          description: message,
          sender,
          name: senderName,
          type: "DM",
          timestamp: new Date(),
        });
      }
    }

    if (senderSocket) {
      io.to(senderSocket).emit("new-message", newMessage);
      io.to(senderSocket).emit("updateUnread");
    }

    if (receiverEntity?.email && !isSelfMessage) {
      const mailSent = await sendMail(
        receiverEntity.email,
        `New message from ${senderName}`,
        message
      );

      if (!mailSent) {
        console.warn("Failed to send offline message email.");
      }
    }

    res.status(200).json({ success: true, message: "Message sent successfully.", data: newMessage });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Retrieve messages between two users
const getMessages = async (req, res) => {
  try {
    const { sender, receiver } = req.params;

    if (!sender || !receiver) {
      return res.status(400).json({ success: false, message: "Sender and receiver are required." });
    }

    const messages = await DirectMessage.find({
      $or: [
        { sender, receiver },
        { sender: receiver, receiver: sender },
      ],
    }).sort({ createdAt: 1 });

    res.status(200).json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const getRecentChatUsers = async (req, res) => {
  try {
    const userId = req.user.userId; // Extract user ID from token

    // Step 1: Find the latest message per user
    const lastMessages = await DirectMessage.aggregate([
      {
        $match: {
          $or: [{ sender: userId }, { receiver: userId }],
        },
      },
      { $sort: { createdAt: -1 } }, // Sort by latest message
      {
        $group: {
          _id: {
            $cond: [{ $eq: ["$sender", userId] }, "$receiver", "$sender"],
          }, // Group by the chat partner
          lastMessageTime: { $first: "$createdAt" },
          lastMessage: { $first: "$message" },
        },
      },
    ]);

    // Convert aggregation result to a map
    const lastMessageMap = {};
    lastMessages.forEach((msg) => {
      lastMessageMap[msg._id.toString()] = msg;
    });

    // Step 2: Get all users who have chatted with the current user
    const userIds = lastMessages.map((msg) => msg._id);
    const users = await User.find({ _id: { $in: userIds } }, "name _id");
    const adminUsers = await Admin.find({ _id: { $in: userIds } }, "name _id");
    const clientUsers = await Client.find({ _id: { $in: userIds } }, "name _id");
    const allUsers = [...users, ...adminUsers, ...clientUsers];

    // Get the current user (who is making the request)
    let currentUser = await User.findById({ _id: userId }, "name _id");
    if (!currentUser) currentUser = await Admin.findById({ _id: userId }, "name _id");
    if (!currentUser) currentUser = await Client.findById({ _id: userId }, "name _id");

    // Step 3: Get unseen message count for each user
    const usersWithDetails = await Promise.all(
      allUsers.map(async (user) => {
        const unseenCount = await DirectMessage.countDocuments({
          sender: user._id,
          receiver: userId,
          seen: false,
        });

        return {
          _id: user._id,
          name: user.name,
          unseenMessages: unseenCount,
          lastMessageTime: lastMessageMap[user._id.toString()]?.lastMessageTime || null,
          lastMessage: lastMessageMap[user._id.toString()]?.lastMessage || "",
        };
      })
    );

    // Step 4: Sort users by lastMessageTime (latest first)
    usersWithDetails.sort((a, b) => {
      return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
    });

    res.status(200).json({ success: true, user: currentUser, chatUsers: usersWithDetails });
  } catch (error) {
    console.error("Error fetching recent chat users:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const getAllUser = async (req, res) => {
  try {
    const loggedInUserId = req.user.userId; // Get logged-in user ID

    // Fetch users from all collections (excluding the logged-in user)
    const employeeUsers = await User.find({ _id: { $ne: loggedInUserId } }, "_id name");
    const adminUsers = await Admin.find({ _id: { $ne: loggedInUserId } }, "_id name");
    const clientUsers = await Client.find({ _id: { $ne: loggedInUserId } }, "_id name");

    // Combine users into one array
    const allUsers = [...employeeUsers, ...adminUsers, ...clientUsers];

    // Fetch unread messages and last message time for each user
    const usersWithChatData = await Promise.all(
      allUsers.map(async (user) => {
        const lastMessage = await DirectMessage.findOne({
          $or: [
            { sender: loggedInUserId, receiver: user._id },
            { sender: user._id, receiver: loggedInUserId },
          ],
        }).sort({ createdAt: -1 }); // Get the latest message

        const unreadCount = await DirectMessage.countDocuments({
          sender: user._id,
          receiver: loggedInUserId,
          seen: false,
        });

        return {
          id: user._id,
          name: user.name,
          unreadMessages: unreadCount,
          lastMessageTime: lastMessage ? lastMessage.createdAt : null,
        };
      })
    );

    // Sort by:
    // 1) Unread messages first (Descending)
    // 2) Recent chat activity (Newest first)
    const sortedUsers = usersWithChatData.sort((a, b) => {
      if (a.unreadMessages !== b.unreadMessages) {
        return b.unreadMessages - a.unreadMessages; // Unread messages first
      }
      return new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0); // Recent chats next
    });

    res.json({ success: true, users: sortedUsers });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const readMessage = async (req, res) => {
  try {
    const { senderId } = req.body;
    const receiverId = req.user.userId;

    await DirectMessage.updateMany(
      { sender: senderId, receiver: receiverId, seen: false },
      { $set: { seen: true } }
    );

    res.json({ message: "Messages marked as read" });
  } catch (error) {
    console.error("Error updating messages:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Clear conversation between the authenticated user and another user
const clearConversation = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { otherUserId } = req.body;

    if (!otherUserId) {
      return res.status(400).json({ success: false, message: "otherUserId is required" });
    }

    const result = await DirectMessage.deleteMany({
      $or: [
        { sender: userId, receiver: otherUserId },
        { sender: otherUserId, receiver: userId },
      ],
    });

    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    console.error("Error clearing conversation:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = { sendMessage, getMessages, getRecentChatUsers, getAllUser, readMessage, clearConversation };
