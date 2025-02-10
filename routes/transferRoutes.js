const express = require("express");
const {
  createTransfer,
  moveTransferToSales,
  moveTransferToCallback,
  getUserTransfers,
  getAllTransfers,
  getTransferById,
  updateTransfer,
  deleteTransfer,
} = require("../controllers/transferController");

const router = express.Router();

router.post("/", createTransfer);
router.post("/transfer-to-sales", moveTransferToSales);
router.post("/transfer-to-callback", moveTransferToCallback);
router.get("/user/:id", getUserTransfers);
router.get("/all", getAllTransfers);
router.get("/:id", getTransferById);
router.put("/:id", updateTransfer);
router.delete("/:id", deleteTransfer);

module.exports = router;
