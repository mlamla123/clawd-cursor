import type { Request, Response, NextFunction } from 'express';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  private windows: Map<string, number[]> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  middleware(bucket: string = 'default') {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = `${bucket}:${req.ip || 'unknown'}`;
      const now = Date.now();
      const windowStart = now - this.config.windowMs;

      let timestamps = this.windows.get(key) || [];
      timestamps = timestamps.filter(t => t > windowStart);

      if (timestamps.length >= this.config.maxRequests) {
        const retryAfter = Math.ceil((timestamps[0] + this.config.windowMs - now) / 1000);
        res.set('Retry-After', String(retryAfter));
        return res.status(429).json({ error: 'Rate limit exceeded', retryAfter });
      }

      timestamps.push(now);
      this.windows.set(key, timestamps);
      next();
    };
  }
}

export const taskLimiter = new RateLimiter({ maxRequests: 10, windowMs: 60000 });
export const generalLimiter = new RateLimiter({ maxRequests: 100, windowMs: 60000 });
