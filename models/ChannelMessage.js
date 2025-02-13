const mongoose = require('mongoose')
const ChannelMessageSchema = new mongoose.Schema({
    channelId: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  });
  
  const ChannelMessage = mongoose.model("ChannelMessage", ChannelMessageSchema);
  module.exports = ChannelMessage;
  