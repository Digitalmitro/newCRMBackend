const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const registeradminSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: Number, required: true },
    password: { type: String, required: true },
    type: { type: String, enum: ['Admin', 'SuperAdmin'], default: 'Admin' },
    // role distinguishes superadmin from regular admin
    role: { type: String, enum: ['admin', 'superadmin'], default: 'admin' },
    avatar: { type: String, default: "" },
    otp: { type: String },
    otpExpiration: { type: Date },
    // Granular permissions — superadmin always has all, regular admins get
    // whatever the superadmin grants them.
    permissions: {
      task:    { create: { type: Boolean, default: false }, delete: { type: Boolean, default: false } },
      channel: { create: { type: Boolean, default: false }, delete: { type: Boolean, default: false }, edit: { type: Boolean, default: false } },
      salary:  { upload: { type: Boolean, default: false }, revoke: { type: Boolean, default: false } },
      payslip: { upload: { type: Boolean, default: false }, revoke: { type: Boolean, default: false } },
      report:  { add:    { type: Boolean, default: false }, delete: { type: Boolean, default: false } },
      taskManagement: { access: { type: Boolean, default: false } },
    },
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
