const SupportMessage = require("../models/SupportMessage");
const User = require("../models/User");

// ✅ User Sends a Support Message
exports.sendSupportMessage = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) return res.status(401).json({ message: "Unauthorized" });

        // ✅ Check if conversation exists
        let supportMessage = await SupportMessage.findOne({ userId: user._id });

        if (!supportMessage) {
            // ✅ Create new conversation if user has no previous messages
            supportMessage = new SupportMessage({
                userId: user._id,
                userName: user.name,
                conversation: [{ sender: "user", message: req.body.message }],
            });
        } else {
            // ✅ Add new message to conversation array
            supportMessage.conversation.push({ sender: "user", message: req.body.message });
        }

        await supportMessage.save();
        res.status(201).json({ message: "Message sent successfully!" });
    } catch (error) {
        console.error("🚨 Error saving support message:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// ✅ User Fetches Their Own Support Messages
exports.getUserSupportMessages = async (req, res) => {
    try {
        const userMessages = await SupportMessage.findOne({ userId: req.user._id });

        if (!userMessages) {
            return res.json({ conversation: [] }); // ✅ Return empty conversation array
        }

        res.json({
            _id: userMessages._id,
            userId: userMessages.userId,
            userName: userMessages.userName,
            status: userMessages.status,
            conversation: userMessages.conversation || [], // ✅ Ensure conversation exists
        });
    } catch (error) {
        console.error("🚨 Error fetching user support messages:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// ✅ Admin Gets All Support Messages (Corrected)
exports.getSupportMessages = async (req, res) => {
    try {
        const messages = await SupportMessage.find().sort({ updatedAt: -1 });

        if (!messages.length) {
            return res.json([]); // ✅ Return an empty array if no messages exist
        }

        const formattedMessages = messages.map((msg) => ({
            _id: msg._id,
            userId: msg.userId,
            userName: msg.userName,
            status: msg.status,
            conversation: msg.conversation || [], // ✅ Ensure conversation exists
        }));

        res.json(formattedMessages);
    } catch (error) {
        console.error("🚨 Error fetching support messages:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

// ✅ Admin Replies to a Support Message
exports.replySupportMessage = async (req, res) => {
    try {
        const { reply } = req.body;
        if (!reply.trim()) return res.status(400).json({ message: "Reply cannot be empty" });

        const supportMessage = await SupportMessage.findById(req.params.id);
        if (!supportMessage) return res.status(404).json({ message: "Support message not found" });

        // ✅ Add reply to conversation array
        supportMessage.conversation.push({ sender: "admin", message: reply });

        // ✅ Update status to "resolved" (optional)
        supportMessage.status = "resolved";

        await supportMessage.save();

        res.json({ message: "Reply sent successfully" });
    } catch (error) {
        console.error("🚨 Error replying to support message:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

