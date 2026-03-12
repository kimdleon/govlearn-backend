import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { db } from '../lib/db';

const router = Router();

// Middleware to check if user is admin
async function isAdmin(req: AuthRequest, res: Response): Promise<boolean> {
  if (!req.user?.userId) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }

  const user = await db.user.findUnique({
    where: { id: req.user.userId },
    select: { role: true },
  });

  if (user?.role !== 'ADMIN') {
    res.status(403).json({ error: 'Forbidden - Admin access required' });
    return false;
  }

  return true;
}

// GET /api/admin/users
router.get('/users', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!(await isAdmin(req, res))) return;

    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (error) {
    console.error('[ADMIN/USERS]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/users
router.post('/users', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!(await isAdmin(req, res))) return;

    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Check if user exists
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'User already exists' });
      return;
    }

    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: (role?.toUpperCase() || 'LEARNER') as any,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    res.status(201).json(user);
  } catch (error) {
    console.error('[ADMIN/USERS/CREATE]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/users (Bulk delete)
router.delete('/users', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    console.log('[ADMIN/BULK_DELETE] 🗑️  Bulk delete request received');
    console.log('[ADMIN/BULK_DELETE] Request body:', req.body);
    
    if (!(await isAdmin(req, res))) return;

    const { userIds } = req.body;
    console.log('[ADMIN/BULK_DELETE] User IDs to delete:', userIds);

    if (!Array.isArray(userIds) || userIds.length === 0) {
      console.log('[ADMIN/BULK_DELETE] ❌ Invalid userIds - not an array or empty');
      res.status(400).json({ error: 'userIds must be a non-empty array' });
      return;
    }

    console.log(`[ADMIN/BULK_DELETE] ✅ Received ${userIds.length} user IDs to delete`);

    // Don't allow deleting your own account
    const currentUserId = req.user?.userId;
    if (userIds.includes(currentUserId)) {
      console.log('[ADMIN/BULK_DELETE] ❌ Attempted to delete own account');
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    console.log('[ADMIN/BULK_DELETE] 🔍 Executing deleteMany query...');
    const result = await db.user.deleteMany({
      where: {
        id: {
          in: userIds,
        },
      },
    });

    console.log(`[ADMIN/BULK_DELETE] ✅ Successfully deleted ${result.count} users`);
    res.json({ deletedCount: result.count });
  } catch (error) {
    console.error('[ADMIN/BULK_DELETE] 💥 ERROR:', error);
    if (error instanceof Error) {
      console.error('[ADMIN/BULK_DELETE] Message:', error.message);
      console.error('[ADMIN/BULK_DELETE] Stack:', error.stack);
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/speakers
router.get('/speakers', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!(await isAdmin(req, res))) return;

    const speakers = await db.speaker.findMany({
      include: {
        webinars: {
          select: { id: true, title: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json(speakers);
  } catch (error) {
    console.error('[ADMIN/SPEAKERS]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/speakers
router.post('/speakers', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!(await isAdmin(req, res))) return;

    const { name, bio, credentials, photoUrl, email, company, jobRole } = req.body;

    if (!name || !bio || !credentials) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const speaker = await db.speaker.create({
      data: {
        name,
        bio,
        credentials,
        photoUrl,
        email,
        company,
        jobRole,
      },
    });

    res.status(201).json(speaker);
  } catch (error) {
    console.error('[ADMIN/SPEAKERS/CREATE]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/speakers/:speakerId
router.patch('/speakers/:speakerId', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!(await isAdmin(req, res))) return;

    const { speakerId } = req.params;
    const { name, bio, credentials, photoUrl, email, company, jobRole } = req.body;

    const speaker = await db.speaker.update({
      where: { id: speakerId },
      data: {
        ...(name && { name }),
        ...(bio && { bio }),
        ...(credentials && { credentials }),
        ...(photoUrl !== undefined && { photoUrl }),
        ...(email !== undefined && { email }),
        ...(company !== undefined && { company }),
        ...(jobRole !== undefined && { jobRole }),
      },
    });

    res.json(speaker);
  } catch (error) {
    console.error('[ADMIN/SPEAKERS/UPDATE]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/webinars
router.get('/webinars', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!(await isAdmin(req, res))) return;

    const webinars = await db.webinar.findMany({
      include: {
        speakers: {
          select: { id: true, name: true },
        },
        registrations: {
          select: { id: true, status: true },
        },
      },
      orderBy: { sessionDate: 'desc' },
    });

    res.json(webinars);
  } catch (error) {
    console.error('[ADMIN/WEBINARS]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/speakers/:speakerId/webinars
router.get('/speakers/:speakerId/webinars', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!(await isAdmin(req, res))) return;

    const { speakerId } = req.params;

    const webinars = await db.webinar.findMany({
      where: {
        speakers: {
          some: { id: speakerId },
        },
      },
      select: {
        id: true,
        title: true,
        sessionDate: true,
        status: true,
      },
    });

    res.json(webinars);
  } catch (error) {
    console.error('[ADMIN/SPEAKERS/WEBINARS]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/reports/webinars
router.get('/reports/webinars', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!(await isAdmin(req, res))) return;

    const webinars = await db.webinar.findMany({
      include: {
        registrations: {
          select: { id: true, status: true },
        },
        assessments: {
          select: {
            id: true,
            results: {
              select: { score: true, passed: true },
            },
          },
        },
      },
    });

    const report = webinars.map((w) => ({
      id: w.id,
      title: w.title,
      totalRegistrations: w.registrations.length,
      revenue: w.price * (w.registrations?.filter((r) => r.status === 'attended').length || 0),
      assessments: w.assessments.length,
    }));

    res.json(report);
  } catch (error) {
    console.error('[ADMIN/REPORTS/WEBINARS]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/admin/webinars/:webinarId/pricing
router.patch('/webinars/:webinarId/pricing', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!(await isAdmin(req, res))) return;

    const { webinarId } = req.params;
    const { price, priceType, freePeriodEndDate, maxFreeSlotsForPromo } = req.body;

    const webinar = await db.webinar.update({
      where: { id: webinarId },
      data: {
        ...(price !== undefined && { price }),
        ...(priceType && { priceType }),
        ...(freePeriodEndDate && { freePeriodEndDate: new Date(freePeriodEndDate) }),
        ...(maxFreeSlotsForPromo !== undefined && { maxFreeSlotsForPromo }),
      },
    });

    res.json(webinar);
  } catch (error) {
    console.error('[ADMIN/WEBINARS/PRICING]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
