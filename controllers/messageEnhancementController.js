const DirectMessage = require("../models/DirectMessage");
const ChannelMessage = require("../models/ChannelMessage");
const User = require("../models/User");
const Admin = require("../models/Admin");
const Client = require("../models/Client");
const { getIo, onlineUsers } = require("../utils/socket");
const sendMail = require("../services/sendMail");

// Constants
const MESSAGE_DELETE_WINDOW = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
const MESSAGE_EDIT_WINDOW = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

// Helper function to check if message can be deleted/edited
const canModifyMessage = (createdAt) => {
  const timeDiff = Date.now() - new Date(createdAt).getTime();
  return timeDiff <= MESSAGE_EDIT_WINDOW;
};

// Delete Direct Message (soft delete)
const deleteDirectMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    const message = await DirectMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    // Check if user is the sender
    if (message.sender.toString() !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized to delete this message" });
    }

    // Check if message is within 2-hour window
    if (!canModifyMessage(message.createdAt)) {
      return res.status(400).json({ success: false, message: "Cannot delete message older than 2 hours" });
    }

    // Soft delete
    message.isDeleted = true;
    message.deletedAt = new Date();
    await message.save();

    // Emit to receiver
    const io = getIo();
    const receiverSocket = onlineUsers.get(message.receiver.toString());
    if (receiverSocket) {
      io.to(receiverSocket).emit("message-deleted", { messageId });
    }

    res.status(200).json({ success: true, message: "Message deleted successfully" });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Delete Channel Message (soft delete)
const deleteChannelMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    const message = await ChannelMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    // Check if user is the sender
    if (message.sender.toString() !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized to delete this message" });
    }

    // Check if message is within 2-hour window
    if (!canModifyMessage(message.createdAt)) {
      return res.status(400).json({ success: false, message: "Cannot delete message older than 2 hours" });
    }

    // Soft delete
    message.isDeleted = true;
    message.deletedAt = new Date();
    await message.save();

    // Emit to channel
    const io = getIo();
    io.to(message.channelId.toString()).emit("message-deleted", { messageId, channelId: message.channelId });

    res.status(200).json({ success: true, message: "Message deleted successfully" });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Edit Direct Message
const editDirectMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { message: newMessage } = req.body;
    const userId = req.user.userId;

    if (!newMessage || newMessage.trim() === '') {
      return res.status(400).json({ success: false, message: "New message content is required" });
    }

    const message = await DirectMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    // Check if user is the sender
    if (message.sender.toString() !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized to edit this message" });
    }

    // Check if message is within 2-hour window
    if (!canModifyMessage(message.createdAt)) {
      return res.status(400).json({ success: false, message: "Cannot edit message older than 2 hours" });
    }

    // Store original message in edit history
    message.editHistory.push({
      originalMessage: message.message,
      editedAt: new Date(),
    });

    message.message = newMessage;
    message.editedAt = new Date();
    await message.save();

    // Emit to receiver
    const io = getIo();
    const receiverSocket = onlineUsers.get(message.receiver.toString());
    if (receiverSocket) {
      io.to(receiverSocket).emit("message-edited", { messageId, updatedMessage: message });
    }

    res.status(200).json({ success: true, message: "Message edited successfully", data: message });
  } catch (error) {
    console.error("Error editing message:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Edit Channel Message
const editChannelMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { message: newMessage } = req.body;
    const userId = req.user.userId;

    if (!newMessage || newMessage.trim() === '') {
      return res.status(400).json({ success: false, message: "New message content is required" });
    }

    const message = await ChannelMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    // Check if user is the sender
    if (message.sender.toString() !== userId) {
      return res.status(403).json({ success: false, message: "Unauthorized to edit this message" });
    }

    // Check if message is within 2-hour window
    if (!canModifyMessage(message.createdAt)) {
      return res.status(400).json({ success: false, message: "Cannot edit message older than 2 hours" });
    }

    // Store original message in edit history
    message.editHistory.push({
      originalMessage: message.message,
      editedAt: new Date(),
    });

    message.message = newMessage;
    message.editedAt = new Date();
    await message.save();

    // Emit to channel
    const io = getIo();
    io.to(message.channelId.toString()).emit("message-edited", { messageId, updatedMessage: message, channelId: message.channelId });

    res.status(200).json({ success: true, message: "Message edited successfully", data: message });
  } catch (error) {
    console.error("Error editing message:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Get Message with Edit History
const getMessageHistory = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await DirectMessage.findById(messageId).populate('mentions', 'name email');
    
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    res.status(200).json({ 
      success: true, 
      data: {
        originalMessage: message.message,
        editHistory: message.editHistory,
        editedAt: message.editedAt,
        createdAt: message.createdAt,
      }
    });
  } catch (error) {
    console.error("Error fetching message history:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Search and suggest users for @mentions in channel
const getMentionSuggestions = async (req, res) => {
  try {
    const { channelId, searchTerm } = req.query;

    if (!channelId) {
      return res.status(400).json({ success: false, message: "Channel ID is required" });
    }

    const Channel = require("../models/Channels");
    const channel = await Channel.findById(channelId).populate('members', '_id name email');

    if (!channel) {
      return res.status(404).json({ success: false, message: "Channel not found" });
    }

    let suggestions = channel.members;

    if (searchTerm) {
      suggestions = suggestions.filter(member =>
        member.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    res.status(200).json({ 
      success: true, 
      suggestions: suggestions.slice(0, 10) // Limit to 10 suggestions
    });
  } catch (error) {
    console.error("Error fetching mention suggestions:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  deleteDirectMessage,
  deleteChannelMessage,
  editDirectMessage,
  editChannelMessage,
  getMessageHistory,
  getMentionSuggestions,
};
