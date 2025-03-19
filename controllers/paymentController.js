const axios = require("axios");
const Payment = require("../models/Payment");
const User = require("../models/User");

const BTCPAY_HOST = process.env.BTCPAY_HOST;
const BTCPAY_API_KEY = process.env.BTCPAY_API_KEY;
const BTCPAY_STORE_ID = process.env.BTCPAY_STORE_ID;

const storagePlans = {
  medium: { price: 15.99, downloadLimit: 10 },
  large: { price: 24.99, downloadLimit: 20 },
  xlarge: { price: 49.99, downloadLimit: 40 },
  xxlarge: { price: 99.99, downloadLimit: 80 },
  mega: { price: 199.99, downloadLimit: 180 },
};

// ✅ **Create BTCPay Invoice**
exports.createCryptoPayment = async (req, res) => {
  try {
    const { plan, currency } = req.body;
    const userId = req.user._id;

    if (!storagePlans[plan]) {
      return res.status(400).json({ message: "Invalid storage plan" });
    }

    if (!["BTC", "LTC", "DOGE"].includes(currency)) {
      return res.status(400).json({ message: "Invalid cryptocurrency" });
    }

    const { price, downloadLimit } = storagePlans[plan];

    // ✅ **Check for existing pending payment**
    let existingPayment = await Payment.findOne({ userId, status: "pending" });

    if (existingPayment) {
      try {
        // ✅ Check BTCPay invoice status
        const response = await axios.get(
          `${BTCPAY_HOST}/api/v1/stores/${BTCPAY_STORE_ID}/invoices/${existingPayment.paymentId}`,
          { headers: { Authorization: `token ${BTCPAY_API_KEY}` } }
        );

        const invoiceStatus = response.data.status;

        if (invoiceStatus === "Expired" || invoiceStatus === "Invalid") {
          // ✅ Force Cancel & Delete from DB
          await Payment.findByIdAndDelete(existingPayment._id);
        } else {
          return res.json({ link: response.data.checkoutLink }); // ✅ Use existing invoice
        }
      } catch (err) {
        console.warn("⚠️ Invoice Not Found. Force canceling...");
        await Payment.findByIdAndDelete(existingPayment._id);
      }
    }

    // ✅ **Create a new invoice**
    const invoiceData = {
      storeId: BTCPAY_STORE_ID,
      currency: "USD",
      amount: price,
      checkout: {
        redirectURL: `${process.env.FRONTEND_URL}/payment-success`,
        defaultPaymentMethod: currency,
      },
      metadata: { userId, plan, downloadLimit, selectedCrypto: currency },
    };

    const newInvoice = await axios.post(
      `${BTCPAY_HOST}/api/v1/stores/${BTCPAY_STORE_ID}/invoices`,
      invoiceData,
      { headers: { Authorization: `token ${BTCPAY_API_KEY}` } }
    );

    // ✅ **Save the new payment record**
    const newPayment = new Payment({
      userId,
      paymentId: newInvoice.data.id,
      amount: price,
      currency,
      downloadLimitAdded: downloadLimit,
      status: "pending",
    });

    await newPayment.save();

    res.json({ link: newInvoice.data.checkoutLink });
  } catch (error) {
    console.error("🚨 BTCPay Error:", error.response?.data || error.message);
    res.status(500).json({ message: "Error creating crypto payment" });
  }
};

// ✅ **Verify BTCPay Payment**
exports.verifyCryptoPayment = async (req, res) => {
  try {
    const { paymentId } = req.query;
    const paymentRecord = await Payment.findOne({ paymentId });

    if (!paymentRecord) return res.status(404).json({ message: "Payment not found" });

    try {
      // ✅ Fetch Invoice Status
      const response = await axios.get(
        `${BTCPAY_HOST}/api/v1/stores/${BTCPAY_STORE_ID}/invoices/${paymentId}`,
        { headers: { Authorization: `token ${BTCPAY_API_KEY}` } }
      );

      const invoiceStatus = response.data.status;

      if (invoiceStatus === "Settled") {
        const user = await User.findById(paymentRecord.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // ✅ Increase Download Limit
        user.downloadLimit += paymentRecord.downloadLimitAdded;
        user.totalPurchasedStorage += paymentRecord.downloadLimitAdded;

        // ✅ Save Payment History
        user.paymentHistory.push({
          paymentId,
          amount: paymentRecord.amount,
          currency: paymentRecord.currency,
          downloadLimitAdded: paymentRecord.downloadLimitAdded,
          status: "completed",
          date: new Date(),
        });

        await user.save();
        paymentRecord.status = "completed";
        await paymentRecord.save();

        res.json({ message: "Payment verified, storage added!" });
      } else if (invoiceStatus === "Paid") {
        res.json({ message: "Payment received but still confirming. Please wait..." });
      } else if (invoiceStatus === "Invalid" || invoiceStatus === "Expired") {
        paymentRecord.status = "failed";
        await paymentRecord.save();
        res.status(400).json({ message: "Payment failed or expired." });
      } else {
        res.json({ message: "Payment still pending." });
      }
    } catch (err) {
      console.warn("⚠️ Invoice Not Found in BTCPay. Deleting from DB...");
      await Payment.findByIdAndDelete(paymentRecord._id); // Remove invalid invoice from DB
      return res.status(400).json({ message: "Invoice not found in BTCPay. It may have expired." });
    }
  } catch (error) {
    console.error("🚨 BTCPay Verification Error:", error.response?.data || error.message);
    res.status(500).json({ message: "Error verifying payment" });
  }
};