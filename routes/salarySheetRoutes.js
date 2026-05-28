const express = require("express");
const multer = require("multer");
const { authMiddleware } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");
const {
  uploadSalarySheet,
  listSalarySheets,
  deleteSalarySheet,
} = require("../controllers/salarySheetController");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get("/", authMiddleware, listSalarySheets);
router.post("/upload", authMiddleware, requirePermission("salarySheet", "upload"), upload.single("file"), uploadSalarySheet);
router.delete("/:id", authMiddleware, requirePermission("salarySheet", "revoke"), deleteSalarySheet);

module.exports = router;
