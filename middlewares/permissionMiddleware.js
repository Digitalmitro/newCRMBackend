const Admin = require("../models/Admin");

// Pure check: does this admin doc (needs only role + permissions) have a
// given permission? Mirrors requirePermission's rules exactly — superadmin
// bypasses everything, admins with no permissions object at all (accounts
// created before this system existed) are treated as fully permitted, and
// otherwise the specific resource/action must be explicitly true.
// Exported so callers outside this middleware (e.g. notification fan-out in
// utils/adminScope.js) can apply the identical rule — an admin should never
// be emailed about something they don't have permission to even see.
const adminHasPermission = (admin, resource, action) => {
  if (!admin) return true;
  if (admin.role === "superadmin") return true;

  const hasPermissionsSet = admin.permissions &&
    Object.keys(admin.permissions).length > 0 &&
    Object.values(admin.permissions).some(
      (g) => Object.values(g).some((v) => v === true || v === false)
    );
  if (!hasPermissionsSet) return true;

  return admin.permissions?.[resource]?.[action] === true;
};

// Returns true if the admin has a specific permission OR is superadmin.
// Usage: requirePermission("task", "create")
const requirePermission = (resource, action) => async (req, res, next) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const admin = await Admin.findById(userId).select("role permissions").lean();

    // Not an admin (employee or client) — let them through, no permission restrictions apply
    if (!admin) return next();

    if (!adminHasPermission(admin, resource, action)) {
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

module.exports = { requirePermission, requireSuperAdmin, adminHasPermission };
