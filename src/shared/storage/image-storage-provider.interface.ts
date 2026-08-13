export interface ImageUploadResult {
    url: string;
    publicId: string;
}

export interface ImageStorageProvider {
    upload(buffer: Buffer, folder: string): Promise<ImageUploadResult>;
    remove(publicId: string): Promise<void>;
}
