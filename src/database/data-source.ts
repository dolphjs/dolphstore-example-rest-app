import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { env } from '../shared/configs';

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
