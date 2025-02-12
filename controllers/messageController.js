const DirectMessage = require("../models/DirectMessage");
const { getIo, onlineUsers } = require("../utils/socket");

// Send a new message
const sendMessage = async (req, res) => {
  try {
    const { sender, receiver, message } = req.body;
    
    if (!sender || !receiver || !message) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    // ✅ Save message to database
    const newMessage = new DirectMessage({ sender, receiver, message });
    await newMessage.save();

    const io = getIo(); // Get the initialized Socket.io instance

    // ✅ Emit the message to both sender and receiver if online
    const senderSocket = onlineUsers.get(sender);
    const receiverSocket = onlineUsers.get(receiver);

    if (receiverSocket) {
      io.to(receiverSocket).emit("new-message", newMessage);
      console.log(`✅ Message sent to receiver: ${receiver}`);
    }

    if (senderSocket) {
      io.to(senderSocket).emit("new-message", newMessage);
      console.log(`✅ Message sent to sender: ${sender}`);
    }

    res.status(200).json({ success: true, message: "Message sent successfully.", data: newMessage });
  } catch (error) {
    console.error("❌ Error sending message:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Retrieve messages between two users
const getMessages = async (req, res) => {
  try {
    const { sender, receiver } = req.params;

    if (!sender || !receiver) {
      return res.status(400).json({ success: false, message: "Sender and receiver are required." });
    }

    // ✅ Fetch messages between users
    const messages = await DirectMessage.find({
      $or: [
        { sender, receiver },
        { sender: receiver, receiver: sender },
      ],
    }).sort({ createdAt: 1 });

    res.status(200).json({ success: true, messages });
  } catch (error) {
    console.error("❌ Error fetching messages:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = { sendMessage, getMessages };
