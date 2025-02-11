const SaleModel = require("../models/Sale");
const RegisteruserModal = require("../models/User");
const mongoose = require("mongoose");

// Create a new sale and associate with user
exports.createSale = async (req, res) => {
  try {
    const newSale = new SaleModel(req.body);

    // Save the sale to the database
    await newSale.save();

    // Associate the sale with the user
    await RegisteruserModal.findByIdAndUpdate(
      req.body.user_id,
      { $push: { sale: newSale._id } },
      { new: true }
    );

    res.json({ message: "Sale created and associated with user", data: newSale });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get sales associated with a user (populate)
exports.getSalesByUser = async (req, res) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.params.id);

    const data = await RegisteruserModal.aggregate([
      { $match: { _id: userId } },
      {
        $lookup: {
          from: "sales",
          localField: "_id",
          foreignField: "user_id",
          as: "sales",
        },
      },
    ]);

    res.status(200).json(data[0] || {});
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get all sales
exports.getAllSales = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;  // Default to page 1
    const limit = parseInt(req.query.limit) || 10; // Default limit is 10
    const skip = (page - 1) * limit;

    // Get total count (for frontend pagination info)
    const totalSales = await SaleModel.countDocuments();

    const data = await SaleModel.find().skip(skip).limit(limit);
    res.json({ page,
      limit,
      totalPages: Math.ceil(totalSales / limit),
      totalSales,
      data,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get a specific sale by ID
exports.getSaleById = async (req, res) => {
  try {
    const sale = await SaleModel.findById(req.params.id);
    if (!sale) return res.status(404).json({ error: "Sale not found" });

    res.json(sale);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Update a sale by ID
exports.updateSale = async (req, res) => {
  try {
    const updatedSale = await SaleModel.findByIdAndUpdate(req.params.id, req.body, { new: true });

    if (!updatedSale) return res.status(404).json({ error: "Sale not found" });

    res.json({ message: "Sale updated successfully", data: updatedSale });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Delete a sale by ID
exports.deleteSale = async (req, res) => {
  try {
    const deletedSale = await SaleModel.findByIdAndDelete(req.params.id);

    if (!deletedSale) return res.status(404).json({ error: "Sale not found" });

    res.json({ message: "Sale deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
