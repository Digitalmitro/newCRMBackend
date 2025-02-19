const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { initSocket } = require('./utils/socket');
const connectDB = require('./config/db');
const {startCronJobs} = require('./utils/autoUpdateAttandance')
const attendanceRoutes = require('./routes/attendanceRoutes');
const authRoutes = require("./routes/authRoutes");
const callbackRoutes = require("./routes/callbackRoutes");
const transferRoutes = require("./routes/transferRoutes");
const saleRoutes = require("./routes/saleRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const messageRoutes = require("./routes/messageRoutes");
const concernRoutes = require("./routes/concernRoutes");
const channelRoutes = require("./routes/channelRoutes");
const channelChatsRoutes = require("./routes/channelChatsRoutes");


dotenv.config();
connectDB(); // Connect to MongoDB
// startCronJobs()
const app = express();
const server = http.createServer(app);
initSocket(server);
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173"],
    credentials: true,
  })
);

// ✅ Define API routes
app.use('/attendance', attendanceRoutes);
app.use('/auth', authRoutes);
app.use("/callback", callbackRoutes);
app.use("/transfer", transferRoutes);
app.use("/sale", saleRoutes);
app.use("/notification", notificationRoutes);
app.use("/message", messageRoutes);
app.use("/concern", concernRoutes);
app.use("/api", channelRoutes);
app.use("/channels", channelChatsRoutes);

// ✅ Basic API health check
app.get('/', (req, res) => {
  res.status(200).json({ message: "🚀 Welcome to CRM Server" });
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
