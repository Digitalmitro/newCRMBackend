const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware");
const { requireSuperAdmin } = require("../middlewares/permissionMiddleware");
const ctrl = require("../controllers/superAdminController");

// All routes require auth + superadmin role
router.use(authMiddleware, requireSuperAdmin);

router.get("/me", ctrl.getSuperAdminProfile);
router.get("/admins", ctrl.listAdmins);
router.post("/admins", ctrl.createAdmin);
router.patch("/admins/:id", ctrl.updateAdmin);
router.patch("/admins/:id/permissions", ctrl.updatePermissions);
router.patch("/admins/:id/scope", ctrl.updateScope);
router.delete("/admins/:id", ctrl.deleteAdmin);
router.get("/all-employees", ctrl.getAllEmployeesForPicker);
router.get("/all-channels", ctrl.getAllChannelsForPicker);

module.exports = router;
