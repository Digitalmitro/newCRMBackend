const Client = require("../models/Client");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");
const sendMail = require("../services/sendMail");

const OTP_EXPIRATION_TIME = 5 * 60 * 1000; // 5 minutes — matches Admin's login OTP

const generateToken = (userId, name) => {
  return jwt.sign({ userId, name }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

exports.signUp = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res
        .status(422)
        .json({ message: "Name, email, and password are all required." });
    }

    const existing = await Client.findOne({ email });
    if (existing) {
      return res
        .status(409)
        .json({ message: "An account with this email already exists." });
    }

    const client = new Client({ name, email, password });
    await client.save();
    res.status(201).json({ message: "client account created" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "User creation failed", error: error.message });
    console.log(error);
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await Client.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "invalid credential" });
    }
    // Bug fix: this result was previously computed but never checked, so
    // any password would succeed as long as the email existed.
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "invalid credential" });
    }
    const token = generateToken(user._id, user.name);
    res.status(200).json({ message: "login sucessful", token });
  } catch (error) {
    res.status(200).json({ message: "login failed", error: error.message });
  }
};

// ---- Forgot password (OTP via email) ----
// Same pattern as Admin's login OTP in authController.js: generate a 6-digit
// code, store it with a 5-minute expiration, email it. Resend is just this
// same endpoint called again — the 30s cooldown between taps is a frontend
// concern, not something the backend needs to separately track.
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(422).json({ success: false, message: "Email is required." });
    }

    const client = await Client.findOne({ email });
    if (!client) {
      // Don't reveal whether the email exists — same response either way.
      return res.status(200).json({
        success: true,
        message: "If an account exists for this email, an OTP has been sent.",
      });
    }

    const otp = otpGenerator.generate(6, { upperCase: false, specialChars: false });
    client.otp = otp;
    client.otpExpiration = new Date(Date.now() + OTP_EXPIRATION_TIME);
    await client.save();

    console.log(`[DEV] Client password-reset OTP for ${client.email}: ${otp}`);
    const mailSent = await sendMail(
      client.email,
      "Password reset OTP — Digital Mitro CRM",
      otp,
      "otp",
      "client"
    ).catch(() => ({ success: false }));

    if (mailSent?.success === false) {
      return res.status(500).json({ success: false, message: "Failed to send OTP email." });
    }
    res.status(200).json({
      success: true,
      message: "If an account exists for this email, an OTP has been sent.",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ---- Reset password (verify OTP + set new password in one step) ----
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res
        .status(422)
        .json({ success: false, message: "Email, OTP, and new password are all required." });
    }
    if (String(newPassword).length < 6) {
      return res
        .status(422)
        .json({ success: false, message: "Password must be at least 6 characters." });
    }

    const client = await Client.findOne({ email });
    if (!client || !client.otp || !client.otpExpiration) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP." });
    }

    const isValid = client.otp === otp && new Date() < client.otpExpiration;
    if (!isValid) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP." });
    }

    // Plain-text assignment is intentional — Client's pre("save") hook
    // hashes it automatically; hashing it here too would double-hash it.
    client.password = newPassword;
    client.otp = null;
    client.otpExpiration = null;
    await client.save();

    res.status(200).json({ success: true, message: "Password reset successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
