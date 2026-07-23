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

/**
 * The reverse of getAdminScope: given one employee, returns the _id strings
 * of every admin who is in scope for that employee (superadmin, or
 * allEmployees !== false, or explicitly listed in that admin's
 * allowedEmployees) — i.e. exactly the admins for whom this employee already
 * shows up in getAllUsers / getAllConcerns / the attendance list.
 *
 * Used to fan out notifications (concern submitted, callback created, ...)
 * to the same audience that can already see the underlying record, instead
 * of blasting every admin in the system regardless of their scope.
 *
 * @param {string} employeeId
 * @param {string|null} excludeId - an id to leave out of the result (e.g. the actor)
 */
const getAdminIdsForEmployee = async (employeeId, excludeId = null) => {
  const admins = await Admin.find({}, "role allEmployees allowedEmployees").lean();
  const empId = employeeId?.toString();
  const excluded = excludeId?.toString();
  return admins
    .filter((admin) => {
      if (admin.role === "superadmin") return true;
      if (admin.allEmployees !== false) return true;
      return (admin.allowedEmployees || []).some((id) => id.toString() === empId);
    })
    .map((admin) => admin._id.toString())
    .filter((id) => id !== excluded);
};

/**
 * Same idea as getAdminIdsForEmployee, scoped to channel visibility
 * (allChannels / allowedChannels) instead of employee visibility.
 *
 * @param {string} channelId
 * @param {string|null} excludeId - an id to leave out of the result (e.g. the actor)
 */
const getAdminIdsForChannelScope = async (channelId, excludeId = null) => {
  const admins = await Admin.find({}, "role allChannels allowedChannels").lean();
  const chId = channelId?.toString();
  const excluded = excludeId?.toString();
  return admins
    .filter((admin) => {
      if (admin.role === "superadmin") return true;
      if (admin.allChannels !== false) return true;
      return (admin.allowedChannels || []).some((id) => id.toString() === chId);
    })
    .map((admin) => admin._id.toString())
    .filter((id) => id !== excluded);
};

/**
 * Filters a list of admin ids down to those who actually have the given
 * permission (or are superadmin, or have no permissions object set at all —
 * same legacy-account fallback requirePermission uses). Meant to be layered
 * on top of getAdminIdsForEmployee / getAdminIdsForChannelScope: being in
 * scope for an employee/channel is necessary but not sufficient — the admin
 * also needs to actually have access to the relevant page (e.g. "callbacks"
 * -> Sidebar Access: Callbacks) before it makes sense to email them about it.
 *
 * @param {string[]} adminIds
 * @param {string} resource - e.g. "callbacks", "concern", "tasks"
 * @param {string} action - e.g. "access"
 */
const filterAdminIdsByPermission = async (adminIds, resource, action) => {
  if (!adminIds?.length) return [];
  const { adminHasPermission } = require("../middlewares/permissionMiddleware");
  const admins = await Admin.find({ _id: { $in: adminIds } }, "role permissions").lean();
  return admins
    .filter((admin) => adminHasPermission(admin, resource, action))
    .map((admin) => admin._id.toString());
};

module.exports = {
  getAdminScope,
  getAdminIdsForEmployee,
  getAdminIdsForChannelScope,
  filterAdminIdsByPermission,
};
