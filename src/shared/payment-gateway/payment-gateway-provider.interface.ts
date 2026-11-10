export interface InitializePaymentParams {
    amount: number;
    currency: string;
    email: string;
    reference: string;
    callbackUrl?: string;
    metadata?: Record<string, unknown>;
}

export interface InitializePaymentResult {
    checkoutUrl: string;
    providerReference: string;
}

export type PaymentVerificationStatus = 'success' | 'failed' | 'pending';

export interface VerifyPaymentResult {
    status: PaymentVerificationStatus;
    amount: number;
    currency: string;
    reference: string;
    providerReference: string;
}

export interface RefundPaymentParams {
    providerReference: string;
    amount?: number;
    reason?: string;
}

export interface RefundPaymentResult {
    status: string;
    providerRefundId: string;
}

export interface PaymentGatewayProvider {
    initialize(params: InitializePaymentParams): Promise<InitializePaymentResult>;
    verify(reference: string): Promise<VerifyPaymentResult>;
    refund(params: RefundPaymentParams): Promise<RefundPaymentResult>;
    verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
}
