import { DService, getDataSource } from '@dolphjs/dolph';
import { ImageStorageService } from '../../shared/storage';
import { PropertyImage } from './property-image.entity';

@DService()
export class PropertyImageService {
    constructor(private imageStorageService: ImageStorageService) {}

    private get repo() {
        return getDataSource().getRepository(PropertyImage);
    }

    async upload(propertyId: string, buffer: Buffer): Promise<PropertyImage> {
        const { url, publicId } = await this.imageStorageService.upload(buffer, `dolphstore/properties/${propertyId}`);
        const position = await this.repo.count({ where: { propertyId } });

        const image = this.repo.create({ propertyId, url, publicId, position });
        return this.repo.save(image);
    }

    async findById(id: string): Promise<PropertyImage | null> {
        return this.repo.findOne({ where: { id } });
    }

    async remove(imageId: string): Promise<void> {
        const image = await this.repo.findOne({ where: { id: imageId } });
        if (!image) return;

        await this.imageStorageService.remove(image.publicId);
        await this.repo.delete({ id: imageId });
    }
}
