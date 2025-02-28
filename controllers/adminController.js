const User = require("../models/User");
const Payment = require("../models/Payment");
const FeedItem = require("../models/FeedItem");

// ✅ Get Admin Dashboard Stats
exports.getDashboardStats = async (req, res) => {
  try {
    // ✅ 1. Total Users
    const totalUsers = await User.countDocuments();

    // ✅ 2. Active Users (Users logged in within the last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeUsers = await User.countDocuments({ lastLogin: { $gte: thirtyDaysAgo } });

    // ✅ 3. Total Revenue (Sum of all completed transactions)
    const totalRevenue = await Payment.aggregate([
      { $match: { status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const revenue = totalRevenue.length > 0 ? totalRevenue[0].total : 0;

    // ✅ 4. Total Downloads (Sum of all downloads across users)
    const totalDownloads = await User.aggregate([
      { $unwind: "$downloadedFiles" },
      { $group: { _id: null, total: { $sum: 1 } } }
    ]);
    const downloads = totalDownloads.length > 0 ? totalDownloads[0].total : 0;

    // ✅ 5. Recent Transactions (Last 5 Transactions)
    const transactions = await Payment.find()
      .populate("userId", "name email") // Attach user details
      .sort({ createdAt: -1 }) // Most recent first
      .limit(5)
      .select("userId amount status createdAt");

    const formattedTransactions = transactions.map((tx) => ({
      _id: tx._id,
      user: tx.userId ? tx.userId.name : "Unknown",
      amount: tx.amount,
      status: tx.status.charAt(0).toUpperCase() + tx.status.slice(1), // Capitalize status
      date: tx.createdAt
    }));

    // ✅ 6. Top 5 Most Downloaded Feed Items
    const topFeedItems = await FeedItem.find()
      .sort({ downloadCount: -1 }) // Sort by most downloaded
      .limit(5)
      .select("title downloadCount");

    res.json({
      totalUsers,
      activeUsers,
      totalRevenue: revenue,
      totalDownloads: downloads,
      transactions: formattedTransactions,
      topFeedItems,
    });
  } catch (error) {
    console.error("🚨 Error fetching dashboard stats:", error);
    res.status(500).json({ message: "Error fetching dashboard stats", error: error.message });
  }
};

// ✅ Get all approved devices for the logged-in admin
exports.getApprovedDevices = async (req, res) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Access denied" });
  }

  res.json({ allowedDevices: req.user.allowedDevices });
};

// ✅ Approve a new device
exports.approveDevice = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { deviceToken } = req.body;
    if (!deviceToken) {
      return res.status(400).json({ message: "Device token is required" });
    }

    if (!req.user.allowedDevices.includes(deviceToken)) {
      req.user.allowedDevices.push(deviceToken);
      await req.user.save();
    }

    res.json({ message: "Device approved successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Remove a device
exports.removeDevice = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const { deviceToken } = req.body;
    if (!deviceToken) {
      return res.status(400).json({ message: "Device token is required" });
    }

    req.user.allowedDevices = req.user.allowedDevices.filter(token => token !== deviceToken);
    await req.user.save();

    res.json({ message: "Device removed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// ✅ Get All Payments (Admin Only)
exports.getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find().populate("userId", "name email").sort({ createdAt: -1 });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: "Error fetching payments", error: error.message });
  }
};
