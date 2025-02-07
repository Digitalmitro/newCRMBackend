// routes/attendanceRoutes.js
const express = require("express");
const router = express.Router();
const { punchIn, punchOut, updateLeaveStatus,handlePunch, getUserAttendance,getAllAttendance } = require("../controllers/attendanceController");
const {authMiddleware} = require("../middlewares/authMiddleware");

router.post("/punch-in", authMiddleware, punchIn);
router.post("/punch-out", authMiddleware, punchOut);
router.post("/punch", authMiddleware, handlePunch);
router.post("/leave-status", authMiddleware, updateLeaveStatus);
router.get("/user",authMiddleware, getUserAttendance);
router.get("/admin", getAllAttendance)

module.exports = router;
