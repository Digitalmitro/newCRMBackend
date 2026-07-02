const Admin = require("../models/Admin");

// Returns true if the admin has a specific permission OR is superadmin.
// Usage: requirePermission("task", "create")
const requirePermission = (resource, action) => async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const admin = await Admin.findById(userId).select("role permissions").lean();

    // Not an admin (employee or client) — let them through, no permission restrictions apply
    if (!admin) return next();

    // Superadmin bypasses all permission checks
    if (admin.role === "superadmin") return next();

    // Safety fallback: if the admin has no permissions field set at all
    // (old accounts created before this system), grant full access.
    const hasPermissionsSet = admin.permissions &&
      Object.keys(admin.permissions).length > 0 &&
      Object.values(admin.permissions).some(
        (g) => Object.values(g).some((v) => v === true || v === false)
      );
    if (!hasPermissionsSet) return next();

    const allowed = admin.permissions?.[resource]?.[action];
    // Treat both explicit false AND missing key the same way (denied).
    // The distinction matters for the error message but not the outcome.
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: `You don't have permission to ${action} ${resource}. Ask a SuperAdmin to grant this access in Manage Admins.`,
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
