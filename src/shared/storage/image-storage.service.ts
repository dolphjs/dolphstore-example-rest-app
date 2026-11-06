import { DService } from '@dolphjs/dolph';
import { createImageStorageProvider } from './image-storage-provider.factory';
import { ImageStorageProvider, ImageUploadResult } from './image-storage-provider.interface';

@DService()
export class ImageStorageService {
    private provider: ImageStorageProvider;

    constructor() {
        this.provider = createImageStorageProvider();
    }

    upload(buffer: Buffer, folder: string): Promise<ImageUploadResult> {
        return this.provider.upload(buffer, folder);
    }

    remove(publicId: string): Promise<void> {
        return this.provider.remove(publicId);
    }
}
