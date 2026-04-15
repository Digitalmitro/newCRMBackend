const mongoose = require('mongoose')

const ChannelSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    channelImage: { type: String, default: null }, // Channel avatar/image
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    inviteLink: { type: String, unique: true },
    tags: [
      {
        type: String,
        enum: ['Active', 'Archived', 'Inactive'], // Predefined status tag
      }
    ],
    customTags: [String], // Additional custom tags (max 2 in addition to status)
    details: {
      purpose: { type: String, default: '' },
      guidelines: { type: String, default: '' },
      additionalInfo: { type: String, default: '' },
    },
    createdAt: { type: Date, default: Date.now },
  });
  
  const Channel = mongoose.model("Channel", ChannelSchema);
  module.exports = Channel;
  