const express = require("express");
const {
  createCallback,
  moveCallbackToSales,
  getUserCallbacks,
  getAllCallbacks,
  getCallbackById,
  updateCallback,
  deleteCallback,
} = require("../controllers/callbackController");

const router = express.Router();

router.post("/", createCallback);
router.post("/callback-to-sales", moveCallbackToSales);
router.get("/user/:id", getUserCallbacks);
router.get("/all", getAllCallbacks);
router.get("/:id", getCallbackById);
router.put("/:id", updateCallback);
router.delete("/:id", deleteCallback);

module.exports = router;
