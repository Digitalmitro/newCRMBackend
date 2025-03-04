const express = require("express");
const {
  submitConcern,
  getAllConcerns,
  getConcernsByUser,
  updateConcernStatus,
  approveConcern,
  rejectConcern
} = require("../controllers/concernController");
const {authMiddleware} = require("../middlewares/authMiddleware")
const router = express.Router();

// Routes
router.post("/submit", authMiddleware, submitConcern);
router.get("/all", getAllConcerns);
router.get("/user",authMiddleware, getConcernsByUser);
router.put("/update/:concernId", updateConcernStatus);
router.patch("/approve/:id",approveConcern);
router.patch("/reject/:id", rejectConcern);

module.exports = router;
