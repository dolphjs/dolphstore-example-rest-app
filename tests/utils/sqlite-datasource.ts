import { initTypeOrm } from '@dolphjs/dolph/packages/typeorm';

/**
 * Seeds the framework's global TypeORM singleton (the same one
 * `getDataSource()` returns everywhere in application code) with an
 * in-memory `better-sqlite3` DataSource, so services under test can be used
 * exactly as they run in production — no repository mocking.
 *
 * Entity columns must avoid Postgres-only types (`enum`, `timestamptz`) for
 * this to work; see the comments on AbstractEntity and User.role.
 */
export async function seedSqliteDataSource(entities: Function[]) {
    const dataSource = initTypeOrm({
        options: {
            type: 'better-sqlite3',
            database: ':memory:',
            dropSchema: true,
            entities,
            synchronize: true,
            logging: false,
        } as any,
    });

    await dataSource.initialize();
    return dataSource;
}
