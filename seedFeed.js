const mongoose = require("mongoose");
const dotenv = require("dotenv");
const FeedItem = require("./models/FeedItem");

dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((error) => console.error("❌ MongoDB Connection Error:", error));

// Dummy Data Generator
const generateDummyData = () => {
  const resolutions = ["320 x 240", "640 x 480", "1280 x 720", "1920 x 1080"];
  const durations = ["00:05:00", "00:15:30", "00:28:00", "01:02:45"];
  const fileTypes = ["MPG", "MP4", "AVI", "MOV"];
  const fileSizes = ["200 MB", "586.051 MB", "1.2 GB", "3.5 GB"];

  return {
    title: "Sample Video " + Math.floor(Math.random() * 100),
    description: "This is a sample video file with random metadata.",
    image: "https://via.placeholder.com/300",
    downloadUrl: "https://example.com/download",
    resolution: resolutions[Math.floor(Math.random() * resolutions.length)],
    duration: durations[Math.floor(Math.random() * durations.length)],
    fileType: fileTypes[Math.floor(Math.random() * fileTypes.length)],
    fileSize: fileSizes[Math.floor(Math.random() * fileSizes.length)],
  };
};

// Generate 30 items (3 pages)
const generateFeedItems = async () => {
  try {
    await FeedItem.deleteMany(); // Clear existing feed items
    const allItems = [];

    for (let i = 0; i < 30; i++) {
      allItems.push(generateDummyData());
    }

    await FeedItem.insertMany(allItems);
    console.log("✅ Successfully added dummy feed items!");
    mongoose.connection.close();
  } catch (error) {
    console.error("❌ Error adding dummy data:", error);
  }
};

generateFeedItems();
