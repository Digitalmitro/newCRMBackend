const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const CallBack = require("../models/CallBack");
const Sale = require("../models/Sale");
const Transfer = require("../models/Transfer");
const {RegisteradminModal} = require('../models/Admin')
const otpGenerator = require("otp-generator");
const sendMail = require("../services/sendMail")
const OTP_EXPIRATION_TIME = 5 * 60 * 1000;
 
const generateToken = (userId, name) => {
  return jwt.sign({ userId, name }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

exports.signup = async (req, res) => {
  try {
    const { name, email, phone, password, type } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email already in use" });

    const user = new User({ name, email, phone, password, type });
    await user.save();

    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    res.status(500).json({ message: "Signup failed", error: error.message });
  }
};

exports.createUserByAdmin = async (req, res) => {
  try {
    const { name, email, phone, password, type } = req.body;
    console.log({ name, email, phone, password, type })
    // Only admin can create users
    // const admin = await RegisteradminModal.findById(req.user._id);
    // if (admin.type !== "Admin") return res.status(403).json({ message: "Access denied" });

    const user = new User({ name, email, phone, password, type });
    await user.save();

    res.status(201).json({ message: "User created by admin" });
  } catch (error) {
    res.status(500).json({ message: "User creation failed", error: error.message });
    console.log(error)
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid email or password" });

    const token = generateToken(user._id, user.name);
    res.status(200).json({ message: "Login successful", token, userType: user.type });
  } catch (error) {
    res.status(500).json({ message: "Login failed", error: error.message });
  }
};

exports.getUserName = async (req,res) =>{
  try {
    const users = await User.find({}, "name _id");
    res.status(200).json({ success: true, users });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

// Admin Signup
exports.adminSignup = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    // Check if admin already exists
    const existingAdmin = await RegisteradminModal.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new admin
    const newAdmin = new RegisteradminModal({
      name,
      email,
      phone,
      password: hashedPassword,
    });

    await newAdmin.save();

    res.status(201).json({ message: "Admin registered successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Admin Login
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(422)
        .json({ message: "Please fill all the fields.", success: false });
    }

    const adminFound = await RegisteradminModal.findOne({ email });

    if (!adminFound) {
      return res.status(422).json({ message: "Admin Not Found!", success: false });
    }

    const passCheck = await bcrypt.compare(password, adminFound.password);
    if (!passCheck) {
      return res
        .status(400)
        .json({ message: "Invalid login credentials", success: false });
    }

    // Generate 6-digit OTP
    const otp = otpGenerator.generate(6, { upperCase: false, specialChars: false });
    const otpExpiration = new Date(Date.now() + OTP_EXPIRATION_TIME);

    // Save OTP and expiration time
    adminFound.otp = otp;
    adminFound.otpExpiration = otpExpiration;
    await adminFound.save();

    // Send OTP email
    const emailBody = `Your OTP for login is: ${otp}\n\nThis OTP is valid for 5 minutes.`;
    const mailSent = await sendMail(adminFound.email, "Your OTP for Admin Login", emailBody);


    if (mailSent) {
      return res.status(200).json({
        message: "OTP sent to email. Please check your email to complete login.",
        success: true,
      });
    } else {
      return res
        .status(500)
        .json({ message: "Failed to send OTP email", success: false });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", success: false });
  }
};

exports.verifyAdminOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res
        .status(422)
        .json({ message: "Please provide both email and OTP", success: false });
    }

    const adminFound = await RegisteradminModal.findOne({ email });

    if (!adminFound) {
      return res.status(404).json({ message: "Admin Not Found!", success: false });
    }

    const currentTime = new Date();

    // Check if OTP is correct and not expired
    if (adminFound.otp === otp && currentTime < adminFound.otpExpiration) {
      const token = await adminFound.generateAuthToken();

      // Clear OTP and expiration after successful verification
      adminFound.otp = null;
      adminFound.otpExpiration = null;
      await adminFound.save();

      return res.status(200).json({
        message: "OTP verified successfully, login complete.",
        token,
        user: {
          name: adminFound.name,
          email: adminFound.email,
          phone: adminFound.phone,
          _id: adminFound._id,
        },
        success: true,
      });
    } else {
      return res.status(400).json({ message: "Invalid or expired OTP", success: false });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", success: false });
  }
};

//admin use api
// 🔹 1. Get All Users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password"); // Exclude password

    // Get user IDs
    const userIds = users.map(user => user._id);

    // Count documents for each user ID
    const callBackCounts = await CallBack.aggregate([
      { $match: { user_id: { $in: userIds } } },
      { $group: { _id: "$user_id", count: { $sum: 1 } } }
    ]);

    const saleCounts = await Sale.aggregate([
      { $match: { user_id: { $in: userIds } } },
      { $group: { _id: "$user_id", count: { $sum: 1 } } }
    ]);

    const transferCounts = await Transfer.aggregate([
      { $match: { user_id: { $in: userIds } } },
      { $group: { _id: "$user_id", count: { $sum: 1 } } }
    ]);

    // Convert counts to a map for easy lookup
    const getCountMap = (counts) => {
      return counts.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {});
    };

    const callBackMap = getCountMap(callBackCounts);
    const saleMap = getCountMap(saleCounts);
    const transferMap = getCountMap(transferCounts);

    // Add counts to user data
    const usersWithCounts = users.map(user => ({
      ...user.toObject(),
      callBackCount: callBackMap[user._id] || 0,
      saleCount: saleMap[user._id] || 0,
      transferCount: transferMap[user._id] || 0
    }));

    res.json(usersWithCounts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


// 🔹 2. Get Single User by ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔹 3. Update User
exports.updateUser = async (req, res) => {
  try {
    const { name, email, phone, type } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ message: "User not found" });

    user.name = name || user.name;
    user.email = email || user.email;
    user.phone = phone || user.phone;
    user.type = type || user.type;

    const updatedUser = await user.save();
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 🔹 4. Delete User
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    await user.deleteOne();
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};