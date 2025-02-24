const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const registeradminSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    phone: {
      type: Number,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    type: { type: String, enum: ['Admin', 'SuperAdmin'], required: true },
    otp: {
      type: String,
    },
    otpExpiration: {
      type: Date,
    },
  },
  { timestamps: true }
);

registeradminSchema.methods.generateAuthToken = async function () {
  try {
    // const expirationTime = Math.floor(Date.now() / 1000) + (60 * 60);
 
    let token = jwt.sign(
      { _id: this._id, expiresIn: '30d' },
      process.env.JWT_SECRET
    );
    return token;
  } catch (e) {
    console.log(`Failed to generate token --> ${e}`);
  }
};
const RegisteradminModal = mongoose.model("Admin", registeradminSchema);

module.exports = { RegisteradminModal };
