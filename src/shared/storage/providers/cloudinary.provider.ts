import { v2 as cloudinary } from 'cloudinary';
import { ImageStorageProvider, ImageUploadResult } from '../image-storage-provider.interface';
import { ImageStorageException } from '../image-storage.errors';

export class CloudinaryImageStorageProvider implements ImageStorageProvider {
    constructor(config: { cloudName: string; apiKey: string; apiSecret: string }) {
        cloudinary.config({
            cloud_name: config.cloudName,
            api_key: config.apiKey,
            api_secret: config.apiSecret,
        });
    }

    upload(buffer: Buffer, folder: string): Promise<ImageUploadResult> {
        return new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream({ folder, resource_type: 'image' }, (err, result) => {
                if (err || !result) {
                    reject(new ImageStorageException(err?.message ?? 'image upload failed', String(err?.http_code ?? '')));
                    return;
                }
                resolve({ url: result.secure_url, publicId: result.public_id });
            });
            stream.end(buffer);
        });
    }

    async remove(publicId: string): Promise<void> {
        const result = await cloudinary.uploader.destroy(publicId);
        if (result.result !== 'ok' && result.result !== 'not found') {
            throw new ImageStorageException(`failed to remove image ${publicId}: ${result.result}`);
        }
    }
}
