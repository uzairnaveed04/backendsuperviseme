import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "../firebaseAdmin.js"; // 🔹 Firestore DB
import { verifyToken } from "../authMiddleware.js"; // 🔹 Auth middleware
import { getFirestore, collection, query, where, getDocs, setDoc, doc, getDoc, writeBatch, orderBy } from 'firebase/firestore'; // Note: Only needed if using Firebase v9, but keeping for completeness

const router = express.Router();

// 🔹 Helper functions
function getStudentDir(studentEmail) {
  // Final destination: uploads/[studentEmail]
  return path.join(process.cwd(), "uploads", studentEmail);
}

function getMetadataFile(studentEmail) {
  return path.join(getStudentDir(studentEmail), "uploads.json");
}

// -------------------------------------------------------------------------
// 💾 Multer Storage Configuration (FIXED)
// -------------------------------------------------------------------------

// Define the ROOT temporary upload directory
const rootUploadsDir = path.join(process.cwd(), "uploads");

// Ensure the root uploads folder exists (required for temporary storage)
if (!fs.existsSync(rootUploadsDir)) {
  fs.mkdirSync(rootUploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  // 🎯 FIX: Always save to the root directory first (no req.body checks here)
  destination: (req, file, cb) => {
    // Multer now saves all files to the main 'uploads' folder temporarily
    cb(null, rootUploadsDir); 
  },
  
  // Set the filename
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    // Use a temporary filename; the final name/location is set after auth check
    cb(null, "temp-" + uniqueSuffix + path.extname(file.originalname)); 
  },
});

const upload = multer({ storage });

// -------------------------------------------------------------------------
// 🚀 POST Route: File Upload
// -------------------------------------------------------------------------
router.post("/upload", verifyToken, upload.single("file"), async (req, res) => {
  try {
    const { studentEmail, supervisorEmail } = req.body;
    const uploadedFile = req.file;

    if (!studentEmail || !supervisorEmail) {
      // If validation fails, delete the temporarily saved file
      if (uploadedFile) fs.unlinkSync(uploadedFile.path); 
      return res.status(400).json({
        success: false,
        message: "studentEmail & supervisorEmail required",
      });
    }

    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // 🔍 Check if student-supervisor relationship is approved (Firebase Check)
    const snapshot = await db
      .collection("messages")
      .where("senderId", "==", studentEmail)
      .where("receiverId", "==", supervisorEmail)
      .where("status", "==", "Approved")
      .get();

    if (snapshot.empty) {
      // If authorization fails, delete the temporarily saved file
      fs.unlinkSync(uploadedFile.path); 
      return res.status(403).json({
        success: false,
        message: "❌ You must first be approved by this supervisor before uploading documents.",
      });
    }

    // -------------------------------------------------------------------------
    // ✅ FINAL STEP: Move the temporary file to the student's isolated folder
    // -------------------------------------------------------------------------
    const finalStudentDir = getStudentDir(studentEmail);
    
    // 1. Final destination folder banao
    if (!fs.existsSync(finalStudentDir)) {
      fs.mkdirSync(finalStudentDir, { recursive: true });
    }

    // 2. File ka final name set karo (Remove 'temp-' prefix)
    const finalFilename = uploadedFile.filename.replace("temp-", "file-");
    const finalPath = path.join(finalStudentDir, finalFilename);

    // 3. File ko temporary location se permanent location par move karo
    fs.renameSync(uploadedFile.path, finalPath);
    
    // -------------------------------------------------------------------------

    // ✅ Save file metadata
    const metadataFile = getMetadataFile(studentEmail);
    if (!fs.existsSync(metadataFile)) {
      fs.writeFileSync(metadataFile, JSON.stringify([]));
    }
    
    const metadata = JSON.parse(fs.readFileSync(metadataFile));
    const newEntry = {
      studentEmail,
      supervisorEmail,
      filename: finalFilename, // Use final filename
      originalName: uploadedFile.originalname,
      path: finalPath, // Use final path
      uploadedAt: new Date().toISOString(),
    };

    metadata.push(newEntry);
    fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));

    console.log("📩 Upload saved:", newEntry);

    res.json({
      success: true,
      message: `✅ File uploaded successfully and saved to ${studentEmail}'s folder.`,
      file: newEntry,
    });
  } catch (err) {
    console.error("❌ Upload error:", err.message, err.stack);
    // If an error happens after the file was uploaded but before move/metadata, try to clean up
    if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, message: "Upload failed" });
  }
});

// 🚀 Route: Get all files of a student
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