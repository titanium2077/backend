const User = require("../models/User");

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    // ✅ Fetch Last 5 Transactions
    const transactions = user.paymentHistory
      .sort((a, b) => b.date - a.date)
      .slice(0, 5);

    // ✅ Fetch Last 5 Downloads
    const downloads = user.downloadedFiles
      .sort((a, b) => b.downloadDate - a.downloadDate)
      .slice(0, 5);

    // 🔥 Debug: Log the data before sending it
    console.log("🔹 Profile Data:", {
      user: user.name,
      transactions,
      downloads,
    });

    res.json({ user, transactions, downloads });
  } catch (error) {
    console.error("🚨 Error fetching profile:", error);
    res.status(500).json({ message: "Server error" });
  }
};