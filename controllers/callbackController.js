const CallbackModel = require("../models/CallBack");
const RegisteruserModal = require("../models/User");
const SaleModel = require("../models/Sale");
const mongoose = require("mongoose");

// ✅ Create a new callback
exports.createCallback = async (req, res) => {
  const userId=req.user.userId;
  try {
    const { name, email, phone, calldate, domainName, budget, country, address, comments } = req.body;
    const newCallback = new CallbackModel({ 
        name, 
        email, 
        phone, 
        calldate, 
        domainName, 
        budget, 
        country, 
        address, 
        comments,
        user_id: userId 
    });
    
    
    await newCallback.save();


    
    res.send("Transfer created and associated with user");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};

// ✅ Move a callback to sales
exports.moveCallbackToSales = async (req, res) => {
  try {
    const { callback_id, saleData } = req.body;
    const deletedCallback = await CallbackModel.findByIdAndDelete(callback_id);

    if (!deletedCallback) return res.status(404).send("Callback not found");

    delete saleData._id; // Prevent ID conflicts
    const newSale = await SaleModel.create(saleData);

    await RegisteruserModal.findByIdAndUpdate(deletedCallback.user_id, {
      $push: { sale: newSale._id },
    });

    res.send({
      message: "Callback deleted and sales record created successfully",
      sale: newSale,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};

// ✅ Get all callbacks for a specific user
exports.getUserCallbacks = async (req, res) => {
  try {
    const ID = new mongoose.Types.ObjectId(req.params.id);
    const data = await RegisteruserModal.aggregate([
      { $match: { _id: ID } },
      { $lookup: { from: "callbacks", localField: "_id", foreignField: "user_id", as: "callback" } },
    ]);

    res.status(200).json(data[0] || {});
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};

// ✅ Get all callbacks
exports.getAllCallbacks = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;  // Default to page 1
    const limit = parseInt(req.query.limit) || 10; // Default limit is 10
    const skip = (page - 1) * limit;

    // Fetch callbacks with pagination
    const data = await CallbackModel.find().skip(skip).limit(limit).sort({createdAt:-1});

    // Get total count (for frontend pagination info)
    const totalCallbacks = await CallbackModel.countDocuments();

    res.status(200).json({
      page,
      limit,
      totalPages: Math.ceil(totalCallbacks / limit),
      totalCallbacks,
      data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
};

// ✅ Get a single callback by ID
exports.getCallbackById = async (req, res) => {
  try {
     const user_id = req.user.userId
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch callbacks only for the logged-in user
    const data = await CallbackModel.find({ user_id })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    // Get total count for pagination
    const totalCallbacks = await CallbackModel.countDocuments({ user_id });

    res.status(200).json({
      page,
      limit,
      totalPages: Math.ceil(totalCallbacks / limit),
      totalCallbacks,
      data,
    });
  } catch (error) {
    console.error("Error fetching user callbacks:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// ✅ Update a callback
exports.updateCallback = async (req, res) => {
  try {
    const updatedCallback = await CallbackModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedCallback) return res.status(404).send("Callback not found");
    res.send("Callback updated successfully");
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
};

// ✅ Delete a callback
exports.deleteCallback = async (req, res) => {
  try {
    const deletedCallback = await CallbackModel.findByIdAndDelete(req.params.id);
    if (!deletedCallback) return res.status(404).send("Callback not found");
    res.send("Callback deleted successfully");
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
};
