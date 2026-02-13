import app from '../app';

describe('App bootstrap', () => {
  test('app module exports an Express application', () => {
    expect(app).toBeDefined();
    expect(typeof app).toBe('function');
  });
});
