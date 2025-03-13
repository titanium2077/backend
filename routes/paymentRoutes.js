const express = require("express");
const { createCryptoPayment, verifyCryptoPayment } = require("../controllers/paymentController");
const { authMiddleware } = require("../middleware/authMiddleware");

const router = express.Router();

// ✅ Create Crypto Payment (BTC, USDT)
router.post("/crypto-payment", authMiddleware, createCryptoPayment);

// ✅ Verify Crypto Payment
router.get("/crypto-verify", authMiddleware, verifyCryptoPayment);

module.exports = router;
