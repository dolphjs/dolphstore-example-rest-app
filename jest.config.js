module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Jest's default testMatch does not pick up `*.e2e-spec.ts` (no dot
  // before "spec") — list it explicitly alongside the usual `*.spec.ts`.
  testMatch: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/app/', '/dist/'],
};
