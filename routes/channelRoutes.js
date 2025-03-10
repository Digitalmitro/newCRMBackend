const express = require("express");
const router = express.Router();
const channelController = require("../controllers/channelController");
const {authMiddleware} = require("../middlewares/authMiddleware")

// API Endpoints
router.post("/create",authMiddleware, channelController.createChannel);
router.get("/all", authMiddleware,channelController.getAllChannels);
router.get("/:id", channelController.getChannelById);
router.delete("/:id", channelController.deleteChannel);

//inviate
router.get("/invite/:channelId", channelController.getInviteLink);
router.post("/invite", channelController.inviteByEmail);
router.get("/join/:inviteLink", channelController.joinChannel);

module.exports = router;
