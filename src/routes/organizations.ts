import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { db } from '../lib/db';

const router = Router();

// GET /api/organizations
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const organizations = await db.organization.findMany({
      include: {
        categories: true,
        users: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.json(organizations);
  } catch (error) {
    console.error('[ORGANIZATIONS/LIST]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/organizations
router.post('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { name, slug, imageUrl } = req.body;

    if (!name || !slug) {
      res.status(400).json({ error: 'Name and slug are required' });
      return;
    }

    const organization = await db.organization.create({
      data: {
        name,
        slug,
        imageUrl,
      },
    });

    res.status(201).json(organization);
  } catch (error) {
    console.error('[ORGANIZATIONS/CREATE]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/organizations/:orgId
router.get('/:orgId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { orgId } = req.params;

    const org = await db.organization.findUnique({
      where: { id: orgId },
      include: {
        categories: true,
        departments: true,
        users: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });

    if (!org) {
      res.status(404).json({ error: 'Organization not found' });
      return;
    }

    res.json(org);
  } catch (error) {
    console.error('[ORGANIZATIONS/GET]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/organizations/:orgId
router.patch('/:orgId', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { orgId } = req.params;
    const { name, slug, imageUrl, isActive } = req.body;

    const org = await db.organization.update({
      where: { id: orgId },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json(org);
  } catch (error) {
    console.error('[ORGANIZATIONS/UPDATE]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/organizations/:orgId/categories
router.get('/:orgId/categories', async (req: Request, res: Response): Promise<void> => {
  try {
    const { orgId } = req.params;

    const categories = await db.category.findMany({
      where: {
        organizations: {
          some: { id: orgId },
        },
      },
    });

    res.json(categories);
  } catch (error) {
    console.error('[ORGANIZATIONS/CATEGORIES]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/organizations/:orgId/departments
router.post('/:orgId/departments', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { orgId } = req.params;
    const { name } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Department name is required' });
      return;
    }

    const department = await db.department.create({
      data: {
        name,
        organizationId: orgId,
      },
    });

    res.status(201).json(department);
  } catch (error) {
    console.error('[ORGANIZATIONS/DEPARTMENTS/CREATE]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
