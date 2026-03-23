const Channel = require("../models/Channels");
const ChannelInvite = require("../models/ChannelInvite");
const User = require("../models/User");
const Admin = require("../models/Admin");
const Client = require("../models/Client");
const ChannelMessage = require("../models/ChannelMessage");
const sendMail = require("../services/sendMail");

const normalizeMemberIds = (members = []) => [
  ...new Set(
    (Array.isArray(members) ? members : [])
      .filter(Boolean)
      .map((member) => member.toString())
      .filter(Boolean)
  ),
];

const mapResolvedMembers = (members = [], memberMap = {}) =>
  normalizeMemberIds(members)
    .map((memberId) => memberMap[memberId] || null)
    .filter(Boolean);

// Create a new channel
exports.createChannel = async (req, res) => {
  try {
    const { name, description, members } = req.body;
    const owner = req.user.userId;

    if (!name || !owner) {
      return res.status(400).json({ error: "Name and owner are required" });
    }
    const uniqueMembers = normalizeMemberIds([...(Array.isArray(members) ? members : []), owner]);
    const newChannel = new Channel({
      name,
      description,
      members: uniqueMembers,
      owner,
      inviteLink: `https://yourapp.com/invite/${Math.random().toString(36).substr(2, 8)}`,
    });

    await newChannel.save();
    res.status(201).json({ message: "Channel created successfully", channel: newChannel });
  } catch (error) {
    res.status(500).json({ error: "Server error", details: error.message });
  }
};

