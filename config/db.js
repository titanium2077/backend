const mongoose = require("mongoose");
const dotenv = require("dotenv");

// ✅ Ensure correct `.env` file is loaded
dotenv.config({ path: `.env.${process.env.NODE_ENV || "development"}` });

const MONGO_URI = process.env.MONGO_URI;

const connectDB = async () => {
  try {
    if (!MONGO_URI) {
      throw new Error("❌ MONGO_URI is missing in .env file!");
    }

    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ MongoDB Connected Successfully!");
  } catch (error) {
    console.error("❌ MongoDB Connection Failed:", error);
    process.exit(1); // ❌ Stop the server if DB connection fails
  }
};

module.exports = connectDB;
