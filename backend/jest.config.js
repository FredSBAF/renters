module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFiles: ['<rootDir>/src/__tests__/env-setup.js'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  globalTeardown: '<rootDir>/src/__tests__/teardown.ts',
  testTimeout: 30000,
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
    '!src/__tests__/**',
    '!src/routes/index.ts'  // placeholder, no logic yet
  ],
  coverageThreshold: {
    global: { lines: 80, functions: 80, branches: 70, statements: 80 }
  }
};
