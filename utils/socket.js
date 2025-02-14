const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");

const onlineUsers = new Map(); // Store connected users

let io;

const initSocket = (server) => {
  io = socketIo(server, {
    cors: {
      origin: `${process.env.Client_Url}`, // Update based on frontend URL
      methods: ["GET", "POST"],
    },
  });

  // ✅ Middleware for authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization;
    
    if (!token) {
      console.log("❌ No token provided, rejecting connection.");
      return next(new Error("Authentication error"));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        console.log("❌ JWT verification failed:", err.message);
        return next(new Error("Authentication error"));
      }

      socket.userId = decoded.userId; // Attach userId to socket
      onlineUsers.set(decoded.userId, socket.id); // Store user in online users map
      // console.log(`✅ User connected: ${decoded.userId} | Socket ID: ${socket.id}`);
      next();
    });
  });

  // ✅ Handle events
  io.on("connection", (socket) => {
    console.log(`✅ Socket connected: ${socket.id}`);

    socket.emit("authenticated", { message: "User authenticated", userId: socket.userId });
    socket.on("joinChannel", (channelId) => {
    socket.join(channelId);
      console.log(`User ${socket.id} joined channel ${channelId}`);
     });
  
    socket.on("disconnect", () => {
      console.log(`⚠️ User disconnected: ${socket.userId}`);
      onlineUsers.delete(socket.userId);
    });
  });

  return io;
};

const getIo = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};

module.exports = { initSocket, getIo, onlineUsers };
