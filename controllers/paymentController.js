const paypal = require("paypal-rest-sdk");
const Payment = require("../models/Payment");
const User = require("../models/User");

paypal.configure({
  mode: "sandbox",
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET,
});

// ✅ Define One-Time Purchase Plans
const storagePlans = {
  small: { price: 9.99, downloadLimit: 10 },  // 10GB for $9.99
  medium: { price: 14.99, downloadLimit: 15 }, // 15GB for $14.99
  large: { price: 19.99, downloadLimit: 20 }, // 20GB for $19.99
};

// ✅ Create a PayPal Payment for One-Time Storage Purchase
exports.createPayment = async (req, res) => {
  try {
    const { plan } = req.body; // 💳 Plan: "small", "medium", or "large"
    const userId = req.user._id;

    if (!storagePlans[plan]) {
      return res.status(400).json({ message: "Invalid storage plan" });
    }

    const { price, downloadLimit } = storagePlans[plan];

    // ✅ Create a PayPal Payment Object
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
        console.error("🚨 Payment record not found:", paymentId);
        return res.status(404).json({ message: "Payment record not found" });
      }

      console.log("✅ Found Payment Record:", paymentRecord);

      // ✅ Find the User
      const user = await User.findById(paymentRecord.userId);
      if (!user) {
        console.error("🚨 User not found:", paymentRecord.userId);
        return res.status(404).json({ message: "User not found" });
      }

      console.log("✅ User Found:", user.email);

      // ✅ Increase User's Download Limit
      user.downloadLimit += paymentRecord.downloadLimitAdded;
      user.totalPurchasedStorage += paymentRecord.downloadLimitAdded;

      console.log(
        `📈 Updated Storage: ${user.downloadLimit}GB (Total Purchased: ${user.totalPurchasedStorage}GB)`
      );

      // ✅ Save Payment History in User Model
      if (!user.paymentHistory) {
        user.paymentHistory = [];
      }

      user.paymentHistory.push({
        paymentId: paymentRecord.paymentId,
        amount: paymentRecord.amount,
        downloadLimitAdded: paymentRecord.downloadLimitAdded,
        status: "completed",
        date: new Date(),
      });

      await user.save(); // ✅ Save User Data

      console.log("✅ Payment history saved for user:", user.email);

      // ✅ Update Payment Status to "completed"
      paymentRecord.status = "completed";
      await paymentRecord.save();

      console.log("✅ Payment verified and saved successfully!");

      res.json({ message: "Payment verified, storage added successfully!" });
    });
  } catch (error) {
    console.error("🚨 Error verifying payment:", error);
    res.status(500).json({ message: "Error verifying payment", error: error.message });
  }
};

