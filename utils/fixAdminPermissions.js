/**
 * utils/fixAdminPermissions.js
 *
 * One-time migration — run once after deploying the backend update:
 *   node utils/fixAdminPermissions.js
 *
 * What it does: every admin in the DB who has a permissions object
 * (i.e. not a blank record) but is missing the "employee" key gets that
 * key added with { create: false, edit: false, delete: false }.
 *
 * This fixes the bug where admins created before "employee" was added
 * to DEFAULT_PERMISSIONS had no employee key in their stored permissions,
 * causing requirePermission("employee","create") to see `undefined` and
 * return a 403 — even if the SuperAdmin intended to grant the permission
 * but the UI never surfaced it.
 *
 * After running this script, SuperAdmin can go to Manage Admins and
 * toggle "Create employee" ON for whichever admins should have it.
 *
 * Safe to run multiple times — skips admins who already have the key.
 */

require("../config/db");          // connect to MongoDB
const Admin = require("../models/Admin");

const MISSING_KEY_DEFAULTS = {
  employee: { create: false, edit: false, delete: false },
};

(async () => {
  try {
    const admins = await Admin.find({ role: { $ne: "superadmin" } }).lean();
    let fixed = 0;
    let skipped = 0;

    for (const admin of admins) {
      const perms = admin.permissions || {};
      const hasAnyPerms = Object.keys(perms).length > 0;

      // Only touch admins who already have some permissions set — blank
      // records are handled by the safety fallback in permissionMiddleware.
      if (!hasAnyPerms) { skipped++; continue; }

      const updates = {};
      for (const [key, defaults] of Object.entries(MISSING_KEY_DEFAULTS)) {
        if (perms[key] === undefined) {
          updates[`permissions.${key}`] = defaults;
        }
      }

      if (Object.keys(updates).length === 0) { skipped++; continue; }

      await Admin.updateOne({ _id: admin._id }, { $set: updates });
      console.log(`  Fixed admin ${admin.name} (${admin._id}): added keys ${Object.keys(updates).join(", ")}`);
      fixed++;
    }

    console.log(`\nDone. Fixed: ${fixed}, Already OK / skipped: ${skipped}`);
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
})();
