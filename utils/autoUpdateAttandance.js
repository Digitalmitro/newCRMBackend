const schedule = require("node-schedule");
const moment = require("moment");
const { getAttendanceDate, TIMEZONE } = require("./attendanceDay");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const { checkWeekendOrHoliday } = require("./weekHoliday")

// Function to update attendance
const autoUpdateAttendance = async (shiftType) => {
  try {
    const today = getAttendanceDate(); // IST attendance day (5am cutover)
    const holidayOrWeekend = checkWeekendOrHoliday(today);

    const users = await User.find({ type:shiftType });
    for (const user of users) {
      const existingAttendance = await Attendance.findOne({ user_id: user._id, currentDate: today });

      if (!existingAttendance) {
        let workStatus = "Absent";

        if (holidayOrWeekend) {
          workStatus = holidayOrWeekend;
        } else {
          const leaveRequest = await Attendance.findOne({ user_id: user._id, date: today });

          if (leaveRequest) {
            workStatus = leaveRequest.leaveStatus === "Approved" ? "Leave Approved" : "Pending Leave";
          }
        }

        // Create Attendance Entry
        const newAttendance = new Attendance({
          currentDate: today,
          shiftType,
          user_id: user._id,
          status: workStatus,
          workStatus: workStatus,
          isPunchedIn: false,
        });

        await newAttendance.save();
        console.log(`✅ Auto-marked ${user.name} (${shiftType}) as ${workStatus}`);
      }
    }
  } catch (error) {
    console.error(`❌ Error in auto-updating attendance for ${shiftType} shift:`, error);
  }
};

// 📌 Export the Function to Use in `server.js`
const startCronJobs = async () => {
  console.log("🚀 Starting Cron Jobs...");

  // ✅ Day Shift: 9 AM
  schedule.scheduleJob({ rule: "0 9 * * *", tz: TIMEZONE }, () => autoUpdateAttendance("Day"));

  // ✅ Night Shift: 7 PM
  schedule.scheduleJob({ rule: "0 19 * * *", tz: TIMEZONE }, () => autoUpdateAttendance("Night"));
  // await autoUpdateAttendance("Day");

  console.log("✅ Cron Jobs Scheduled!");
 
};

module.exports = { startCronJobs };