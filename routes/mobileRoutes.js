const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/mobileController");

// ── Public ──────────────────────────────────────────────────────────────────
// POST /mobile/login — unified login (employee / admin / client)
router.post("/login", ctrl.mobileLogin);

// ── Authenticated ────────────────────────────────────────────────────────────
// FCM device token
router.post("/fcm-token",   authMiddleware, ctrl.registerFcmToken);
router.delete("/fcm-token", authMiddleware, ctrl.clearFcmToken);

// Profile
router.get("/profile", authMiddleware, ctrl.getMobileProfile);

// Home screen dashboard (single API call)
router.get("/dashboard", authMiddleware, ctrl.getMobileDashboard);

// Channels with unread counts
router.get("/channels", authMiddleware, ctrl.getMobileChannels);

// DM conversations list with unread counts
router.get("/dms", authMiddleware, ctrl.getMobileDMs);

// Socket.io event reference
router.get("/socket-info", ctrl.getSocketInfo);

module.exports = router;
