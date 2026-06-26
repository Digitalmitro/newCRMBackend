const mongoose = require("mongoose");

const DirectMessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  message: {
    type: String,
    required: function () {
      return !this.attachments || this.attachments.length === 0;
    },
    default: "",
  },
  attachments: {
    type: [String],
    default: [],
  },
  // Pin fields — same as ChannelMessage
  isPinned: { type: Boolean, default: false, index: true },
  pinnedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
  pinnedAt: { type: Date, default: null },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "DirectMessage", default: null },
  replyPreview: {
    message: { type: String },
    sender: { type: mongoose.Schema.Types.ObjectId, default: null },
    senderName: { type: String },
  },
  seen: { type: Boolean, default: false },
  // One reaction per user per message — picking a new emoji replaces
  // their previous one, tapping the same emoji again clears it.
  reactions: {
    type: [{
      emoji: { type: String, required: true },
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      userName: { type: String, default: "" },
    }],
    default: [],
  },
  // Edit / delete tracking. Tombstones preserved like WhatsApp.
  editedAt: { type: Date, default: null },
  isDeleted: { type: Boolean, default: false, index: true },
  deletedAt: { type: Date, default: null },
  deletedBy: { type: mongoose.Schema.Types.ObjectId, default: null },
  createdAt: { type: Date, default: Date.now },
});

const DirectMessage = mongoose.model("DirectMessage", DirectMessageSchema);
module.exports = DirectMessage;
