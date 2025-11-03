import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "../firebaseAdmin.js";   // 🔹 Firestore DB
import { verifyToken } from "../authMiddleware.js";  // 🔹 Auth middleware

const router = express.Router();

// 🔹 Helper functions for per-student storage
function getStudentDir(studentEmail) {
  return path.join(process.cwd(), "uploads", studentEmail);
}

function getMetadataFile(studentEmail) {
  return path.join(getStudentDir(studentEmail), "uploads.json");
}

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { studentEmail } = req.body;

    if (!studentEmail) {
      return cb(new Error("studentEmail required"), null);
    }

    const studentDir = getStudentDir(studentEmail);

    if (!fs.existsSync(studentDir)) {
      fs.mkdirSync(studentDir, { recursive: true });
    }

    cb(null, studentDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "file-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

// 🚀 Upload route with supervision + student isolation
router.post("/upload", verifyToken, upload.single("file"), async (req, res) => {
  try {
    const { studentEmail, supervisorEmail } = req.body;

    if (!studentEmail || !supervisorEmail) {
      return res.status(400).json({
        success: false,
        message: "studentEmail & supervisorEmail required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // 🔍 Check if student-supervisor relationship is approved
    const snapshot = await db
      .collection("messages")
      .where("senderId", "==", studentEmail)
      .where("receiverId", "==", supervisorEmail)
      .where("status", "==", "Approved")
      .get();

    if (snapshot.empty) {
      return res.status(403).json({
        success: false,
        message: "❌ You must first be approved by this supervisor before uploading documents.",
      });
    }

    // ✅ Ensure student's metadata.json exists
    const metadataFile = getMetadataFile(studentEmail);
    if (!fs.existsSync(metadataFile)) {
      fs.writeFileSync(metadataFile, JSON.stringify([]));
    }

    // ✅ Save file metadata
    const metadata = JSON.parse(fs.readFileSync(metadataFile));
    const newEntry = {
      studentEmail,
      supervisorEmail,
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      uploadedAt: new Date().toISOString(),
    };

    metadata.push(newEntry);
    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));

    console.log("📩 Upload saved:", newEntry);

    res.json({
      success: true,
      message: `✅ File uploaded successfully and sent to ${supervisorEmail}`,
      file: newEntry,
    });
  } catch (err) {
    console.error("❌ Upload error:", err.message, err.stack);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
});

// 🚀 Route: Get all files of a student (Only student himself or supervisor)
router.get("/files/:studentEmail", verifyToken, async (req, res) => {
  try {
    const { studentEmail } = req.params;
    const userEmail = req.user.email; // 🔹 From verifyToken decoded JWT

    const metadataFile = getMetadataFile(studentEmail);

    if (!fs.existsSync(metadataFile)) {
      return res.json([]);
    }

    // 🔒 Access control
    if (userEmail !== studentEmail) {
      // Supervisor can access only if relationship is approved
      const snapshot = await db
        .collection("messages")
        .where("senderId", "==", studentEmail)
        .where("receiverId", "==", userEmail)
        .where("status", "==", "Approved")
        .get();

      if (snapshot.empty) {
        return res.status(403).json({
          success: false,
          message: "❌ You are not authorized to view this student's documents.",
        });
      }
    }

    const metadata = JSON.parse(fs.readFileSync(metadataFile));
    res.json(metadata);
  } catch (err) {
    console.error("❌ Fetch error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch files" });
  }
});

export default router;
