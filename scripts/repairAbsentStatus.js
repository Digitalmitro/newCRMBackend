// One-time repair: attendance rows that have a real punch-in but still say
// status "Absent" (left over from the auto-absent placeholder bug).
// Usage (from newCRMBackend, with .env present):  node scripts/repairAbsentStatus.js
require("dotenv").config();
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const Attendance = require("../models/Attendance");

const lateOrOnTime = (shift, m) => {
  const h = m.hour(), min = m.minute();
  return (shift === "Day" && (h > 10 || (h === 10 && min > 40))) ||
    (shift === "Night" && (h > 20 || (h === 20 && min > 10))) ? "Late" : "On Time";
};

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const rows = await Attendance.find({ status: "Absent", punchIn: { $ne: null } });
  for (const r of rows) {
    r.status = lateOrOnTime(r.shiftType, moment.tz(r.firstPunchIn || r.punchIn, "Asia/Kolkata"));
    await r.save();
  }
  console.log(`Repaired ${rows.length} record(s).`);
  await mongoose.disconnect();
})();
