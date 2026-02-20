import { logger } from '../../utils/logger';

describe('logger', () => {
  test('logger is defined and has level', () => {
    expect(logger).toBeDefined();
    expect(logger.level).toBeDefined();
  });

  test('logger uses debug level when NODE_ENV is not production', () => {
    expect(process.env.NODE_ENV).not.toBe('production');
    expect(logger.level).toBe('debug');
  });
});

describe('logger production level', () => {
  test('when NODE_ENV is production, logger level is info', () => {
    process.env.NODE_ENV = 'production';
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires -- need require for isolateModules
      const { logger: prodLogger } = require('../../utils/logger');
      expect(prodLogger.level).toBe('info');
    });
    process.env.NODE_ENV = 'test';
  });
});
