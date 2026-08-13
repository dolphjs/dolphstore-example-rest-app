import { createTestingApp, TestingApp } from '@dolphjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { seedSqliteDataSource } from '../../../tests/utils/sqlite-datasource';
import { EmailService } from '../../shared/email';
import { EmailVerificationCode } from '../iam/email-verification-code.entity';
import { RefreshToken } from '../iam/refresh-token.entity';
import { User } from '../iam/user.entity';
import { PropertyImage } from '../properties/property-image.entity';
import { Property } from '../properties/property.entity';
import { Review } from './review.entity';

describe('ReviewsController (e2e)', () => {
    let app: TestingApp;
    let dataSource: DataSource;
    let mockEmailService: { sendTemplate: jest.Mock; send: jest.Mock };
    let counter = 0;

    beforeAll(async () => {
        mockEmailService = {
            sendTemplate: jest.fn().mockResolvedValue({ id: 'em_mock', status: 'queued' }),
            send: jest.fn().mockResolvedValue({ id: 'em_mock', status: 'queued' }),
        };

        app = await createTestingApp({
            components: [
                () => import('../iam/iam.component').then((m) => m.IamComponent),
                () => import('../properties/properties.component').then((m) => m.PropertiesComponent),
                () => import('./reviews.component').then((m) => m.ReviewsComponent),
            ],
            overrides: [{ service: EmailService, useValue: mockEmailService as unknown as EmailService }],
        });

        dataSource = await seedSqliteDataSource([User, RefreshToken, EmailVerificationCode, Property, PropertyImage, Review]);
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
        const email = `e2e-reviews-${counter}@dolphstore.test`;

        await request(app.engine)
            .post('/v1/auth/register')
            .send({ email, password: 'password123', firstName: 'Rev', lastName: 'User', phone: '+15550019999', role });

        const code = lastSentCode();
        const verified = await request(app.engine).post('/v1/auth/verify-email').send({ email, code });

        return { accessToken: verified.body.data.accessToken as string, userId: verified.body.data.user.id as string };
    }

    async function createPublishedProperty(agentToken: string, city: string) {
        const created = await request(app.engine)
            .post('/v1/properties')
            .set('Authorization', `Bearer ${agentToken}`)
            .send({
                title: 'Reviewable property',
                description: 'desc',
                price: 45000,
                listingType: 'rent',
                propertyType: 'apartment',
                address: '1 Main St',
                city,
                state: 'Lagos',
            });

        await request(app.engine)
            .patch(`/v1/properties/${created.body.data.id}`)
            .set('Authorization', `Bearer ${agentToken}`)
            .send({ status: 'published' });

        return created.body.data.id as string;
    }

    it('rejects reviewing without a token', async () => {
        const agent = await registerVerifiedUser('agent');
        const propertyId = await createPublishedProperty(agent.accessToken, 'ReviewCity1');

        const res = await request(app.engine).post(`/v1/properties/${propertyId}/reviews`).send({ rating: 5, comment: 'Nice' });
        expect(res.status).toBe(401);
    });

    it('rejects an agent reviewing their own property', async () => {
        const agent = await registerVerifiedUser('agent');
        const propertyId = await createPublishedProperty(agent.accessToken, 'ReviewCity2');

        const res = await request(app.engine)
            .post(`/v1/properties/${propertyId}/reviews`)
            .set('Authorization', `Bearer ${agent.accessToken}`)
            .send({ rating: 5, comment: 'self' });

        expect(res.status).toBe(403);
    });

    it('creates a review, exposes it in the public list, and updates the property rating rollup', async () => {
        const agent = await registerVerifiedUser('agent');
        const reviewer = await registerVerifiedUser('user');
        const propertyId = await createPublishedProperty(agent.accessToken, 'ReviewCity3');

        const created = await request(app.engine)
            .post(`/v1/properties/${propertyId}/reviews`)
            .set('Authorization', `Bearer ${reviewer.accessToken}`)
            .send({ rating: 4, comment: 'Pretty good' });
        expect(created.status).toBe(200);

        const list = await request(app.engine).get(`/v1/properties/${propertyId}/reviews`);
        expect(list.body.data.data).toHaveLength(1);
        expect(list.body.data.data[0].comment).toBe('Pretty good');

        const detail = await request(app.engine).get(`/v1/properties/${propertyId}`);
        expect(detail.body.data.averageRating).toBe(4);
        expect(detail.body.data.reviewCount).toBe(1);
    });

    it('rejects a second review from the same user on the same property', async () => {
        const agent = await registerVerifiedUser('agent');
        const reviewer = await registerVerifiedUser('user');
        const propertyId = await createPublishedProperty(agent.accessToken, 'ReviewCity4');

        await request(app.engine)
            .post(`/v1/properties/${propertyId}/reviews`)
            .set('Authorization', `Bearer ${reviewer.accessToken}`)
            .send({ rating: 5, comment: 'first' });

        const second = await request(app.engine)
            .post(`/v1/properties/${propertyId}/reviews`)
            .set('Authorization', `Bearer ${reviewer.accessToken}`)
            .send({ rating: 1, comment: 'second' });

        expect(second.status).toBe(409);
    });

    it('the review author can update it, a different user cannot', async () => {
        const agent = await registerVerifiedUser('agent');
        const reviewer = await registerVerifiedUser('user');
        const intruder = await registerVerifiedUser('user');
        const propertyId = await createPublishedProperty(agent.accessToken, 'ReviewCity5');

        const created = await request(app.engine)
            .post(`/v1/properties/${propertyId}/reviews`)
            .set('Authorization', `Bearer ${reviewer.accessToken}`)
            .send({ rating: 3, comment: 'original' });
        const reviewId = created.body.data.id;

        const intruderAttempt = await request(app.engine)
            .patch(`/v1/reviews/${reviewId}`)
            .set('Authorization', `Bearer ${intruder.accessToken}`)
            .send({ comment: 'hijacked' });
        expect(intruderAttempt.status).toBe(403);

        const ownAttempt = await request(app.engine)
            .patch(`/v1/reviews/${reviewId}`)
            .set('Authorization', `Bearer ${reviewer.accessToken}`)
            .send({ comment: 'edited' });
        expect(ownAttempt.status).toBe(200);
        expect(ownAttempt.body.data.comment).toBe('edited');
    });

    it('the review author can delete it, removing it from the public list', async () => {
        const agent = await registerVerifiedUser('agent');
        const reviewer = await registerVerifiedUser('user');
        const propertyId = await createPublishedProperty(agent.accessToken, 'ReviewCity6');

        const created = await request(app.engine)
            .post(`/v1/properties/${propertyId}/reviews`)
            .set('Authorization', `Bearer ${reviewer.accessToken}`)
            .send({ rating: 2, comment: 'meh' });

        const del = await request(app.engine)
            .delete(`/v1/reviews/${created.body.data.id}`)
            .set('Authorization', `Bearer ${reviewer.accessToken}`);
        expect(del.status).toBe(200);

        const list = await request(app.engine).get(`/v1/properties/${propertyId}/reviews`);
        expect(list.body.data.data).toHaveLength(0);
    });
});
