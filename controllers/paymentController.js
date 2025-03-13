const axios = require("axios");
const Payment = require("../models/Payment");
const User = require("../models/User");

const BTCPAY_HOST = process.env.BTCPAY_HOST;
const BTCPAY_API_KEY = process.env.BTCPAY_API_KEY;
const BTCPAY_STORE_ID = process.env.BTCPAY_STORE_ID;

const storagePlans = {
  "mini-small": { price: 0.99, downloadLimit: 1 },
  "small": { price: 5.99, downloadLimit: 5 },
  "medium": { price: 9.99, downloadLimit: 10 },
  "large": { price: 14.99, downloadLimit: 15 },
  "xlarge": { price: 24.99, downloadLimit: 25 },
  "xxlarge": { price: 49.99, downloadLimit: 50 },
  "mega": { price: 99.99, downloadLimit: 100 },
};

// ✅ Create BTCPay Invoice
exports.createCryptoPayment = async (req, res) => {
  try {
    const { plan } = req.body;
    const userId = req.user._id;

    if (!storagePlans[plan]) {
      return res.status(400).json({ message: "Invalid storage plan" });
    }

    const { price, downloadLimit } = storagePlans[plan];

    // ✅ Prepare Invoice Data
    const invoiceData = {
      storeId: BTCPAY_STORE_ID,
      currency: "USD",
      amount: price,
      checkout: {
        redirectURL: `${process.env.FRONTEND_URL}/payment-success`,
        defaultPaymentMethod: "BTC",
      },
      metadata: { userId, plan, downloadLimit },
    };

    // ✅ Create Invoice on BTCPay
    const response = await axios.post(
      `${BTCPAY_HOST}/api/v1/stores/${BTCPAY_STORE_ID}/invoices`,
      invoiceData,
      { headers: { Authorization: `token ${BTCPAY_API_KEY}` } }
    );

    // ✅ Store Payment Record
    const newPayment = new Payment({
      userId,
      paymentId: response.data.id,
      amount: price,
      currency: "USD",
      downloadLimitAdded: downloadLimit,
      status: "pending",
    });

    await newPayment.save();

    res.json({ link: response.data.checkoutLink });
  } catch (error) {
    console.error("🚨 BTCPay Error:", error.response?.data || error.message);
    res.status(500).json({ message: "Error creating crypto payment" });
  }
};

// ✅ Verify BTCPay Payment
exports.verifyCryptoPayment = async (req, res) => {
  try {
    const { paymentId } = req.query;

    // ✅ Fetch Invoice Status
    const response = await axios.get(
      `${BTCPAY_HOST}/api/v1/stores/${BTCPAY_STORE_ID}/invoices/${paymentId}`,
      { headers: { Authorization: `token ${BTCPAY_API_KEY}` } }
    );

    const paymentRecord = await Payment.findOne({ paymentId });
    if (!paymentRecord) return res.status(404).json({ message: "Payment not found" });

    if (response.data.status === "Settled") {
      const user = await User.findById(paymentRecord.userId);
      if (!user) return res.status(404).json({ message: "User not found" });

      // ✅ Increase Download Limit
      user.downloadLimit += paymentRecord.downloadLimitAdded;
      user.totalPurchasedStorage += paymentRecord.downloadLimitAdded;

      // ✅ Save Payment History
      user.paymentHistory.push({
        paymentId,
        amount: paymentRecord.amount,
        downloadLimitAdded: paymentRecord.downloadLimitAdded,
        status: "completed",
        date: new Date(),
      });

      await user.save();
      paymentRecord.status = "completed";
      await paymentRecord.save();

      res.json({ message: "Payment verified, storage added!" });
    } else {
      res.json({ message: "Payment still pending or failed." });
    }
  } catch (error) {
    console.error("🚨 BTCPay Verification Error:", error.response?.data || error.message);
    res.status(500).json({ message: "Error verifying payment" });
  }
};
