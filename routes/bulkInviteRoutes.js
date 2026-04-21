const express = require('express');
const router = express.Router();
const { authMiddleware }= require('../middlewares/authMiddleware');
const {
  sendBulkInvites,
  getPendingInvites,
  acceptInvite,
  resendInvite,
  cancelInvite,
} = require('../controllers/bulkInviteController');

// Send bulk invites to multiple emails
router.post('/bulk', authMiddleware, sendBulkInvites);

// Get pending invites for a channel
router.get('/:channelId/pending', authMiddleware, getPendingInvites);

// Accept invite
router.post('/:inviteId/accept', acceptInvite);

// Resend invite
router.post('/:inviteId/resend', authMiddleware, resendInvite);

// Cancel invite
router.delete('/:inviteId', authMiddleware, cancelInvite);

module.exports = router;
