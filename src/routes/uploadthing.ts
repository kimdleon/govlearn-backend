import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// POST /api/uploadthing - Handle file uploads
router.post(
  '/',
  authenticateToken,
  upload.single('file'),
  (req: any, res: Response): void => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      // Generate URL for the uploaded file
      const fileUrl = `/uploads/${req.file.filename}`;

      console.log(`[UPLOADTHING] File uploaded: ${req.file.originalname} -> ${fileUrl}`);
      res.json({
        url: fileUrl,
        name: req.file.originalname,
        size: req.file.size,
      });
    } catch (error) {
      console.error('[UPLOADTHING] Error:', error);
      res.status(500).json({ error: 'Failed to upload file' });
    }
  }
);

export default router;

