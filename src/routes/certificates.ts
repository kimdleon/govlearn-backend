import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { db } from '../lib/db';

const router = Router();

// GET /api/certificates/:courseId
router.get('/:courseId', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { courseId } = req.params;

    // Check if user has completed the course
    const course = await db.course.findUnique({
      where: { id: courseId },
      include: {
        chapters: {
          select: { id: true },
        },
      },
    });

    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    // Check if user has purchased the course (or is the instructor)
    const hasPurchased =
      course.userId === req.user.userId ||
      (await db.purchase.findFirst({
        where: {
          courseId,
          userId: req.user.userId,
          status: 'COMPLETED',
        },
      }));

    if (!hasPurchased) {
      res.status(403).json({ error: 'Unauthorized - Course not purchased' });
      return;
    }

    // Check progress on all chapters
    const userProgress = await db.userProgress.findMany({
      where: {
        userId: req.user.userId,
        content: {
          courseId,
        },
      },
    });

    // For now, return a placeholder certificate data
    // In production, you would generate an actual PDF/image
    const certificate = {
      userId: req.user.userId,
      courseId,
      issuedAt: new Date(),
      courseTitle: course.title,
      completionPercentage: userProgress.length > 0 ? 100 : 0,
    };

    res.json(certificate);
  } catch (error) {
    console.error('[CERTIFICATES/GET]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/certificates/:courseId/verify
router.post('/:courseId/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;
    const { verificationCode } = req.body;

    // This would verify a certificate verification code
    // For webinar certificates, use the WebinarCertificate model
    const course = await db.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true },
    });

    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    res.json({
      valid: true,
      course,
      message: 'Certificate is valid',
    });
  } catch (error) {
    console.error('[CERTIFICATES/VERIFY]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
