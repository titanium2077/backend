const express = require("express");
const { createPayment, verifyPayment } = require("../controllers/paymentController");
const { authMiddleware } = require("../middleware/authMiddleware");

const router = express.Router();

// ✅ Create PayPal Payment
router.post("/paypal-payment", authMiddleware, createPayment);

// ✅ Verify PayPal Payment
router.get("/paypal-verify", authMiddleware, verifyPayment);

module.exports = router;
