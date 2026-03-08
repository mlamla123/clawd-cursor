import { randomBytes } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { Request, Response, NextFunction } from 'express';

const TOKEN_FILE = '.clawd-auth-token';

export function getTokenPath(): string {
  return path.join(process.cwd(), TOKEN_FILE);
}

export function generateAuthToken(): string {
  const tokenPath = getTokenPath();
  if (fs.existsSync(tokenPath)) {
    const existing = fs.readFileSync(tokenPath, 'utf-8').trim();
    if (existing.length >= 32) return existing;
  }
  const token = randomBytes(32).toString('hex');
  fs.writeFileSync(tokenPath, token, { mode: 0o600 });
  return token;
}

export function authMiddleware(token: string, exemptPaths: string[] = ['/health']) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (exemptPaths.includes(req.path)) return next();
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ') || auth.slice(7) !== token) {
      return res.status(401).json({ error: 'Unauthorized', hint: 'Include Authorization: Bearer <token> header' });
    }
    next();
  };
}
