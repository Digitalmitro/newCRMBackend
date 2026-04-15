const Channel = require("../models/Channels");
const User = require("../models/User");
const path = require("path");
const fs = require("fs");
const { getIo } = require("../utils/socket");

// Update channel details
const updateChannelDetails = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { purpose, guidelines, additionalInfo } = req.body;
    const userId = req.user.userId;

    // Find channel
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ success: false, message: "Channel not found" });
    }

    // Check if user is channel owner or admin
    if (channel.owner.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: "Only channel owner can update details" 
      });
    }

    // Update details
    if (purpose) channel.details.purpose = purpose;
    if (guidelines) channel.details.guidelines = guidelines;
    if (additionalInfo) channel.details.additionalInfo = additionalInfo;

    await channel.save();

    // Emit update to all channel members
    const io = getIo();
    io.to(channelId).emit("channel-details-updated", {
      channelId,
      details: channel.details,
    });

    res.status(200).json({
      success: true,
      message: "Channel details updated successfully",
      data: channel,
    });
  } catch (error) {
    console.error("Error updating channel details:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Get channel details
const getChannelDetails = async (req, res) => {
  try {
    const { channelId } = req.params;

    const channel = await Channel.findById(channelId)
      .populate('members', '_id name profilePicture email')
      .populate('owner', '_id name profilePicture');

    if (!channel) {
      return res.status(404).json({ success: false, message: "Channel not found" });
    }

    res.status(200).json({
      success: true,
      data: {
        _id: channel._id,
        name: channel.name,
        description: channel.description,
        channelImage: channel.channelImage,
        details: channel.details,
        tags: channel.tags,
        customTags: channel.customTags,
        members: channel.members,
        owner: channel.owner,
        memberCount: channel.members.length,
        createdAt: channel.createdAt,
      },
    });
  } catch (error) {
    console.error("Error fetching channel details:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Update channel tags
const updateChannelTags = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { tags, customTags } = req.body;
    const userId = req.user.userId;

    // Find channel
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ success: false, message: "Channel not found" });
    }

    // Check if user is channel owner
    if (channel.owner.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: "Only channel owner can update tags" 
      });
    }

    // Validate predefined status tag
    const validStatuses = ['Active', 'Archived', 'Inactive'];
    if (tags && !tags.every(tag => validStatuses.includes(tag))) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid status tag. Must be: Active, Archived, or Inactive" 
      });
    }

    // Validate custom tags (max 2 in addition to status)
    if (customTags && customTags.length > 2) {
      return res.status(400).json({ 
        success: false, 
        message: "Maximum 2 custom tags allowed" 
      });
    }

    // Update tags
    if (tags) channel.tags = tags;
    if (customTags) channel.customTags = customTags;

    await channel.save();

    // Emit update to all channel members
    const io = getIo();
    io.to(channelId).emit("channel-tags-updated", {
      channelId,
      tags: channel.tags,
      customTags: channel.customTags,
    });

    res.status(200).json({
      success: true,
      message: "Channel tags updated successfully",
      data: {
        tags: channel.tags,
        customTags: channel.customTags,
      },
    });
  } catch (error) {
    console.error("Error updating channel tags:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Upload channel image
const uploadChannelImage = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user.userId;

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: "No file provided" 
      });
    }

    // Find channel
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ success: false, message: "Channel not found" });
    }

    // Check if user is channel owner
    if (channel.owner.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: "Only channel owner can update channel image" 
      });
    }

    // Create file path
    const fileUrl = `/channel-images/${channelId}/${req.file.filename}`;

    // Delete old image if exists
    if (channel.channelImage) {
      const oldFilePath = path.join(__dirname, '..', 'uploads', channel.channelImage);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Update channel with new image
    channel.channelImage = fileUrl;
    await channel.save();

    // Emit update to all channel members
    const io = getIo();
    io.to(channelId).emit("channel-image-updated", {
      channelId,
      channelImage: fileUrl,
    });

    res.status(200).json({
      success: true,
      message: "Channel image updated successfully",
      data: {
        channelId,
        channelImage: fileUrl,
      },
    });
  } catch (error) {
    console.error("Error uploading channel image:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Delete channel image
const deleteChannelImage = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user.userId;

    // Find channel
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ success: false, message: "Channel not found" });
    }

    // Check if user is channel owner
    if (channel.owner.toString() !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: "Only channel owner can delete channel image" 
      });
    }

    if (!channel.channelImage) {
      return res.status(400).json({ 
        success: false, 
        message: "No channel image to delete" 
      });
    }

    // Delete file from storage
    const filePath = path.join(__dirname, '..', 'uploads', channel.channelImage);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Update channel
    channel.channelImage = null;
    await channel.save();

    // Emit update to all channel members
    const io = getIo();
    io.to(channelId).emit("channel-image-deleted", {
      channelId,
    });

    res.status(200).json({
      success: true,
      message: "Channel image deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting channel image:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Remove member from channel when deleted
const removeMemberFromChannel = async (req, res) => {
  try {
    const { channelId, memberId } = req.params;

    // Find channel
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ success: false, message: "Channel not found" });
    }

    // Remove member
    channel.members = channel.members.filter(id => id.toString() !== memberId);
    await channel.save();

    // Emit update to all channel members
    const io = getIo();
    io.to(channelId).emit("member-removed", {
      channelId,
      removedMemberId: memberId,
    });

    res.status(200).json({
      success: true,
      message: "Member removed from channel successfully",
    });
  } catch (error) {
    console.error("Error removing member:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  updateChannelDetails,
  getChannelDetails,
  updateChannelTags,
  uploadChannelImage,
  deleteChannelImage,
  removeMemberFromChannel,
};
