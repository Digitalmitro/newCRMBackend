const express = require("express");
const router = express.Router();
const channelController = require("../controllers/channelController");
const {authMiddleware} = require("../middlewares/authMiddleware")

// API Endpoints
router.post("/create",authMiddleware, channelController.createChannel);
router.get("/all", channelController.getAllChannels);
router.get("/:id", channelController.getChannelById);
router.delete("/:id", channelController.deleteChannel);

module.exports = router;
