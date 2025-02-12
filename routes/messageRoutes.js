// routes/messageRoutes.js
const express = require("express");
const { sendMessage, getMessages } = require("../controllers/messageController");

const router = express.Router();

router.post("/send-message", sendMessage);
router.get("/messages/:sender/:receiver", getMessages);

module.exports = router;
