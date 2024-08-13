const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
   message: {type: String}
});

const NotificationModel = mongoose.model("notification", notificationSchema);

module.exports = { NotificationModel };
