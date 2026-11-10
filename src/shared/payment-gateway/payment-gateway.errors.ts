export class PaymentGatewayException extends Error {
    constructor(
        message: string,
        public readonly providerCode?: string,
    ) {
        super(message);
        this.name = 'PaymentGatewayException';
    }
}
