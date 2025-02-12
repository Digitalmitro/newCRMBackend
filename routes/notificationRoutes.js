// routes/notificationRoutes.js
const express = require("express");
const { sendNotification,getNotification } = require("../controllers/notificationController");

const router = express.Router();

router.post("/send-notification", sendNotification);
router.get("/get-notifications",getNotification)

module.exports = router;
