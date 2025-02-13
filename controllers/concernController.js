const { ConcernModel } = require("../models/concern");

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
      ConcernDate,
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
    const { userId } = req.params;
    const concerns = await ConcernModel.find({ user_id: userId }).sort({ createdAt: -1 });

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

module.exports = {
  submitConcern,
  getAllConcerns,
  getConcernsByUser,
  updateConcernStatus
};
