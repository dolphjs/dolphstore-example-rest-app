import { env } from '../configs';
import { ImageStorageProvider } from './image-storage-provider.interface';
import { CloudinaryImageStorageProvider } from './providers/cloudinary.provider';

export function createImageStorageProvider(): ImageStorageProvider {
    switch (env.imageStorage.provider) {
        case 'cloudinary':
            return new CloudinaryImageStorageProvider({
                cloudName: env.imageStorage.cloudinaryCloudName,
                apiKey: env.imageStorage.cloudinaryApiKey,
                apiSecret: env.imageStorage.cloudinaryApiSecret,
            });
        default:
            throw new Error(`Unsupported image storage provider: ${env.imageStorage.provider}`);
    }
}
