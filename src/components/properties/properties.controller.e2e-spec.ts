import { createTestingApp, TestingApp } from '@dolphjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { seedSqliteDataSource } from '../../../tests/utils/sqlite-datasource';
import { EmailService } from '../../shared/email';
import { ImageStorageService } from '../../shared/storage';
import { EmailVerificationCode } from '../iam/email-verification-code.entity';
import { RefreshToken } from '../iam/refresh-token.entity';
import { User } from '../iam/user.entity';
import { PropertyImage } from './property-image.entity';
import { Property } from './property.entity';

describe('PropertiesController (e2e)', () => {
    let app: TestingApp;
    let dataSource: DataSource;
    let mockEmailService: { sendTemplate: jest.Mock; send: jest.Mock };
    let mockImageStorage: { upload: jest.Mock; remove: jest.Mock };
    let counter = 0;

    beforeAll(async () => {
        mockEmailService = {
            sendTemplate: jest.fn().mockResolvedValue({ id: 'em_mock', status: 'queued' }),
            send: jest.fn().mockResolvedValue({ id: 'em_mock', status: 'queued' }),
        };
        mockImageStorage = {
            upload: jest.fn().mockResolvedValue({ url: 'https://cdn.example.com/mock.png', publicId: 'mock-public-id' }),
            remove: jest.fn().mockResolvedValue(undefined),
        };

        app = await createTestingApp({
            // Lazy loaders — see the note in iam.controller.e2e-spec.ts on why an
            // eager `import` here would resolve real, unmocked services before
            // `overrides` gets a chance to seed the registry.
            components: [
                () => import('../iam/iam.component').then((m) => m.IamComponent),
                () => import('./properties.component').then((m) => m.PropertiesComponent),
            ],
            overrides: [
                { service: EmailService, useValue: mockEmailService as unknown as EmailService },
                { service: ImageStorageService, useValue: mockImageStorage as unknown as ImageStorageService },
            ],
        });

        dataSource = await seedSqliteDataSource([User, RefreshToken, EmailVerificationCode, Property, PropertyImage]);
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
        const email = `e2e-props-${counter}@dolphstore.test`;

        await request(app.engine)
            .post('/v1/auth/register')
            .send({ email, password: 'password123', firstName: 'Prop', lastName: 'User', phone: '+15550009999', role });

        const code = lastSentCode();
        const verified = await request(app.engine).post('/v1/auth/verify-email').send({ email, code });

        return { accessToken: verified.body.data.accessToken as string, userId: verified.body.data.user.id as string };
    }

    const propertyPayload = {
        title: 'Nice flat',
        description: 'A nice flat',
        price: 45000,
        listingType: 'rent',
        propertyType: 'apartment',
        address: '1 Main St',
        city: 'Lagos',
        state: 'Lagos',
    };

    it('rejects creating a property without a token', async () => {
        const res = await request(app.engine).post('/v1/properties').send(propertyPayload);
        expect(res.status).toBe(401);
    });

    it('rejects creating a property as a plain (non-agent) user', async () => {
        const plainUser = await registerVerifiedUser('user');

        const res = await request(app.engine)
            .post('/v1/properties')
            .set('Authorization', `Bearer ${plainUser.accessToken}`)
            .send(propertyPayload);

        expect(res.status).toBe(403);
    });

    it('agent creates a draft property, invisible from the public list/detail routes', async () => {
        const agent = await registerVerifiedUser('agent');

        const created = await request(app.engine)
            .post('/v1/properties')
            .set('Authorization', `Bearer ${agent.accessToken}`)
            .send(propertyPayload);

        expect(created.status).toBe(200);
        expect(created.body.data.status).toBe('draft');

        const publicDetail = await request(app.engine).get(`/v1/properties/${created.body.data.id}`);
        expect(publicDetail.status).toBe(404);

        const mine = await request(app.engine).get('/v1/properties/mine').set('Authorization', `Bearer ${agent.accessToken}`);
        expect(mine.body.data.data.map((p: any) => p.id)).toContain(created.body.data.id);
    });

    it('publishing a property makes it visible on the public routes', async () => {
        const agent = await registerVerifiedUser('agent');
        const created = await request(app.engine)
            .post('/v1/properties')
            .set('Authorization', `Bearer ${agent.accessToken}`)
            .send({ ...propertyPayload, city: 'PublishTest' });

        await request(app.engine)
            .patch(`/v1/properties/${created.body.data.id}`)
            .set('Authorization', `Bearer ${agent.accessToken}`)
            .send({ status: 'published' });

        const detail = await request(app.engine).get(`/v1/properties/${created.body.data.id}`);
        expect(detail.status).toBe(200);
        expect(detail.body.data.status).toBe('published');

        const list = await request(app.engine).get('/v1/properties').query({ city: 'PublishTest' });
        expect(list.body.data.data.map((p: any) => p.id)).toContain(created.body.data.id);
    });

    it('a different agent cannot update or delete someone else\'s property', async () => {
        const owner = await registerVerifiedUser('agent');
        const intruder = await registerVerifiedUser('agent');

        const created = await request(app.engine)
            .post('/v1/properties')
            .set('Authorization', `Bearer ${owner.accessToken}`)
            .send(propertyPayload);

        const updateAttempt = await request(app.engine)
            .patch(`/v1/properties/${created.body.data.id}`)
            .set('Authorization', `Bearer ${intruder.accessToken}`)
            .send({ title: 'Hijacked' });
        expect(updateAttempt.status).toBe(403);

        const deleteAttempt = await request(app.engine)
            .delete(`/v1/properties/${created.body.data.id}`)
            .set('Authorization', `Bearer ${intruder.accessToken}`);
        expect(deleteAttempt.status).toBe(403);
    });

    it('uploads and removes a property image through the mocked storage provider', async () => {
        const agent = await registerVerifiedUser('agent');
        const created = await request(app.engine)
            .post('/v1/properties')
            .set('Authorization', `Bearer ${agent.accessToken}`)
            .send(propertyPayload);

        const uploadRes = await request(app.engine)
            .post(`/v1/properties/${created.body.data.id}/images`)
            .set('Authorization', `Bearer ${agent.accessToken}`)
            .attach('image', Buffer.from('fake-png-bytes'), 'photo.png');

        expect(uploadRes.status).toBe(200);
        expect(uploadRes.body.data.url).toBe('https://cdn.example.com/mock.png');
        expect(mockImageStorage.upload).toHaveBeenCalled();

        const imageId = uploadRes.body.data.id;

        const removeRes = await request(app.engine)
            .delete(`/v1/properties/${created.body.data.id}/images/${imageId}`)
            .set('Authorization', `Bearer ${agent.accessToken}`);

        expect(removeRes.status).toBe(200);
        expect(mockImageStorage.remove).toHaveBeenCalledWith('mock-public-id');
    });

    it('deleting a property removes it from the public list', async () => {
        const agent = await registerVerifiedUser('agent');
        const created = await request(app.engine)
            .post('/v1/properties')
            .set('Authorization', `Bearer ${agent.accessToken}`)
            .send({ ...propertyPayload, city: 'DeleteTest' });

        await request(app.engine)
            .patch(`/v1/properties/${created.body.data.id}`)
            .set('Authorization', `Bearer ${agent.accessToken}`)
            .send({ status: 'published' });

        const deleteRes = await request(app.engine)
            .delete(`/v1/properties/${created.body.data.id}`)
            .set('Authorization', `Bearer ${agent.accessToken}`);
        expect(deleteRes.status).toBe(200);

        const detail = await request(app.engine).get(`/v1/properties/${created.body.data.id}`);
        expect(detail.status).toBe(404);
    });
});
