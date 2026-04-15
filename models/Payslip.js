const mongoose = require('mongoose');

const PayslipSchema = new mongoose.Schema({
  employeeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  month: { 
    type: String, 
    required: true,
    enum: ['January', 'February', 'March', 'April', 'May', 'June', 
           'July', 'August', 'September', 'October', 'November', 'December']
  },
  year: { 
    type: Number, 
    required: true 
  },
  fileUrl: { 
    type: String, 
    required: true // PDF file path/URL
  },
  fileName: { 
    type: String, 
    required: true
  },
  uploadedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Admin", 
    required: true 
  },
  uploadedAt: { 
    type: Date, 
    default: Date.now 
  },
}, { timestamps: true });

// Ensure one payslip per employee per month
PayslipSchema.index({ employeeId: 1, month: 1, year: 1 }, { unique: true });

const Payslip = mongoose.model("Payslip", PayslipSchema);
module.exports = Payslip;
