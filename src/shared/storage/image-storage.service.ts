import { DolphServiceHandler } from '@dolphjs/dolph/classes';
import { Dolph } from '@dolphjs/dolph/common';
import { DService } from '@dolphjs/dolph/decorators';
import { createImageStorageProvider } from './image-storage-provider.factory';
import { ImageStorageProvider, ImageUploadResult } from './image-storage-provider.interface';

@DService()
export class ImageStorageService extends DolphServiceHandler<Dolph> {
    private provider: ImageStorageProvider;

    constructor() {
        super('imageStorageService');
        this.provider = createImageStorageProvider();
    }

    upload(buffer: Buffer, folder: string): Promise<ImageUploadResult> {
        return this.provider.upload(buffer, folder);
    }

    remove(publicId: string): Promise<void> {
        return this.provider.remove(publicId);
    }
}
