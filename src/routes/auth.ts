import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { db } from '../lib/db';
import { hashPassword, verifyPassword, generateAccessToken, generateRefreshToken } from '../lib/auth';
import nodemailer from 'nodemailer';

const router = Router();

// Email transporter setup
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

// Generate verification code
function generateVerificationCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

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
    const verificationCode = generateVerificationCode();

    const user = await db.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        contact,
        country,
        company,
        jobRole,
        verificationCode,
        emailVerified: false,
        role: 'LEARNER',
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    // Send verification email
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM_EMAIL,
        to: email,
        subject: 'Verify your GovLearn account',
        html: `
          <h2>Welcome to GovLearn!</h2>
          <p>Hi ${name},</p>
          <p>Please verify your email address by entering the code below:</p>
          <h3>${verificationCode}</h3>
          <p>This code will expire in 24 hours.</p>
          <p>If you didn't create this account, please ignore this email.</p>
        `,
      });
    } catch (emailError) {
      console.error('[AUTH/SIGNUP] Email send error:', emailError);
      // Continue anyway - user can request code resend
    }

    res.status(201).json({
      message: 'Signup successful. Please verify your email.',
      user,
      requiresVerification: true,
    });
  } catch (error) {
    console.error('[AUTH/SIGNUP]', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const isPasswordValid = await verifyPassword(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
    });

    // Update refresh token and last login
    await db.user.update({
      where: { id: user.id },
      data: {
        refreshToken,
        lastLogin: new Date(),
      },
    });

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
    console.error('[AUTH/LOGIN]', error);
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

// POST /api/auth/verify-email
router.post('/verify-email', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, verificationCode } = req.body;

    if (!email || !verificationCode) {
      res.status(400).json({ error: 'Email and verification code required' });
      return;
    }

    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.verificationCode !== verificationCode) {
      res.status(400).json({ error: 'Invalid verification code' });
      return;
    }

    // Mark email as verified and clear code
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verificationCode: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    // Generate tokens
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
    });

    // Store refresh token
    await db.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.json({
      message: 'Email verified successfully',
      user: updatedUser,
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error('[AUTH/VERIFY_EMAIL]', error);
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
