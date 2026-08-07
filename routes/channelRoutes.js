const express = require("express");
const router = express.Router();
const channelController = require("../controllers/channelController");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");
const { upload } = require("../utils/fileUpload");

// API Endpoints
router.post("/create", authMiddleware, requirePermission("channel", "create"), channelController.createChannel);
router.get("/all", authMiddleware, channelController.getAllChannels);

// Tag option metadata (must come before /:id) — feature #8
router.get("/tags/options", channelController.getTagOptions);

router.get("/:id", channelController.getChannelById);
router.delete("/:id", authMiddleware, requirePermission("channel", "delete"), channelController.deleteChannel);
router.put("/:id", authMiddleware, requirePermission("channel", "edit"), channelController.updateChannel);
router.post("/:id/remove-member", authMiddleware, requirePermission("channel", "edit"), channelController.removeMember);

// Channel image upload — feature #13
router.post(
  "/:id/image",
  authMiddleware,
  requirePermission("channel", "edit"),
  upload.single("image"),
  channelController.uploadChannelImage
);

// Invites
router.get("/invite/:channelId", channelController.getInviteLink);
router.post("/invite", channelController.inviteByEmail); // single (legacy)
router.post(
  "/invite-multiple",
  authMiddleware,
  channelController.inviteByMultipleEmails
); // feature #10
router.get("/join/:inviteLink", channelController.joinChannel);

module.exports = router;
