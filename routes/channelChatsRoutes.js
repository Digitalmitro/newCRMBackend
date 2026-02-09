const express = require("express");
const { sendChannelMessage, getChannelMessages } = require("../controllers/channelChatsController");
const {
  getChannelTasks,
  createChannelTask,
  updateChannelTask,
} = require("../controllers/channelTaskController");
const { authMiddleware } = require("../middlewares/authMiddleware");

const router = express.Router();

// ✅ Send a message in a channel
router.post("/send", sendChannelMessage);

router.get("/:channelId/tasks", authMiddleware, getChannelTasks);
router.post("/:channelId/tasks", authMiddleware, createChannelTask);
router.patch("/:channelId/tasks/:taskId", authMiddleware, updateChannelTask);

// ✅ Get all messages from a channel
router.get("/:channelId", getChannelMessages);

module.exports = router;
