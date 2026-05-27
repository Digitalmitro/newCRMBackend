const Admin = require("../models/Admin");

// Returns true if the admin has a specific permission OR is superadmin.
// Usage: requirePermission("task", "create")
const requirePermission = (resource, action) => async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const admin = await Admin.findById(userId).select("role permissions").lean();
    if (!admin) return res.status(403).json({ success: false, message: "Not an admin." });

    // Superadmin bypasses all permission checks
    if (admin.role === "superadmin") return next();

    const allowed = admin.permissions?.[resource]?.[action];
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: `You don't have permission to ${action} ${resource}.`,
      });
    }
    next();
  } catch (err) {
    console.error("permissionMiddleware error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Middleware that only allows superadmin through
const requireSuperAdmin = async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const admin = await Admin.findById(userId).select("role").lean();
    if (!admin || admin.role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Superadmin access required." });
    }
    next();
  } catch (err) {
    console.error("requireSuperAdmin error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

module.exports = { requirePermission, requireSuperAdmin };
