import { DService, getDataSource, logger } from '@dolphjs/dolph';
import { QueryFailedError } from 'typeorm';
import { ImageStorageService } from '../../shared/storage';
import { PropertyImage } from './property-image.entity';

const MAX_POSITION_ATTEMPTS = 5;
const UNIQUE_VIOLATION_CODES = ['23505', 'SQLITE_CONSTRAINT_UNIQUE'];

const isUniqueViolation = (error: unknown) =>
    error instanceof QueryFailedError &&
    UNIQUE_VIOLATION_CODES.includes((error.driverError as { code?: string }).code ?? '');

@DService()
export class PropertyImageService {
    constructor(private imageStorageService: ImageStorageService) {}

    private get repo() {
        return getDataSource().getRepository(PropertyImage);
    }

    // Taking the next position and saving aren't atomic, so two uploads to one
    // property can pick the same one. The unique constraint makes the loser retry.
    private async saveAtNextPosition(propertyId: string, url: string, publicId: string): Promise<PropertyImage> {
        for (let attempt = 1; ; attempt += 1) {
            const highest = await this.repo.maximum('position', { propertyId });
            const image = this.repo.create({ propertyId, url, publicId, position: (highest ?? -1) + 1 });

            try {
                return await this.repo.save(image);
            } catch (error) {
                if (attempt === MAX_POSITION_ATTEMPTS || !isUniqueViolation(error)) throw error;
            }
        }
    }

    async upload(propertyId: string, buffer: Buffer): Promise<PropertyImage> {
        const { url, publicId } = await this.imageStorageService.upload(buffer, `dolphstore/properties/${propertyId}`);

        try {
            return await this.saveAtNextPosition(propertyId, url, publicId);
        } catch (error) {
            // Nothing references the stored image if the row was never saved.
            await this.imageStorageService.remove(publicId).catch((removeError: Error) => {
                logger.error(`Could not remove orphaned image ${publicId}: ${removeError.message}`);
            });

            throw error;
        }
    }

    async findById(id: string): Promise<PropertyImage | null> {
        return this.repo.findOne({ where: { id } });
    }

    async remove(imageId: string): Promise<void> {
        const image = await this.repo.findOne({ where: { id: imageId } });
        if (!image) return;

        // In this order, a failure leaves a stray stored file rather than a row whose image is gone.
        await this.repo.delete({ id: imageId });
        await this.imageStorageService.remove(image.publicId);
    }
}
