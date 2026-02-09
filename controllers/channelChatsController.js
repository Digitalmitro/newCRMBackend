const ChannelMessage = require("../models/ChannelMessage");
const Channel = require("../models/Channels");
const User = require("../models/User");
const Admin = require("../models/Admin");
const Client = require("../models/Client");
const mongoose = require("mongoose");
const { getIo, onlineUsers } = require("../utils/socket");
const sendMail = require("../services/sendMail");

const resolveUserEntity = async (id) => {
  if (!id) return null;
  return (
    (await User.findById(id)) ||
    (await Admin.findById(id)) ||
    (await Client.findById(id))
  );
};

const isImageUrl = (value = "") => /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(value);
const isVideoUrl = (value = "") => /\.(mp4|webm|ogg|mov|mkv)$/i.test(value);
const isAudioUrl = (value = "") => /\.(mp3|wav|ogg|m4a|aac)$/i.test(value);
const isPdfUrl = (value = "") => /\.pdf$/i.test(value);
const isDocumentUrl = (value = "") => /\.(pdf|docx|doc|xlsx|xls|pptx|ppt|csv|txt|zip|rar)$/i.test(value);
const safeDecode = (value = "") => {
  try {
    return decodeURIComponent(value);
  } catch (error) {
    return value;
  }
};
const getFileNameFromUrl = (value = "") => {
  if (!value) return "file";
  try {
    const url = new URL(value);
    return safeDecode(url.pathname.split("/").pop() || "file");
  } catch (error) {
    const name = value.split("/").pop() || "file";
    return safeDecode(name.split("?")[0]);
  }
};
const buildReplyPreview = (value = "") => {
  if (!value) return "";
  if (value.startsWith("http")) {
    if (isImageUrl(value)) return "Photo";
    if (isVideoUrl(value)) return `Video: ${getFileNameFromUrl(value)}`;
    if (isAudioUrl(value)) return `Audio: ${getFileNameFromUrl(value)}`;
    if (isPdfUrl(value)) return `PDF: ${getFileNameFromUrl(value)}`;
    if (isDocumentUrl(value)) return `Document: ${getFileNameFromUrl(value)}`;
    return "Link";
  }
  return value.length > 80 ? `${value.slice(0, 80)}...` : value;
};

// Send a new message in a channel
const sendChannelMessage = async (req, res) => {
  try {
    const { sender, channelId, message, replyTo } = req.body;

    if (!sender || !channelId || !message) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    let replyMeta;
    if (replyTo) {
      if (!mongoose.Types.ObjectId.isValid(replyTo)) {
        return res.status(400).json({ success: false, message: "Invalid replyTo message." });
      }
      const replyDoc = await ChannelMessage.findOne({ _id: replyTo, channelId });
      if (!replyDoc) {
        return res.status(400).json({ success: false, message: "Reply target not found." });
      }
      const replySender = await resolveUserEntity(replyDoc.sender);
      const replySenderName = replyDoc.isSystem
        ? replyDoc.systemLabel || "System"
        : replySender?.name || "User";
      replyMeta = {
        replyTo: replyDoc._id,
        replyPreview: {
          message: buildReplyPreview(replyDoc.message),
          sender: replyDoc.sender,
          senderName: replySenderName,
        },
      };
    }

    const newMessage = new ChannelMessage({
      sender,
      channelId,
      message,
      ...(replyMeta || {}),
    });
    await newMessage.save();

    const channel = await Channel.findById(channelId);
    const channelName = channel ? channel.name : "Unknown Channel";
    const io = getIo();
    const senderEntity = await resolveUserEntity(sender);
    const senderName = senderEntity?.name || "Unknown Sender";

    io.to(channelId).emit("new-channel-message", newMessage);
    io.to(channelId).emit("receive-notification", {
      title: channelName,
      sender: channelId,
      description: `You have a new message in channel ${channelName}`,
      timestamp: new Date(),
    });

    if (channel?.members?.length) {
      const memberIds = channel.members.map((id) => id?.toString());
      const uniqueMembers = [...new Set(memberIds)];

      const offlineRecipients = uniqueMembers.filter(
        (memberId) => memberId && memberId !== sender?.toString() && !onlineUsers.get(memberId)
      );

      await Promise.all(
        offlineRecipients.map(async (memberId) => {
          const member = await resolveUserEntity(memberId);
          if (!member?.email) return;
          await sendMail(
            member.email,
            `New message in ${channelName}`,
            `${senderName} sent a message in ${channelName}: ${message}`
          );
        })
      );
    }

    res.status(200).json({ success: true, message: "Message sent successfully.", data: newMessage });
  } catch (error) {
    console.error("Error sending channel message:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Retrieve messages from a channel
const getChannelMessages = async (req, res) => {
  try {
    const { channelId } = req.params;

    if (!channelId) {
      return res.status(400).json({ success: false, message: "Channel ID is required." });
    }

    const messages = await ChannelMessage.find({ channelId }).sort({ createdAt: 1 });

    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error("Error fetching channel messages:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = { sendChannelMessage, getChannelMessages };
