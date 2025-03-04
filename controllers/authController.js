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
      role: email === process.env.ADMIN_EMAIL ? "admin" : "user",
      allowedDevices: [],
      pendingDevices: [],
    });

    await user.save();
    res.status(201).json({ message: `User registered successfully as ${user.role}` });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ General Login Function (Users & Admins)
const loginUser = async (req, res, roleCheck = "user") => {
  try {
    const { email, password, deviceToken } = req.body;
    const ipAddress = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"];
    const countryData = geoip.lookup(ipAddress);
    const country = countryData ? countryData.country : "Unknown";

    console.log(`🔹 Login Attempt: Email=${email}, DeviceToken=${deviceToken}`);

    let user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    if (user.role !== roleCheck) {
      console.warn(`🚨 Wrong Portal: Expected=${roleCheck}, Found=${user.role}`);
      return res.status(403).json({ message: `Access denied. Use /${user.role}/login instead.` });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.warn("🚨 Incorrect Password");
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // ✅ Use existing deviceToken or generate a new one
    let newDeviceToken = deviceToken || uuidv4();

    // ✅ Store new device in `pendingDevices`, but DO NOT block login
    const existingDevice = user.allowedDevices.includes(newDeviceToken);
    if (!existingDevice) {
      console.log("🔹 Storing new device:", { newDeviceToken });

      const alreadyPending = user.pendingDevices.find((d) => d.deviceToken === newDeviceToken);
      if (!alreadyPending) {
        user.pendingDevices.push({ deviceToken: newDeviceToken, ipAddress, userAgent, country, approved: true });
      }
    }

    console.log("✅ Login Successful!");

    // ✅ Save login record in `loginHistory`
    user.loginHistory.push({
      deviceToken: newDeviceToken,
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
    user.deviceToken = newDeviceToken;
    await user.save();

    const token = jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1h" });

    // ✅ Set Secure Cookies
    res.cookie("jwt", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",  // ✅ Only secure in production
      sameSite: "Lax",  // ✅ Works better for subdomains
      domain: "kawaiee.xyz",  // ✅ Use exact domain instead of `.` prefix
      maxAge: 60 * 60 * 1000,
    });

    // ✅ Ensure frontend can read token for debugging
    res.json({
      message: "Login successful",
      token, // ✅ Also return token explicitly
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        deviceToken: newDeviceToken,
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

    res.json({ user });
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};
