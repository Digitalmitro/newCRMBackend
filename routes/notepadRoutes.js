const express = require("express");
const { saveNotes, getNotes } = require("../controllers/notepadController");
const {authMiddleware}= require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/", authMiddleware, saveNotes); 
router.get("/", authMiddleware, getNotes); 

module.exports = router;
