const mongoose = require("mongoose");

const DownloadTokenSchema = new mongoose.Schema({
  token: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  filePath: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});

module.exports = mongoose.model("DownloadToken", DownloadTokenSchema);
