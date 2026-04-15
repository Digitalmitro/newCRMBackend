const User = require("../models/User");
const Channel = require("../models/Channels");
const DirectMessage = require("../models/DirectMessage");
const ChannelMessage = require("../models/ChannelMessage");
const Payslip = require("../models/Payslip");
const { getIo } = require("../utils/socket");

// Delete employee and remove access
const deleteEmployeeAndRemoveAccess = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const adminId = req.user.userId;

    // Validate employee exists
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // Get all channels the employee is member of
    const channels = await Channel.find({
      members: { $in: [employeeId] },
    });

    // Remove employee from all channels
    for (const channel of channels) {
      channel.members = channel.members.filter(id => id.toString() !== employeeId);
      await channel.save();

      // Emit notification to channel members
      const io = getIo();
      io.to(channel._id.toString()).emit("member-removed", {
        channelId: channel._id,
        removedMemberId: employeeId,
        removedUserName: employee.name,
        reason: "Employee account deleted",
      });
    }

    // Note: Messages are NOT deleted, they remain with the employee's name
    // This preserves conversation history

    // Delete profile picture if exists
    if (employee.profilePicture) {
      const path = require("path");
      const fs = require("fs");
      const filePath = path.join(__dirname, '..', 'uploads', employee.profilePicture);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Delete payslips (optional - depends on company policy)
    // const payslips = await Payslip.deleteMany({ employeeId });

    // Delete the employee
    await User.findByIdAndDelete(employeeId);

    res.status(200).json({
      success: true,
      message: "Employee deleted successfully and removed from all channels",
      data: {
        deletedEmployeeId: employeeId,
        deletedEmployeeName: employee.name,
        removedFromChannels: channels.length,
        channelsRemoved: channels.map(c => c.name),
        messagesPreserved: true,
      },
    });
  } catch (error) {
    console.error("Error deleting employee:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Soft delete (deactivate) employee instead of hard delete
const deactivateEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Add isActive field to user if needed
    const employee = await User.findByIdAndUpdate(
      employeeId,
      { isActive: false, deactivatedAt: new Date() },
      { new: true }
    );

    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    res.status(200).json({
      success: true,
      message: "Employee deactivated successfully",
      data: employee,
    });
  } catch (error) {
    console.error("Error deactivating employee:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Get employee activity summary
const getEmployeeActivitySummary = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // Get channels
    const channels = await Channel.find({
      members: { $in: [employeeId] },
    }).select('name _id');

    // Count messages
    const directMessageCount = await DirectMessage.countDocuments({
      $or: [
        { sender: employeeId },
        { receiver: employeeId },
      ],
    });

    const channelMessageCount = await ChannelMessage.countDocuments({
      sender: employeeId,
    });

    // Get payslips
    const payslips = await Payslip.find({ employeeId }).select('month year _id');

    res.status(200).json({
      success: true,
      data: {
        employee: {
          id: employee._id,
          name: employee.name,
          email: employee.email,
          createdAt: employee.createdAt,
        },
        activity: {
          channelCount: channels.length,
          channels: channels,
          directMessageCount,
          channelMessageCount,
          totalMessages: directMessageCount + channelMessageCount,
          payslipCount: payslips.length,
          payslips: payslips,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching employee summary:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Reactivate employee
const reactivateEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;

    const employee = await User.findByIdAndUpdate(
      employeeId,
      { isActive: true, deactivatedAt: null },
      { new: true }
    );

    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    res.status(200).json({
      success: true,
      message: "Employee reactivated successfully",
      data: employee,
    });
  } catch (error) {
    console.error("Error reactivating employee:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  deleteEmployeeAndRemoveAccess,
  deactivateEmployee,
  getEmployeeActivitySummary,
  reactivateEmployee,
};
