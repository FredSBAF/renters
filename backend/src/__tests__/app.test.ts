import request from 'supertest';
import app from '../app';

describe('App bootstrap', () => {
  test('app module exports an Express application', () => {
    expect(app).toBeDefined();
    expect(typeof app).toBe('function');
  });

  test('GET / should return standard API format', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('errors');
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.message).toBe('Pouraccord API');
  });

  describe('GET /health', () => {
    test('returns 200 with health status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('status', 'ok');
      expect(res.body.data).toHaveProperty('timestamp');
      expect(res.body.data).toHaveProperty('uptime');
      expect(typeof res.body.data.uptime).toBe('number');
      expect(res.body.data.uptime).toBeGreaterThanOrEqual(0);
      expect(new Date(res.body.data.timestamp).getTime()).not.toBeNaN();
      expect(res.body).toHaveProperty('errors');
      expect(Array.isArray(res.body.errors)).toBe(true);
    });

    test('does not expose stack trace or sensitive data', async () => {
      const res = await request(app).get('/health');
      expect(res.body).not.toHaveProperty('stack');
      expect(JSON.stringify(res.body)).not.toMatch(/password|secret|key|token/i);
    });
  });
});
