// routes/messageRoutes.js
const express = require("express");
const {authMiddleware} = require("../middlewares/authMiddleware")
const { sendMessage, getMessages, getRecentChatUsers } = require("../controllers/messageController");

const router = express.Router();

router.post("/send-message", sendMessage);
router.get("/messages/:sender/:receiver", getMessages);
router.get("/recentChats",authMiddleware, getRecentChatUsers)


module.exports = router;
