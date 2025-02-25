const DirectMessage = require("../models/DirectMessage");
const User = require("../models/User")
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

const getRecentChatUsers = async (req, res) => {
  try {
    const userId = req.user.userId; // Extract user ID from token

    // Step 1: Find the latest message per user
    const lastMessages = await DirectMessage.aggregate([
      {
        $match: {
          $or: [{ sender: userId }, { receiver: userId }],
        },
      },
      { $sort: { createdAt: -1 } }, // Sort by latest message
      {
        $group: {
          _id: { 
            $cond: [{ $eq: ["$sender", userId] }, "$receiver", "$sender"] 
          }, // Group by the chat partner
          lastMessageTime: { $first: "$createdAt" },
          lastMessage: { $first: "$message" },
        },
      },
    ]);

    // Convert aggregation result to a map
    const lastMessageMap = {};
    lastMessages.forEach((msg) => {
      lastMessageMap[msg._id.toString()] = msg;
    });

    // Step 2: Get all users who have chatted with the current user
    const userIds = lastMessages.map(msg => msg._id);
    const users = await User.find({ _id: { $in: userIds } }, "name _id");

    // Step 3: Get unseen message count for each user
    const usersWithDetails = await Promise.all(
      users.map(async (user) => {
        const unseenCount = await DirectMessage.countDocuments({
          sender: user._id,
          receiver: userId,
          seen: false,
        });

        return {
          _id: user._id,
          name: user.name,
          unseenMessages: unseenCount,
          lastMessageTime: lastMessageMap[user._id.toString()]?.lastMessageTime || null,
          lastMessage: lastMessageMap[user._id.toString()]?.lastMessage || "",
        };
      })
    );

    // Step 4: Sort users by lastMessageTime (latest first)
    usersWithDetails.sort((a, b) => {
      return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
    });

    res.status(200).json({ success: true, chatUsers: usersWithDetails });
  } catch (error) {
    console.error("Error fetching recent chat users:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const getAllUser = async (req,res) =>{
  try {
    const users = await User.find({}, "_id name"); // Fetch all users (ID & Name only)
    const loggedInUserId = req.user.userId; // Get logged-in user ID

    // Fetch unread messages and last message time for each user
    const usersWithChatData = await Promise.all(
      users.map(async (user) => {
        if (user._id.toString() === loggedInUserId) return null; // Exclude current user

        const lastMessage = await DirectMessage.findOne({
          $or: [
            { sender: loggedInUserId, receiver: user._id },
            { sender: user._id, receiver: loggedInUserId }
          ]
        }).sort({ createdAt: -1 }); // Get latest message

        const unreadCount = await DirectMessage.countDocuments({
          sender: user._id,
          receiver: loggedInUserId,
          seen: false,
        });

        return {
          id: user._id,
          name: user.name,
          unreadMessages: unreadCount,
          lastMessageTime: lastMessage ? lastMessage.createdAt : null,
        };
      })
    );

    // Filter out null values (current user) and sort by:
    // 1️⃣ Unread messages first (Descending)
    // 2️⃣ Recent chat activity (Newest first)
    const sortedUsers = usersWithChatData
      .filter(Boolean)
      .sort((a, b) => {
        if (a.unreadMessages !== b.unreadMessages) {
          return b.unreadMessages - a.unreadMessages; // Unread messages first
        }
        return new Date(b.lastMessageTime || 0) - new Date(a.lastMessageTime || 0); // Recent chats next
      });

    res.json(sortedUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

const readMessage = async (req,res) =>{
  try {
    const { senderId } = req.body;
    const receiverId = req.user.userId;

    await DirectMessage.updateMany(
      { sender: senderId, receiver: receiverId, seen: false },
      { $set: { seen: true } }
    );

    res.json({ message: "Messages marked as read" });
  } catch (error) {
    console.error("Error updating messages:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = { sendMessage, getMessages, getRecentChatUsers,getAllUser, readMessage };
