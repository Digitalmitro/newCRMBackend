const TransferModel = require("../models/Transfer");
const RegisteruserModal = require("../models/User");
const CallbackModel = require("../models/CallBack");
const SaleModel = require("../models/Sale");
const mongoose = require("mongoose");

// ✅ Create a new transfer
exports.createTransfer = async (req, res) => {
  const userId = req.user.userId;

  try {
    const {
      name,
      email,
      phone,
      calldate,
      domainName,
      buget,
      country,
      address,
      comments,
    } = req.body;
    const newTransfer = new TransferModel({
      name,
      email,
      phone,
      calldate,
      domainName,
      buget,
      country,
      address,
      comments,
      user_id: userId,
    });

    await newTransfer.save();

    res.send("Transfer created and associated with user");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};

// ✅ Move a transfer to sales
exports.moveTransferToSales = async (req, res) => {
  try {
    const { transfer_id, saleData } = req.body;
    const deletedTransfer = await TransferModel.findByIdAndDelete(transfer_id);

    if (!deletedTransfer) return res.status(404).send("Transfer not found");

    delete saleData._id;
    const newSale = await SaleModel.create(saleData);

    await RegisteruserModal.findByIdAndUpdate(deletedTransfer.user_id, {
      $push: { sale: newSale._id },
    });

    res.send({
      message: "Transfer deleted and sales record created successfully",
      sale: newSale,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};

// ✅ Move a transfer to a callback
exports.moveTransferToCallback = async (req, res) => {
  try {
    const { transfer_id, callbackData } = req.body;
    const deletedTransfer = await TransferModel.findByIdAndDelete(transfer_id);

    if (!deletedTransfer) return res.status(404).send("Transfer not found");

    delete callbackData._id;
    const newCallback = await CallbackModel.create(callbackData);

    await RegisteruserModal.findByIdAndUpdate(deletedTransfer.user_id, {
      $push: { callback: newCallback._id },
    });

    res.send({
      message: "Transfer deleted and callback record created successfully",
      callback: newCallback,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};

// ✅ Get all transfers for a specific user
exports.getUserTransfers = async (req, res) => {
  try {
    const ID = new mongoose.Types.ObjectId(req.params.id);
    const data = await RegisteruserModal.aggregate([
      { $match: { _id: ID } },
      {
        $lookup: {
          from: "transfers",
          localField: "_id",
          foreignField: "user_id",
          as: "transfer",
        },
      },
    ]);

    res.status(200).json(data[0] || {});
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
};

// ✅ Get all transfers
exports.getAllTransfers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const data = await TransferModel.find()
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    const totalTransfer = await TransferModel.countDocuments();

    res.status(200).json({
      page,
      limit,
      totalPages: Math.ceil(totalTransfer / limit),
      totalTransfer,
      data,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
};

// ✅ Get a single transfer by ID
exports.getTransferById = async (req, res) => {
  try {
    const user_id = req.user.userId;
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch callbacks only for the logged-in user
    const data = await TransferModel.find({ user_id })
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    // Get total count for pagination
    const totalTransfer = await TransferModel.countDocuments({ user_id });

    res.status(200).json({
      page,
      limit,
      totalPages: Math.ceil(totalTransfer / limit),
      totalTransfer,
      data,
    });
  } catch (error) {
    console.error("Error fetching user callbacks:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Update a document by ID
exports.updateTransfer = async (req, res) => {
  const packageId = req.params.id;
  const updateData = req.body;
  try {
    const updatedPackage = await TransferModel.findByIdAndUpdate(
      packageId,
      updateData,
      { new: true }
    );

    if (!updatedPackage) {
      return res.status(404).json({ message: "Package not found" });
    }

    res.json({ message: "Package updated successfully", data: updatedPackage });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Delete a document by ID
exports.deleteTransfer = async (req, res) => {
  const packageId = req.params.id;

  try {
    const deletedPackage = await TransferModel.findByIdAndDelete(packageId);

    if (!deletedPackage) {
      return res.status(404).json({ message: "Package not found" });
    }

    res.json({ message: "Package deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

exports.searchTransfers = async (req, res) => {
  try {
    const { email, phone, domainName, page = 1, limit = 10 } = req.query;
    const query = {};

    if (email) query.email = { $regex: email, $options: "i" };
    if (phone) query.phone = { $regex: phone, $options: "i" };
    if (domainName) query.domainName = { $regex: domainName, $options: "i" };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch matching transfers with pagination
    const data = await TransferModel.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    // Count total documents matching the query
    const totalCount = await TransferModel.countDocuments(query);

    res.status(200).json({
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
      data,
    });
  } catch (error) {
    console.error("Error searching transfers:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
