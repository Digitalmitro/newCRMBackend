const express = require("express");
const { signup, login, createUserByAdmin } = require("../controllers/authController");
const {authMiddleware} = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/admin/create-user", authMiddleware, createUserByAdmin);

module.exports = router;
