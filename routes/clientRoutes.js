const express = require("express");
const { login, signUp, forgotPassword, resetPassword } = require("../controllers/clientController");
const router = express.Router();
router.post("/login", login);
router.post("/signup", signUp);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
module.exports = router;
