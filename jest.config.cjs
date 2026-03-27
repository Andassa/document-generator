/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.cjs'],
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts', '!src/**/pdf.worker.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  clearMocks: true,
  resetMocks: true,
  testTimeout: 30_000,
};
