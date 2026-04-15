const User = require("../models/User");
const Admin = require("../models/Admin");
const Client = require("../models/Client");
const path = require("path");
const fs = require("fs");

// Upload profile picture for any user type
const uploadProfilePicture = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userType = req.body.userType; // 'user', 'admin', or 'client'

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: "No file provided" 
      });
    }

    if (!userType || !['user', 'admin', 'client'].includes(userType)) {
      return res.status(400).json({ 
        success: false, 
        message: "Valid userType (user, admin, or client) is required" 
      });
    }

    // Create file path
    const fileUrl = `/profile-pictures/${userType}/${userId}/${req.file.filename}`;

    // Find user in appropriate model
    let user;
    if (userType === 'user') {
      user = await User.findById(userId);
    } else if (userType === 'admin') {
      user = await Admin.findById(userId);
    } else if (userType === 'client') {
      user = await Client.findById(userId);
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Delete old profile picture if exists
    if (user.profilePicture) {
      const oldFilePath = path.join(__dirname, '..', 'uploads', user.profilePicture);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Update user with new profile picture
    user.profilePicture = fileUrl;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile picture uploaded successfully",
      data: {
        userId,
        profilePicture: fileUrl,
      },
    });
  } catch (error) {
    console.error("Error uploading profile picture:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Get profile picture URL
const getProfilePicture = async (req, res) => {
  try {
    const { userId, userType } = req.query;

    if (!userId || !userType || !['user', 'admin', 'client'].includes(userType)) {
      return res.status(400).json({ 
        success: false, 
        message: "Valid userId and userType are required" 
      });
    }

    let user;
    if (userType === 'user') {
      user = await User.findById(userId);
    } else if (userType === 'admin') {
      user = await Admin.findById(userId);
    } else if (userType === 'client') {
      user = await Client.findById(userId);
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      data: {
        userId,
        name: user.name,
        profilePicture: user.profilePicture,
      },
    });
  } catch (error) {
    console.error("Error fetching profile picture:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Delete profile picture
const deleteProfilePicture = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { userType } = req.body;

    if (!userType || !['user', 'admin', 'client'].includes(userType)) {
      return res.status(400).json({ 
        success: false, 
        message: "Valid userType (user, admin, or client) is required" 
      });
    }

    let user;
    if (userType === 'user') {
      user = await User.findById(userId);
    } else if (userType === 'admin') {
      user = await Admin.findById(userId);
    } else if (userType === 'client') {
      user = await Client.findById(userId);
    }

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.profilePicture) {
      return res.status(400).json({ 
        success: false, 
        message: "No profile picture to delete" 
      });
    }

    // Delete file from storage
    const filePath = path.join(__dirname, '..', 'uploads', user.profilePicture);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Update user
    user.profilePicture = null;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile picture deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting profile picture:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  uploadProfilePicture,
  getProfilePicture,
  deleteProfilePicture,
};
