import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import multer from 'multer';

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
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

      // For development, generate a mock URL
      // In production, upload to cloud storage (S3, Cloudinary, etc.)
      const mockUrl = `https://via.placeholder.com/600x400?text=${encodeURIComponent(req.file.originalname)}`;

      console.log(`[UPLOADTHING] File uploaded: ${req.file.originalname}`);
      res.json({
        url: mockUrl,
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

