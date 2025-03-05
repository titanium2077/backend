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
const DOWNLOAD_EXPIRY = 5 * 60; // 5 minutes expiry time

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

// ✅ Generate a Secure Download Link
exports.generateSecureDownloadToken = async (req, res) => {
  try {
    console.log("📥 Generating secure download token...");

    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    if (!req.params.id) {
      return res.status(400).json({ message: "File ID is required" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const feedItem = await FeedItem.findById(req.params.id);
    if (!feedItem) {
      return res.status(404).json({ message: "File not found" });
    }

    console.log("✅ Found Feed Item:", feedItem);

    // ✅ Check if the user has enough quota
    const fileSizeMB = parseFloat(feedItem.fileSize);
    const fileSizeGB = fileSizeMB / 1024;

    if (user.downloadLimit < fileSizeGB) {
      return res.status(403).json({ message: "Not enough download limit. Please purchase more storage." });
    }

    console.log("✅ User has enough download limit. Deducting...");
    user.downloadLimit -= fileSizeGB;
    user.totalDownloads += fileSizeGB;
    await user.save();

    console.log("✅ Updated user quota. New limit:", user.downloadLimit);

    // ✅ Generate Secure JWT Token
    const tokenPayload = {
      filePath: feedItem.storageKey,
      fileName: path.basename(feedItem.storageKey),
      fileSize: feedItem.fileSize,
      userId: user._id,
      exp: Math.floor(Date.now() / 1000) + DOWNLOAD_EXPIRY, // Expiry time (5 min)
    };

    const downloadToken = jwt.sign(tokenPayload, process.env.JWT_SECRET);
    const secureDownloadUrl = `${BASE_URL}/api/feed/secure-download?token=${downloadToken}`;

    console.log("✅ Secure Download Token Generated:", secureDownloadUrl);

    res.json({
      downloadToken,
      secureDownloadUrl,
      message: "Download link generated successfully",
      remainingQuota: user.downloadLimit,
    });

  } catch (error) {
    console.error("🚨 ERROR in `generateSecureDownloadToken`:", error);
    res.status(500).json({ message: "Error generating download token", error: error.message });
  }
};

// ✅ Serve the file securely via the generated token
exports.verifySecureDownload = async (req, res) => {
  try {
    console.log("🔒 [SECURE DOWNLOAD] Validating token...");

    const { token } = req.query;
    if (!token) {
      console.error("🚨 ERROR: Missing download token.");
      return res.status(400).json({ message: "Missing download token" });
    }

    // ✅ Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.error("🚨 ERROR: Invalid or expired token:", err.message);
      return res.status(403).json({ message: "Invalid or expired token" });
    }

    console.log("✅ Token Verified:", decoded);

    // ✅ Check if all required fields exist
    if (!decoded.filePath || !decoded.fileName || !decoded.userId) {
      console.error("🚨 ERROR: Invalid token payload. Missing filePath, fileName, or userId.");
      return res.status(400).json({ message: "Invalid token: Missing filePath, fileName, or userId" });
    }

    console.log("🔹 Decoded Token Payload:", decoded);

    res.json({
      message: "Token verified",
      fileName: decoded.fileName,
      fileSize: decoded.fileSize,
      downloadUrl: `${BASE_URL}/api/feed/start-download?token=${token}`
    });

  } catch (error) {
    console.error("🚨 ERROR in `verifySecureDownload`:", error);
    res.status(500).json({ message: "Error verifying download token", error: error.message });
  }
};

exports.startFileDownload = async (req, res) => {
  try {
    console.log("🎯 Starting file download...");

    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ message: "Missing download token" });
    }

    // ✅ Verify token again
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      console.error("🚨 ERROR: Invalid or expired token:", err.message);
      return res.status(403).json({ message: "Invalid or expired token" });
    }

    console.log("✅ Token Verified:", decoded);

    // ✅ Construct absolute file path
    const sanitizedFileName = path.basename(decoded.fileName);
    const filePath = path.join(UPLOADS_DIR, sanitizedFileName);

    console.log("📂 Checking File Path:", filePath);

    if (!fs.existsSync(filePath)) {
      console.error("🚨 ERROR: File not found on server!", filePath);
      return res.status(404).json({ message: "File not found on server. Please contact support." });
    }

    console.log("✅ File exists. Streaming file:", filePath);

    // ✅ Set Headers for Secure Download
    res.setHeader("Content-Disposition", `attachment; filename="${sanitizedFileName}"`);
    res.setHeader("Content-Type", "application/octet-stream");

    // ✅ Stream the file to the user
    const fileStream = fs.createReadStream(filePath);
    fileStream.on("error", (err) => {
      console.error("🚨 ERROR: File stream error", err);
      return res.status(500).json({ message: "Error streaming file" });
    });

    fileStream.pipe(res);

    console.log("✅ File streaming started...");

  } catch (error) {
    console.error("🚨 ERROR in `startFileDownload`:", error);
    res.status(500).json({ message: "Error processing download", error: error.message });
  }
};