const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const geoip = require("geoip-lite");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv");

dotenv.config(); // ✅ Load .env variables

// ✅ Register a New User
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    
    user = new User({ 
      name, 
      email, 
      password: hashedPassword, 
      role: email === process.env.ADMIN_EMAIL ? "admin" : "user", // ✅ Auto-assign admin role
      allowedDevices: [], 
      pendingDevices: [] // ✅ Initialize pending devices
    });

    await user.save();
    res.status(201).json({ message: `User registered successfully as ${user.role}` });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ General Login Function (Used for Both Users & Admins)
const loginUser = async (req, res, roleCheck = "user") => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];
    const countryData = geoip.lookup(ipAddress);
    const country = countryData ? countryData.country : "Unknown";

    let user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    // ✅ Ensure correct login portal
    if (user.role !== roleCheck) {
      return res.status(403).json({ message: `Access denied. Use /${user.role}/login instead.` });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    // ✅ Check if user already has a device token
    let deviceToken = req.cookies.deviceToken || user.deviceToken;

    if (!deviceToken) {
      deviceToken = uuidv4(); // ✅ Generate new device token if none exists
    }

    // ✅ Admin Login: Track Device Logins
    if (user.role === "admin") {
      if (!user.allowedDevices.includes(deviceToken)) {
        console.log("🚨 Unauthorized Device", { deviceToken });

        // ✅ Store device for approval, but DO NOT block login
        if (!user.pendingDevices) user.pendingDevices = [];
        user.pendingDevices.push({ deviceToken, ipAddress, userAgent, country, approved: false });
      }
    }

    // ✅ Save login record in `loginHistory`
    user.loginHistory.push({
      deviceToken,
      ipAddress,
      userAgent,
      country,
      loginTime: new Date(),
    });

    // ✅ Store last login info
    user.lastLogin = new Date();
    user.ipAddress = ipAddress;
    user.userAgent = userAgent;
    user.country = country;
    user.deviceToken = deviceToken;
    await user.save();

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });

    // ✅ Set Secure Cookies
    res.cookie("jwt", token, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === "production", 
      sameSite: "Strict", 
      maxAge: 60 * 60 * 1000 
    });

    res.cookie("deviceToken", deviceToken, { httpOnly: true, secure: true, sameSite: "Strict" });

    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        country: user.country,
        lastLogin: user.lastLogin,
        ipAddress: user.ipAddress,
        userAgent: user.userAgent,
        deviceToken: deviceToken,
        loginHistory: user.loginHistory, // ✅ Send login history
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


// ✅ Admin Login (Only for Admins)
exports.adminLogin = async (req, res) => {
  return loginUser(req, res, "admin");
};

// ✅ User Login (Only for Normal Users)
exports.userLogin = async (req, res) => {
  return loginUser(req, res, "user");
};

// ✅ Logout and Clear Cookies
exports.logout = async (req, res) => {
  res.clearCookie("jwt", { httpOnly: true, secure: true, sameSite: "Strict" });
  res.clearCookie("deviceToken", { httpOnly: true, secure: true, sameSite: "Strict" });
  res.json({ message: "Logged out successfully" });
};

// ✅ Get Authenticated User Info (Protected Route)
exports.getUser = async (req, res) => {
  try {
    const token = req.cookies.jwt;
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ user });
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};
