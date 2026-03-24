import request from 'supertest';
import app from '../app';
import { config } from '../config/env';

describe('App bootstrap', () => {
  test('app module exports an Express application', () => {
    expect(app).toBeDefined();
    expect(typeof app).toBe('function');
  });

  test('OPTIONS preflight returns CORS headers for allowed origin', async () => {
    const origin = config.frontendUrl;
    const res = await request(app)
      .options('/api/v1/auth/register')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type');
    expect([200, 204]).toContain(res.status);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  test('GET /api/openapi.yaml returns YAML spec', async () => {
    const res = await request(app).get('/api/openapi.yaml');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/yaml/);
    expect(res.text).toMatch(/^openapi:\s*3\./m);
    expect(res.text).toContain('Pouraccord API');
  });

  test('GET /api/docs redirects to Swagger UI', async () => {
    const res = await request(app).get('/api/docs').redirects(0);
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe('/api/docs/');
  });

  test('GET /api/docs/ serves Swagger UI HTML', async () => {
    const res = await request(app).get('/api/docs/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    expect(res.text).toMatch(/swagger|Swagger UI/i);
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
