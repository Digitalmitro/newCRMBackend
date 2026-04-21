const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const { upload } = require('../utils/fileUpload');
const {
  uploadPayslip,
  getEmployeePayslips,
  getMyPayslips,
  downloadPayslip,
  deletePayslip,
  getPayslipsByMonth,
} = require('../controllers/payslipController');

// Admin: Upload payslip
router.post('/upload', authMiddleware, upload.single('file'), uploadPayslip);

// Get payslips for specific employee (Admin)
router.get('/employee/:employeeId', authMiddleware, getEmployeePayslips);

// Get my payslips (Employee)
router.get('/my-payslips', authMiddleware, getMyPayslips);

// Download payslip
router.get('/download/:payslipId', authMiddleware, downloadPayslip);

// Delete payslip (Admin)
router.delete('/:payslipId', authMiddleware, deletePayslip);

// Get payslips by month (Admin)
router.get('/month/list', authMiddleware, getPayslipsByMonth);

module.exports = router;
