// Runs before any test file (see jest.config.js `setupFiles`) so tests
// never depend on a developer's real, gitignored `.env` — deterministic,
// safe dummy values, none of which are used for a real connection since
// every test that touches TypeORM seeds its own in-memory sqlite DataSource
// (see tests/utils/sqlite-datasource.ts).
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_at_least_32_characters_long';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_at_least_32_characters_long';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.SQL_HOST = 'localhost';
process.env.SQL_USER = 'test';
process.env.SQL_PASSWORD = 'test';
process.env.SQL_DATABASE = 'test';
process.env.EMAIL_PROVIDER = 'sendbyte';
process.env.EMAIL_FROM = 'DolphStore <no-reply@dolphstore.test>';
process.env.SENDBYTE_API_KEY = 'sk_test_dummy_key_for_tests';
