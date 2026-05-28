const Admin = require("../models/Admin");
const mongoose = require("mongoose");

/**
 * Returns scope info for the calling admin:
 *  - isSuperAdmin: true/false
 *  - allEmployees: true/false
 *  - allowedEmployees: array of ObjectId strings
 *  - allChannels: true/false
 *  - allowedChannels: array of ObjectId strings
 * 
 * If user is not an admin (null userId or not found), returns null.
 */
const getAdminScope = async (userId) => {
  if (!userId) return null;
  const admin = await Admin.findById(userId)
    .select("role allEmployees allowedEmployees allChannels allowedChannels permissions")
    .lean();
  if (!admin) return null;
  return {
    isSuperAdmin: admin.role === "superadmin",
    allEmployees: admin.role === "superadmin" ? true : (admin.allEmployees !== false),
    allowedEmployees: (admin.allowedEmployees || []).map((id) => id.toString()),
    allChannels: admin.role === "superadmin" ? true : (admin.allChannels !== false),
    allowedChannels: (admin.allowedChannels || []).map((id) => id.toString()),
    permissions: admin.permissions || {},
  };
};

module.exports = { getAdminScope };
