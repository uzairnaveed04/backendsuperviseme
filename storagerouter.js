import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

// ✅ Multer Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const studentID = req.body?.studentID || "unknownStudent";
    const supervisorEmail = req.body?.supervisorEmail || "unknownEmail";

    const safeEmail = supervisorEmail.replace(/[@.]/g, '_');
    const uniqueName = `${studentID}-${safeEmail}-${Date.now()}${path.extname(file.originalname)}`;

    console.log("📥 Upload Request:", { studentID, supervisorEmail, file: file.originalname });

    cb(null, uniqueName);
  }
});

// ✅ File size limit 50MB
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

// ✅ Student PDF Upload
router.post('/upload-pdf', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  console.log("✅ File saved:", req.file.filename);
  res.json({ success: true, message: 'File uploaded successfully', filename: req.file.filename });
});

// ✅ Static file serving for Supervisor download
router.use('/files', express.static(path.join(__dirname, '../uploads')));

export default router;
