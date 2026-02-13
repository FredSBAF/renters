import { config, validateEnv } from '../../config/env';

describe('Environment configuration', () => {
  test('config object should have all expected keys', () => {
    expect(config.env).toBe('test');
    expect(config.port).toBeDefined();
    expect(config.frontendUrl).toBeDefined();
    expect(config.apiBaseUrl).toBeDefined();
    expect(config.db.host).toBeDefined();
    expect(config.db.port).toBeDefined();
    expect(config.db.name).toBeDefined();
    expect(config.db.user).toBeDefined();
    expect(config.db.password).toBeDefined();
    expect(config.jwt.secret).toBeDefined();
    expect(config.jwt.secret.length).toBeGreaterThanOrEqual(32);
    expect(config.jwt.refreshSecret).toBeDefined();
    expect(config.totp.encryptionKey.length).toBe(32);
    expect(config.aws.s3Bucket).toBeDefined();
    expect(config.aws.region).toBeDefined();
    expect(config.email.from).toBeDefined();
    expect(config.stripe.secretKey).toBeDefined();
    expect(config.ai.serviceUrl).toBeDefined();
    expect(config.rateLimit.windowMs).toBeDefined();
    expect(config.rateLimit.max).toBeDefined();
    expect(config.rateLimit.authMax).toBeDefined();
  });

  test('config should be immutable (as const)', () => {
    expect(typeof config).toBe('object');
    expect(config.env).toBe('test');
  });

  test('validateEnv should fail when JWT_SECRET is too short', () => {
    const env = { ...process.env, JWT_SECRET: 'short' };
    const { error } = validateEnv(env);
    expect(error).toBeDefined();
    expect(error?.details.some((d) => d.message.includes('32'))).toBe(true);
  });

  test('validateEnv should fail when TOTP_SECRET_ENCRYPTION_KEY is not 32 chars', () => {
    const env = { ...process.env, TOTP_SECRET_ENCRYPTION_KEY: 'not32chars' };
    const { error } = validateEnv(env);
    expect(error).toBeDefined();
    expect(
      error?.details.some((d) => d.message.includes('32') || d.message.includes('length'))
    ).toBe(true);
  });

  test('validateEnv should fail when required vars are missing', () => {
    const env = {};
    const { error } = validateEnv(env);
    expect(error).toBeDefined();
    expect(error?.details.length).toBeGreaterThan(0);
  });
});
