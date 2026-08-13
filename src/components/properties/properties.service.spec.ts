import { DataSource } from 'typeorm';
import { seedSqliteDataSource } from '../../../tests/utils/sqlite-datasource';
import { Role } from '../../shared/enums';
import { ImageStorageService } from '../../shared/storage';
import { User } from '../iam/user.entity';
import { UserService } from '../iam/user.service';
import { PropertyImage } from './property-image.entity';
import { PropertyImageService } from './property-image.service';
import { ListingStatus, ListingType, PropertyType } from './property.enums';
import { Property } from './property.entity';
import { PropertyService } from './property.service';
import { PropertiesService, Requester } from './properties.service';

describe('PropertiesService', () => {
    let dataSource: DataSource;
    let propertiesService: PropertiesService;
    let imageStorage: { upload: jest.Mock; remove: jest.Mock };
    let owner: Requester;
    let otherAgent: Requester;
    let admin: Requester;

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

    beforeAll(async () => {
        dataSource = await seedSqliteDataSource([User, Property, PropertyImage]);

        const userService = new UserService();
        const ownerUser = await userService.create({
            email: 'owner@dolphstore.test',
            password: 'password123',
            firstName: 'Owner',
            lastName: 'Agent',
            phone: '+15550004444',
            role: Role.AGENT,
        });
        owner = { userId: ownerUser.id, role: Role.AGENT };

        const otherUser = await userService.create({
            email: 'other@dolphstore.test',
            password: 'password123',
            firstName: 'Other',
            lastName: 'Agent',
            phone: '+15550005555',
            role: Role.AGENT,
        });
        otherAgent = { userId: otherUser.id, role: Role.AGENT };

        const adminUser = await userService.create({
            email: 'admin@dolphstore.test',
            password: 'password123',
            firstName: 'Admin',
            lastName: 'User',
            phone: '+15550006666',
        });
        admin = { userId: adminUser.id, role: Role.ADMIN };
    });

    beforeEach(() => {
        imageStorage = {
            upload: jest.fn().mockResolvedValue({ url: 'https://cdn.example.com/1.png', publicId: 'pub1' }),
            remove: jest.fn().mockResolvedValue(undefined),
        };
        propertiesService = new PropertiesService(
            new PropertyService(),
            new PropertyImageService(imageStorage as unknown as ImageStorageService),
        );
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    it('the owning agent can update their own property', async () => {
        const property = await propertiesService.create(owner.userId, baseDto);
        const updated = await propertiesService.update(property.id, owner, { title: 'New title' });
        expect(updated.title).toBe('New title');
    });

    it('a different agent cannot update someone else\'s property', async () => {
        const property = await propertiesService.create(owner.userId, baseDto);
        await expect(propertiesService.update(property.id, otherAgent, { title: 'Hijacked' })).rejects.toThrow(
            /do not own/,
        );
    });

    it('an admin can update any property', async () => {
        const property = await propertiesService.create(owner.userId, baseDto);
        const updated = await propertiesService.update(property.id, admin, { title: 'Admin edit' });
        expect(updated.title).toBe('Admin edit');
    });

    it('update throws NotFound for an unknown property', async () => {
        await expect(
            propertiesService.update('00000000-0000-0000-0000-000000000000', owner, { title: 'x' }),
        ).rejects.toThrow(/not found/);
    });

    it('findPublished throws for a draft property', async () => {
        const property = await propertiesService.create(owner.userId, baseDto);
        await expect(propertiesService.findPublished(property.id)).rejects.toThrow(/not found/);
    });

    it('findPublished returns a published property', async () => {
        const property = await propertiesService.create(owner.userId, baseDto);
        await propertiesService.update(property.id, owner, { status: ListingStatus.PUBLISHED });

        const found = await propertiesService.findPublished(property.id);
        expect(found.id).toBe(property.id);
    });

    it('addImage uploads via the storage provider for the owner, rejects for a non-owner', async () => {
        const property = await propertiesService.create(owner.userId, baseDto);

        const image = await propertiesService.addImage(property.id, owner, Buffer.from('bytes'));
        expect(image.url).toBe('https://cdn.example.com/1.png');

        await expect(propertiesService.addImage(property.id, otherAgent, Buffer.from('bytes'))).rejects.toThrow(/do not own/);
    });

    it('remove() removes the property and cascades image cleanup through the storage provider', async () => {
        const property = await propertiesService.create(owner.userId, baseDto);
        await propertiesService.addImage(property.id, owner, Buffer.from('bytes'));

        await propertiesService.remove(property.id, owner);

        expect(imageStorage.remove).toHaveBeenCalled();
        await expect(propertiesService.update(property.id, owner, { title: 'x' })).rejects.toThrow(/not found/);
    });

    it('removeImage rejects for a non-owner and throws NotFound for an image belonging to a different property', async () => {
        const propertyA = await propertiesService.create(owner.userId, baseDto);
        const propertyB = await propertiesService.create(owner.userId, baseDto);
        const imageOnA = await propertiesService.addImage(propertyA.id, owner, Buffer.from('bytes'));

        await expect(propertiesService.removeImage(propertyA.id, imageOnA.id, otherAgent)).rejects.toThrow(/do not own/);
        await expect(propertiesService.removeImage(propertyB.id, imageOnA.id, owner)).rejects.toThrow(/image not found/);
    });

    it('findMine only returns the requester\'s properties, including drafts', async () => {
        await propertiesService.create(owner.userId, { ...baseDto, city: 'MineTest' });
        await propertiesService.create(otherAgent.userId, { ...baseDto, city: 'MineTest' });

        const result = await propertiesService.findMine(owner, { page: 1, limit: 20, order: 'DESC', city: 'MineTest' });
        expect(result.data.every((p) => p.agentId === owner.userId)).toBe(true);
    });
});
