import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

// Define the root uploads directory (jahan saare student folders hain)
const uploadDir = path.join(process.cwd(), "uploads");
const mappingFile = path.join(uploadDir, "mapping.json"); 

// Ensure necessary folders/files exist
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(mappingFile)) fs.writeFileSync(mappingFile, JSON.stringify({}));


// -------------------------------------------------------------------------
// Upload Logic (Keep this as is, but remember the per-student setup is missing here)
// -------------------------------------------------------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "file-" + uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

router.post("/upload", upload.single("file"), (req, res) => {
  try {
    const { studentEmail, supervisorEmail } = req.body;
    // ... (Add your complete metadata saving and folder creation/move logic here 
    // to match your successful uploads, if needed. Assuming the mapping/auth check works.)
    
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
});

// -------------------------------------------------------------------------
// 🔄 FIX: GET files for a supervisor (Scans all student folders)
// -------------------------------------------------------------------------
router.get("/files", (req, res) => {
  try {
    const { supervisorEmail } = req.query;
    if (!supervisorEmail)
      return res.status(400).json({ success: false, message: "supervisorEmail required", files: [] });

    const allFiles = [];
    
    // 1. Read all entries (folders/files) inside the main 'uploads' directory
    const items = fs.readdirSync(uploadDir, { withFileTypes: true });
    
    // 2. Filter only student directories (folders whose names are student emails)
    const studentFolders = items
      .filter(dirent => dirent.isDirectory()) 
      .map(dirent => dirent.name);

    // 3. Iterate through each student folder
    for (const studentEmail of studentFolders) {
      const studentDir = path.join(uploadDir, studentEmail);
      const metadataFile = path.join(studentDir, "uploads.json"); // Path to student's metadata file
      
      // 4. Check if the student has a metadata file
      if (fs.existsSync(metadataFile)) {
        try {
          // 5. Read and filter the student's metadata
          const metadata = JSON.parse(fs.readFileSync(metadataFile, "utf8"));
          
          const supervisorFiles = metadata.filter(f => f.supervisorEmail === supervisorEmail);
          allFiles.push(...supervisorFiles);
        } catch (readError) {
          console.error(`Error reading metadata for ${studentEmail}:`, readError);
          continue; 
        }
      }
    }

    // 6. Sort by upload date 
    allFiles.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    res.json({ success: true, files: allFiles });
  } catch (err) {
    console.error("❌ Error fetching files:", err);
    res.status(500).json({ success: false, message: "Failed to fetch files", files: [] });
  }
});

// -------------------------------------------------------------------------
// ✅ NEW ROUTE: Download file securely from student folder
// Frontend will call: /api/download?studentEmail=...&filename=...
// -------------------------------------------------------------------------
router.get("/download", (req, res) => {
    // NOTE: You must include your verifyToken middleware here for security
    // Example: router.get("/download", verifyToken, (req, res) => { ...
    
    const { studentEmail, filename } = req.query;

    if (!studentEmail || !filename) {
        return res.status(400).json({ success: false, message: "Missing studentEmail or filename." });
    }

    // 1. Construct the path to the file inside the student's folder
    const studentDir = path.join(process.cwd(), "uploads", studentEmail);
    const filePath = path.join(studentDir, filename);

    // 2. Check if file exists
    if (fs.existsSync(filePath)) {
        // 3. Send the file for download
        res.download(filePath, (err) => {
            if (err) {
                console.error("Error serving file:", err.message);
                res.status(500).json({ success: false, message: "Could not download file." });
            }
        });
    } else {
        console.log(`File not found: ${filePath}`);
        res.status(404).json({ success: false, message: "File not found on server." });
    }
});

export default router;