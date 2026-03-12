import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { db } from '../lib/db';

const router = Router();

// GET /api/users/:userId
router.get('/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('[USERS/GET]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/users/:userId
router.patch('/:userId', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { userId } = req.params;

    // Users can only update their own profile unless they're admin
    if (req.user.userId !== userId && req.user.role !== 'ADMIN') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const {
      name,
      avatarUrl,
      number,
      contact,
      country,
      company,
      jobRole,
      studentOrProfessional,
      facebook,
      instagram,
      link,
      linkedIn,
      headline,
      industry,
      services,
      education,
    } = req.body;

    const user = await db.user.update({
      where: { id: userId },
      data: {
        ...(name && { name }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(number !== undefined && { number }),
        ...(contact !== undefined && { contact }),
        ...(country !== undefined && { country }),
        ...(company !== undefined && { company }),
        ...(jobRole !== undefined && { jobRole }),
        ...(studentOrProfessional !== undefined && { studentOrProfessional }),
        ...(facebook !== undefined && { facebook }),
        ...(instagram !== undefined && { instagram }),
        ...(link !== undefined && { link }),
        ...(linkedIn !== undefined && { linkedIn }),
        ...(headline !== undefined && { headline }),
        ...(industry !== undefined && { industry }),
        ...(services !== undefined && { services }),
        ...(education !== undefined && { education }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
      },
    });

    res.json(user);
  } catch (error) {
    console.error('[USERS/UPDATE]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:userId/instructor-profile
router.get('/:userId/instructor-profile', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        facebook: true,
        instagram: true,
        link: true,
        linkedIn: true,
        headline: true,
        industry: true,
        services: true,
        education: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('[USERS/INSTRUCTOR_PROFILE]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:userId/metadata
router.get('/:userId/metadata', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        department: {
          select: {
            id: true,
            name: true,
          },
        },
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      id: user.id,
      name: user.name,
      role: user.role,
      organization: user.organization,
      department: user.department,
      team: user.team,
    });
  } catch (error) {
    console.error('[USERS/METADATA]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
