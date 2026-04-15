const mongoose = require('mongoose');

const DirectMessageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    seen: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false }, // Soft delete
    deletedAt: { type: Date, default: null },
    editHistory: [
      {
        originalMessage: String,
        editedAt: Date,
      }
    ],
    editedAt: { type: Date, default: null },
    fileUrl: { type: String, default: null }, // File attachment support
    fileType: { type: String, default: null }, // Type of file (pdf, image, video, audio, other)
    mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // @mention functionality
    createdAt: { type: Date, default: Date.now },
  });
  
  const DirectMessage = mongoose.model("DirectMessage", DirectMessageSchema);
  module.exports = DirectMessage;
    