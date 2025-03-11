const cron = require("node-cron");
const moment = require("moment-timezone");
const Callback = require("../models/CallBack");
const User = require("../models/User");
const  sendMail  = require("../services/sendMail"); 
const { getIo, onlineUsers } = require("../utils/socket");

const startScheduler = (minute,hour) => {
    const scheduleTime = `${minute} ${hour} * * *`;

  cron.schedule(scheduleTime, async () => {
    try {
      const today = new Date().toISOString().split("T")[0]; 
      const callbacks = await Callback.find({ calldate: today }).populate("user_id");

      if (callbacks.length === 0) {
        console.log("✅ No callbacks scheduled for today.");
        return;
      }
      const io = getIo(); 

      for (const callback of callbacks) {
        const user = callback.user_id;

        if (user) {
          // ✅ Send Email Notification
          await sendMail(user.email, "Callback Reminder", `Reminder: You have a callback scheduled today with ${callback.name}.`);

          // ✅ Send Real-Time Notification via Socket.io
          const userSocket = onlineUsers.get(user._id.toString());
          if (userSocket) {
            io.to(userSocket).emit("receive-notification", {
              title: "Callback Reminder",
              description: `Reminder: You have a callback scheduled today with ${callback.name}.`,
              timestamp: new Date(),
            });
          }

          console.log(`📧 Test Email sent & notification triggered for ${user.email}`);
        }
      }
    } catch (error) {
      console.error("❌ Error in callback test scheduler:", error);
    }
  });

  console.log(`✅ Callback scheduler is running at ${hour}:${minute}.`);
};

module.exports = { startScheduler };
