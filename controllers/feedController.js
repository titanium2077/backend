const FeedItem = require("../models/FeedItem");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const dotenv = require("dotenv");
const User = require("../models/User");
const jwt = require("jsonwebtoken");

dotenv.config();

const UPLOADS_DIR = path.join(__dirname, "..", process.env.UPLOADS_DIR || "uploads");
const BASE_URL = process.env.BASE_URL || "https://miamiachan.com";

// ✅ Ensure Uploads Directory Exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ✅ Get All Feed Items (Paginated)
exports.getFeedItems = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const items = await FeedItem.find().skip(skip).limit(limit);
    const total = await FeedItem.countDocuments();

    res.json({
      items,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching feed items" });
  }
};

// ✅ Get Single Feed Item
exports.getFeedItem = async (req, res) => {
  try {
    const item = await FeedItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: "Error fetching item" });
  }
};

// ✅ Create Feed Item
exports.createFeed = async (req, res) => {
  try {
    console.log("🔹 Request received:", req.body);
    console.log("📂 Uploaded files:", req.files);

    if (!req.files || !req.files.file || !req.files.image) {
      console.error("🚨 Missing files! Received:", req.files);
      return res.status(400).json({ message: "Both file and image are required" });
    }

    const file = req.files.file[0];
    const image = req.files.image[0];

    console.log("📂 Processing ZIP file:", file.originalname, "Size:", file.size);
    console.log("🖼️ Processing Image:", image.originalname, "Size:", image.size);

    // ✅ Ensure file was properly saved
    const filePath = path.join(UPLOADS_DIR, file.filename);
    if (!fs.existsSync(filePath)) {
      console.error("🚨 ERROR: File was not saved properly!", filePath);
      return res.status(500).json({ message: "Upload failed. File not saved." });
    }

    // ✅ Compute File Hash (SHA-256)
    const fileData = fs.readFileSync(filePath);
    const fileHash = crypto.createHash("sha256").update(fileData).digest("hex");

    // ✅ Check for duplicate files
    const existingFile = await FeedItem.findOne({ fileHash });
    if (existingFile) {
      console.warn("⚠️ File already exists in database:", existingFile.storageKey);
      return res.json({ message: "File already exists", item: existingFile });
    }

    // ✅ Save Feed Item in MongoDB
    const newFeed = new FeedItem({
      title: req.body.title,
      description: req.body.description,
      image: `/uploads/${image.filename}`,
      storageKey: `/uploads/${file.filename}`,
      fileHash,
      resolution: req.body.resolution,
      duration: req.body.duration,
      fileType: path.extname(file.filename),
      fileSize: (file.size / (1024 * 1024)).toFixed(2) + " MB",
    });

    await newFeed.save();

    res.status(201).json({ message: "Feed created successfully", item: newFeed });
  } catch (error) {
    console.error("🚨 Error saving feed item:", error);
    res.status(500).json({ message: "Error creating feed" });
  }
};

// ✅ Update Feed Item
exports.updateFeedItem = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    const feedItem = await FeedItem.findById(req.params.id);
    if (!feedItem) {
      return res.status(404).json({ message: "Item not found" });
    }

    console.log("📝 Updating Feed Item:", req.params.id);
    console.log("📂 Received Files:", req.files);

    // Get updated fields from request body
    const { title, description, resolution, duration } = req.body;
    let updatedData = { title, description, resolution, duration };

    // ✅ Handle File Uploads (If new files are uploaded, replace old ones)
    if (req.files) {
      if (req.files.file) {
        // ✅ Delete old ZIP file if exists
        if (feedItem.storageKey) {
          const oldFilePath = path.join(UPLOADS_DIR, path.basename(feedItem.storageKey));
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
            console.log("🗑️ Deleted old file:", oldFilePath);
          }
        }

        // ✅ Store new file
        const file = req.files.file[0];
        updatedData.storageKey = `/uploads/${file.filename}`;
        updatedData.fileType = path.extname(file.filename);
        updatedData.fileSize = (file.size / (1024 * 1024)).toFixed(2) + " MB";
      }

      if (req.files.image) {
        // ✅ Delete old image if exists
        if (feedItem.image) {
          const oldImagePath = path.join(UPLOADS_DIR, path.basename(feedItem.image));
          if (fs.existsSync(oldImagePath)) {
            fs.unlinkSync(oldImagePath);
            console.log("🗑️ Deleted old image:", oldImagePath);
          }
        }

        // ✅ Store new image
        const image = req.files.image[0];
        updatedData.image = `/uploads/${image.filename}`;
      }
    }

    // ✅ Update MongoDB Document
    const updatedItem = await FeedItem.findByIdAndUpdate(req.params.id, updatedData, { new: true });

    res.json({ message: "Item updated successfully", item: updatedItem });
  } catch (error) {
    console.error("🚨 Error updating feed item:", error);
    res.status(500).json({ message: "Error updating feed item" });
  }
};

