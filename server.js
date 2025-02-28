const dotenv = require("dotenv");

// ✅ Ensure `NODE_ENV` is defined
const ENV = process.env.NODE_ENV || "development";
dotenv.config({ path: `.env.${ENV}` });

console.log(`🟢 Server running in ${ENV} mode, using: .env.${ENV}`);

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/db");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const authRoutes = require("./routes/authRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const feedRoutes = require("./routes/feedRoutes");
const adminRoutes = require("./routes/adminRoutes");
const profileRoutes = require("./routes/profileRoutes");

const { authMiddleware, adminMiddleware } = require("./middleware/authMiddleware");

const app = express();

// ✅ Ensure Upload Directory Exists
const UPLOADS_DIR = path.join(__dirname, process.env.UPLOADS_DIR || "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ✅ Connect to MongoDB before starting the server
connectDB();

// ✅ CORS Configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// ✅ Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Ensure form-data works
app.use(cookieParser());

// ✅ Serve uploaded files directly
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/profile", authMiddleware, profileRoutes);
app.use("/api/admin", authMiddleware, adminMiddleware, adminRoutes);

// ✅ Configure Multer for Uploading Files
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
      cb(null, `${Date.now()}_${file.originalname}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 }, // ✅ Max File Size: 50MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/zip" || file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only ZIP files and images are allowed"), false);
    }
  },
});

// ✅ Admin File Upload Route (ZIP & Images)
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

// ✅ Error Handling
app.use((err, req, res, next) => {
  console.error("🚨 Error:", err);
  res.status(500).json({ message: "Internal Server Error" });
});

// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`));
