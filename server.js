const express = require('express')
const cors = require('cors')
const dotenv=require('dotenv')
const http = require('http');
const socketUtil = require('./utils/socket');
const connectDB = require('./config/db');
const attendanceRoutes = require('./routes/attendanceRoutes')
const authRoutes = require("./routes/authRoutes");
const callbackRoutes = require("./routes/callbackRoutes");
const transferRoutes = require("./routes/transferRoutes");
const saleRoutes = require("./routes/saleRoutes")
 
dotenv.config()
connectDB()
const app = express();
const server = http.createServer(app);
const io = socketUtil.init(server);
app.use(express.json());
app.use(cors());

//all routes
app.get('/',(req,res)=>{
res.status(200).json({"message":"wellcome to crm server"})
})
app.use('/attendance', attendanceRoutes);
app.use('/auth',authRoutes)
app.use("/callback",callbackRoutes);
app.use("/transfer", transferRoutes);
app.use("/sale", saleRoutes);

io.on('connection', (socket) => {
    console.log("Connected to socket.io");
      socket.on("setup", (userData) => {
        socket.join(userData.userId);
        console.log(userData)
        socket.emit("connected");
      });
  
    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });
});

const PORT = process.env.PORT || 5000
app.listen(PORT, (err)=>{
    if(err) throw err;
    console.log(`server is running on ${PORT}`)
})