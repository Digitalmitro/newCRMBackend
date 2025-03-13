const { ConcernModel } = require("../models/concern");
const Attendance = require("../models/Attendance");
const User = require("../models/User")
const moment = require('moment-timezone')
// 📌 Submit a Concern (Book Leave, Forgot Clock Out, Employee Concern)
const submitConcern = async (req, res) => {
  try {
    const { concernType, message, ConcernDate, ActualPunchIn, ActualPunchOut, status } = req.body;
    const user_id = req.user.userId

    if (!user_id || !concernType || !message) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const newConcern = new ConcernModel({
      user_id,
      concernType,
      message,
      ConcernDate: ConcernDate,
      ActualPunchIn,
      ActualPunchOut,
      status: status || "Pending",
      currenDate: new Date().toISOString().split("T")[0]
    });

    await newConcern.save();
    res.status(201).json({ success: true, message: "Concern submitted successfully", data: newConcern });

  } catch (error) {
    console.error("Error submitting concern:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// 📌 Get All Concerns
const getAllConcerns = async (req, res) => {
  try {
    const concerns = await ConcernModel.find().populate("user_id", "name email");
    res.status(200).json({ success: true, concerns });
  } catch (error) {
    console.error("Error fetching concerns:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// 📌 Get Concerns by User ID
const getConcernsByUser = async (req, res) => {
  try {
    const user_id = req.user.userId
    const concerns = await ConcernModel.find({ user_id }).sort({ createdAt: -1 });

    if (!concerns.length) {
      return res.status(404).json({ success: false, message: "No concerns found for this user" });
    }

    res.status(200).json({ success: true, concerns });
  } catch (error) {
    console.error("Error fetching user concerns:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// 📌 Update Concern Status
const updateConcernStatus = async (req, res) => {
  try {
    const { concernId } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: "Status is required" });
    }

    const updatedConcern = await ConcernModel.findByIdAndUpdate(
      concernId,
      { status },
      { new: true }
    );

    if (!updatedConcern) {
      return res.status(404).json({ success: false, message: "Concern not found" });
    }

    res.status(200).json({ success: true, message: "Concern updated successfully", data: updatedConcern });
  } catch (error) {
    console.error("Error updating concern:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const approveConcern = async (req, res) => {
  try {
    const { user_id, concern_id } = req.params;

    // Find and update concern status
    const concern = await ConcernModel.findOne({ _id: concern_id, user_id: user_id });
    if (!concern) {
      return res.status(404).json({ message: "Concern not found or does not belong to this user" });
    }

    const { ConcernDate, concernType, ActualPunchIn, ActualPunchOut } = concern;

    if (!ConcernDate) {
      return res.status(400).json({ message: "Concern date is missing" });
    }

    // ✅ Ensure ConcernDate is stored as `YYYY-MM-DDT00:00:00.000Z` (UTC)
    const concernDateUTC = moment(ConcernDate).tz("Asia/Kolkata").format("YYYY-MM-DD");

    let punchInTime = ActualPunchIn
      ? moment(ActualPunchIn, "YYYY-MM-DD hh:mm A").tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm")
      : moment.tz(ConcernDate + " 10:30", "YYYY-MM-DD HH:mm", "Asia/Kolkata");

    let punchOutTime = ActualPunchOut
      ? moment(ActualPunchOut, "YYYY-MM-DD hh:mm A").tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm")
      : moment.tz(ConcernDate + " 19:30", "YYYY-MM-DD HH:mm", "Asia/Kolkata");
    const workingTime = 540
    // ✅ Determine work status based on working time
    let workStatus = "Absent";
    if (workingTime >= 300 && workingTime < 420) {
      workStatus = "Half Day";
    } else if (workingTime >= 420) {
      workStatus = "Full Day";
    }

    const user = await User.findOne({ _id: user_id })
    const punchInHour = moment(punchInTime).hour();
    const punchInMinute = moment(punchInTime).minute();
    let shiftType=user.type;
    let status = "On Time";
    if (
      (shiftType === "Day" &&
        (punchInHour > 10 || (punchInHour === 10 && punchInMinute > 40))) ||
      (shiftType === "Night" &&
        (punchInHour > 20 || (punchInHour === 20 && punchInMinute > 10)))
    ) {
      status = "Late";
    }

    // ✅ Find existing attendance
    let attendance = await Attendance.findOne({ user_id: user_id, currentDate: concernDateUTC });

    if (attendance) {
      // ✅ Update existing attendance, preserving `firstPunchIn`
      if (!attendance.firstPunchIn) {
        attendance.firstPunchIn = punchInTime;
      }
      attendance.punchIn = punchInTime;
      attendance.punchOut = punchOutTime;
      attendance.workingTime = workingTime;
      attendance.shiftType = shiftType;
      attendance.status = status;
      attendance.workStatus = workStatus;
      attendance.ip = "System Generated";
      attendance.isPunchedIn = false;

      await attendance.save();
    } else {
      // ✅ Create new attendance record
      attendance = new Attendance({
        user_id: user_id,
        currentDate: concernDateUTC,
        firstPunchIn: punchInTime, // First punch-in is only set for new records
        punchIn: punchInTime,
        punchOut: punchOutTime,
        workingTime: workingTime,
        shiftType: shiftType,
        status: status,
        workStatus: workStatus,
        ip: "System Generated",
        isPunchedIn: false,
        leaveStatus: "Pending",
        leaveApproved: false,
      });

      await attendance.save();
    }
    concern.status = "Approved";
    await concern.save();

    res.status(200).json({
      message: "Concern approved and attendance updated",
      concern,
      attendance,
    });

  } catch (error) {
    console.error("Error approving concern:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// Reject Concern only if both user_id and concern_id match
const rejectConcern = async (req, res) => {
  try {
    const { user_id, concern_id } = req.params;

    const concern = await ConcernModel.findOneAndUpdate(
      { _id: concern_id, user_id: user_id }, // Ensure both match
      { status: "Rejected" },
      { new: true }
    );

    if (!concern) {
      return res.status(404).json({ message: "Concern not found or does not belong to this user" });
    }

    res.status(200).json({ message: "Concern rejected successfully", concern });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

module.exports = {
  submitConcern,
  getAllConcerns,
  getConcernsByUser,
  updateConcernStatus,
  approveConcern,
  rejectConcern
};
