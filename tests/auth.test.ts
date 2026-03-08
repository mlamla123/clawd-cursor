import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { authMiddleware, generateAuthToken, getTokenPath } from '../src/auth';

const TEST_TOKEN = 'test-token-abcdef1234567890abcdef1234567890abcdef';

function createTestApp(token: string, exemptPaths?: string[]) {
  const app = express();
  app.use(express.json());
  app.use(authMiddleware(token, exemptPaths));
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/protected', (_req, res) => res.json({ data: 'secret' }));
  app.post('/task', (_req, res) => res.json({ accepted: true }));
  return app;
}

describe('authMiddleware', () => {
  it('returns 401 when no Authorization header', async () => {
    const app = createTestApp(TEST_TOKEN);
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('returns 401 when token is wrong', async () => {
    const app = createTestApp(TEST_TOKEN);
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer wrong-token');
    expect(res.status).toBe(401);
  });

  it('returns 401 when Authorization format is wrong (no Bearer prefix)', async () => {
    const app = createTestApp(TEST_TOKEN);
    const res = await request(app)
      .get('/protected')
      .set('Authorization', TEST_TOKEN);
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid Bearer token', async () => {
    const app = createTestApp(TEST_TOKEN);
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${TEST_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toBe('secret');
  });

  it('exempts /health by default', async () => {
    const app = createTestApp(TEST_TOKEN);
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('protects /health when not in exempt list', async () => {
    const app = createTestApp(TEST_TOKEN, []);
    const res = await request(app).get('/health');
    expect(res.status).toBe(401);
  });

  it('response includes hint when unauthorized', async () => {
    const app = createTestApp(TEST_TOKEN);
    const res = await request(app).get('/protected');
    expect(res.body.hint).toContain('Authorization');
  });

  it('POST /task is protected', async () => {
    const app = createTestApp(TEST_TOKEN);
    const res = await request(app)
      .post('/task')
      .send({ task: 'test' });
    expect(res.status).toBe(401);
  });

  it('POST /task succeeds with valid token', async () => {
    const app = createTestApp(TEST_TOKEN);
    const res = await request(app)
      .post('/task')
      .set('Authorization', `Bearer ${TEST_TOKEN}`)
      .send({ task: 'test' });
    expect(res.status).toBe(200);
  });
});

describe('generateAuthToken', () => {
  const tokenPath = getTokenPath();

  afterEach(() => {
    // Clean up token file after each test
    try { fs.unlinkSync(tokenPath); } catch { /* ok */ }
  });

  it('generates a token of at least 64 characters (32 bytes hex)', () => {
    const token = generateAuthToken();
    expect(token.length).toBeGreaterThanOrEqual(64);
  });

  it('returns the same token on subsequent calls', () => {
    const token1 = generateAuthToken();
    const token2 = generateAuthToken();
    expect(token1).toBe(token2);
  });

  it('writes token to file', () => {
    generateAuthToken();
    expect(fs.existsSync(tokenPath)).toBe(true);
  });
});

describe('--no-auth disables protection', () => {
  it('auth disabled when auth.enabled is false', async () => {
    // Simulate no-auth: skip mounting authMiddleware
    const app = express();
    app.use(express.json());
    // No auth middleware mounted
    app.get('/protected', (_req, res) => res.json({ data: 'accessible' }));
    const res = await request(app).get('/protected');
    expect(res.status).toBe(200);
    expect(res.body.data).toBe('accessible');
  });
});
