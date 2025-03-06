const paypal = require("paypal-rest-sdk");
const Payment = require("../models/Payment");
const User = require("../models/User");

paypal.configure({
  mode: process.env.PAYPAL_MODE || "sandbox",
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET,
});

// ✅ Define Fixed Packages
const storagePlans = {
  "mini-small": { price: 0.99, downloadLimit: 1 },  // 1GB for $0.99
  "small": { price: 5.99, downloadLimit: 5 },       // 5GB for $5.99
  "medium": { price: 9.99, downloadLimit: 10 },     // 10GB for $9.99
  "large": { price: 14.99, downloadLimit: 15 },     // 15GB for $14.99
  "xlarge": { price: 24.99, downloadLimit: 25 },    // 25GB for $24.99
  "xxlarge": { price: 49.99, downloadLimit: 50 },   // 50GB for $49.99
  "mega": { price: 99.99, downloadLimit: 100 },     // 100GB for $99.99
};

// ✅ Create a PayPal Payment for Fixed Packages
exports.createPayment = async (req, res) => {
  try {
    const { plan } = req.body; // 💳 Plan: "mini-small", "small", etc.
    const userId = req.user._id;

    if (!storagePlans[plan]) {
      return res.status(400).json({ message: "Invalid storage plan" });
    }

    const { price, downloadLimit } = storagePlans[plan];

    // ✅ Create PayPal Payment Object
    const paymentData = {
      intent: "sale",
      payer: { payment_method: "paypal" },
      transactions: [
        {
          amount: { total: price.toFixed(2), currency: "USD" },
          description: `Purchase ${downloadLimit}GB Storage`,
        },
      ],
      redirect_urls: {
        return_url: `${process.env.FRONTEND_URL}/payment-success`,
        cancel_url: `${process.env.FRONTEND_URL}/payment-cancel`,
      },
    };

    // ✅ Create PayPal Payment
    paypal.payment.create(paymentData, async (error, payment) => {
      if (error) {
        console.error("PayPal Error:", error);
        return res.status(500).json({ error: "Payment creation failed" });
      }

      // ✅ Store the Payment in Database as Pending
      const newPayment = new Payment({
        userId,
        paymentId: payment.id,
        amount: price,
        currency: "USD",
        downloadLimitAdded: downloadLimit,
        status: "pending",
      });

      await newPayment.save();

      // ✅ Send PayPal Payment Link to Frontend
      const approvalUrl = payment.links.find(link => link.rel === "approval_url").href;
      res.json({ link: approvalUrl });
    });
  } catch (error) {
    res.status(500).json({ message: "Error creating payment", error: error.message });
  }
};

// ✅ Verify PayPal Payment and Add Storage to User Account
exports.verifyPayment = async (req, res) => {
  try {
    const { paymentId, payerId } = req.query;

    console.log("🔍 Verifying Payment:", { paymentId, payerId });

    // ✅ Execute PayPal Payment
    paypal.payment.execute(paymentId, { payer_id: payerId }, async (error, payment) => {
      if (error) {
        console.error("🚨 PayPal Verification Error:", error);
        return res.status(500).json({ message: "Payment verification failed" });
      }

      // ✅ Find the Payment Record
      const paymentRecord = await Payment.findOne({ paymentId });
      if (!paymentRecord) {
        return res.status(404).json({ message: "Payment record not found" });
      }

      // ✅ Find the User
      const user = await User.findById(paymentRecord.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // ✅ Increase User's Download Limit
      user.downloadLimit += paymentRecord.downloadLimitAdded;
      user.totalPurchasedStorage += paymentRecord.downloadLimitAdded;

      console.log(
        `📈 Updated Storage: ${user.downloadLimit}GB (Total Purchased: ${user.totalPurchasedStorage}GB)`
      );

      // ✅ Save Payment History in User Model
      user.paymentHistory.push({
        paymentId: paymentRecord.paymentId,
        amount: paymentRecord.amount,
        downloadLimitAdded: paymentRecord.downloadLimitAdded,
        status: "completed",
        date: new Date(),
      });

      await user.save(); // ✅ Save User Data

      // ✅ Update Payment Status to "completed"
      paymentRecord.status = "completed";
      await paymentRecord.save();

      console.log("✅ Payment verified and saved successfully!");

      res.json({ message: "Payment verified, storage added successfully!" });
    });
  } catch (error) {
    res.status(500).json({ message: "Error verifying payment", error: error.message });
  }
};