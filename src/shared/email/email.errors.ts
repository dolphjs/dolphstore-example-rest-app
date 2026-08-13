export class EmailSendException extends Error {
    constructor(
        message: string,
        public readonly providerCode?: string,
    ) {
        super(message);
        this.name = 'EmailSendException';
    }
}
