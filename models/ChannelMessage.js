const mongoose = require('mongoose')
const ChannelMessageSchema = new mongoose.Schema({
    channelId: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "ChannelMessage", default: null },
    replyPreview: {
      message: { type: String },
      sender: { type: mongoose.Schema.Types.ObjectId, default: null },
      senderName: { type: String },
    },
    createdAt: { type: Date, default: Date.now },
  });
  
  const ChannelMessage = mongoose.model("ChannelMessage", ChannelMessageSchema);
  module.exports = ChannelMessage;
  
