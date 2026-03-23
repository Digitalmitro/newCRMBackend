const express = require("express");
const {
  sendChannelMessage,
  getChannelMessages,
  markChannelMessagesAsRead,
} = require("../controllers/channelChatsController");
const {
  getChannelTasks,
  createChannelTask,
  updateChannelTask,
  deleteChannelTask,
  addTaskComment,
} = require("../controllers/channelTaskController");
const { authMiddleware } = require("../middlewares/authMiddleware");

const router = express.Router();

// ✅ Send a message in a channel
router.post("/send", sendChannelMessage);
router.post("/:channelId/read", authMiddleware, markChannelMessagesAsRead);

router.get("/:channelId/tasks", authMiddleware, getChannelTasks);
router.post("/:channelId/tasks", authMiddleware, createChannelTask);
router.patch("/:channelId/tasks/:taskId", authMiddleware, updateChannelTask);
router.delete("/:channelId/tasks/:taskId", authMiddleware, deleteChannelTask);
router.post("/:channelId/tasks/:taskId/comments", authMiddleware, addTaskComment);

// ✅ Get all messages from a channel
router.get("/:channelId", getChannelMessages);

module.exports = router;
