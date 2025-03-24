const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { initSocket } = require('./utils/socket');
const connectDB = require('./config/db');
const {startCronJobs} = require('./utils/autoUpdateAttandance')
const {startScheduler} = require("./utils/callbackScheduler");
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
const notesRoutes = require("./routes/notepadRoutes")
const fileUploadRoutes = require("./routes/fileUpload");
const clientRoutes=require("./routes/clientRoutes")
dotenv.config();
connectDB(); // Connect to MongoDB

const app = express();
const server = http.createServer(app);
initSocket(server);

// startCronJobs()
startScheduler(0,20)
startScheduler(13, 15);
startScheduler(15, 13);
app.use(express.json());
app.use(
  cors({
    origin:  [process.env.Client_Url, process.env.Admin_Url,process.env.Guest_Url],
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
app.use("/notepad",notesRoutes)
app.use("/files", fileUploadRoutes);
app.use("/client",clientRoutes)
// ✅ Basic API health check
app.get('/', (req, res) => {
  res.status(200).json({ message: "🚀 Welcome to CRM Server" });
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
