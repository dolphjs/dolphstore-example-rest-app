export class ImageStorageException extends Error {
    constructor(
        message: string,
        public readonly providerCode?: string,
    ) {
        super(message);
        this.name = 'ImageStorageException';
    }
}
