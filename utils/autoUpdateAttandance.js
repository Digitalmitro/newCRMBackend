const cron = require("node-cron"); 
const moment = require("moment");
const Attendance = require("../models/Attendance");
const User = require("../models/User");

// Function to update attendance
const autoUpdateAttendance = async (shiftType) => {
  try {
    const today = moment().format("YYYY-MM-DD");
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

// 🕘 Schedule for Day shift users (9 AM)
cron.schedule("0 9 * * *", () => autoUpdateAttendance("Day"));

// 🕖 Schedule for Night shift users (7 PM)
cron.schedule("0 19 * * *", () => autoUpdateAttendance("Night"));
