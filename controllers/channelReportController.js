const ChannelReport = require("../models/ChannelReport");
const Channel = require("../models/Channels");
const Admin = require("../models/Admin");
const path = require("path");
const fs = require("fs");

// Upload monthly report (Admin only)
const uploadChannelReport = async (req, res) => {
  try {
    const { channelId, month, year, description } = req.body;
    const adminId = req.user.userId;

    // Validate required fields
    if (!channelId || !month || !year || !req.file) {
      return res.status(400).json({ 
        success: false, 
        message: "Channel ID, month, year, and file are required" 
      });
    }

    // Validate channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ success: false, message: "Channel not found" });
    }

    // Check if admin exists
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(403).json({ success: false, message: "Admin not found" });
    }

    // Check for existing report
    const existingReport = await ChannelReport.findOne({ channelId, month, year });
    if (existingReport) {
      return res.status(400).json({ 
        success: false, 
        message: "Report already exists for this channel and month" 
      });
    }

    // Create file path
    const fileUrl = `/channel-reports/${channelId}/${year}/${month}/${req.file.filename}`;

    // Save report record
    const report = new ChannelReport({
      channelId,
      month,
      year,
      fileUrl,
      fileName: req.file.originalname,
      uploadedBy: adminId,
      description: description || '',
    });

    await report.save();

    res.status(201).json({
      success: true,
      message: "Channel report uploaded successfully",
      data: report,
    });
  } catch (error) {
    console.error("Error uploading channel report:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Get reports for a channel
const getChannelReports = async (req, res) => {
  try {
    const { channelId } = req.params;

    // Verify channel exists
    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ success: false, message: "Channel not found" });
    }

    // Fetch all reports for the channel
    const reports = await ChannelReport.find({ channelId })
      .populate('uploadedBy', 'name email')
      .sort({ year: -1, month: -1 });

    res.status(200).json({
      success: true,
      data: reports,
    });
  } catch (error) {
    console.error("Error fetching channel reports:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Download report
const downloadChannelReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await ChannelReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    // Construct full file path
    const filePath = path.join(__dirname, '..', 'uploads', report.fileUrl);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "File not found" });
    }

    // Send file
    res.download(filePath, report.fileName);
  } catch (error) {
    console.error("Error downloading report:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Delete report (Admin only)
const deleteChannelReport = async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = await ChannelReport.findByIdAndDelete(reportId);
    if (!report) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    // Delete file from storage
    const filePath = path.join(__dirname, '..', 'uploads', report.fileUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(200).json({
      success: true,
      message: "Report deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting report:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Get reports by month and year
const getReportsByMonth = async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ 
        success: false, 
        message: "Month and year are required" 
      });
    }

    const reports = await ChannelReport.find({ month, year })
      .populate('channelId', 'name')
      .populate('uploadedBy', 'name email')
      .sort({ uploadedAt: -1 });

    res.status(200).json({
      success: true,
      data: reports,
    });
  } catch (error) {
    console.error("Error fetching reports by month:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  uploadChannelReport,
  getChannelReports,
  downloadChannelReport,
  deleteChannelReport,
  getReportsByMonth,
};
