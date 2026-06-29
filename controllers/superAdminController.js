const bcrypt = require("bcryptjs");
const Admin = require("../models/Admin");
const User = require("../models/User");
const Channel = require("../models/Channels");

// GET /superadmin/all-employees — for the employee picker
exports.getAllEmployeesForPicker = async (req, res) => {
  try {
    const users = await User.find({ isDeleted: { $ne: true } })
      .select("_id name email avatar")
      .sort({ name: 1 })
      .lean();
    return res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET /superadmin/all-channels — for the channel picker
exports.getAllChannelsForPicker = async (req, res) => {
  try {
    const channels = await Channel.find()
      .select("_id name image")
      .sort({ name: 1 })
      .lean();
    return res.json({ success: true, channels });
  } catch (err) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// PATCH /superadmin/admins/:id/scope — update employee/channel scope
exports.updateScope = async (req, res) => {
  try {
    const { allEmployees, allowedEmployees, allChannels, allowedChannels } = req.body;
    const update = {};
    if (allEmployees !== undefined) update.allEmployees = allEmployees;
    if (allowedEmployees !== undefined) update.allowedEmployees = allowedEmployees;
    if (allChannels !== undefined) update.allChannels = allChannels;
    if (allowedChannels !== undefined) update.allowedChannels = allowedChannels;

    const admin = await Admin.findOneAndUpdate(
      { _id: req.params.id, role: { $ne: "superadmin" } },
      { $set: update },
      { new: true, select: "-password -otp -otpExpiration" }
    );
    if (!admin) return res.status(404).json({ success: false, message: "Admin not found." });
    return res.json({ success: true, admin });
  } catch (err) {
    console.error("updateScope error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const DEFAULT_PERMISSIONS = {
  task:    { create: false, delete: false },
  channel: { create: false, delete: false, edit: false },
  // Bug fix: this was "salary" (which in the schema is just the sidebar
  // visibility toggle, {access: bool}) instead of "salarySheet" (the
  // actual upload/revoke action permission) — meant the fallback never
  // matched anything in the real schema. Harmless in practice today
  // since the create-admin form always sends explicit permissions now,
  // but worth having correct for any other caller that omits permissions.
  salarySheet: { upload: false, revoke: false },
  payslip: { upload: false, revoke: false },
  report:  { add: false, delete: false },
  taskManagement: { access: false },
};

// GET /superadmin/admins — list all non-superadmin admins
exports.listAdmins = async (req, res) => {
  try {
    const admins = await Admin.find({ role: { $ne: "superadmin" } })
      .select("-password -otp -otpExpiration")
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, admins });
  } catch (err) {
    console.error("listAdmins error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// POST /superadmin/admins — create a new admin
exports.createAdmin = async (req, res) => {
  try {
    const { name, email, phone, password, permissions } = req.body;
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: "name, email, phone and password are required." });
    }
    const existing = await Admin.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: "An admin with this email already exists." });
    }
    const hashed = await bcrypt.hash(password, 10);
    const admin = await Admin.create({
      name,
      email,
      phone,
      password: hashed,
      type: "Admin",
      role: "admin",
      permissions: permissions || DEFAULT_PERMISSIONS,
    });
    const { password: _, otp, otpExpiration, ...safe } = admin.toObject();
    return res.status(201).json({ success: true, admin: safe });
  } catch (err) {
    console.error("createAdmin error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// PATCH /superadmin/admins/:id/permissions — update permissions
exports.updatePermissions = async (req, res) => {
  try {
    const { permissions } = req.body;
    if (!permissions) {
      return res.status(400).json({ success: false, message: "permissions object required." });
    }
    const admin = await Admin.findOneAndUpdate(
      { _id: req.params.id, role: { $ne: "superadmin" } },
      { $set: { permissions } },
      { new: true, select: "-password -otp -otpExpiration" }
    );
    if (!admin) return res.status(404).json({ success: false, message: "Admin not found." });
    return res.json({ success: true, admin });
  } catch (err) {
    console.error("updatePermissions error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// PATCH /superadmin/admins/:id — update admin details (name, phone, email)
exports.updateAdmin = async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    const update = {};
    if (name) update.name = name;
    if (email) update.email = email;
    if (phone) update.phone = phone;
    if (password) update.password = await bcrypt.hash(password, 10);

    const admin = await Admin.findOneAndUpdate(
      { _id: req.params.id, role: { $ne: "superadmin" } },
      { $set: update },
      { new: true, select: "-password -otp -otpExpiration" }
    );
    if (!admin) return res.status(404).json({ success: false, message: "Admin not found." });
    return res.json({ success: true, admin });
  } catch (err) {
    console.error("updateAdmin error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// DELETE /superadmin/admins/:id — delete an admin
exports.deleteAdmin = async (req, res) => {
  try {
    const admin = await Admin.findOneAndDelete({ _id: req.params.id, role: { $ne: "superadmin" } });
    if (!admin) return res.status(404).json({ success: false, message: "Admin not found." });
    return res.json({ success: true, message: "Admin deleted." });
  } catch (err) {
    console.error("deleteAdmin error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET /superadmin/me — current superadmin profile
exports.getSuperAdminProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.userId).select("-password -otp -otpExpiration").lean();
    if (!admin) return res.status(404).json({ success: false, message: "Not found." });
    return res.json({ success: true, admin });
  } catch (err) {
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
