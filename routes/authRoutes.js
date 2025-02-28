const express = require("express");
const { register, userLogin, adminLogin, logout, getUser } = require("../controllers/authController");
const {authMiddleware} = require("../middleware/authMiddleware"); // ✅ Protect /me

const router = express.Router();

// ✅ Public Routes
router.post("/register", register);
router.post("/login", userLogin); // ✅ Normal users login here
router.post("/admin/login", adminLogin); // ✅ Admins login here

// ✅ Protected Routes (Requires Authentication)
router.get("/me", authMiddleware, getUser); // ✅ Protect user info
router.post("/logout", logout);

module.exports = router;
