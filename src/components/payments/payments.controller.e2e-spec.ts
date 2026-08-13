import { createTestingApp, TestingApp } from '@dolphjs/testing';
import { createHmac } from 'crypto';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { seedSqliteDataSource } from '../../../tests/utils/sqlite-datasource';
import { EmailService } from '../../shared/email';
import { PaymentGatewayService } from '../../shared/payment-gateway';
import { Role } from '../../shared/enums';
import { EmailVerificationCode } from '../iam/email-verification-code.entity';
import { RefreshToken } from '../iam/refresh-token.entity';
import { TokenService } from '../iam/token.service';
import { User } from '../iam/user.entity';
import { UserService } from '../iam/user.service';
import { PropertyImage } from '../properties/property-image.entity';
import { Property } from '../properties/property.entity';
import { PropertyService } from '../properties/property.service';
import { Review } from '../reviews/review.entity';
import { Payment } from './payment.entity';
import { PaymentService } from './payment.service';

describe('PaymentsController (e2e)', () => {
    let app: TestingApp;
    let dataSource: DataSource;
    let mockEmailService: { sendTemplate: jest.Mock; send: jest.Mock };
    let mockGateway: { initialize: jest.Mock; verify: jest.Mock; refund: jest.Mock; verifyWebhookSignature: jest.Mock };
    let counter = 0;

    beforeAll(async () => {
        mockEmailService = {
            sendTemplate: jest.fn().mockResolvedValue({ id: 'em_mock', status: 'queued' }),
            send: jest.fn().mockResolvedValue({ id: 'em_mock', status: 'queued' }),
        };
        mockGateway = {
            initialize: jest.fn().mockResolvedValue({ checkoutUrl: 'https://checkout.paystack.com/mock', providerReference: 'mockref' }),
            verify: jest.fn(),
            refund: jest.fn().mockResolvedValue({ status: 'processed', providerRefundId: 'rfd_1' }),
            verifyWebhookSignature: jest.fn().mockReturnValue(true),
        };

        app = await createTestingApp({
            components: [
                () => import('../iam/iam.component').then((m) => m.IamComponent),
                () => import('../properties/properties.component').then((m) => m.PropertiesComponent),
                () => import('./payments.component').then((m) => m.PaymentsComponent),
            ],
            overrides: [
                { service: EmailService, useValue: mockEmailService as unknown as EmailService },
                { service: PaymentGatewayService, useValue: mockGateway as unknown as PaymentGatewayService },
            ],
        });

        dataSource = await seedSqliteDataSource([User, RefreshToken, EmailVerificationCode, Property, PropertyImage, Review, Payment]);
    });

    afterAll(async () => {
        await dataSource.destroy();
        await app.close();
    });

    function lastSentCode(): string {
        const call = mockEmailService.sendTemplate.mock.calls.at(-1);
        return call[1].code;
    }

    async function registerVerifiedUser(role?: 'agent' | 'user') {
        counter += 1;
        const email = `e2e-payments-${counter}@dolphstore.test`;

        await request(app.engine)
            .post('/v1/auth/register')
            .send({ email, password: 'password123', firstName: 'Pay', lastName: 'User', phone: '+15550029999', role });

        const code = lastSentCode();
        const verified = await request(app.engine).post('/v1/auth/verify-email').send({ email, code });

        return { accessToken: verified.body.data.accessToken as string, userId: verified.body.data.user.id as string };
    }

    async function createAdmin() {
        counter += 1;
        const userService = new UserService();
        const admin = await userService.create({
            email: `e2e-payments-admin-${counter}@dolphstore.test`,
            password: 'password123',
            firstName: 'Admin',
            lastName: 'User',
            phone: '+15550039999',
            role: Role.ADMIN,
        });
        await userService.markEmailVerified(admin.id);

        const tokenService = new TokenService();
        const verifiedAdmin = (await userService.findById(admin.id))!;
        return { accessToken: tokenService.signAccessToken(verifiedAdmin), userId: admin.id };
    }

    async function createPublishedProperty(agentToken: string) {
        const created = await request(app.engine)
            .post('/v1/properties')
            .set('Authorization', `Bearer ${agentToken}`)
            .send({
                title: 'Featurable property',
                description: 'desc',
                price: 45000,
                listingType: 'rent',
                propertyType: 'apartment',
                address: '1 Main St',
                city: 'Lagos',
                state: 'Lagos',
            });

        await request(app.engine)
            .patch(`/v1/properties/${created.body.data.id}`)
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ status: 'published' });

        return created.body.data.id as string;
    }

    it('rejects initiating a feature payment without a token', async () => {
        const agent = await registerVerifiedUser('agent');
        const propertyId = await createPublishedProperty(agent.accessToken);

        const res = await request(app.engine).post(`/v1/properties/${propertyId}/feature`).send({ durationDays: 7 });
        expect(res.status).toBe(401);
    });

    it('rejects a plain user (non-agent) initiating a feature payment', async () => {
        const agent = await registerVerifiedUser('agent');
        const propertyId = await createPublishedProperty(agent.accessToken);
        const otherUser = await registerVerifiedUser('user');

        const res = await request(app.engine)
            .post(`/v1/properties/${propertyId}/feature`)
            .set('Authorization', `Bearer ${otherUser.accessToken}`)
            .send({ durationDays: 7 });
        expect(res.status).toBe(403);
    });

    it('rejects an agent featuring a property they do not own', async () => {
        const agent = await registerVerifiedUser('agent');
        const propertyId = await createPublishedProperty(agent.accessToken);
        const intruder = await registerVerifiedUser('agent');

        const res = await request(app.engine)
            .post(`/v1/properties/${propertyId}/feature`)
            .set('Authorization', `Bearer ${intruder.accessToken}`)
            .send({ durationDays: 7 });
        expect(res.status).toBe(403);
    });

    it('initiates a feature payment and returns a checkout URL', async () => {
        const agent = await registerVerifiedUser('agent');
        const propertyId = await createPublishedProperty(agent.accessToken);

        const res = await request(app.engine)
            .post(`/v1/properties/${propertyId}/feature`)
            .set('Authorization', `Bearer ${agent.accessToken}`)
            .send({ durationDays: 7 });

        expect(res.status).toBe(200);
        expect(res.body.data.checkoutUrl).toBe('https://checkout.paystack.com/mock');
        expect(res.body.data.status).toBe('pending');
        expect(res.body.data.amount).toBe(350000);
    });

    it('a payment owner can fetch it by reference, another agent cannot', async () => {
        const agent = await registerVerifiedUser('agent');
        const propertyId = await createPublishedProperty(agent.accessToken);
        const intruder = await registerVerifiedUser('agent');

        const initiated = await request(app.engine)
            .post(`/v1/properties/${propertyId}/feature`)
            .set('Authorization', `Bearer ${agent.accessToken}`)
            .send({ durationDays: 3 });
        const reference = initiated.body.data.reference;

        const denied = await request(app.engine)
            .get(`/v1/payments/${reference}`)
            .set('Authorization', `Bearer ${intruder.accessToken}`);
        expect(denied.status).toBe(403);

        const allowed = await request(app.engine)
            .get(`/v1/payments/${reference}`)
            .set('Authorization', `Bearer ${agent.accessToken}`);
        expect(allowed.status).toBe(200);
        expect(allowed.body.data.reference).toBe(reference);
    });

    it('lists only the requesting agent\'s own payments', async () => {
        const agentA = await registerVerifiedUser('agent');
        const propertyA = await createPublishedProperty(agentA.accessToken);
        await request(app.engine)
            .post(`/v1/properties/${propertyA}/feature`)
            .set('Authorization', `Bearer ${agentA.accessToken}`)
            .send({ durationDays: 2 });

        const agentB = await registerVerifiedUser('agent');
        const propertyB = await createPublishedProperty(agentB.accessToken);
        await request(app.engine)
            .post(`/v1/properties/${propertyB}/feature`)
            .set('Authorization', `Bearer ${agentB.accessToken}`)
            .send({ durationDays: 2 });

        const mine = await request(app.engine).get('/v1/payments/mine').set('Authorization', `Bearer ${agentA.accessToken}`);
        expect(mine.status).toBe(200);
        expect(mine.body.data.data.length).toBeGreaterThanOrEqual(1);
        expect(mine.body.data.data.every((p: any) => p.propertyId === propertyA)).toBe(true);
    });

    // The webhook route needs `req.rawBody`, which depends on a framework fix
    // (capturing the raw bytes for byte-exact HMAC verification) that is
    // committed upstream in dolph but not yet published to the
    // `@dolphjs/dolph` version this app installs from npm — see the README's
    // Payments section. Until it's published, the controller safely 400s
    // rather than trusting a re-serialized body for signature verification.
    // The full success/idempotency/re-verify behavior of `handleWebhook`
    // itself IS covered end-to-end at the service layer in
    // payments.service.spec.ts, with a directly-supplied raw body.
    it('the webhook route 400s until req.rawBody is available (pending @dolphjs/dolph publish)', async () => {
        const agent = await registerVerifiedUser('agent');
        const propertyId = await createPublishedProperty(agent.accessToken);
        const initiated = await request(app.engine)
            .post(`/v1/properties/${propertyId}/feature`)
            .set('Authorization', `Bearer ${agent.accessToken}`)
            .send({ durationDays: 4 });
        const reference = initiated.body.data.reference;

        const payload = { event: 'charge.success', data: { reference } };
        const rawBody = Buffer.from(JSON.stringify(payload));
        const signature = createHmac('sha512', 'sk_test_dummy_key_for_tests').update(rawBody).digest('hex');

        const webhook = await request(app.engine)
            .post('/v1/payments/webhooks/paystack')
            .set('Content-Type', 'application/json')
            .set('x-paystack-signature', signature)
            .send(payload);

        expect(webhook.status).toBe(400);
        expect(webhook.body.message).toMatch(/raw request body/);
    });

    it('only an admin can refund a paid payment', async () => {
        const agent = await registerVerifiedUser('agent');
        const propertyId = await createPublishedProperty(agent.accessToken);

        const initiated = await request(app.engine)
            .post(`/v1/properties/${propertyId}/feature`)
            .set('Authorization', `Bearer ${agent.accessToken}`)
            .send({ durationDays: 6 });
        const paymentId = initiated.body.data.id;

        // Seed the PAID state directly at the service layer — the webhook
        // route can't be exercised over HTTP yet (see the test above), so
        // this mirrors what a successful webhook delivery would have done.
        const paymentService = new PaymentService();
        await paymentService.markPaid(paymentId, 'ps_e2e_refund_ref');
        await new PropertyService().markFeatured(propertyId, new Date(Date.now() + 6 * 24 * 60 * 60 * 1000));

        const deniedForAgent = await request(app.engine)
            .post(`/v1/payments/${paymentId}/refund`)
            .set('Authorization', `Bearer ${agent.accessToken}`)
            .send({ reason: 'not allowed' });
        expect(deniedForAgent.status).toBe(403);

        const admin = await createAdmin();
        const refunded = await request(app.engine)
            .post(`/v1/payments/${paymentId}/refund`)
            .set('Authorization', `Bearer ${admin.accessToken}`)
            .send({ reason: 'agent requested' });
        expect(refunded.status).toBe(200);
        expect(refunded.body.data.status).toBe('refunded');

        const property = await request(app.engine).get(`/v1/properties/${propertyId}`);
        expect(property.body.data.isFeatured).toBe(false);
    });
});
