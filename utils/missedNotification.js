const Notification = require("../models/Notifications");


const sendMissedNotifications = async (userId) => {
  try {
    const { getIo, onlineUsers } = require("../utils/socket");
    const io = getIo();
    const userSocket = onlineUsers.get(userId);

    if (!userSocket) return;

    // ✅ Fetch unread notifications
    const unreadNotifications = await Notification.find({ userId, isRead: false });
     if(!unreadNotifications) return 
    // ✅ Send them via Socket.io
    unreadNotifications.forEach((notification) => {
      io.to(userSocket).emit("receive-notification", {
        title: notification.title,
        description: notification.description,
        type: notification.type,
        sender: notification.sender,
        timestamp: notification.createdAt,
      });
    });

    // ✅ Mark notifications as read
    await Notification.updateMany({ userId, isRead: false }, { $set: { isRead: true } });

    console.log(`📨 Sent missed notifications to user ${userId}`);
  } catch (error) {
    console.error("❌ Error sending missed notifications:", error);
  }
};

module.exports = { sendMissedNotifications };
