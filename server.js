const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { initSocket } = require('./utils/socket');
const connectDB = require('./config/db');
const { startCronJobs } = require('./utils/autoUpdateAttandance');
const { startScheduler } = require("./utils/callbackScheduler");
const { startTaskOverdueScheduler } = require("./utils/taskOverdueScheduler");
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
const notesRoutes = require("./routes/notepadRoutes");
const fileUploadRoutes = require("./routes/fileUpload");
const clientRoutes = require("./routes/clientRoutes");
const profileRoutes = require("./routes/profileRoutes");
const payslipRoutes = require("./routes/payslipRoutes");
dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);
initSocket(server);

startScheduler(0, 20);
startScheduler(17, 18);
startTaskOverdueScheduler();

// ─── CORS ────────────────────────────────────────────────────────────────────
// Browser rule: origin:'*' and credentials:true cannot be used together.
// When a request includes credentials (Authorization header with withCredentials,
// or cookies), the server MUST reflect a specific origin — never a wildcard.
// Fix: use a function that allows any subdomain of digitalmitro.info plus
// localhost for dev. This works with credentials:true and doesn't rely on
// env vars being correctly set.
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile app, Postman, curl, server-to-server)
    if (!origin) return callback(null, true);

    // Allow any subdomain of digitalmitro.info and localhost variants
    const isAllowed =
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
      /^https?:\/\/([a-z0-9-]+\.)?digitalmitro\.info$/.test(origin);

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// Must be FIRST — before express.json() and all routes.
app.use(cors(corsOptions));
// Explicitly handle all OPTIONS preflights with the SAME config.
// Using the same corsOptions object here is critical — a mismatch between
// the preflight response and the actual response headers causes "Failed to fetch".
app.options('*', cors(corsOptions));
// ─────────────────────────────────────────────────────────────────────────────

app.use(express.json());

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
app.use("/notepad", notesRoutes);
app.use("/files", fileUploadRoutes);
app.use("/client", clientRoutes);
app.use("/profile", profileRoutes);
app.use("/payslips", payslipRoutes);
app.use("/salary-sheet", require("./routes/salarySheetRoutes"));
app.use("/superadmin", require("./routes/superAdminRoutes"));
app.use("/mobile", require("./routes/mobileRoutes"));

// ✅ Serve uploaded files from local disk
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
const reportsDir = path.join(uploadsDir, "reports");
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
app.use("/uploads", express.static(uploadsDir));

// ✅ Serve legal pages (Privacy Policy, Terms & Conditions, Account
// Deletion) — required for Play Store submission. Short top-level aliases
// redirect to the actual files so there's a clean URL to put in Play
// Console and the app's Settings screen.
const legalDir = path.join(__dirname, "public", "legal");
app.use("/legal", express.static(legalDir));
app.get("/privacy-policy", (req, res) => res.redirect("/legal/privacy-policy.html"));
app.get("/terms-and-conditions", (req, res) => res.redirect("/legal/terms-and-conditions.html"));
app.get("/delete-account", (req, res) => res.redirect("/legal/delete-account.html"));

// ✅ Basic API health check
app.get('/', (req, res) => {
  res.status(200).json({ message: "🚀 Welcome to CRM Server" });
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
