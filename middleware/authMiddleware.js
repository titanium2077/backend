const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  try {
    console.log("🔹 Cookies received:", req.cookies); // ✅ Debugging

    const token = req.cookies.jwt;
    if (!token) {
      console.warn("🚨 No JWT token found.");
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      console.warn("🚨 User not found.");
      return res.status(401).json({ message: "User not found." });
    }

    // ✅ Attach user to request object for further use
    req.user = user;

    // ✅ Validate Device Token (Warn instead of block)
    const deviceToken = req.cookies.deviceToken;
    if (!deviceToken) {
      console.warn("⚠️ No device token found in cookies.");
    } else if (deviceToken !== user.deviceToken) {
      console.warn(`⚠️ Device Mismatch: Expected ${user.deviceToken}, got ${deviceToken}`);
      return res.status(403).json({ message: "Unauthorized device. Please log in again." });
    }

    next(); // ✅ Continue if all checks pass
  } catch (error) {
    console.error("🚨 Auth Error:", error.message);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

// ✅ Admin Authorization Middleware
const adminMiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    console.warn("🚨 Admin access denied.");
    return res.status(403).json({ message: "Access Denied. Admins only." });
  }
  next();
};

module.exports = { authMiddleware, adminMiddleware };
