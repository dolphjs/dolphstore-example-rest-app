import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from '../shared/configs';

/**
 * Separate from the runtime DataSource that `DolphFactory` auto-initializes
 * from `dolph_config.yaml` (see packages/typeorm in @dolphjs/dolph) — the
 * `typeorm` CLI (migration:generate/run/revert) needs its own DataSource
 * instance to introspect, since it runs outside of DolphFactory entirely.
 * Both point at the same database via the same validated env vars, so they
 * never drift out of sync.
 */
export const AppDataSource = new DataSource({
    type: 'postgres',
    host: env.database.host,
    port: env.database.port,
    username: env.database.username,
    password: env.database.password,
    database: env.database.name,
    synchronize: false,
    logging: !env.app.isProduction,
    entities: ['src/**/*.entity.ts'],
    migrations: ['src/database/migrations/*.ts'],
});
