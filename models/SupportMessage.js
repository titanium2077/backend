const mongoose = require("mongoose");

const SupportMessageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, required: true },
    status: { type: String, enum: ["pending", "resolved"], default: "pending" },
    conversation: [
      {
        sender: { type: String, enum: ["user", "admin"], required: true },
        message: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("SupportMessage", SupportMessageSchema);
