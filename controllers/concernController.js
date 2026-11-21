const { ConcernModel } = require("../models/concern");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const Admin = require("../models/Admin");
const Client = require("../models/Client");
const Notification = require("../models/Notifications");
const moment = require('moment-timezone');
const { emitToUser, isUserOnline, triggerSoftRefresh } = require("../utils/socket");

const resolveUserEntity = async (id) => {
  if (!id) return null;
  return (
    (await User.findById(id)) ||
    (await Admin.findById(id)) ||
    (await Client.findById(id))
  );
};
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

    const reporter = await resolveUserEntity(user_id);
    const reporterName = reporter?.name || "User";
    // Only notify admins who are in scope for this employee AND actually
    // have access to the Concerns page — being in scope isn't enough on
    // its own; this used to notify every admin in the system regardless
    // of either.
    const { getAdminIdsForEmployee, filterAdminIdsByPermission } = require("../utils/adminScope");
    let adminIds = await getAdminIdsForEmployee(user_id, user_id);
    adminIds = await filterAdminIdsByPermission(adminIds, "concern", "access");

    if (adminIds.length > 0) {
      const { notifyUsers } = require("../utils/notifyUsers");
      await notifyUsers({
        userIds: adminIds,
        title: `New concern: ${concernType}`,
        description: `${reporterName} reported: ${message}`,
        type: "CONCERN",
        sender: user_id,
        pushData: { type: "concern", concernId: newConcern._id?.toString() },
      });
    }

    await triggerSoftRefresh("Concern");
    res.status(201).json({ success: true, message: "Concern submitted successfully", data: newConcern });

  } catch (error) {
    console.error("Error submitting concern:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// 📌 Get All Concerns
const getAllConcerns = async (req, res) => {
  try {
    const { getAdminScope } = require("../utils/adminScope");
    const scope = await getAdminScope(req.user?.userId);

    let filter = {};
    if (scope && !scope.isSuperAdmin && !scope.allEmployees && scope.allowedEmployees.length > 0) {
      filter.user_id = { $in: scope.allowedEmployees };
    }

    const concerns = await ConcernModel.find(filter)
      .populate("user_id", "name email avatar")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, concerns });
  } catch (error) {
    console.error("Error fetching concerns:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

const getPendingConcernsCount = async (req, res) => {
  try {
    const pendingCount = await ConcernModel.countDocuments({ status: "Pending" });
    res.status(200).json({ success: true, count: pendingCount });
  } catch (error) {
    console.error("Error fetching pending concerns count:", error);
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
    // await triggerSoftRefresh("Concern");
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

    // The date only matters for concerns that touch attendance (leave and
    // missing-punch corrections). A general concern can be approved without
    // one - it used to be rejected with "Concern date is missing".
    const parsedConcernDate = ConcernDate
      ? moment.tz(String(ConcernDate).slice(0, 10), "YYYY-MM-DD", true, "Asia/Kolkata")
      : null;
    const concernDateUTC = parsedConcernDate && parsedConcernDate.isValid()
      ? parsedConcernDate.format("YYYY-MM-DD")
      : null;

    // ── LEAVE concern — create/update attendance with Leave status ──────────
    const isLeave = concernType && concernType.toLowerCase().includes("leave");
    if (isLeave && !concernDateUTC) {
      return res.status(400).json({ message: "Leave date is missing" });
    }
    if (isLeave) {
      let attendance = await Attendance.findOne({ user_id, currentDate: concernDateUTC });
      if (attendance && attendance.punchIn) {
        // The employee actually punched in that day - an approved leave must
        // not rewrite a day they worked (it used to flip it to "Leave").
      } else if (attendance) {
        attendance.status = "Leave";
        attendance.workStatus = "Leave";
        attendance.leaveApproved = true;
        attendance.leaveStatus = "Approved";
        await attendance.save();
      } else {
        const user = await User.findById(user_id);
        attendance = new Attendance({
          user_id,
          currentDate: concernDateUTC,
          shiftType: user?.type || "Day",
          status: "Leave",
          workStatus: "Leave",
          punchIn: null,
          punchOut: null,
          workingTime: 0,
          isPunchedIn: false,
          leaveApproved: true,
          leaveStatus: "Approved",
          ip: "System Generated",
        });
        await attendance.save();
      }
      concern.status = "Approved";
      await concern.save();
      const approveNotification = await Notification.create({
        userId: user_id,
        title: "Leave Approved",
        description: `Your leave request for ${concern.ConcernDate} has been approved.`,
        type: "CONCERN_STATUS",
        sender: null,
      });
      if (isUserOnline(user_id)) {
        emitToUser(user_id, "receive-notification", {
          title: approveNotification.title,
          description: approveNotification.description,
          type: approveNotification.type,
          sender: approveNotification.sender,
          timestamp: approveNotification.createdAt,
        });
        await Notification.updateOne({ _id: approveNotification._id }, { $set: { isRead: true } });
      }
      // Same "Concern" type submitConcern broadcasts, and what Concern.jsx's
      // list-refresh listener actually checks for — was "Concern_Employee"
      // here, a different string the frontend never matched, so other
      // admins' concern list (and the sidebar badge, which doesn't filter
      // by type but is fixed for good measure) didn't live-update on
      // approve/reject.
      await triggerSoftRefresh("Concern");
      return res.status(200).json({
        message: "Leave approved and attendance updated",
        concern,
        attendance,
      });
    }

    // ── Everything that is not a leave ──────────────────────────────────────
    // Approving a concern is an acknowledgement only. It must NOT rewrite
    // punch times or status. (It used to overwrite the day with 10:30-19:30,
    // a 9h "Full Day" and "On Time" for EVERY non-leave concern type -
    // including a late punch-in, a general "Employee Concern" or "Other".)
    //
    // Only a genuine missing-punch correction may add data, and only data
    // that is missing, using times the employee actually supplied:
    //   - no record for the day  -> create one from the supplied times
    //   - record without punch-in -> fill the punch-in
    //   - open record, no punch-out -> fill the punch-out
    // Existing punch times and the Late / On Time status are never changed.
    let attendance = null;
    const concernKind = (concernType || "").toLowerCase();
    const isPunchCorrection =
      concernKind.includes("forgot clock") ||
      concernKind.includes("punch in correction") ||
      concernKind.includes("punch out correction");

    const parseIST = (v) => {
      if (!v) return null;
      const m = moment.tz(v, ["YYYY-MM-DD hh:mm A", "YYYY-MM-DD HH:mm", moment.ISO_8601], true, "Asia/Kolkata");
      return m.isValid() ? m : null;
    };
    const claimedIn = isPunchCorrection ? parseIST(ActualPunchIn) : null;
    const claimedOut = isPunchCorrection ? parseIST(ActualPunchOut) : null;
    const workStatusFor = (mins) => (mins >= 420 ? "Full Day" : mins >= 300 ? "Half Day" : "Absent");

    if ((claimedIn || claimedOut) && concernDateUTC) {
      const user = await User.findOne({ _id: user_id });
      const shiftType = user?.type || "Day";
      attendance = await Attendance.findOne({ user_id: user_id, currentDate: concernDateUTC });

      if (!attendance && claimedIn) {
        const h = claimedIn.hour(), mi = claimedIn.minute();
        const late =
          (shiftType === "Day" && (h > 10 || (h === 10 && mi > 40))) ||
          (shiftType === "Night" && (h > 20 || (h === 20 && mi > 10)));
        const mins = claimedOut ? Math.max(claimedOut.diff(claimedIn, "minutes"), 0) : 0;
        attendance = new Attendance({
          user_id: user_id,
          currentDate: concernDateUTC,
          firstPunchIn: claimedIn.toDate(),
          punchIn: claimedIn.toDate(),
          punchOut: claimedOut ? claimedOut.toDate() : undefined,
          workingTime: mins,
          shiftType,
          status: late ? "Late" : "On Time",
          workStatus: claimedOut ? workStatusFor(mins) : "Absent",
          ip: "System Generated",
          isPunchedIn: false,
          leaveStatus: "Pending",
          leaveApproved: false,
        });
        await attendance.save();
      } else if (attendance && !attendance.punchIn && claimedIn) {
        const h = claimedIn.hour(), mi = claimedIn.minute();
        const late =
          (shiftType === "Day" && (h > 10 || (h === 10 && mi > 40))) ||
          (shiftType === "Night" && (h > 20 || (h === 20 && mi > 10)));
        attendance.firstPunchIn = claimedIn.toDate();
        attendance.punchIn = claimedIn.toDate();
        attendance.shiftType = shiftType;
        attendance.status = late ? "Late" : "On Time";
        if (claimedOut) {
          const mins = Math.max(claimedOut.diff(claimedIn, "minutes"), 0);
          attendance.punchOut = claimedOut.toDate();
          attendance.workingTime = mins;
          attendance.workStatus = workStatusFor(mins);
        }
        attendance.isPunchedIn = false;
        await attendance.save();
      } else if (attendance && attendance.punchIn && !attendance.punchOut && claimedOut) {
        const mins = Math.max(claimedOut.diff(moment(attendance.punchIn), "minutes"), 0);
        attendance.punchOut = claimedOut.toDate();
        attendance.workingTime = (attendance.workingTime || 0) + mins;
        attendance.workStatus = workStatusFor(attendance.workingTime);
        attendance.isPunchedIn = false;
        await attendance.save();
      }
    }
    concern.status = "Approved";
    await concern.save();
    const approveTitle = "Concern approved";
    const approveDescription = `Your ${concern.concernType || "concern"} for ${concern.ConcernDate || "the selected date"} was approved.`;
    const approveNotification = await Notification.create({
      userId: user_id,
      title: approveTitle,
      description: approveDescription,
      type: "CONCERN_STATUS",
      sender: null,
    });
    if (isUserOnline(user_id)) {
      emitToUser(user_id, "receive-notification", {
        title: approveNotification.title,
        description: approveNotification.description,
        type: approveNotification.type,
        sender: approveNotification.sender,
        timestamp: approveNotification.createdAt,
      });
      await Notification.updateOne(
        { _id: approveNotification._id },
        { $set: { isRead: true } }
      );
    }
    // console.log("approved")
    await triggerSoftRefresh("Concern");
    res.status(200).json({
      message: "Concern approved",
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
    const rejectTitle = "Concern rejected";
    const rejectDescription = `Your ${concern.concernType || "concern"} for ${concern.ConcernDate || "the selected date"} was rejected.`;
    const rejectNotification = await Notification.create({
      userId: user_id,
      title: rejectTitle,
      description: rejectDescription,
      type: "CONCERN_STATUS",
      sender: null,
    });
    if (isUserOnline(user_id)) {
      emitToUser(user_id, "receive-notification", {
        title: rejectNotification.title,
        description: rejectNotification.description,
        type: rejectNotification.type,
        sender: rejectNotification.sender,
        timestamp: rejectNotification.createdAt,
      });
      await Notification.updateOne(
        { _id: rejectNotification._id },
        { $set: { isRead: true } }
      );
    }
    await triggerSoftRefresh("Concern");
    res.status(200).json({ message: "Concern rejected successfully", concern });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

module.exports = {
  submitConcern,
  getAllConcerns,
  getPendingConcernsCount,
  getConcernsByUser,
  updateConcernStatus,
  approveConcern,
  rejectConcern
};