// ✅ Delete Feed Item
exports.deleteFeedItem = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    const feedItem = await FeedItem.findById(req.params.id);
    if (!feedItem) {
      return res.status(404).json({ message: "Item not found" });
    }

    // ✅ Delete associated files
    const filePath = path.join(UPLOADS_DIR, path.basename(feedItem.storageKey));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log("🗑️ Deleted file:", filePath);
    }

    const imagePath = path.join(UPLOADS_DIR, path.basename(feedItem.image));
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
      console.log("🗑️ Deleted image:", imagePath);
    }

    await FeedItem.findByIdAndDelete(req.params.id);
    res.json({ message: "Item deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting feed item" });
  }
};

// ✅ Generate Secure Download Link (Authenticated Users Only)
exports.generateDownloadLink = async (req, res) => {
  try {
    console.log("📥 Generating direct download link...");
    console.log("🔹 Request Params:", req.params);
    console.log("🔹 Query Params:", req.query);

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    if (!req.params.id) {
      console.error("🚨 ERROR: Missing file ID in request.");
      return res.status(400).json({ message: "File ID is required" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const feedItem = await FeedItem.findById(req.params.id);
    if (!feedItem) {
      console.error("🚨 ERROR: Feed item not found in database.");
      return res.status(404).json({ message: "Item not found" });
    }

    console.log("✅ Found Feed Item:", feedItem);

    // ✅ Construct the full file path
    const filePath = path.join(UPLOADS_DIR, feedItem.storageKey.replace(/^\/uploads\//, ""));
    console.log("📂 Checking File Path:", filePath);

    // ✅ Check if the file actually exists
    if (!fs.existsSync(filePath)) {
      console.error("🚨 ERROR: File not found on server!");
      return res.status(404).json({ message: "File not found on server. Please contact support." });
    }

    console.log("✅ SUCCESS: File exists. Proceeding with download...");

    // ✅ Convert file size from MB to GB
    const fileSizeMB = parseFloat(feedItem.fileSize);
    const fileSizeGB = fileSizeMB / 1024;

    console.log(`📏 File Size: ${fileSizeMB} MB (${fileSizeGB.toFixed(4)} GB)`);
    console.log(`🔹 User's Available Limit: ${user.downloadLimit} GB`);

    // ✅ Check if user has enough quota
    if (user.downloadLimit < fileSizeGB) {
      console.error("⚠️ ERROR: User does not have enough download limit.");
      return res.status(403).json({ message: "Not enough download limit. Please purchase more storage." });
    }

    console.log("✅ User has enough download limit. Deducting...");

    // ✅ Deduct the user's download limit (Only if file exists)
    user.downloadLimit -= fileSizeGB;
    user.totalDownloads += fileSizeGB;

    // ✅ Log Download in User's History
    user.downloadedFiles.push({
      fileId: feedItem._id,
      fileSize: fileSizeMB, // Store size in MB
      downloadDate: new Date(),
    });

    await user.save();

    // ✅ Generate Direct File URL
    const directDownloadUrl = `${BASE_URL}${feedItem.storageKey}`;
    console.log("✅ Direct Download Link Generated:", directDownloadUrl);

    res.json({
      downloadUrl: directDownloadUrl,
      message: "Download successful",
      remainingQuota: user.downloadLimit,
    });

  } catch (error) {
    console.error("🚨 ERROR in `generateDownloadLink`:", error);
    res.status(500).json({ message: "Error generating download link", error: error.message });
  }
};