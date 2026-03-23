const mongoose = require('mongoose')
const ChannelMessageSchema = new mongoose.Schema({
    channelId: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    isSystem: { type: Boolean, default: false },
    systemLabel: { type: String, default: null },
    message: { type: String, required: true },
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, default: [] }],
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
  
