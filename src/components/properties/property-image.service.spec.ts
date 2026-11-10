import { DataSource } from 'typeorm';
import { seedSqliteDataSource } from '../../../tests/utils/sqlite-datasource';
import { ImageStorageService } from '../../shared/storage';
import { User } from '../iam/user.entity';
import { UserService } from '../iam/user.service';
import { PropertyImage } from './property-image.entity';
import { PropertyImageService } from './property-image.service';
import { ListingType, PropertyType } from './property.enums';
import { Property } from './property.entity';
import { PropertyService } from './property.service';

describe('PropertyImageService', () => {
    let dataSource: DataSource;
    let propertyImageService: PropertyImageService;
    let imageStorage: { upload: jest.Mock; remove: jest.Mock };
    let propertyId: string;

    beforeAll(async () => {
        dataSource = await seedSqliteDataSource([User, Property, PropertyImage]);

        const userService = new UserService();
        const agent = await userService.create({
            email: 'image-agent@dolphstore.test',
            password: 'password123',
            firstName: 'Img',
            lastName: 'Agent',
            phone: '+15550003333',
        });

        const property = await new PropertyService().create(agent.id, {
            title: 'Image test property',
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

    beforeEach(() => {
        imageStorage = {
            upload: jest.fn().mockResolvedValue({ url: 'https://cdn.example.com/1.png', publicId: 'dolphstore/properties/pub1' }),
            remove: jest.fn().mockResolvedValue(undefined),
        };
        propertyImageService = new PropertyImageService(imageStorage as unknown as ImageStorageService);
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    it('uploads via the storage provider and persists the resulting url/publicId', async () => {
        const image = await propertyImageService.upload(propertyId, Buffer.from('fake-image-bytes'));

        expect(imageStorage.upload).toHaveBeenCalledWith(expect.any(Buffer), `dolphstore/properties/${propertyId}`);
        expect(image.url).toBe('https://cdn.example.com/1.png');
        expect(image.publicId).toBe('dolphstore/properties/pub1');
        expect(image.position).toBe(0);
    });

    it('increments position for subsequent images on the same property', async () => {
        const second = await propertyImageService.upload(propertyId, Buffer.from('more-bytes'));
        expect(second.position).toBe(1);
    });

    it('gives concurrent uploads different positions', async () => {
        const images = await Promise.all(
            [1, 2, 3].map((index) => propertyImageService.upload(propertyId, Buffer.from(`bytes-${index}`))),
        );
        const positions = images.map((image) => image.position);

        expect(new Set(positions).size).toBe(3);
    });

    it('never reuses a position after an image is removed', async () => {
        const first = await propertyImageService.upload(propertyId, Buffer.from('first'));
        const second = await propertyImageService.upload(propertyId, Buffer.from('second'));

        await propertyImageService.remove(first.id);

        const third = await propertyImageService.upload(propertyId, Buffer.from('third'));

        expect(third.position).toBe(second.position + 1);
    });

    it('removes the stored image when the row cannot be saved', async () => {
        await expect(
            propertyImageService.upload('00000000-0000-0000-0000-000000000000', Buffer.from('orphan')),
        ).rejects.toThrow();

        expect(imageStorage.remove).toHaveBeenCalledWith('dolphstore/properties/pub1');
    });

    it('keeps the save error when removing the stored image also fails', async () => {
        imageStorage.remove.mockRejectedValue(new Error('provider is down'));

        await expect(
            propertyImageService.upload('00000000-0000-0000-0000-000000000000', Buffer.from('orphan')),
        ).rejects.not.toThrow('provider is down');
    });

    it('remove() deletes from storage and from the database', async () => {
        const image = await propertyImageService.upload(propertyId, Buffer.from('to-remove'));

        await propertyImageService.remove(image.id);

        expect(imageStorage.remove).toHaveBeenCalledWith(image.publicId);
        expect(await propertyImageService.findById(image.id)).toBeNull();
    });

    it('remove() is a no-op for an unknown image id', async () => {
        await expect(propertyImageService.remove('00000000-0000-0000-0000-000000000000')).resolves.toBeUndefined();
        expect(imageStorage.remove).not.toHaveBeenCalled();
    });
});
