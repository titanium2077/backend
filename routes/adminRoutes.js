const express = require("express");
const { authMiddleware, adminMiddleware } = require("../middleware/authMiddleware");
const { getAllPayments } = require("../controllers/adminController");
const { getApprovedDevices, approveDevice, removeDevice, getDashboardStats  } = require("../controllers/adminController");

const router = express.Router();

// ✅ Admin Dashboard API
router.get("/dashboard", authMiddleware, adminMiddleware, getDashboardStats);

// ✅ Get list of approved devices (Protected)
router.get("/devices", authMiddleware, getApprovedDevices);

// ✅ Approve a new device (Protected)
router.post("/approve-device", authMiddleware, approveDevice);

// ✅ Remove an existing device (Protected)
router.post("/remove-device", authMiddleware, removeDevice);

// ✅ Get all payments (Admins Only)
router.get("/payments", authMiddleware, adminMiddleware, getAllPayments);

module.exports = router;
