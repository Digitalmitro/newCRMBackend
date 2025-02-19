const express = require("express");
const { signup, login, createUserByAdmin, getUserName,adminLogin,adminSignup, verifyAdminOtp } = require("../controllers/authController");
const {authMiddleware} = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/admin/create-user", authMiddleware, createUserByAdmin);
router.get("/all",authMiddleware, getUserName);

//for admin part
router.post("/loginadmin", adminLogin);
router.post("/registeradmin", adminSignup);
router.post("/verify-otp", verifyAdminOtp);

module.exports = router;
