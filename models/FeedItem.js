const mongoose = require("mongoose");

const FeedItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  image: { type: String, required: true }, // Thumbnail URL
  storageKey: { type: String, required: true }, // Storage path for the file
  fileHash: { type: String, unique: true, required: true }, // Prevent duplicate uploads
  resolution: { type: String, required: true },
  duration: { type: String, required: true },
  fileType: { type: String, required: true },
  fileSize: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("FeedItem", FeedItemSchema);
