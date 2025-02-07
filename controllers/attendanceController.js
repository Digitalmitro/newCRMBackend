const Attendance = require("../models/Attendance");
const User = require("../models/User");
const { checkWeekendOrHoliday } = require("../utils/weekHoliday");
const moment = require("moment");

// Helper function to calculate working time in minutes
const calculateWorkingTime = (punchIn, punchOut) => {
  const start = moment(punchIn, "HH:mm");
  const end = moment(punchOut, "HH:mm");
  return end.diff(start, 'minutes'); 
};

// Punch-In API
exports.punchIn = async (req, res) => {
  const { userId } = req.user; 

  try {
   
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const today = moment().format("YYYY-MM-DD");
    const holidayOrWeekend = checkWeekendOrHoliday(today);

    if (holidayOrWeekend) {
      const newAttendance = new Attendance({
        currentDate: today,
        shiftType: "Day",
        user_id: userId,
        status: holidayOrWeekend,
        workStatus: holidayOrWeekend === "Holiday" ? "Full Day" : "Absent",
        ip: req.ip,
       
      });

      await newAttendance.save();
      return res.status(201).json({ message: `${holidayOrWeekend} - Attendance marked automatically`, data: newAttendance });
    }

    // Otherwise, normal punch-in process
    const attendance = await Attendance.findOne({ user_id: userId, currentDate: today });
    if (attendance && attendance.isPunchedIn) {
      return res.status(400).json({ message: "User already punched in today" });
    }

    const punchInTime = moment().format("HH:mm");
    const shiftType = punchInTime >= "10:30" && punchInTime <= "19:30" ? "Day" : "Night";

    const newAttendance = new Attendance({
      currentDate: today,
      punchIn: punchInTime,
      shiftType: shiftType,
      user_id: userId,
      isPunchedIn: true,
      ip: req.ip,
      status: "On Time",
    });

    await newAttendance.save();
    res.status(201).json({ message: "Punch In successful", data: newAttendance });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error during punch in", error: error.message });
  }
};

// Punch-Out API
exports.punchOut = async (req, res) => {
  const { userId } = req.user; 

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const today = moment().format("YYYY-MM-DD");
    const attendance = await Attendance.findOne({ user_id: userId, currentDate: today });

    if (!attendance || !attendance.isPunchedIn) {
      return res.status(400).json({ message: "User hasn't punched in today" });
    }

    const punchOutTime = moment().format("HH:mm");
    const workingTime = calculateWorkingTime(attendance.punchIn, punchOutTime);

    attendance.punchOut = punchOutTime;
    attendance.workingTime = workingTime;
    attendance.isPunchedIn = false;

    // Update status and work status
    let workStatus = "Full Day"; // Default
    if (workingTime < 480) {
      workStatus = "Half Day";
    } else if (workingTime > 480) {
      // workStatus = "Over Time";
       workStatus = "Full Day";
    }

    attendance.status = "On Time";
    attendance.workStatus = workStatus;

    await attendance.save();
    res.status(200).json({ message: "Punch Out successful", data: attendance });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error during punch out", error: error.message });
  }
};

// Leave Update (Admin or User)
exports.updateLeaveStatus = async (req, res) => {
  const { userId } = req.user;
  const { leaveApproved } = req.body;

  try {
    // Check if the user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if attendance record exists
    const today = moment().format("YYYY-MM-DD");
    const attendance = await Attendance.findOne({ user_id: userId, currentDate: today });
    if (!attendance) {
      return res.status(404).json({ message: "Attendance not found for today" });
    }

    // Update leave status if it's pending
    if (attendance.leaveStatus === 'Pending') {
      attendance.leaveApproved = leaveApproved;
      attendance.leaveStatus = leaveApproved ? 'Approved' : 'Rejected';
      attendance.status = leaveApproved ? 'Leave' : 'Absent';
      attendance.workStatus = leaveApproved ? 'Leave' : 'Absent';
      await attendance.save();

      res.status(200).json({ message: `Leave ${leaveApproved ? 'Approved' : 'Rejected'}`, data: attendance });
    } else {
      res.status(400).json({ message: "Leave has already been processed" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating leave status", error: error.message });
  }
};

//forgot puch in, punch out
exports.handlePunch = async (req, res) => {
  const { userId } = req.user;
  const { date, punchIn, punchOut, fix } = req.body; // Optional fix values

  try {
    const today = date || moment().format("YYYY-MM-DD");
    let attendance = await Attendance.findOne({ user_id: userId, currentDate: today });

    if (!attendance) {
      // If no attendance record, create Punch-In
      const shiftType = punchIn >= "10:30" && punchIn <= "19:30" ? "Day" : "Night";

      attendance = new Attendance({
        user_id: userId,
        currentDate: today,
        punchIn: punchIn || moment().format("HH:mm"),
        shiftType: shiftType,
        isPunchedIn: true,
        status: "On Time",
      });

      await attendance.save();
      return res.status(201).json({ message: "Punch-In recorded", data: attendance });
    }

    if (attendance.isPunchedIn) {
      // User is punched in, process Punch-Out or fix
      let finalPunchOut = punchOut || moment().format("HH:mm");

      if (fix) {
        // If fixing, update Punch-In and/or Punch-Out
        if (punchIn) attendance.punchIn = punchIn;
        if (punchOut) finalPunchOut = punchOut;
      }

      const workingTime = calculateWorkingTime(attendance.punchIn, finalPunchOut);
      attendance.punchOut = finalPunchOut;
      attendance.workingTime = workingTime;
      attendance.isPunchedIn = false;

      await attendance.save();
      return res.status(200).json({ message: "Punch-Out recorded", data: attendance });
    }

    return res.status(400).json({ message: "Already punched out for today" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error processing attendance", error: error.message });
  }
};

//This is for admin
exports.getAllAttendance = async (req, res) => {
  try {
    const allAttendance = await Attendance.find().populate("user_id", "name email");
    res.status(200).json({ message: "All attendance records", data: allAttendance });
  } catch (error) {
    res.status(500).json({ message: "Error fetching attendance", error: error.message });
  }
};

exports.getUserAttendance = async (req, res) => {
  const { userId } = req.user; // Get user from token
  const { range } = req.query;

  let startDate, endDate;

  if (range === "today") {
    startDate = moment().format("YYYY-MM-DD");
    endDate = startDate;
  } else if (range === "this_month") {
    startDate = moment().startOf("month").format("YYYY-MM-DD");
    endDate = moment().endOf("month").format("YYYY-MM-DD");
  } else if (range === "last_month") {
    startDate = moment().subtract(1, "months").startOf("month").format("YYYY-MM-DD");
    endDate = moment().subtract(1, "months").endOf("month").format("YYYY-MM-DD");
  } else if (range === "year") {
    startDate = moment().startOf("year").format("YYYY-MM-DD");
    endDate = moment().endOf("year").format("YYYY-MM-DD");
  } else {
    return res.status(400).json({ message: "Invalid range parameter" });
  }

  try {
    const userAttendance = await Attendance.find({
      user_id: userId,
      currentDate: { $gte: startDate, $lte: endDate },
    });

    res.status(200).json({
      message: `Attendance records from ${startDate} to ${endDate}`,
      data: userAttendance,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching user attendance",
      error: error.message,
    });
  }
};

