const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
    userName: { type: String },
    userEmail: { type: String },
    currentDate: { type: String },
    punchin: { type: String },
    punchOut: { type: String },
    time: { type: String },
    ip: { type: String },
    status: { type: String },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "register user",
    required: true,
  },
});

const AttendanceModel = mongoose.model("attendance", attendanceSchema);

module.exports = { AttendanceModel };
