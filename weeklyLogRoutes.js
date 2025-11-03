import express from "express";
import { db } from "./firebaseAdmin.js";
import { getAuth } from "firebase-admin/auth";
import { Timestamp } from "firebase-admin/firestore";

const router = express.Router();

/**
 * ✅ Middleware: Verify Firebase token
 */
async function verifyToken(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, error: "No token provided" });
    }

    const token = header.split(" ")[1];
    const decoded = await getAuth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(401).json({ success: false, error: "Invalid or expired token" });
  }
}

/**
 * 📝 Route: Submit Weekly Log
 */
router.post("/submit", verifyToken, async (req, res) => {
  try {
    const { logContent, weekStart, supervisorEmail } = req.body;
    const studentEmail = req.user.email;

    // 🚨 Validate request body
    if (!logContent?.trim() || !weekStart) {
      return res.json({ success: false, error: "Log content and week start are required" });
    }

    // 🔍 Check if student is supervised (messages collection with status == Approved)
    const messagesSnap = await db.collection("messages")
      .where("senderId", "==", studentEmail)
      .where("status", "==", "Approved")
      .get();

    if (messagesSnap.empty) {
      return res.json({
        success: false,
        error: "❌ You must be supervised before submitting weekly logs"
      });
    }

    // ✅ Add log
    await db.collection("weeklyLogs").add({
      studentEmail,
      supervisorEmail: supervisorEmail || "N/A",
      weekStart: Timestamp.fromDate(new Date(weekStart)), // frontend sends ISO string
      logContent: logContent.trim(),
      status: "submitted",
      submittedAt: Timestamp.now()
    });

    res.json({ success: true, message: "✅ Weekly log submitted successfully!" });

  } catch (err) {
    console.error("Weekly log submit error:", err);
    res.status(500).json({ success: false, error: "Server error while submitting weekly log" });
  }
});

export default router;
