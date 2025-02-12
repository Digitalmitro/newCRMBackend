// routes/notificationRoutes.js
const express = require("express");
const { sendNotification,getNotification } = require("../controllers/notificationController");
const {authMiddleware} =require("../middlewares/authMiddleware")
const router = express.Router();

router.post("/send-notification",  sendNotification);
router.get("/get-notifications", authMiddleware,getNotification)

module.exports = router;
