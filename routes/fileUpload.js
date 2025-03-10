const express = require("express");
const { upload, uploadToCloudinary } = require("../utils/fileUpload");
const { getIo, onlineUsers } = require("../utils/socket");

const router = express.Router();

// ✅ File Upload API
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    // const { sender, receiver } = req.body;
    const file = req.file;

    if (!file) return res.status(400).json({ success: false, message: "No file uploaded" });

    // ✅ Upload to Cloudinary
    const fileUrl = await uploadToCloudinary(file.buffer, "chat_uploads");

    // ✅ Emit real-time notification
    // const io = getIo();
    // const receiverSocket = onlineUsers.get(receiver);
    // if (receiverSocket) {
    //   io.to(receiverSocket).emit("new-message", {
    //     sender,
    //     message: fileUrl,
    //     type: "file",
    //   });
    // }

    return res.json({ success: true, fileUrl });
  } catch (error) {
    console.error("File Upload Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

module.exports = router;
