const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  country: { type: String, default: "Unknown" },
  lastLogin: { type: Date },
  ipAddress: { type: String, default: "Unknown" },
  userAgent: { type: String, default: "Unknown" },
  deviceToken: { type: String, default: null },
  allowedDevices: { type: [String], default: [] }, // ✅ Approved devices
  pendingDevices: {
    type: [
      {
        deviceToken: String,
        ipAddress: String,
        userAgent: String,
        country: String,
        approved: Boolean,
      },
    ],
    default: [],
  },
  loginHistory: {
    type: [
      {
        deviceToken: String,
        ipAddress: String,
        userAgent: String,
        country: String,
        loginTime: Date,
      },
    ],
    default: [],
  },
  
  paymentHistory: {
    type: [
      {
        paymentId: String,
        amount: Number,
        downloadLimitAdded: Number,
        status: String,
        date: Date,
      },
    ],
    default: [],
  },

  // ✅ One-Time Purchase Download System (Instead of Subscription)
  downloadLimit: { type: Number, default: 0 }, // ✅ GB available for download
  totalPurchasedStorage: { type: Number, default: 0 }, // ✅ Total GB purchased over time
  totalDownloads: { type: Number, default: 0 }, // ✅ Total GB downloaded
  downloadedFiles: {
    type: [
      {
        fileId: mongoose.Schema.Types.ObjectId,
        fileSize: Number, // ✅ In MB
        downloadDate: Date,
      },
    ],
    default: [],
  },

  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", UserSchema);