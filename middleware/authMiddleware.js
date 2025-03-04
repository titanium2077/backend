const jwt = require("jsonwebtoken");
const User = require("../models/User");

const authMiddleware = async (req, res, next) => {
  try {
    console.log("🔹 Incoming Auth Request: ", req.originalUrl);
    console.log("🔹 Cookies received:", req.cookies);
    console.log("🔹 Authorization Header:", req.headers.authorization);

    // ✅ Try getting JWT from Cookie or Authorization Header
    let token =
      req.cookies?.jwt || req.headers.authorization?.split(" ")[1];

    console.log("🔹 Extracted Token:", token ? "✔ Yes" : "❌ No");

    if (!token) {
      console.warn("🚨 No JWT Token Provided");
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    // ✅ Decode JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ Token Decoded:", decoded);

    // ✅ Find User
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) {
      console.warn("🚨 User Not Found for Token");
      return res.status(401).json({ message: "User not found." });
    }

    // ✅ Attach user to request object
    req.user = user;

    // ✅ Validate Device Token (Optional Check)
    const deviceToken = req.cookies?.deviceToken;
    if (deviceToken) {
      console.log("🔹 Device Token Found:", deviceToken);
      if (deviceToken !== user.deviceToken) {
        console.warn(`⚠️ Device Mismatch: Expected ${user.deviceToken}, got ${deviceToken}`);
        return res.status(403).json({ message: "Unauthorized device. Please log in again." });
      }
    } else {
      console.warn("⚠️ No device token found in cookies.");
    }

    console.log("✅ Authentication Passed");
    next(); // ✅ Continue if all checks pass
  } catch (error) {
    console.error("🚨 Authentication Error:", error.message);
    res.status(401).json({ message: "Invalid or expired token" });
  }
};

// ✅ Admin Authorization Middleware
const adminMiddleware = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    console.warn("🚨 Admin Access Denied.");
    return res.status(403).json({ message: "Access Denied. Admins only." });
  }
  console.log("✅ Admin Access Granted");
  next();
};

module.exports = { authMiddleware, adminMiddleware };