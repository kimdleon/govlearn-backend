import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { db } from '../lib/db';

const router = Router();

// POST /api/courses
router.post('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { title, description, categoryId, price } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    const course = await db.course.create({
      data: {
        userId: req.user.userId,
        title,
        description,
        categoryId,
        price: price ? parseFloat(price) : undefined,
      },
    });

    res.status(201).json(course);
  } catch (error) {
    console.error('[COURSES/CREATE]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/courses/:courseId
router.get('/:courseId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;

    const course = await db.course.findUnique({
      where: { id: courseId },
      include: {
        sections: {
          include: {
            courseContent: true,
          },
        },
        chapters: {
          orderBy: {
            position: 'asc',
          },
        },
        attachments: true,
        category: true,
      },
    });

    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    res.json(course);
  } catch (error) {
    console.error('[COURSES/GET]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/courses/:courseId
router.delete('/:courseId', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { courseId } = req.params;

    const course = await db.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    if (course.userId !== req.user.userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    await db.course.delete({
      where: { id: courseId },
    });

    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('[COURSES/DELETE]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/courses/:courseId/publish
router.post('/:courseId/publish', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { courseId } = req.params;

    const course = await db.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    if (course.userId !== req.user.userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const published = await db.course.update({
      where: { id: courseId },
      data: { isPublished: true },
    });

    res.json(published);
  } catch (error) {
    console.error('[COURSES/PUBLISH]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/courses/:courseId/unpublish
router.post('/:courseId/unpublish', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { courseId } = req.params;

    const course = await db.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    if (course.userId !== req.user.userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const unpublished = await db.course.update({
      where: { id: courseId },
      data: { isPublished: false },
    });

    res.json(unpublished);
  } catch (error) {
    console.error('[COURSES/UNPUBLISH]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/courses/:courseId/purchase-status
router.get('/:courseId/purchase-status', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { courseId } = req.params;

    const purchase = await db.purchase.findUnique({
      where: {
        userId_courseId: {
          userId: req.user.userId,
          courseId,
        },
      },
    });

    res.json({
      purchased: !!purchase && purchase.status === 'COMPLETED',
      status: purchase?.status,
    });
  } catch (error) {
    console.error('[COURSES/PURCHASE_STATUS]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/courses/:courseId/checkout
router.post('/:courseId/checkout', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { courseId } = req.params;

    const course = await db.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    // Create purchase record
    const purchase = await db.purchase.create({
      data: {
        userId: req.user.userId,
        courseId,
        status: 'PENDING',
        amount: course.price,
      },
    });

    // In production, redirect to payment gateway
    res.json({
      purchaseId: purchase.id,
      amount: course.price,
      message: 'Payment initiated',
    });
  } catch (error) {
    console.error('[COURSES/CHECKOUT]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/courses/:courseId/success
router.post('/:courseId/success', async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;
    const { transactionId, userId } = req.body;

    if (!transactionId || !userId) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Update purchase status
    const purchase = await db.purchase.updateMany({
      where: {
        transactionId,
        userId,
        courseId,
      },
      data: {
        status: 'COMPLETED',
      },
    });

    res.json({ message: 'Payment successful', purchase });
  } catch (error) {
    console.error('[COURSES/SUCCESS]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/courses/:courseId/certificate
router.patch('/:courseId/certificate', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { courseId } = req.params;
    const { hasCertificate, certificateTemplateUrl } = req.body;

    const course = await db.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    if (course.userId !== req.user.userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const updated = await db.course.update({
      where: { id: courseId },
      data: {
        hasCertificate: hasCertificate ?? course.hasCertificate,
        certificateTemplateUrl: certificateTemplateUrl ?? course.certificateTemplateUrl,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('[COURSES/CERTIFICATE]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/courses/:courseId/attachments
router.post('/:courseId/attachments', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { courseId } = req.params;
    const { name, url } = req.body;

    if (!name || !url) {
      res.status(400).json({ error: 'Name and URL are required' });
      return;
    }

    const course = await db.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      res.status(404).json({ error: 'Course not found' });
      return;
    }

    if (course.userId !== req.user.userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const attachment = await db.attachment.create({
      data: {
        name,
        url,
        courseId,
      },
    });

    res.status(201).json(attachment);
  } catch (error) {
    console.error('[COURSES/ATTACHMENTS/CREATE]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/courses/:courseId/attachments/:attachmentId
router.delete('/:courseId/attachments/:attachmentId', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { courseId, attachmentId } = req.params;

    const attachment = await db.attachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment || attachment.courseId !== courseId) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }

    const course = await db.course.findUnique({
      where: { id: courseId },
    });

    if (course?.userId !== req.user.userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    await db.attachment.delete({
      where: { id: attachmentId },
    });

    res.json({ message: 'Attachment deleted successfully' });
  } catch (error) {
    console.error('[COURSES/ATTACHMENTS/DELETE]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
