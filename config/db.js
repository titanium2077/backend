const mongoose = require("mongoose");
const dotenv = require("dotenv");

// ✅ Ensure `NODE_ENV` is defined
const ENV = process.env.NODE_ENV || "development";
const envFile = `/var/www/${ENV}-backend/.env.${ENV}`;
dotenv.config({ path: envFile });

console.log(`🔹 Using environment file: ${envFile}`);

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
    process.exit(1);
  }
};

module.exports = connectDB;
