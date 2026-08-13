import { createTestingApp, TestingApp } from '@dolphjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { seedSqliteDataSource } from '../../../tests/utils/sqlite-datasource';
import { IamComponent } from './iam.component';
import { RefreshToken } from './refresh-token.entity';
import { User } from './user.entity';

describe('IamController (e2e)', () => {
    let app: TestingApp;
    let dataSource: DataSource;

    const credentials = {
        email: 'e2e@dolphstore.test',
        password: 'password123',
        firstName: 'E2e',
        lastName: 'Test',
        phone: '+15550000003',
    };

    beforeAll(async () => {
        app = await createTestingApp({ components: [IamComponent] });
        // Constructing DolphFactory above ran autoInitTypeOrm against
        // dolph_config.yaml's (real Postgres) config — seeding here
        // afterwards replaces the global DataSource with sqlite before any
        // request/repository access happens.
        dataSource = await seedSqliteDataSource([User, RefreshToken]);
    });

    afterAll(async () => {
        await dataSource.destroy();
        await app.close();
    });

    it('rejects registration with an invalid DTO', async () => {
        const res = await request(app.engine).post('/v1/auth/register').send({ email: 'not-an-email', password: 'short' });

        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'email' })]));
    });

    it('registers, then rejects a duplicate email with 409', async () => {
        const res = await request(app.engine).post('/v1/auth/register').send(credentials);

        expect(res.status).toBe(200);
        expect(res.body.data.user.email).toBe(credentials.email);
        expect(res.body.data.user.password).toBeUndefined();
        expect(res.body.data.accessToken).toBeDefined();
        expect(res.body.data.refreshToken).toBeDefined();

        const dupe = await request(app.engine).post('/v1/auth/register').send(credentials);
        expect(dupe.status).toBe(409);
    });

    it('rejects login with the wrong password', async () => {
        const res = await request(app.engine).post('/v1/auth/login').send({ email: credentials.email, password: 'wrong-password' });
        expect(res.status).toBe(401);
    });

    it('logs in and can reach the protected /me route with the access token', async () => {
        const login = await request(app.engine).post('/v1/auth/login').send({ email: credentials.email, password: credentials.password });
        expect(login.status).toBe(200);

        const accessToken = login.body.data.accessToken;

        const unauthed = await request(app.engine).get('/v1/auth/me');
        expect(unauthed.status).toBe(401);

        const me = await request(app.engine).get('/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);
        expect(me.status).toBe(200);
        expect(me.body.data.email).toBe(credentials.email);
    });

    it('rotates tokens on refresh and invalidates the old refresh token', async () => {
        const login = await request(app.engine).post('/v1/auth/login').send({ email: credentials.email, password: credentials.password });
        const oldRefreshToken = login.body.data.refreshToken;

        const refreshed = await request(app.engine).post('/v1/auth/refresh').send({ refreshToken: oldRefreshToken });
        expect(refreshed.status).toBe(200);
        expect(refreshed.body.data.refreshToken).not.toBe(oldRefreshToken);

        const reused = await request(app.engine).post('/v1/auth/refresh').send({ refreshToken: oldRefreshToken });
        expect(reused.status).toBe(401);
    });

    it('logout revokes the refresh token and requires a valid access token', async () => {
        const login = await request(app.engine).post('/v1/auth/login').send({ email: credentials.email, password: credentials.password });
        const { accessToken, refreshToken } = login.body.data;

        const unauthed = await request(app.engine).post('/v1/auth/logout').send({ refreshToken });
        expect(unauthed.status).toBe(401);

        const loggedOut = await request(app.engine)
            .post('/v1/auth/logout')
            .set('Authorization', `Bearer ${accessToken}`)
            .send({ refreshToken });
        expect(loggedOut.status).toBe(200);

        const reused = await request(app.engine).post('/v1/auth/refresh').send({ refreshToken });
        expect(reused.status).toBe(401);
    });
});
