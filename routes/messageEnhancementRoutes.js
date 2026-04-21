const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middlewares/authMiddleware');
const {
  deleteDirectMessage,
  deleteChannelMessage,
  editDirectMessage,
  editChannelMessage,
  getMessageHistory,
  getMentionSuggestions,
} = require('../controllers/messageEnhancementController');
console.log({
  deleteDirectMessage: typeof deleteDirectMessage,
  deleteChannelMessage: typeof deleteChannelMessage,
  editDirectMessage: typeof editDirectMessage,
});
// Delete messages (2-hour window)
router.delete('/direct/:messageId', authMiddleware, deleteDirectMessage);
router.delete('/channel/:messageId', authMiddleware, deleteChannelMessage);

// Edit messages (2-hour window)
router.put('/direct/:messageId', authMiddleware, editDirectMessage);
router.put('/channel/:messageId', authMiddleware, editChannelMessage);

// Get message history
router.get('/history/:messageId', authMiddleware, getMessageHistory);

// Get @mention suggestions
router.get('/mentions/suggestions', authMiddleware, getMentionSuggestions);

module.exports = router;
