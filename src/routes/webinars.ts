import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { db } from '../lib/db';

const router = Router();

// GET /api/webinars
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.query;

    const webinars = await db.webinar.findMany({
      where: status ? { status: status as string } : { status: 'published' },
      include: {
        speakers: true,
      },
      orderBy: {
        sessionDate: 'asc',
      },
    });

    res.json(webinars);
  } catch (error) {
    console.error('[WEBINARS/LIST]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/webinars
router.post('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const {
      title,
      slug,
      posterUrl,
      outline,
      price,
      certificatePrice,
      sessionDate,
      speakers,
      googleMeetLink,
    } = req.body;

    if (!title || !slug || !sessionDate) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const webinar = await db.webinar.create({
      data: {
        title,
        slug,
        posterUrl,
        outline,
        price: price ? parseFloat(price) : 0,
        certificatePrice: certificatePrice ? parseFloat(certificatePrice) : 0,
        sessionDate: new Date(sessionDate),
        googleMeetLink,
        status: 'draft',
        speakers: speakers
          ? {
              connect: Array.isArray(speakers)
                ? speakers.map((id: string) => ({ id }))
                : [{ id: speakers }],
            }
          : undefined,
      },
      include: {
        speakers: true,
      },
    });

    res.status(201).json(webinar);
  } catch (error) {
    console.error('[WEBINARS/CREATE]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/webinars/:webinarId
router.get('/:webinarId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { webinarId } = req.params;

    const webinar = await db.webinar.findUnique({
      where: { id: webinarId },
      include: {
        speakers: true,
        registrations: {
          select: {
            id: true,
            userId: true,
            status: true,
          },
        },
      },
    });

    if (!webinar) {
      res.status(404).json({ error: 'Webinar not found' });
      return;
    }

    res.json(webinar);
  } catch (error) {
    console.error('[WEBINARS/GET]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/webinars/:webinarId/register
router.post('/:webinarId/register', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { webinarId } = req.params;

    const webinar = await db.webinar.findUnique({
      where: { id: webinarId },
    });

    if (!webinar) {
      res.status(404).json({ error: 'Webinar not found' });
      return;
    }

    // Check if already registered
    const existing = await db.registration.findUnique({
      where: {
        userId_webinarId: {
          userId: req.user.userId,
          webinarId,
        },
      },
    });

    if (existing) {
      res.status(409).json({ error: 'Already registered' });
      return;
    }

    const registration = await db.registration.create({
      data: {
        userId: req.user.userId,
        webinarId,
        status: 'registered',
      },
    });

    res.status(201).json(registration);
  } catch (error) {
    console.error('[WEBINARS/REGISTER]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/webinars/:webinarId/publish
router.post('/:webinarId/publish', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { webinarId } = req.params;

    const webinar = await db.webinar.update({
      where: { id: webinarId },
      data: { status: 'published' },
    });

    res.json(webinar);
  } catch (error) {
    console.error('[WEBINARS/PUBLISH]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/webinars/:webinarId/registration-info
router.get('/:webinarId/registration-info', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { webinarId } = req.params;

    const registration = await db.registration.findUnique({
      where: {
        userId_webinarId: {
          userId: req.user.userId,
          webinarId,
        },
      },
      include: {
        certificate: true,
        certificatePurchase: true,
      },
    });

    if (!registration) {
      res.status(404).json({ error: 'Not registered' });
      return;
    }

    res.json(registration);
  } catch (error) {
    console.error('[WEBINARS/REGISTRATION_INFO]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/webinars/:webinarId/checkout
router.post('/:webinarId/checkout', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { webinarId } = req.params;
    const { type } = req.body; // 'registration' or 'certificate'

    const webinar = await db.webinar.findUnique({
      where: { id: webinarId },
    });

    if (!webinar) {
      res.status(404).json({ error: 'Webinar not found' });
      return;
    }

    const amount = type === 'certificate' ? webinar.certificatePrice : webinar.price;

    const payment = await db.payment.create({
      data: {
        amount,
        method: 'PEARLPAY',
        status: 'paid',
        paymentType: type === 'certificate' ? 'CERTIFICATE' : 'REGISTRATION',
      },
    });

    res.json({
      paymentId: payment.id,
      amount,
      webinarId,
      type,
    });
  } catch (error) {
    console.error('[WEBINARS/CHECKOUT]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/webinars/:webinarId/certificate-purchase
router.post('/:webinarId/certificate-purchase', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { webinarId } = req.params;
    const { transactionId } = req.body;

    const registration = await db.registration.findUnique({
      where: {
        userId_webinarId: {
          userId: req.user.userId,
          webinarId,
        },
      },
    });

    if (!registration) {
      res.status(404).json({ error: 'Registration not found' });
      return;
    }

    const webinar = await db.webinar.findUnique({
      where: { id: webinarId },
    });

    const certificatePurchase = await db.webinarCertificatePurchase.create({
      data: {
        registrationId: registration.id,
        amount: webinar?.certificatePrice || 0,
        transactionId,
        status: 'COMPLETED',
      },
    });

    res.status(201).json(certificatePurchase);
  } catch (error) {
    console.error('[WEBINARS/CERTIFICATE_PURCHASE]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/webinars/:webinarId
router.patch('/:webinarId', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { webinarId } = req.params;
    const { title, outline, price, sessionDate, googleMeetLink } = req.body;

    const webinar = await db.webinar.update({
      where: { id: webinarId },
      data: {
        ...(title && { title }),
        ...(outline && { outline }),
        ...(price !== undefined && { price }),
        ...(sessionDate && { sessionDate: new Date(sessionDate) }),
        ...(googleMeetLink && { googleMeetLink }),
      },
    });

    res.json(webinar);
  } catch (error) {
    console.error('[WEBINARS/UPDATE]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
