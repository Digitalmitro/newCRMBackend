const schedule = require("node-schedule");
const moment = require("moment-timezone");
const Callback = require("../models/CallBack");
const Notification = require("../models/Notifications");
const User = require("../models/User");
const sendMail = require("../services/sendMail");
const { getIo, onlineUsers } = require("../utils/socket");

const startScheduler = (minute, hour) => {
  schedule.scheduleJob({ minute, hour, tz: "Asia/Kolkata" }, async () => {
    try {
      const today = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");
      const callbacks = await Callback.find({ calldate: today }).populate("user_id");

      if (callbacks.length === 0) {
        console.log("✅ No callbacks scheduled for today.");
        return;
      }

      const io = getIo();
      for (const callback of callbacks) {
        const user = callback.user_id;
        if (!user) continue;

        const notificationData = {
          userId: user._id,
          title: "Callback Reminder",
          description: `Reminder: You have a callback scheduled today with ${callback.name}.`,
          isRead: false,
        };

        // ✅ Check if user is online
        const userSocket = onlineUsers.get(user._id.toString());
        if (userSocket) {
          io.to(userSocket).emit("receive-notification", notificationData);
          console.log(`📢 Real-time notification sent to ${user.email}`);
        } else {
          // ✅ Save to Notification Collection for later
          await Notification.create(notificationData);
          console.log(`💾 Notification saved for ${user.email} (offline)`);
        }

        // ✅ Send Email Notification
        await sendMail(user.email, "Callback Reminder", notificationData.description);
        console.log(`📧 Email sent to ${user.email}`);
      }
    } catch (error) {
      console.error("❌ Error in callback scheduler:", error);
    }
  });

  console.log(`✅ Callback scheduler set for ${hour}:${minute} IST`);
};

module.exports = { startScheduler };
