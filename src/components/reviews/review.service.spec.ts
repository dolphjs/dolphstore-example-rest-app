import { DataSource } from 'typeorm';
import { seedSqliteDataSource } from '../../../tests/utils/sqlite-datasource';
import { PropertyImage } from '../properties/property-image.entity';
import { ListingType, PropertyType } from '../properties/property.enums';
import { Property } from '../properties/property.entity';
import { PropertyService } from '../properties/property.service';
import { User } from '../iam/user.entity';
import { UserService } from '../iam/user.service';
import { Review } from './review.entity';
import { ReviewService } from './review.service';

describe('ReviewService', () => {
    let dataSource: DataSource;
    let reviewService: ReviewService;
    let propertyId: string;
    let reviewerId: string;

    beforeAll(async () => {
        dataSource = await seedSqliteDataSource([User, Property, PropertyImage, Review]);
        reviewService = new ReviewService();

        const userService = new UserService();
        const agent = await userService.create({
            email: 'review-agent@dolphstore.test',
            password: 'password123',
            firstName: 'Agent',
            lastName: 'Owner',
            phone: '+15550007777',
        });
        const reviewer = await userService.create({
            email: 'reviewer@dolphstore.test',
            password: 'password123',
            firstName: 'Rev',
            lastName: 'Iewer',
            phone: '+15550008888',
        });
        reviewerId = reviewer.id;

        const property = await new PropertyService().create(agent.id, {
            title: 'Reviewed property',
            description: 'desc',
            price: 1000,
            listingType: ListingType.SALE,
            propertyType: PropertyType.HOUSE,
            address: '1 Main St',
            city: 'Lagos',
            state: 'Lagos',
        });
        propertyId = property.id;
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    it('creates a review', async () => {
        const review = await reviewService.create(propertyId, reviewerId, { rating: 5, comment: 'Great place!' });
        expect(review.rating).toBe(5);
        expect(review.propertyId).toBe(propertyId);
    });

    it('findByPropertyAndUser finds the created review', async () => {
        const found = await reviewService.findByPropertyAndUser(propertyId, reviewerId);
        expect(found?.comment).toBe('Great place!');
    });

    it('listForProperty paginates', async () => {
        const result = await reviewService.listForProperty(propertyId, { page: 1, limit: 20, order: 'DESC' });
        expect(result.total).toBe(1);
        expect(result.data[0].rating).toBe(5);
    });

    it('update applies a partial change', async () => {
        const existing = await reviewService.findByPropertyAndUser(propertyId, reviewerId);
        const updated = await reviewService.update(existing!.id, { rating: 3 });
        expect(updated.rating).toBe(3);
        expect(updated.comment).toBe('Great place!');
    });

    it('getAggregateForProperty computes average and count as numbers', async () => {
        const aggregate = await reviewService.getAggregateForProperty(propertyId);
        expect(aggregate.reviewCount).toBe(1);
        expect(aggregate.averageRating).toBe(3);
        expect(typeof aggregate.averageRating).toBe('number');
    });

    it('getAggregateForProperty returns zeroes for a property with no reviews', async () => {
        const aggregate = await reviewService.getAggregateForProperty('00000000-0000-0000-0000-000000000000');
        expect(aggregate).toEqual({ averageRating: 0, reviewCount: 0 });
    });

    it('softDelete removes the review from lookups', async () => {
        const existing = await reviewService.findByPropertyAndUser(propertyId, reviewerId);
        await reviewService.softDelete(existing!.id);

        expect(await reviewService.findById(existing!.id)).toBeNull();
    });
});
