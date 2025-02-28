const express = require("express");
const { 
  getFeedItems, 
  getFeedItem, 
  createFeed, 
  updateFeedItem, 
  deleteFeedItem, 
  generateDownloadLink, 
} = require("../controllers/feedController");

const { authMiddleware, adminMiddleware } = require("../middleware/authMiddleware");
const { upload } = require("../middleware/uploadMiddleware"); // ✅ Import Multer Upload Middleware

const router = express.Router();

// ✅ Public Routes
router.get("/", getFeedItems);
router.get("/:id", getFeedItem);

// ✅ Admin Routes (Ensure `uploadMiddleware` is applied properly)
router.post("/create", authMiddleware, adminMiddleware, upload, createFeed);
router.put("/:id", authMiddleware, adminMiddleware, upload, updateFeedItem);
router.delete("/:id", authMiddleware, adminMiddleware, deleteFeedItem);

// ✅ Secure Download Routes
router.get("/download/:id", authMiddleware, generateDownloadLink); 

module.exports = router;
