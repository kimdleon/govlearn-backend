import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { db } from './lib/db';

// Import route handlers
import authRoutes from './routes/auth';
import courseRoutes from './routes/courses';
import webinarRoutes from './routes/webinars';
import userRoutes from './routes/users';
import certificateRoutes from './routes/certificates';
import adminRoutes from './routes/admin';
import learningPathRoutes from './routes/learning-paths';
import organizationRoutes from './routes/organizations';
import paymentRoutes from './routes/payments';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS Origins
const corsOrigins = [
  'http://localhost:3000',
  'https://govlearn.ph',
  'https://www.govlearn.ph',
  process.env.NEXT_PUBLIC_APP_URL || 'https://govlearn.ph'
].filter(Boolean);

// Middleware
app.use(cors({
  origin: corsOrigins,
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/webinars', webinarRoutes);
app.use('/api/users', userRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/learning-paths', learningPathRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/payments', paymentRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV}`);
  console.log(`🌐 CORS enabled for: ${corsOrigins.join(', ')}`);
});
