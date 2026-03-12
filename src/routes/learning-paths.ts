import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { db } from '../lib/db';

const router = Router();

// GET /api/learning-paths
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const paths = await db.learningPath.findMany({
      include: {
        items: {
          include: {
            course: {
              select: { id: true, title: true, imageUrl: true },
            },
          },
        },
        enrollments: {
          select: { userId: true, progress: true },
        },
      },
    });

    res.json(paths);
  } catch (error) {
    console.error('[LEARNING_PATHS/LIST]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/learning-paths
router.post('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { title, description } = req.body;

    if (!title) {
      res.status(400).json({ error: 'Title is required' });
      return;
    }

    const path = await db.learningPath.create({
      data: {
        title,
        description,
        createdBy: req.user.userId,
      },
    });

    res.status(201).json(path);
  } catch (error) {
    console.error('[LEARNING_PATHS/CREATE]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/learning-paths/:pathId
router.get('/:pathId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { pathId } = req.params;

    const path = await db.learningPath.findUnique({
      where: { id: pathId },
      include: {
        items: {
          include: {
            course: true,
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!path) {
      res.status(404).json({ error: 'Learning path not found' });
      return;
    }

    res.json(path);
  } catch (error) {
    console.error('[LEARNING_PATHS/GET]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/learning-paths/:pathId/items
router.post('/:pathId/items', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { pathId } = req.params;
    const { courseId, position } = req.body;

    if (!courseId) {
      res.status(400).json({ error: 'Course ID is required' });
      return;
    }

    // Check if learning path exists
    const path = await db.learningPath.findUnique({ where: { id: pathId } });
    if (!path) {
      res.status(404).json({ error: 'Learning path not found' });
      return;
    }

    const item = await db.learningPathItem.create({
      data: {
        learningPathId: pathId,
        courseId,
        position: position || 0,
      },
    });

    res.status(201).json(item);
  } catch (error) {
    console.error('[LEARNING_PATHS/ITEMS/CREATE]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/learning-paths/:pathId/items/:itemId
router.delete('/:pathId/items/:itemId', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { pathId, itemId } = req.params;

    const item = await db.learningPathItem.findUnique({
      where: { id: itemId },
    });

    if (!item || item.learningPathId !== pathId) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    await db.learningPathItem.delete({ where: { id: itemId } });

    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    console.error('[LEARNING_PATHS/ITEMS/DELETE]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/learning-paths/:pathId/enroll
router.post('/:pathId/enroll', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { pathId } = req.params;

    // Note: user field in schema appears to be a string, not a relation
    // Using the userId directly as it's already in the model
    const enrollment = await db.learningPathEnrollment.create({
      data: {
        learningPathId: pathId,
        userId: req.user.userId,
        status: 'ENROLLED',
        user: req.user.userId, // Matches schema requirement
      } as any,
    });

    res.status(201).json(enrollment);
  } catch (error) {
    console.error('[LEARNING_PATHS/ENROLL]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
