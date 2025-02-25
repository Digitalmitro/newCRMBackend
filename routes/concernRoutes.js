const express = require("express");
const {
  submitConcern,
  getAllConcerns,
  getConcernsByUser,
  updateConcernStatus
} = require("../controllers/concernController");
const {authMiddleware} = require("../middlewares/authMiddleware")
const router = express.Router();

// Routes
router.post("/submit", authMiddleware, submitConcern);
router.get("/all", getAllConcerns);
router.get("/user",authMiddleware, getConcernsByUser);
router.put("/update/:concernId", updateConcernStatus);

module.exports = router;