exports.updateChannel = async (req, res) => {
  try {
    const channelId = req.params.id;
    const { name, description, members } = req.body;
    const userId = req.user.userId;

    const channel = await Channel.findById(channelId);

    if (!channel) return res.status(404).json({ error: "Channel not found" });

    // Optional: Only allow owner to update
    if (channel.owner.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Not authorized to update this channel" });
    }

    if (name) channel.name = name;
    if (description) channel.description = description;
    if (members && Array.isArray(members)) {
      const uniqueMembers = normalizeMemberIds([...members, channel.owner?.toString()]);
      channel.members = uniqueMembers;
    }

    await channel.save();

    res.status(200).json({ message: "Channel updated successfully", channel });
  } catch (error) {
    console.error("Error updating channel:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};

// Remove a member from a channel (owner-only)
exports.removeMember = async (req, res) => {
  try {
    const channelId = req.params.id;
    const { memberId } = req.body;
    const requesterId = req.user.userId;

    if (!memberId) {
      return res.status(400).json({ error: "memberId is required" });
    }

    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    if (channel.owner?.toString() !== requesterId?.toString()) {
      return res.status(403).json({ error: "Only the channel owner can remove members" });
    }

    const normalizedMembers = normalizeMemberIds(channel.members);
    const beforeCount = normalizedMembers.length;
    channel.members = normalizedMembers.filter((m) => m !== memberId.toString());

    if (channel.members.length === beforeCount) {
      return res.status(400).json({ error: "Member not found in channel" });
    }

    await channel.save();
    res.status(200).json({ message: "Member removed successfully", channel });
  } catch (error) {
    console.error("Error removing member:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};


// Get all channels
exports.getAllChannels = async (req, res) => {
  try {
    const userId = req.user.userId;

    console.log(userId);
    

    // Find channels where the user is a member
    const channels = await Channel.find({ members: { $in: [userId] } }).lean(); // Use .lean() for better performance

    // Extract unique member IDs from all channels
    const memberIds = [...new Set(channels.flatMap((channel) => normalizeMemberIds(channel.members)))];

    // Fetch member details from dif  ferent schemas
    const users = await User.find({ _id: { $in: memberIds } }, "name email").lean();
    const admins = await Admin.find({ _id: { $in: memberIds } }, "name email").lean();
    const clients = await Client.find({ _id: { $in: memberIds } }, "name email").lean();

    // Combine all users
    const allMembers = [...users, ...admins, ...clients];

    // Convert to a lookup map for fast access
    const memberMap = {};
    allMembers.forEach((member) => {
      memberMap[member._id.toString()] = member;
    });

    // Attach full member details and unread stats to each channel
    const channelsWithMembers = await Promise.all(
      channels.map(async (channel) => {
        const [unreadMessages, lastMessage] = await Promise.all([
          ChannelMessage.countDocuments({
            channelId: channel._id,
            sender: { $ne: userId },
            seenBy: { $ne: userId },
          }),
          ChannelMessage.findOne({ channelId: channel._id })
            .sort({ createdAt: -1 })
            .select("createdAt")
            .lean(),
        ]);

        return {
          ...channel,
          members: mapResolvedMembers(channel.members, memberMap),
          unreadMessages,
          lastMessageTime: lastMessage?.createdAt || channel.createdAt || null,
        };
      })
    );

    channelsWithMembers.sort((a, b) => {
      if ((a.unreadMessages || 0) !== (b.unreadMessages || 0)) {
        return (b.unreadMessages || 0) - (a.unreadMessages || 0);
      }
      return new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0);
    });

    res.status(200).json(channelsWithMembers);
  } catch (error) {
    console.error("Error fetching channels:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};


exports.getChannelById = async (req, res) => {
  try {
    const channel = await Channel.findById(req.params.id).lean();
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    // Extract unique member IDs
    const memberIds = normalizeMemberIds(channel.members);

    // Fetch member details from different schemas
    const users = await User.find({ _id: { $in: memberIds } }, "name email").lean();
    const admins = await Admin.find({ _id: { $in: memberIds } }, "name email").lean();
    const clients = await Client.find({ _id: { $in: memberIds } }, "name email").lean();

    // Combine all members
    const allMembers = [...users, ...admins, ...clients];

    // Create a lookup map
    const memberMap = {};
    allMembers.forEach((member) => {
      memberMap[member._id.toString()] = member;
    });

    // Attach full member details to the channel
    const channelWithMembers = {
      ...channel,
      members: mapResolvedMembers(channel.members, memberMap),
    };

    res.status(200).json(channelWithMembers);
  } catch (error) {
    console.error("Error fetching channel:", error);
    res.status(500).json({ error: "Server error", details: error.message });
  }
};

// Delete a channel
exports.deleteChannel = async (req, res) => {
  try {
    const channel = await Channel.findByIdAndDelete(req.params.id);
    if (!channel) return res.status(404).json({ error: "Channel not found" });

    res.status(200).json({ message: "Channel deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Server error", details: error.message });
  }
};

// 🔹 1. Get Invite Link for a Channel
exports.getInviteLink = async (req, res) => {
  try {
    const { channelId } = req.params;
    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    res.json({ inviteLink: `/join/${channel.inviteLink}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔹 2. Send Email Invite
exports.inviteByEmail = async (req, res) => {
  try {
    const { channelId, email, invitedBy } = req.body;
    // console.log({ channelId, email, invitedBy });

    // Check if the channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) return res.status(404).json({ message: "Channel not found" });
    const user = await User.findOne({ email });
    // Generate an invite link
    const invite = new ChannelInvite({ channel: channelId, invitedBy, email });
    await invite.save();

    const inviteLink = `https://api.digitalmitro.info/api/join/${invite._id}`;
    const signupLink = `https://client.digitalmitro.info/signup`;
    // Prepare email content
    const subject = `You're invited to join ${channel.name}`;
    const text = user
      ? `Hello,

You have been invited to join the channel "${channel.name}". 
Click the link below to accept the invitation:

${inviteLink}

Best regards,
Digital Mitro Team`
      : `Hello,

You have been invited to join the channel "${channel.name}". However, it looks like you don't have an account yet.

Please sign up first by clicking the link below:

${signupLink}

After signing up, return to this email and click the invitation link to join the channel:

${inviteLink}

Best regards,  
Digital Mitro Team`;
    // Send email
    await sendMail(email, subject, text);

    res.json({ message: "Invite sent successfully", inviteLink });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", details: err.message });
  }
};

// 🔹 3. Accept Invite & Join Channel
exports.joinChannel = async (req, res) => {
  try {
    const { inviteLink } = req.params;
    if (!inviteLink) return res.status(401).json({ message: " missing params" })
    // Check if invite exists
    const invite = await ChannelInvite.findById({ _id: inviteLink });
    if (!invite) return res.status(404).json({ message: "Invalid or expired invite link" });

    // Check if user exists with the invited email
    const user = await User.findOne({ email: invite.email });
    const client = await Client.findOne({ email: invite.email })
    // if (!user && !client) return res.status(400).json({ message: "User not found or don't have account" });
    if (!user && !client) {
      return res.status(302).redirect("https://client.digitalmitro.info/signup");
    }
    // Find the channel
    const channel = await Channel.findById({ _id: invite.channel });
    if (!channel) return res.status(404).json({ message: "Channel not found" });

    // Determine the entity to add (user or client)
    const memberId = user ? user?._id : client?._id;

    // Add user/client to the channel if they are not already a member
    const normalizedMembers = normalizeMemberIds(channel.members);
    if (!normalizedMembers.includes(memberId.toString())) {
      channel.members.push(memberId);
      await channel.save();
    }
    // Mark invite as accepted
    invite.status = "accepted";
    await invite.save();
    const redirectUrl = client?.email === invite.email
      ? "https://client.digitalmitro.info"
      : "https://digitalmitro.info";

    // Redirect user to the appropriate URL
    res.status(302).redirect(redirectUrl);
    // res.status(200).json({ message: "Successfully joined the channel", channel });
  } catch (err) {
    console.error("Error in joinChannel:", err);
    res.status(500).json({ message: "Server error", details: err.message });
  }
};
