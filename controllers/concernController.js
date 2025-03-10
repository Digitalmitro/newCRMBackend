const { ConcernModel } = require("../models/concern");
const Attendance = require("../models/Attendance")
// 📌 Submit a Concern (Book Leave, Forgot Clock Out, Employee Concern)
const submitConcern = async (req, res) => {
  try {
    const {  concernType, message, ConcernDate, ActualPunchIn, ActualPunchOut, status } = req.body;
    const user_id= req.user.userId

    if (!user_id || !concernType || !message) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const newConcern = new ConcernModel({
      user_id,
      concernType,
      message,
      ConcernDate:ConcernDate,
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
    const user_id= req.user.userId
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

    // Find concern by user_id and concern_id
    const concern = await ConcernModel.findOneAndUpdate(
      { _id: concern_id, user_id: user_id },
      { status: "Approved" },
      { new: true }
    );

    if (!concern) {
      return res.status(404).json({ message: "Concern not found or does not belong to this user" });
    }

    const { ConcernDate, concernType, ActualPunchIn, ActualPunchOut } = concern;
    
    if (!ConcernDate) {
      return res.status(400).json({ message: "Concern date is missing" });
    }

    // Parse ConcernDate
    const concernDate = moment(ConcernDate, "YYYY-MM-DD").startOf("day");

    // Find existing attendance
    let attendance = await Attendance.findOne({
      user_id: user_id,
      currentDate: concernDate.toDate(),
    });

    // Determine shift type based on time
    let shiftType = "Day";
    if (ActualPunchIn) {
      const punchInHour = moment(ActualPunchIn, "HH:mm").hour();
      shiftType = punchInHour >= 8 && punchInHour < 17 ? "Day" : "Night";
    }

    // Default Punch-in/out times (Modify if concern provides ActualPunchIn/ActualPunchOut)
    const punchInTime = moment(ActualPunchIn || "10:30", "HH:mm").toDate();
    const punchOutTime = moment(ActualPunchOut || "19:30", "HH:mm").toDate();

    // Calculate working time
    const workingTime = moment(punchOutTime).diff(moment(punchInTime), "minutes");

    // Determine work status based on working time
    let workStatus = "Absent";
    if (workingTime >= 300 && workingTime < 420) {
      workStatus = "Half Day";
    } else if (workingTime >= 420) {
      workStatus = "Full Day";
    }

    // Set Status based on punch-in time
    let status = "On Time";
    if (
      (shiftType === "Day" && moment(punchInTime).hour() > 10) ||
      (shiftType === "Night" && moment(punchInTime).hour() > 20)
    ) {
      status = "Late";
    }

    // If attendance exists, update it
    if (attendance) {
      attendance.punchIn = punchInTime;
      attendance.punchOut = punchOutTime;
      attendance.workingTime = workingTime;
      attendance.shiftType = shiftType;
      attendance.status = status;
      attendance.workStatus = workStatus;
      attendance.ip = "System Generated";
      attendance.isPunchedIn = false;
    } else {
      // Create new attendance record
      attendance = new Attendance({
        user_id: user_id,
        currentDate: concernDate.toDate(),
        firstPunchIn: punchInTime,
        punchIn: punchInTime,
        punchOut: punchOutTime,
        workingTime: workingTime,
        shiftType: shiftType,
        status: status,
        workStatus: workStatus,
        ip: "System Generated",
        isPunchedIn: false,
      });
    }

    await attendance.save();

    res.status(200).json({ message: "Concern approved and attendance updated", concern, attendance });

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
