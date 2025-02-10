
const TransferModel = require("../models/Transfer");
const RegisteruserModal = require("../models/User");
const CallbackModel = require("../models/CallBack");
const SaleModel = require("../models/Sale");
const mongoose = require("mongoose");

// ✅ Create a new transfer
exports.createTransfer = async (req, res) => {
  try {
    const newTransfer = new TransferModel(req.body);
    await newTransfer.save();

    await RegisteruserModal.findByIdAndUpdate(req.body.user_id, {
      $push: { transfer: newTransfer._id },
    });

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
      { $lookup: { from: "transfers", localField: "_id", foreignField: "user_id", as: "transfer" } },
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
    const data = await TransferModel.find().sort({ createdAt: -1 });
    res.send(data);
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
};

// ✅ Get a single transfer by ID
exports.getTransferById = async (req, res) => {
  try {
    const transfer = await TransferModel.findById(req.params.id);
    if (!transfer) return res.status(404).send("Transfer not found");
    res.send(transfer);
  } catch (error) {
    console.error(error);
    res.status(500).send(error);
  }
};

// Update a document by ID
exports.updateTransfer = async (req, res) => {
  const packageId = req.params.id;
  const updateData = req.body;

  try {
    const updatedPackage = await TransferModel.findByIdAndUpdate(packageId, updateData, { new: true });

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
