const express = require("express");
const {
  signup,
  login,
  createUserByAdmin,
  getUserName,
  adminLogin,
  adminSignup,
  verifyAdminOtp,
  getAdminProfile,
  updateAdminProfile,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} = require("../controllers/authController");

const { authMiddleware } = require("../middlewares/authMiddleware");
const { requirePermission } = require("../middlewares/permissionMiddleware");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/admin/create-user", authMiddleware, requirePermission("employee", "create"), createUserByAdmin);
router.get("/all", authMiddleware, getUserName);

//for admin part
router.post("/loginadmin", adminLogin);
router.post("/registeradmin", adminSignup);
router.post("/verify-otp", verifyAdminOtp);
router.get("/admin/profile", authMiddleware, getAdminProfile);
router.put("/admin/profile", authMiddleware, updateAdminProfile);

// 🔹 Get all users
router.get("/", getAllUsers);

// 🔹 Get user by ID
router.get("/:id", getUserById);

// 🔹 Update user
router.put("/:id", authMiddleware, requirePermission("employee", "edit"), updateUser);

// 🔹 Delete user
router.delete("/:id", authMiddleware, requirePermission("employee", "delete"), deleteUser);

module.exports = router;
