const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String },
  messages: [
    {
      senderId: { type: String },
      message: { type: String },
      time: { type: String },
    },
  ],
  date: { type: String },
  status: { type: String },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "register user",
    required: true,
  },
});

const MessageModel = mongoose.model("message", messageSchema);

module.exports = { MessageModel };
