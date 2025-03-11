const express = require("express");
const {
  sendSupportMessage,
  getSupportMessages,
  replySupportMessage,
  getUserSupportMessages
} = require("../controllers/supportController");
const { authMiddleware, adminMiddleware } = require("../middleware/authMiddleware");

const router = express.Router();

// ✅ User Sends a Support Message
router.post("/", authMiddleware, sendSupportMessage);

// ✅ User Fetches Their Own Support Messages
router.get("/", authMiddleware, getUserSupportMessages);

// ✅ Admin Gets All Support Messages
router.get("/admin", authMiddleware, adminMiddleware, getSupportMessages);

// ✅ Admin Replies to a Message
router.put("/:id/reply", authMiddleware, adminMiddleware, replySupportMessage);

module.exports = router;