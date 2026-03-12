import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { db } from '../lib/db';
import { hashPassword, verifyPassword, generateAccessToken, generateRefreshToken } from '../lib/auth';
import nodemailer from 'nodemailer';

const router = Router();

// Email transporter setup
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.hostinger.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // Use STARTTLS
  requireTLS: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  logger: true, // Enable logging for debugging
  debug: true, // Show debug output
});

// POST /api/auth/signup
router.post('/signup', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, contact, country, industry, jobRole, company } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(409).json({ error: 'User already exists' });
      return;
    }

    const hashedPassword = await hashPassword(password);

    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        contact,
        country,
        company,
        jobRole,
        emailVerified: true,
        role: 'LEARNER',
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    // Send welcome email asynchronously (don't wait for it)
    transporter.sendMail({
      from: process.env.SMTP_FROM_EMAIL || 'govlearn@virtual-mentors.com',
      to: email,
      subject: 'Welcome to GovLearn!',
      html: `
        <h2>Welcome to GovLearn!</h2>
        <p>Hi ${name},</p>
        <p>Your account has been created successfully. You can now log in to access our webinars and courses.</p>
        <p>If you didn't create this account, please ignore this email.</p>
      `,
    }).then((result) => {
      console.log('[AUTH/SIGNUP] Email sent successfully:', result.messageId);
    }).catch((emailError) => {
      console.error('[AUTH/SIGNUP] Email send error:', emailError);
      // Continue anyway - user can still log in
    });

    res.status(201).json({
      message: 'Signup successful. You can now log in.',
      user,
    });
  } catch (error) {
    console.error('[AUTH/SIGNUP]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('[LOGIN] 🔐 Login attempt received');
    const { email, password } = req.body;

    if (!email || !password) {
      console.log('[LOGIN] ❌ Missing email or password');
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    console.log(`[LOGIN] 🔍 Looking up user: ${email}`);
    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      console.log(`[LOGIN] ❌ User not found: ${email}`);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    console.log(`[LOGIN] ✅ User found: ${user.email}`);
    console.log(`[LOGIN] 🔐 Verifying password...`);
    const isPasswordValid = await verifyPassword(password, user.password);

    if (!isPasswordValid) {
      console.log(`[LOGIN] ❌ Invalid password for ${email}`);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    console.log(`[LOGIN] ✅ Password valid`);
    console.log(`[LOGIN] 🎫 Generating tokens...`);
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
    });

    console.log(`[LOGIN] 💾 Updating user record...`);
    // Update refresh token and last login
    await db.user.update({
      where: { id: user.id },
      data: {
        refreshToken,
        lastLogin: new Date(),
      },
    });

    console.log(`[LOGIN] ✅ Login successful for ${email}`);
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('[LOGIN] 💥 ERROR:', error);
    if (error instanceof Error) {
      console.error('[LOGIN] Error message:', error.message);
      console.error('[LOGIN] Error stack:', error.stack);
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token required' });
      return;
    }

    // Verify and decode refresh token
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-env'
    ) as any;

    const user = await db.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user || user.refreshToken !== refreshToken) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    res.json({ accessToken });
  } catch (error) {
    console.error('[AUTH/REFRESH]', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    await db.user.update({
      where: { id: req.user.userId },
      data: { refreshToken: null },
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('[AUTH/LOGOUT]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/verify
router.get('/verify', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await db.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('[AUTH/VERIFY]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
