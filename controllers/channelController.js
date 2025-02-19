const Channel = require("../models/Channels");
const ChannelInvite = require("../models/ChannelInvite");
const User=require("../models/User")
// Create a new channel
exports.createChannel = async (req, res) => {
    try {
        const { name, description, members} = req.body;
        const owner = req.user.userId;

        if (!name || !owner) {
            return res.status(400).json({ error: "Name and owner are required" });
        }

        const newChannel = new Channel({
            name,
            description,
            members,
            owner,
            inviteLink: `https://yourapp.com/invite/${Math.random().toString(36).substr(2, 8)}`,
        });

        await newChannel.save();
        res.status(201).json({ message: "Channel created successfully", channel: newChannel });
    } catch (error) {
        res.status(500).json({ error: "Server error", details: error.message });
    }
};

// Get all channels
exports.getAllChannels = async (req, res) => {
    try {
        const channels = await Channel.find().populate("members owner", "name email");
        res.status(200).json(channels);
    } catch (error) {
        res.status(500).json({ error: "Server error", details: error.message });
    }
};

// Get a single channel by ID
exports.getChannelById = async (req, res) => {
    try {
        const channel = await Channel.findById(req.params.id).populate("members owner", "name email");
        if (!channel) return res.status(404).json({ error: "Channel not found" });

        res.status(200).json(channel);
    } catch (error) {
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
      console.log({ channelId, email, invitedBy })
  
      const channel = await Channel.findById(channelId);
      if (!channel) return res.status(404).json({ message: "Channel not found" });
  
      const invite = new ChannelInvite({ channel: channelId, invitedBy, email });                                         
      await invite.save();
  
      // Send email (replace with actual email service)
      // await sendEmailInvite(email, `/join/${invite.inviteLink}`);
  
      res.json({ message: "Invite sent successfully" });

    } catch (err) {
      res.status(500).json({ message: err.message });
      console.error(err)
    }
  };
  
  // 🔹 3. Accept Invite & Join Channel
  exports.joinChannel = async (req, res) => {
    try {
      const { inviteLink } = req.params;
      const invite = await ChannelInvite.findOne({ inviteLink });
  
      if (!invite) return res.status(404).json({ message: "Invalid invite link" });
  
      // Find user by email
      const user = await User.findOne({ email: invite.email });
      if (!user) return res.status(400).json({ message: "User not found" });
  
      const channel = await Channel.findById(invite.channel);
      if (!channel) return res.status(404).json({ message: "Channel not found" });
  
      // Add user to channel if not already added
      if (!channel.members.includes(user._id)) {
        channel.members.push(user._id);
        await channel.save();
      }
  
      // Mark invite as accepted
      invite.status = "accepted";
      await invite.save();
  
      res.json({ message: "Successfully joined the channel", channel });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };