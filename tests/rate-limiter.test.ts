import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { RateLimiter } from '../src/rate-limiter';

function createTestApp(limiter: RateLimiter, bucket?: string) {
  const app = express();
  app.use(express.json());
  app.get('/api', limiter.middleware(bucket), (_req, res) => res.json({ ok: true }));
  app.post('/api', limiter.middleware(bucket), (_req, res) => res.json({ ok: true }));
  return app;
}

describe('RateLimiter', () => {
  it('allows requests under the limit', async () => {
    const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60000 });
    const app = createTestApp(limiter);
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get('/api');
      expect(res.status).toBe(200);
    }
  });

  it('returns 429 when over the limit', async () => {
    const limiter = new RateLimiter({ maxRequests: 3, windowMs: 60000 });
    const app = createTestApp(limiter);
    for (let i = 0; i < 3; i++) {
      await request(app).get('/api');
    }
    const res = await request(app).get('/api');
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('Rate limit exceeded');
  });

  it('includes retryAfter in 429 response', async () => {
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 60000 });
    const app = createTestApp(limiter);
    await request(app).get('/api');
    const res = await request(app).get('/api');
    expect(res.status).toBe(429);
    expect(typeof res.body.retryAfter).toBe('number');
    expect(res.body.retryAfter).toBeGreaterThan(0);
  });

  it('sets Retry-After header on 429', async () => {
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 60000 });
    const app = createTestApp(limiter);
    await request(app).get('/api');
    const res = await request(app).get('/api');
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('uses separate buckets for different routes', async () => {
    const limiter = new RateLimiter({ maxRequests: 1, windowMs: 60000 });
    const app = express();
    app.use(express.json());
    app.get('/route-a', limiter.middleware('bucket-a'), (_req, res) => res.json({ ok: true }));
    app.get('/route-b', limiter.middleware('bucket-b'), (_req, res) => res.json({ ok: true }));

    // Exhaust bucket-a
    await request(app).get('/route-a');
    const resA = await request(app).get('/route-a');
    expect(resA.status).toBe(429);

    // bucket-b should still work
    const resB = await request(app).get('/route-b');
    expect(resB.status).toBe(200);
  });

  it('window slides — old requests expire', async () => {
    // Very short window: 50ms
    const limiter = new RateLimiter({ maxRequests: 2, windowMs: 50 });
    const app = createTestApp(limiter);

    // Use up the limit
    await request(app).get('/api');
    await request(app).get('/api');
    const blocked = await request(app).get('/api');
    expect(blocked.status).toBe(429);

    // Wait for window to expire
    await new Promise(r => setTimeout(r, 60));

    // Should be allowed again
    const allowed = await request(app).get('/api');
    expect(allowed.status).toBe(200);
  });

  it('taskLimiter and generalLimiter are exported singletons', async () => {
    const { taskLimiter, generalLimiter } = await import('../src/rate-limiter');
    expect(taskLimiter).toBeDefined();
    expect(generalLimiter).toBeDefined();
    expect(typeof taskLimiter.middleware).toBe('function');
    expect(typeof generalLimiter.middleware).toBe('function');
  });
});
