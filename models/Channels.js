const mongoose = require('mongoose')

const ChannelSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    inviteLink: { type: String, unique: true },
    createdAt: { type: Date, default: Date.now },
  });
  
  const Channel = mongoose.model("Channel", ChannelSchema);
  module.exports = Channel;
  