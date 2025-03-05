const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const geoip = require("geoip-lite");
const { v4: uuidv4 } = require("uuid");
const dotenv = require("dotenv");

dotenv.config(); // ✅ Load .env variables

console.log("✅ AUTH CONTROLLER LOADED"); // ✅ Debugging at startup
console.log("🔹 JWT_SECRET:", process.env.JWT_SECRET ? "✔ Loaded" : "❌ Missing!");
console.log("🔹 MONGO_URI:", process.env.MONGO_URI ? "✔ Loaded" : "❌ Missing!");

// ✅ Helper Function: Generate JWT Token
const generateToken = (user) => {
  return jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });
};

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
      role: email === process.env.ADMIN_EMAIL ? "admin" : "user",
      allowedDevices: [],
      pendingDevices: [],
    });

    await user.save();
    res.status(201).json({ message: `User registered successfully as ${user.role}` });
  } catch (error) {
    console.error("🚨 Register Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ General Login Function (Users & Admins)
const loginUser = async (req, res, roleCheck = "user") => {
  try {
    console.log("🔹 Headers:", req.headers);
    console.log("🔹 Body:", req.body);

    const { email, password, deviceToken } = req.body;
    const ipAddress = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];
    const countryData = geoip.lookup(ipAddress);
    const country = countryData ? countryData.country : "Unknown";

    console.log(`🔹 Login Attempt: Email=${email}, IP=${ipAddress}, DeviceToken=${deviceToken}`);

    let user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    console.log("🔹 User Found:", user.email, "| Role:", user.role);

    if (user.role !== roleCheck) {
      console.warn(`🚨 Wrong Portal: Expected=${roleCheck}, Found=${user.role}`);
      return res.status(403).json({ message: `Access denied. Use /${user.role}/login instead.` });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.warn("🚨 Incorrect Password for:", email);
      return res.status(400).json({ message: "Invalid credentials" });
    }

    console.log("✅ Password Matched!");

    let newDeviceToken = deviceToken || uuidv4();
    console.log("🔹 New Device Token:", newDeviceToken);

    const existingDevice = user.allowedDevices.includes(newDeviceToken);
    if (!existingDevice) {
      console.log("🔹 Storing new device:", { newDeviceToken, ipAddress, userAgent, country });

      const alreadyPending = user.pendingDevices.find((d) => d.deviceToken === newDeviceToken);
      if (!alreadyPending) {
        user.pendingDevices.push({ deviceToken: newDeviceToken, ipAddress, userAgent, country, approved: true });
      }
    }

    console.log("✅ Device Check Complete!");

    user.loginHistory.push({
      deviceToken: newDeviceToken,
      ipAddress,
      userAgent,
      country,
      loginTime: new Date(),
    });

    console.log("🔹 Storing Login History");

    user.lastLogin = new Date();
    user.ipAddress = ipAddress;
    user.userAgent = userAgent;
    user.country = country;
    user.deviceToken = newDeviceToken;
    await user.save();

    const token = generateToken(user);
    console.log("✅ JWT Token Generated");

    // ✅ Set Secure Cookie for Cross-Origin Authentication
    res.cookie("jwt", token, {
      httpOnly: true,
      secure: true, // ✅ Required for HTTPS
      sameSite: "None", // ✅ Allows cross-origin requests
      path: "/", // ✅ Ensures cookie is available site-wide
      maxAge: 60 * 60 * 1000, // ✅ 1 hour expiration
    });
        
    console.log("✅ JWT Token Stored in Cookie");

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        deviceToken: newDeviceToken,
      },
    });

    console.log("✅ LOGIN SUCCESSFUL!");
  } catch (error) {
    console.error("🚨 Unexpected Error in Login:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

// ✅ Admin Login (Only for Admins)
exports.adminLogin = async (req, res) => {
  console.log("🟢 ADMIN LOGIN INITIATED");
  return loginUser(req, res, "admin");
};

// ✅ User Login (Only for Normal Users)
exports.userLogin = async (req, res) => {
  console.log("🟢 USER LOGIN INITIATED");
  return loginUser(req, res, "user");
};

// ✅ Logout and Clear Cookies
exports.logout = async (req, res) => {
  console.log("🔹 LOGOUT REQUEST RECEIVED");
  res.clearCookie("jwt", { httpOnly: true, secure: true, sameSite: "None" });
  console.log("✅ Cookies Cleared. User Logged Out.");
  res.json({ message: "Logged out successfully" });
};

// ✅ Get Authenticated User Info (Protected Route)
exports.getUser = async (req, res) => {
  try {
    console.log("🟢 GET USER INFO REQUEST RECEIVED");
    console.log("🔹 Cookies received:", req.cookies);

    const token = req.cookies.jwt || req.headers.authorization?.split(" ")[1]; // ✅ Supports both Cookie & Bearer token

    if (!token) {
      console.warn("🚨 No JWT token found.");
      return res.status(401).json({ message: "Unauthorized. Please log in." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("✅ Token Decoded:", decoded);

    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      console.warn("🚨 User not found.");
      return res.status(401).json({ message: "User not found." });
    }

    console.log("✅ User Found:", user.email);
    res.json({ user });
  } catch (error) {
    console.error("🚨 Error in getUser:", error);
    res.status(401).json({ message: "Invalid token" });
  }
};
