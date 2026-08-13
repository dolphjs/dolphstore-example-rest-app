import { DataSource } from 'typeorm';
import { seedSqliteDataSource } from '../../../tests/utils/sqlite-datasource';
import { User } from '../iam/user.entity';
import { UserService } from '../iam/user.service';
import { PropertyImage } from './property-image.entity';
import { SearchPropertiesDto } from './property.dto';
import { ListingStatus, ListingType, PropertyType } from './property.enums';
import { Property } from './property.entity';
import { PropertyService } from './property.service';

describe('PropertyService', () => {
    let dataSource: DataSource;
    let propertyService: PropertyService;
    let agentId: string;
    let otherAgentId: string;

    function query(overrides: Partial<SearchPropertiesDto> = {}): SearchPropertiesDto {
        return { page: 1, limit: 20, order: 'DESC', ...overrides };
    }

    beforeAll(async () => {
        dataSource = await seedSqliteDataSource([User, Property, PropertyImage]);
        propertyService = new PropertyService();

        const userService = new UserService();
        const agent = await userService.create({
            email: 'agent1@dolphstore.test',
            password: 'password123',
            firstName: 'Agent',
            lastName: 'One',
            phone: '+15550001111',
        });
        agentId = agent.id;

        const otherAgent = await userService.create({
            email: 'agent2@dolphstore.test',
            password: 'password123',
            firstName: 'Agent',
            lastName: 'Two',
            phone: '+15550002222',
        });
        otherAgentId = otherAgent.id;
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    const baseDto = {
        title: 'Nice flat',
        description: 'A nice flat',
        price: 45000,
        listingType: ListingType.RENT,
        propertyType: PropertyType.APARTMENT,
        address: '1 Main St',
        city: 'Lagos',
        state: 'Lagos',
    };

    it('creates a property as DRAFT', async () => {
        const property = await propertyService.create(agentId, baseDto);
        expect(property.status).toBe(ListingStatus.DRAFT);
        expect(property.agentId).toBe(agentId);
    });

    it('findById loads the images relation', async () => {
        const property = await propertyService.create(agentId, baseDto);
        const found = await propertyService.findById(property.id);
        expect(found?.images).toEqual([]);
    });

    it('search excludes drafts when onlyPublished is true', async () => {
        const draft = await propertyService.create(agentId, { ...baseDto, city: 'Abuja-Test' });
        const result = await propertyService.search(query({ city: 'Abuja-Test' }), { onlyPublished: true });
        expect(result.data.find((p) => p.id === draft.id)).toBeUndefined();
    });

    it('search includes published listings and filters by city (case-insensitive)', async () => {
        const published = await propertyService.create(agentId, { ...baseDto, city: 'Ibadan-Test' });
        await propertyService.update(published.id, { status: ListingStatus.PUBLISHED });

        const result = await propertyService.search(query({ city: 'ibadan-test' }), { onlyPublished: true });
        expect(result.data.map((p) => p.id)).toContain(published.id);
    });

    it('search filters by price range', async () => {
        const cheap = await propertyService.create(agentId, { ...baseDto, city: 'PriceTest', price: 1000 });
        const expensive = await propertyService.create(agentId, { ...baseDto, city: 'PriceTest', price: 900000 });
        await propertyService.update(cheap.id, { status: ListingStatus.PUBLISHED });
        await propertyService.update(expensive.id, { status: ListingStatus.PUBLISHED });

        const result = await propertyService.search(query({ city: 'PriceTest', minPrice: 500, maxPrice: 5000 }), {
            onlyPublished: true,
        });

        const ids = result.data.map((p) => p.id);
        expect(ids).toContain(cheap.id);
        expect(ids).not.toContain(expensive.id);
    });

    it('search filters by agentId (for "mine")', async () => {
        const mine = await propertyService.create(agentId, { ...baseDto, city: 'AgentFilterTest' });
        await propertyService.create(otherAgentId, { ...baseDto, city: 'AgentFilterTest' });

        const result = await propertyService.search(query({ city: 'AgentFilterTest' }), {
            onlyPublished: false,
            agentId,
        });

        expect(result.data.every((p) => p.agentId === agentId)).toBe(true);
        expect(result.data.map((p) => p.id)).toContain(mine.id);
    });

    it('update applies a partial change', async () => {
        const property = await propertyService.create(agentId, baseDto);
        const updated = await propertyService.update(property.id, { title: 'Updated title', bedrooms: 3 });
        expect(updated.title).toBe('Updated title');
        expect(updated.bedrooms).toBe(3);
        expect(updated.description).toBe(baseDto.description);
    });

    it('softDelete removes the property from default lookups', async () => {
        const property = await propertyService.create(agentId, baseDto);
        await propertyService.softDelete(property.id);

        const found = await propertyService.findById(property.id);
        expect(found).toBeNull();
    });
});
