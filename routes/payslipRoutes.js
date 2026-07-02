const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");
const { upload } = require("../utils/fileUpload");
const payslipController = require("../controllers/payslipController");

router.post("/", authMiddleware, requirePermission("payslip", "upload"), upload.single("file"), payslipController.uploadPayslip);
router.post("/bulk", authMiddleware, requirePermission("payslip", "upload"), upload.array("files", 100), payslipController.bulkUploadPayslips);
router.get("/me", authMiddleware, payslipController.listMyPayslips);
router.get("/download/:id", authMiddleware, payslipController.downloadPayslip);
router.get("/employee/:employeeId", authMiddleware, payslipController.listEmployeePayslips);
router.delete("/:id", authMiddleware, requirePermission("payslip", "revoke"), payslipController.deletePayslip);

module.exports = router;
