import { Router, Request, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { db } from '../lib/db';
import { hashPassword, verifyPassword, generateAccessToken, generateRefreshToken } from '../lib/auth';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

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

// Helper function to generate verification code
function generateVerificationCode(): string {
  // In development, always return 123456 for easy testing
  if (process.env.NODE_ENV !== 'production') {
    return '123456';
  }
  // In production, generate random code
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

// POST /api/auth/request-verification - Step 1: Send verification code
router.post('/request-verification', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, contact, country, jobRole, company, studentOrProfessional } = req.body;

    console.log('[REQUEST-VERIFICATION] 📝 Verification request for:', email);

    if (!email || !password || !name) {
      console.log('[REQUEST-VERIFICATION] ❌ Missing required fields');
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('[REQUEST-VERIFICATION] ❌ Invalid email format:', email);
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log('[REQUEST-VERIFICATION] ❌ User already exists:', email);
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    // Generate verification code
    const verificationCode = generateVerificationCode();
    const verificationExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Hash password for storage
    const hashedPassword = await hashPassword(password);

    // Store in SignupVerification table (don't create user yet)
    await db.signupVerification.upsert({
      where: { email },
      update: {
        verificationCode,
        verificationExpiry,
        password: hashedPassword,
        name,
        contact,
        country,
        company,
        jobRole,
        studentOrProfessional,
      },
      create: {
        email,
        verificationCode,
        verificationExpiry,
        password: hashedPassword,
        name,
        contact,
        country,
        company,
        jobRole,
        studentOrProfessional,
      },
    });

    console.log('[REQUEST-VERIFICATION] ✅ Verification code generated:', verificationCode);
    console.log('[REQUEST-VERIFICATION] 📧 Sending verification email to:', email);

    // Send verification code email
    await transporter.sendMail({
      from: process.env.SMTP_FROM_EMAIL || 'govlearn@virtual-mentors.com',
      to: email,
      subject: 'GovLearn - Email Verification Code',
      html: `
        <h2>Welcome to GovLearn!</h2>
        <p>Hi ${name},</p>
        <p>Thank you for signing up! Please verify your email with the code below:</p>
        <h3 style="font-family: monospace; font-size: 24px; letter-spacing: 2px; color: #0066cc;">${verificationCode}</h3>
        <p><strong>This code is valid for 10 minutes.</strong></p>
        <p>Do not share this code with anyone.</p>
        <p>If you didn't request this code, please ignore this email.</p>
      `,
    });

    console.log('[REQUEST-VERIFICATION] ✅ Verification email sent to:', email);

    // Always return code in development for testing
    const isDevMode = process.env.NODE_ENV !== 'production';
    res.status(200).json({
      message: 'Verification code sent to your email',
      email,
      ...(isDevMode && { verificationCode }),
    });
  } catch (error) {
    console.error('[REQUEST-VERIFICATION] ❌ Error:', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// POST /api/auth/verify-and-signup - Step 2: Verify code and create account
router.post('/verify-and-signup', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, verificationCode } = req.body;

    console.log('[VERIFY-AND-SIGNUP] 🔍 Verifying code for:', email);

    if (!email || !verificationCode) {
      console.log('[VERIFY-AND-SIGNUP] ❌ Missing email or verification code');
      res.status(400).json({ error: 'Email and verification code required' });
      return;
    }

    // Find signup verification record
    const verification = await db.signupVerification.findUnique({
      where: { email },
    });

    if (!verification) {
      console.log('[VERIFY-AND-SIGNUP] ❌ No verification record found for:', email);
      res.status(404).json({ error: 'Verification not found. Please sign up again.' });
      return;
    }

    // Check if code is expired
    if (new Date() > verification.verificationExpiry) {
      console.log('[VERIFY-AND-SIGNUP] ❌ Verification code expired for:', email);
      await db.signupVerification.delete({ where: { email } });
      res.status(410).json({ error: 'Verification code expired. Please sign up again.' });
      return;
    }

    // Verify code
    if (verification.verificationCode !== verificationCode) {
      console.log('[VERIFY-AND-SIGNUP] ❌ Invalid verification code for:', email);
      res.status(401).json({ error: 'Invalid verification code' });
      return;
    }

    console.log('[VERIFY-AND-SIGNUP] ✅ Code verified for:', email);

    // NOW create user account (only after verification!)
    const user = await db.user.create({
      data: {
        email,
        password: verification.password,
        name: verification.name,
        contact: verification.contact,
        country: verification.country,
        company: verification.company,
        jobRole: verification.jobRole,
        studentOrProfessional: verification.studentOrProfessional,
        emailVerified: true,
        role: 'LEARNER',
      },
    });

    console.log('[VERIFY-AND-SIGNUP] ✅ User created:', email);

    // Generate JWT tokens
    console.log('[VERIFY-AND-SIGNUP] 🎫 Generating tokens...');
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email,
    });

    // Update user with refresh token
    console.log('[VERIFY-AND-SIGNUP] 💾 Saving refresh token...');
    await db.user.update({
      where: { id: user.id },
      data: {
        refreshToken,
        lastLogin: new Date(),
      },
    });

    // Delete verification record
    await db.signupVerification.delete({ where: { email } });

    console.log('[VERIFY-AND-SIGNUP] ✅ Account created and logged in for:', email);
    
    // Set tokens as cookies so server-side code can access them
    const isDev = process.env.NODE_ENV !== 'production';
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: !isDev,
      sameSite: isDev ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: !isDev,
      sameSite: isDev ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
    
    res.status(201).json({
      message: 'Account created successfully',
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
    console.error('[VERIFY-AND-SIGNUP] ❌ Error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// POST /api/auth/signup (kept for backward compatibility, but redirects to two-step)
router.post('/signup', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, contact, country, jobRole, company, studentOrProfessional } = req.body;

    console.log('[AUTH/SIGNUP] 📝 Signup attempt for:', email);

    if (!email || !password || !name) {
      console.log('[AUTH/SIGNUP] ❌ Missing required fields');
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('[AUTH/SIGNUP] ❌ Invalid email format:', email);
      res.status(400).json({ error: 'Invalid email format' });
      return;
    }

    // Check if user exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log('[AUTH/SIGNUP] ❌ User already exists:', email);
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
        studentOrProfessional,
        emailVerified: true,
        role: 'LEARNER',
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    console.log('[AUTH/SIGNUP] ✅ User created:', email);
    console.log('[AUTH/SIGNUP] 🔐 Generated verification code:', verificationCode);
    console.log('[AUTH/SIGNUP] 📧 Sending verification email to:', email);

    // Send verification code email asynchronously
    transporter.sendMail({
      from: process.env.SMTP_FROM_EMAIL || 'govlearn@virtual-mentors.com',
      to: email,
      subject: 'GovLearn - Verification Code',
      html: `
        <h2>Welcome to GovLearn!</h2>
        <p>Hi ${name},</p>
        <p>Your verification code is:</p>
        <h3 style="font-family: monospace; font-size: 24px; letter-spacing: 2px; color: #0066cc;">${verificationCode}</h3>
        <p>This code is valid for 10 minutes. Do not share this code with anyone.</p>
        <p>If you didn't request this code, please ignore this email.</p>
      `,
    }).then((result) => {
      console.log('[AUTH/SIGNUP] ✅ Verification email sent:', result.messageId, 'to:', email);
    }).catch((emailError) => {
      console.error('[AUTH/SIGNUP] ⚠️ Email send error for', email, ':', emailError.message);
    });

    // In development, include code in response for testing
    const isDevMode = process.env.NODE_ENV !== 'production';
    res.status(201).json({
      message: 'Account created. A verification code has been sent to your email.',
      user,
      ...(isDevMode && { verificationCode }),
    });
  } catch (error) {
    console.error('[AUTH/SIGNUP] ❌ Error:', error);
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
    
    // Set tokens as cookies so server-side code can access them
    const isDev = process.env.NODE_ENV !== 'production';
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: !isDev,
      sameSite: isDev ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: !isDev,
      sameSite: isDev ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
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
