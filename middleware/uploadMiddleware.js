const multer = require("multer");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");

dotenv.config();

const UPLOADS_DIR = path.join(__dirname, "..", process.env.UPLOADS_DIR || "uploads");

// ✅ Ensure the uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// ✅ Configure Multer Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname}`);
  },
});

// ✅ File Filter: Allow ZIP & Images
const allowedZipTypes = ["application/zip", "application/x-zip-compressed", "application/octet-stream"];
const allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const fileFilter = (req, file, cb) => {
  if (allowedZipTypes.includes(file.mimetype) || allowedImageTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only ZIP files and images (JPG, PNG, WEBP, GIF) are allowed"), false);
  }
};

const upload = multer({ storage, fileFilter }).fields([{ name: "file", maxCount: 1 }, { name: "image", maxCount: 1 }]);

module.exports = { upload, UPLOADS_DIR };
