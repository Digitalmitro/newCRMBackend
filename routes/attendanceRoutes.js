// routes/attendanceRoutes.js
const express = require("express");
const router = express.Router();
const { punchIn, punchOut, updateLeaveStatus,handlePunch } = require("../controllers/attendanceController");
const {authMiddleware} = require("../middlewares/authMiddleware");

router.post("/punch-in", authMiddleware, punchIn);
router.post("/punch-out", authMiddleware, punchOut);
router.post("/punch", authMiddleware, handlePunch);
router.post("/leave-status", authMiddleware, updateLeaveStatus);

module.exports = router;
