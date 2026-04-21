const express = require('express');
const router = express.Router();
const { authMiddleware }= require('../middlewares/authMiddleware');
const { upload }= require('../utils/fileUpload');
const {
  uploadProfilePicture,
  getProfilePicture,
  deleteProfilePicture,
} = require('../controllers/profilePictureController');

// Upload profile picture
router.post('/upload', authMiddleware, upload.single('file'), uploadProfilePicture);

// Get profile picture
router.get('/', getProfilePicture);

// Delete profile picture
router.delete('/', authMiddleware, deleteProfilePicture);

module.exports = router;
