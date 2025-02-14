const express = require("express");
const { sendChannelMessage, getChannelMessages } = require("../controllers/channelChatsController");

const router = express.Router();

// ✅ Send a message in a channel
router.post("/send", sendChannelMessage);

// ✅ Get all messages from a channel
router.get("/:channelId", getChannelMessages);

module.exports = router;
