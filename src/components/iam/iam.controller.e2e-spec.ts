import { createTestingApp, TestingApp } from '@dolphjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { seedSqliteDataSource } from '../../../tests/utils/sqlite-datasource';
import { EmailService } from '../../shared/email';
import { EmailVerificationCode } from './email-verification-code.entity';
import { RefreshToken } from './refresh-token.entity';
import { User } from './user.entity';

describe('IamController (e2e)', () => {
    let app: TestingApp;
    let dataSource: DataSource;
    let mockEmailService: { sendTemplate: jest.Mock; send: jest.Mock };

    const credentials = {
        email: 'e2e@dolphstore.test',
        password: 'password123',
        firstName: 'E2e',
        lastName: 'Test',
        phone: '+15550000003',
    };

    beforeAll(async () => {
        mockEmailService = {
            sendTemplate: jest.fn().mockResolvedValue({ id: 'em_mock', status: 'queued' }),
            send: jest.fn().mockResolvedValue({ id: 'em_mock', status: 'queued' }),
        };

        app = await createTestingApp({
            // A lazy loader, not an eagerly-imported class — @Component
            // resolves and constructs every listed service (including
            // EmailService) the moment its module is evaluated. An eager
            // `import { IamComponent } from './iam.component'` at the top
            // of this file would run that resolution before `overrides`
            // below ever gets a chance to seed the mock, so IamService
            // would end up with a real, unmocked EmailService instead.
            components: [() => import('./iam.component').then((m) => m.IamComponent)],
            overrides: [{ service: EmailService, useValue: mockEmailService as unknown as EmailService }],
        });
        // Constructing DolphFactory above ran autoInitTypeOrm against
        // dolph_config.yaml's (real Postgres) config — seeding here
        // afterwards replaces the global DataSource with sqlite before any
        // request/repository access happens.
        dataSource = await seedSqliteDataSource([User, RefreshToken, EmailVerificationCode]);
    });

    afterAll(async () => {
        await dataSource.destroy();
        await app.close();
    });

    function lastSentCode(): string {
        const call = mockEmailService.sendTemplate.mock.calls.at(-1);
        return call[1].code;
    }

    async function registerAndVerify() {
        await request(app.engine).post('/v1/auth/register').send(credentials);
        const code = lastSentCode();
        return request(app.engine).post('/v1/auth/verify-email').send({ email: credentials.email, code });
    }

    it('rejects registration with an invalid DTO', async () => {
        const res = await request(app.engine).post('/v1/auth/register').send({ email: 'not-an-email', password: 'short' });

        expect(res.status).toBe(400);
        expect(res.body.errors).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'email' })]));
    });

    it('registers without issuing tokens, sends a verification code, then rejects a duplicate email with 409', async () => {
        const res = await request(app.engine).post('/v1/auth/register').send(credentials);

        expect(res.status).toBe(200);
        expect(res.body.data.user.email).toBe(credentials.email);
        expect(res.body.data.user.password).toBeUndefined();
        expect(res.body.data.accessToken).toBeUndefined();
        expect(mockEmailService.sendTemplate).toHaveBeenCalledWith(
            'verify-email',
            { firstName: credentials.firstName, code: expect.stringMatching(/^\d{6}$/) },
            { to: credentials.email, subject: 'Verify your email' },
        );

        const dupe = await request(app.engine).post('/v1/auth/register').send(credentials);
        expect(dupe.status).toBe(409);
    });

    it('rejects login before the email is verified', async () => {
        const res = await request(app.engine).post('/v1/auth/login').send({ email: credentials.email, password: credentials.password });
        expect(res.status).toBe(403);
    });

    it('rejects verify-email with an incorrect code', async () => {
        const res = await request(app.engine).post('/v1/auth/verify-email').send({ email: credentials.email, code: '000000' });
        expect(res.status).toBe(401);
    });

    it('verifies the email with the correct code and returns tokens', async () => {
        const res = await registerAndVerify();

        expect(res.status).toBe(200);
        expect(res.body.data.user.email).toBe(credentials.email);
        expect(res.body.data.accessToken).toBeDefined();
        expect(res.body.data.refreshToken).toBeDefined();
    });

    it('rejects verify-email for an already-verified account', async () => {
        const res = await request(app.engine).post('/v1/auth/verify-email').send({ email: credentials.email, code: '000000' });
        expect(res.status).toBe(409);
    });

    it('resend-verification always returns 200 without leaking whether the account exists', async () => {
        const known = await request(app.engine).post('/v1/auth/resend-verification').send({ email: credentials.email });
        const unknown = await request(app.engine).post('/v1/auth/resend-verification').send({ email: 'nobody@dolphstore.test' });

        expect(known.status).toBe(200);
        expect(unknown.status).toBe(200);
        expect(known.body.data.message).toBe(unknown.body.data.message);
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
