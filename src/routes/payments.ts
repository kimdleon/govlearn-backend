import { Router, Request, Response } from 'express';
import { db } from '../lib/db';

const router = Router();

// POST /api/payments/callback
router.post('/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactionId, status, amount, courseId, userId, webinarId } = req.body;

    if (!transactionId) {
      res.status(400).json({ error: 'Transaction ID is required' });
      return;
    }

    // Update course purchase
    if (courseId && userId) {
      const purchase = await db.purchase.findFirst({
        where: { transactionId },
      });

      if (purchase && status === 'COMPLETED') {
        await db.purchase.update({
          where: { id: purchase.id },
          data: { status: 'COMPLETED' },
        });
      }
    }

    // Update webinar payment/registration
    if (webinarId && userId) {
      const registration = await db.registration.findFirst({
        where: {
          userId,
          webinarId,
        },
      });

      if (registration && status === 'COMPLETED') {
        const payment = await db.payment.create({
          data: {
            amount: Number(amount) || 0,
            method: 'PEARLPAY',
            status: 'paid',
            transactionId,
            paymentType: 'REGISTRATION',
          },
        });

        await db.registration.update({
          where: { id: registration.id },
          data: {
            paymentId: payment.id,
            registrationType: 'PAID',
          },
        });
      }
    }

    res.json({ success: true, message: 'Payment processed' });
  } catch (error) {
    console.error('[PAYMENTS/CALLBACK]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/payments/verify
router.post('/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactionId } = req.body;

    if (!transactionId) {
      res.status(400).json({ error: 'Transaction ID is required' });
      return;
    }

    // Verify the transaction with payment provider
    // This would typically call an external payment verification API
    const purchase = await db.purchase.findFirst({
      where: { transactionId },
    });

    if (!purchase) {
      res.status(404).json({ error: 'Transaction not found' });
      return;
    }

    res.json({
      verified: true,
      status: purchase.status,
      transactionId,
    });
  } catch (error) {
    console.error('[PAYMENTS/VERIFY]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
