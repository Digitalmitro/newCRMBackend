const mongoose = require('mongoose');

const ChannelReportSchema = new mongoose.Schema({
  channelId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Channel", 
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
  description: { 
    type: String, 
    default: '' 
  },
}, { timestamps: true });

// Ensure one report per channel per month
ChannelReportSchema.index({ channelId: 1, month: 1, year: 1 }, { unique: true });

const ChannelReport = mongoose.model("ChannelReport", ChannelReportSchema);
module.exports = ChannelReport;
