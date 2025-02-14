const Channel = require("../models/Channels");

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
