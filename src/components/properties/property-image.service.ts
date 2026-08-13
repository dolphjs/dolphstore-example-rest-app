import { DolphServiceHandler } from '@dolphjs/dolph/classes';
import { Dolph } from '@dolphjs/dolph/common';
import { DService } from '@dolphjs/dolph/decorators';
import { getDataSource } from '@dolphjs/dolph/packages/typeorm';
import { ImageStorageService } from '../../shared/storage';
import { PropertyImage } from './property-image.entity';

@DService()
export class PropertyImageService extends DolphServiceHandler<Dolph> {
    constructor(private imageStorageService: ImageStorageService) {
        super('propertyImageService');
    }

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
