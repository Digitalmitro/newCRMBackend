const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

 
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
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

    // Only admin can create users
    const admin = await User.findById(req.user.userId);
    if (admin.type !== "admin") return res.status(403).json({ message: "Access denied" });

    const user = new User({ name, email, phone, password, type });
    await user.save();

    res.status(201).json({ message: "User created by admin" });
  } catch (error) {
    res.status(500).json({ message: "User creation failed", error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: "Invalid email or password" });

    const token = generateToken(user._id);
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
