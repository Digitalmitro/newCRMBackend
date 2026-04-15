const Payslip = require("../models/Payslip");
const User = require("../models/User");
const Admin = require("../models/Admin");
const path = require("path");
const fs = require("fs");

// Upload payslip (Admin only)
const uploadPayslip = async (req, res) => {
  try {
    const { employeeId, month, year } = req.body;
    const adminId = req.user.userId;

    // Validate required fields
    if (!employeeId || !month || !year || !req.file) {
      return res.status(400).json({ 
        success: false, 
        message: "Employee ID, month, year, and file are required" 
      });
    }

    // Validate employee exists
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // Check if admin exists
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(403).json({ success: false, message: "Admin not found" });
    }

    // Check for existing payslip
    const existingPayslip = await Payslip.findOne({ employeeId, month, year });
    if (existingPayslip) {
      return res.status(400).json({ 
        success: false, 
        message: "Payslip already exists for this employee and month" 
      });
    }

    // Create file path
    const fileUrl = `/payslips/${employeeId}/${year}/${month}/${req.file.filename}`;

    // Save payslip record
    const payslip = new Payslip({
      employeeId,
      month,
      year,
      fileUrl,
      fileName: req.file.originalname,
      uploadedBy: adminId,
    });

    await payslip.save();

    res.status(201).json({
      success: true,
      message: "Payslip uploaded successfully",
      data: payslip,
    });
  } catch (error) {
    console.error("Error uploading payslip:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Get payslips for an employee
const getEmployeePayslips = async (req, res) => {
  try {
    const { employeeId } = req.params;

    // Verify employee exists
    const employee = await User.findById(employeeId);
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    // Fetch all payslips for the employee
    const payslips = await Payslip.find({ employeeId })
      .populate('uploadedBy', 'name email')
      .sort({ year: -1, month: -1 });

    res.status(200).json({
      success: true,
      data: payslips,
    });
  } catch (error) {
    console.error("Error fetching payslips:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Get my payslips (Employee view)
const getMyPayslips = async (req, res) => {
  try {
    const employeeId = req.user.userId;

    // Fetch all payslips for current employee
    const payslips = await Payslip.find({ employeeId })
      .populate('uploadedBy', 'name email')
      .sort({ year: -1, month: -1 });

    res.status(200).json({
      success: true,
      data: payslips,
    });
  } catch (error) {
    console.error("Error fetching my payslips:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Download payslip
const downloadPayslip = async (req, res) => {
  try {
    const { payslipId } = req.params;

    const payslip = await Payslip.findById(payslipId);
    if (!payslip) {
      return res.status(404).json({ success: false, message: "Payslip not found" });
    }

    // Construct full file path
    const filePath = path.join(__dirname, '..', 'uploads', payslip.fileUrl);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "File not found" });
    }

    // Send file
    res.download(filePath, payslip.fileName);
  } catch (error) {
    console.error("Error downloading payslip:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Delete payslip (Admin only)
const deletePayslip = async (req, res) => {
  try {
    const { payslipId } = req.params;

    const payslip = await Payslip.findByIdAndDelete(payslipId);
    if (!payslip) {
      return res.status(404).json({ success: false, message: "Payslip not found" });
    }

    // Delete file from storage
    const filePath = path.join(__dirname, '..', 'uploads', payslip.fileUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.status(200).json({
      success: true,
      message: "Payslip deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting payslip:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Get payslips for a specific month/year
const getPayslipsByMonth = async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ 
        success: false, 
        message: "Month and year are required" 
      });
    }

    const payslips = await Payslip.find({ month, year })
      .populate('employeeId', 'name email')
      .populate('uploadedBy', 'name email')
      .sort({ uploadedAt: -1 });

    res.status(200).json({
      success: true,
      data: payslips,
    });
  } catch (error) {
    console.error("Error fetching payslips by month:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = {
  uploadPayslip,
  getEmployeePayslips,
  getMyPayslips,
  downloadPayslip,
  deletePayslip,
  getPayslipsByMonth,
};
