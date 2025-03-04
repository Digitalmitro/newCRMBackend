const Notification = require("../models/Notifications");
const { getIo, onlineUsers } = require("../utils/socket");


const sendNotification = async (req, res) => {
  try {
    let { userId, title, description } = req.body;
    console.log({ userId, title, description })
    // If userId is 'ALL', broadcast to all users
    if (userId === "ALL") {
      userId = null;
    }

    // ✅ Save notification to the database
    const notification = new Notification({ userId, title, description });
    await notification.save();

    const io = getIo(); // Get the initialized Socket.io instance

    if (userId) {
      // ✅ Send notification to a specific user if online
      const socketId = onlineUsers.get(userId);
      // console.log(socketId)
      if (socketId) {
        io.to(socketId).emit("receive-notification", {
          title: notification.title,
          description: notification.description,
          timestamp: notification.createdAt,
        });
        console.log(`✅ Notification sent to user: ${userId}`);
      }
    } else {
      // ✅ Broadcast notification to all connected users
      io.emit("receive-notification", {
        title: notification.title,
        description: notification.description,
        timestamp: notification.createdAt,
      });
      console.log("✅ Notification broadcasted to all users");
    }

    res.status(200).json({ success: true, notification });
  } catch (error) {
    console.error("❌ Error sending notification:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const getNotification = async (req, res) => {
  try {
    const { userId } = req.user;
    const notifications = await Notification.find({
      $or: [{ userId }, { userId: null }],
    }).sort({ createdAt: -1 });

    res.status(200).json({ success: true, notifications });
  } catch (error) {
    console.error("❌ Error fetching notifications:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

module.exports = { sendNotification, getNotification };
