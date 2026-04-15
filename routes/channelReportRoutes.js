const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const upload = require('../utils/fileUpload');
const {
  uploadChannelReport,
  getChannelReports,
  downloadChannelReport,
  deleteChannelReport,
  getReportsByMonth,
} = require('../controllers/channelReportController');

// Admin: Upload channel report
router.post('/upload', authMiddleware, upload.single('file'), uploadChannelReport);

// Get reports for specific channel
router.get('/channel/:channelId', authMiddleware, getChannelReports);

// Download report
router.get('/download/:reportId', authMiddleware, downloadChannelReport);

// Delete report (Admin)
router.delete('/:reportId', authMiddleware, deleteChannelReport);

// Get reports by month (Admin)
router.get('/month/list', authMiddleware, getReportsByMonth);

module.exports = router;
