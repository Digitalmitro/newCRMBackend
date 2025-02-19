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
    otp: {
      type: String,
    },
    otpExpiration: {
      type: Date,
    },
  },
  { timestamps: true }
);


const RegisteradminModal = mongoose.model("Admin", registeradminSchema);

module.exports = { RegisteradminModal };
