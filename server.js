const dotenv = require("dotenv");
dotenv.config(); // ✅ Load .env file
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

// ✅ Routes
const authRoutes = require("./routes/authRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const feedRoutes = require("./routes/feedRoutes");
const adminRoutes = require("./routes/adminRoutes");
const profileRoutes = require("./routes/profileRoutes");
const { authMiddleware, adminMiddleware } = require("./middleware/authMiddleware");

// ✅ Initialize Express App
const app = express();
const PORT = process.env.PORT || 5000;
app.use(cookieParser());

// ✅ Ensure Upload Directory Exists
const UPLOADS_DIR = path.join(__dirname, process.env.UPLOADS_DIR || "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ✅ Connect to MongoDB
connectDB();

// ✅ CORS Configuration
const allowedOrigins = process.env.CORS_ORIGIN?.split(",") || ["https://kawaiee.xyz"];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"], // ✅ Add Authorization Header
  })
);

// ✅ Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Serve uploaded files
app.use("/uploads", express.static(UPLOADS_DIR));

// ✅ API Routes
app.use("/api/auth", authRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/profile", authMiddleware, profileRoutes);
app.use("/api/admin", authMiddleware, adminMiddleware, adminRoutes);

// ✅ File Upload Configuration
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}_${file.originalname}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/zip" || file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only ZIP files and images are allowed"), false);
    }
  },
});

// ✅ Admin File Upload Route
app.post(
  "/api/admin/upload",
  authMiddleware,
  adminMiddleware,
  upload.fields([{ name: "file", maxCount: 1 }, { name: "image", maxCount: 1 }]),
  async (req, res) => {
    try {
      const file = req.files?.file ? req.files.file[0].filename : null;
      const image = req.files?.image ? req.files.image[0].filename : null;
      if (!file && !image) {
        return res.status(400).json({ message: "At least one file (ZIP or Image) is required" });
      }
      console.log(`🔹 Uploading file: ${file || "No file uploaded"}`);
      return res.status(201).json({
        message: "File uploaded successfully",
        fileUrl: file ? `/uploads/${file}` : null,
        imageUrl: image ? `/uploads/${image}` : null,
      });
    } catch (error) {
      console.error("🚨 Upload Error:", error);
      res.status(500).json({ message: "File upload failed" });
    }
  }
);

// ✅ Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("🚨 Error:", err);
  res.status(500).json({ message: "Internal Server Error" });
});

// ✅ Start Server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
