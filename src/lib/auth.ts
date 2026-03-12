import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-env';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-env';

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface JWTPayload {
  userId: string;
  email: string;
  role?: string;
}

export function generateAccessToken(payload: JWTPayload, expiresIn = '15m'): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn } as any);
}

export function generateRefreshToken(payload: JWTPayload, expiresIn = '7d'): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET as string, { expiresIn } as any);
}

export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET as string) as JWTPayload;
  } catch (error) {
    return null;
  }
}

export function verifyRefreshToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET as string) as JWTPayload;
  } catch (error) {
    return null;
  }
}
