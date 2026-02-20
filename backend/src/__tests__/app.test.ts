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
});
