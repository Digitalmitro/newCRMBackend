const mongoose = require('mongoose');

const DirectMessageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "DirectMessage", default: null },
    replyPreview: {
      message: { type: String },
      sender: { type: mongoose.Schema.Types.ObjectId, default: null },
      senderName: { type: String },
    },
    seen: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  });
  
  const DirectMessage = mongoose.model("DirectMessage", DirectMessageSchema);
  module.exports = DirectMessage;
    
