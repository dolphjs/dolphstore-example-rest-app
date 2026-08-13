import { DataSource } from 'typeorm';
import { seedSqliteDataSource } from '../../../tests/utils/sqlite-datasource';
import { Role } from '../../shared/enums';
import { Requester } from '../../shared/interfaces';
import { PropertyImage } from '../properties/property-image.entity';
import { ListingStatus, ListingType, PropertyType } from '../properties/property.enums';
import { Property } from '../properties/property.entity';
import { PropertyService } from '../properties/property.service';
import { User } from '../iam/user.entity';
import { UserService } from '../iam/user.service';
import { Review } from './review.entity';
import { ReviewService } from './review.service';
import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
    let dataSource: DataSource;
    let reviewsService: ReviewsService;
    let propertyService: PropertyService;
    let agent: Requester;
    let reviewer: Requester;
    let admin: Requester;
    let propertyId: string;

    beforeAll(async () => {
        dataSource = await seedSqliteDataSource([User, Property, PropertyImage, Review]);
        propertyService = new PropertyService();
        reviewsService = new ReviewsService(new ReviewService(), propertyService);

        const userService = new UserService();
        const agentUser = await userService.create({
            email: 'ro-agent@dolphstore.test',
            password: 'password123',
            firstName: 'Agent',
            lastName: 'Owner',
            phone: '+15550011111',
            role: Role.AGENT,
        });
        agent = { userId: agentUser.id, role: Role.AGENT };

        const reviewerUser = await userService.create({
            email: 'ro-reviewer@dolphstore.test',
            password: 'password123',
            firstName: 'Rev',
            lastName: 'Iewer',
            phone: '+15550022222',
        });
        reviewer = { userId: reviewerUser.id, role: Role.USER };

        const adminUser = await userService.create({
            email: 'ro-admin@dolphstore.test',
            password: 'password123',
            firstName: 'Admin',
            lastName: 'User',
            phone: '+15550033333',
        });
        admin = { userId: adminUser.id, role: Role.ADMIN };

        const property = await propertyService.create(agent.userId, {
            title: 'Reviewable property',
            description: 'desc',
            price: 1000,
            listingType: ListingType.SALE,
            propertyType: PropertyType.HOUSE,
            address: '1 Main St',
            city: 'Lagos',
            state: 'Lagos',
        });
        propertyId = property.id;
        await propertyService.update(propertyId, { status: ListingStatus.PUBLISHED });
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    it('rejects reviewing a non-published property', async () => {
        const draft = await propertyService.create(agent.userId, {
            title: 'Draft property',
            description: 'desc',
            price: 1000,
            listingType: ListingType.SALE,
            propertyType: PropertyType.HOUSE,
            address: '1 Main St',
            city: 'Lagos',
            state: 'Lagos',
        });

        await expect(reviewsService.create(draft.id, reviewer, { rating: 5, comment: 'x' })).rejects.toThrow(/not found/);
    });

    it('rejects an agent reviewing their own property', async () => {
        await expect(reviewsService.create(propertyId, agent, { rating: 5, comment: 'self review' })).rejects.toThrow(
            /cannot review your own property/,
        );
    });

    it('creates a review for a verified user', async () => {
        const review = await reviewsService.create(propertyId, reviewer, { rating: 4, comment: 'Nice place' });
        expect(review.rating).toBe(4);
    });

    it('rejects a second review from the same user on the same property', async () => {
        await expect(reviewsService.create(propertyId, reviewer, { rating: 2, comment: 'again' })).rejects.toThrow(
            /already reviewed/,
        );
    });

    it('the review author can update their own review', async () => {
        const review = await reviewsService.list(propertyId, { page: 1, limit: 20, order: 'DESC' });
        const mine = review.data.find((r) => r.userId === reviewer.userId)!;

        const updated = await reviewsService.update(mine.id, reviewer, { comment: 'Updated comment' });
        expect(updated.comment).toBe('Updated comment');
    });

    it('a different user cannot update someone else\'s review', async () => {
        const review = (await reviewsService.list(propertyId, { page: 1, limit: 20, order: 'DESC' })).data[0];
        await expect(reviewsService.update(review.id, agent, { comment: 'hijack' })).rejects.toThrow(/do not own/);
    });

    it('an admin can remove any review', async () => {
        const review = (await reviewsService.list(propertyId, { page: 1, limit: 20, order: 'DESC' })).data[0];
        await reviewsService.remove(review.id, admin);

        const afterRemoval = await reviewsService.list(propertyId, { page: 1, limit: 20, order: 'DESC' });
        expect(afterRemoval.data.find((r) => r.id === review.id)).toBeUndefined();
    });

    it('list rejects for a non-published property', async () => {
        const draft = await propertyService.create(agent.userId, {
            title: 'Another draft',
            description: 'desc',
            price: 1000,
            listingType: ListingType.SALE,
            propertyType: PropertyType.HOUSE,
            address: '1 Main St',
            city: 'Lagos',
            state: 'Lagos',
        });
        await expect(reviewsService.list(draft.id, { page: 1, limit: 20, order: 'DESC' })).rejects.toThrow(/not found/);
    });
});
