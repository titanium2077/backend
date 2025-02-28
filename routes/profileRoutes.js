const express = require("express");
const { getProfile } = require("../controllers/profileController");
const {authMiddleware} = require("../middleware/authMiddleware");

const router = express.Router();

// ✅ Protected Route - Get User Profile
router.get("/", authMiddleware, getProfile);

module.exports = router;
