const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const upload = require('../utils/fileUpload');
const {
  updateChannelDetails,
  getChannelDetails,
  updateChannelTags,
  uploadChannelImage,
  deleteChannelImage,
  removeMemberFromChannel,
} = require('../controllers/channelManagementController');

// Channel Details
router.put('/:channelId/details', authMiddleware, updateChannelDetails);
router.get('/:channelId/details', authMiddleware, getChannelDetails);

// Channel Tags
router.put('/:channelId/tags', authMiddleware, updateChannelTags);

// Channel Image
router.post('/:channelId/image', authMiddleware, upload.single('file'), uploadChannelImage);
router.delete('/:channelId/image', authMiddleware, deleteChannelImage);

// Remove Member
router.delete('/:channelId/member/:memberId', authMiddleware, removeMemberFromChannel);

module.exports = router;
