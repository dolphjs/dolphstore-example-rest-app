module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Jest's default testMatch does not pick up `*.e2e-spec.ts` (no dot
  // before "spec") — list it explicitly alongside the usual `*.spec.ts`.
  testMatch: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/app/', '/dist/'],
  // Runs before the test framework loads — sets dummy env vars so tests
  // never depend on a developer's real .env (see tests/setup/env.setup.ts).
  setupFiles: ['<rootDir>/tests/setup/env.setup.ts'],
};
