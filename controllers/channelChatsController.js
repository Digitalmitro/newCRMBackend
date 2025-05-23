const ChannelMessage = require("../models/ChannelMessage");
const Channel = require("../models/Channels")
const User = require("../models/User")
const { getIo } = require("../utils/socket");

// ✅ Send a new message in a channel
const sendChannelMessage = async (req, res) => {
  try {
    const { sender, channelId, message } = req.body;

    if (!sender || !channelId || !message) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    // ✅ Save message to database
    const newMessage = new ChannelMessage({ sender, channelId, message });
    await newMessage.save();
    // ✅ Fetch Channel Name  
    const channel = await Channel.findById(channelId);
    const channelName = channel ? channel.name : "Unknown Channel";
    const io = getIo(); // Get the initialized Socket.io instance

    // ✅ Emit the message to all users in the channel
    io.to(channelId).emit("new-channel-message", newMessage);
    // console.log(`✅ Message sent to channel: ${channelId}`);
    io.to(channelId).emit("receive-notification", {
      title: channelName,
      sender:channelId,
      description: `You have a new message in channel ${channelName}`,
      timestamp: new Date(),
    });

    res.status(200).json({ success: true, message: "Message sent successfully.", data: newMessage });
  } catch (error) {
    console.error("❌ Error sending channel message:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// ✅ Retrieve messages from a channel
const getChannelMessages = async (req, res) => {
  try {
    const { channelId } = req.params;

    if (!channelId) {
      return res.status(400).json({ success: false, message: "Channel ID is required." });
    }

    // ✅ Fetch messages from the channel
    const messages = await ChannelMessage.find({ channelId }).sort({ createdAt: 1 });

    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error("❌ Error fetching channel messages:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = { sendChannelMessage, getChannelMessages };
