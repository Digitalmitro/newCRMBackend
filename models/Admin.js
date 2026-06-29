const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const registeradminSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: Number, required: true },
    password: { type: String, required: true },
    type: { type: String, enum: ['Admin', 'SuperAdmin'], default: 'Admin' },
    role: { type: String, enum: ['admin', 'superadmin'], default: 'admin' },
    avatar: { type: String, default: "" },
    jobDescription: { type: String, default: "" },
    otp: { type: String },
    otpExpiration: { type: Date },
    fcmToken: { type: String, default: "" }, // Firebase push notification token

    // Granular permissions
    permissions: {
      // Sidebar visibility
      notes:      { access: { type: Boolean, default: false } },
      callbacks:  { access: { type: Boolean, default: false } },
      attendance: { access: { type: Boolean, default: false } },
      transfer:   { access: { type: Boolean, default: false } },
      sales:      { access: { type: Boolean, default: false } },
      activity:   { access: { type: Boolean, default: false } },
      concern:    { access: { type: Boolean, default: false } },
      notification: { access: { type: Boolean, default: false } },
      tasks:      { access: { type: Boolean, default: false } },
      salary:     { access: { type: Boolean, default: false } },
      // Action permissions
      task:    { create: { type: Boolean, default: false }, delete: { type: Boolean, default: false } },
      channel: { create: { type: Boolean, default: false }, delete: { type: Boolean, default: false }, edit: { type: Boolean, default: false } },
      salarySheet: { upload: { type: Boolean, default: false }, revoke: { type: Boolean, default: false } },
      payslip: { upload: { type: Boolean, default: false }, revoke: { type: Boolean, default: false } },
      report:  { add: { type: Boolean, default: false }, delete: { type: Boolean, default: false } },
      taskManagement: { access: { type: Boolean, default: false } },
      employee: { create: { type: Boolean, default: false }, edit: { type: Boolean, default: false }, delete: { type: Boolean, default: false } },
    },

    // Scope — which employees and channels this admin can manage
    allEmployees: { type: Boolean, default: true },
    allowedEmployees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    allChannels: { type: Boolean, default: true },
    allowedChannels: [{ type: mongoose.Schema.Types.ObjectId, ref: "Channel" }],
  },
  { timestamps: true }
);

registeradminSchema.methods.generateAuthToken = async function () {
  try {
    let token = jwt.sign(
      { name: this.name, userId: this._id, role: this.role, expiresIn: '30d' },
      process.env.JWT_SECRET
    );
    return token;
  } catch (e) {
    console.log(`Failed to generate token --> ${e}`);
  }
};

const RegisteradminModal = mongoose.model("Admin", registeradminSchema);
module.exports = RegisteradminModal;
