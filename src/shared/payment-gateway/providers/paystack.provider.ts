import { createHmac, timingSafeEqual } from 'crypto';
import {
    InitializePaymentParams,
    InitializePaymentResult,
    PaymentGatewayProvider,
    PaymentVerificationStatus,
    RefundPaymentParams,
    RefundPaymentResult,
    VerifyPaymentResult,
} from '../payment-gateway-provider.interface';
import { PaymentGatewayException } from '../payment-gateway.errors';

const BASE_URL = 'https://api.paystack.co';

export class PaystackPaymentGatewayProvider implements PaymentGatewayProvider {
    constructor(private secretKey: string) {}

    private async request(path: string, options: { method?: string; body?: unknown } = {}) {
        const res = await fetch(`${BASE_URL}${path}`, {
            method: options.method ?? 'GET',
            headers: {
                Authorization: `Bearer ${this.secretKey}`,
                'Content-Type': 'application/json',
            },
            body: options.body ? JSON.stringify(options.body) : undefined,
        });

        const body = await res.json();
        if (!res.ok || body.status === false) {
            throw new PaymentGatewayException(body.message ?? 'Paystack request failed', String(res.status));
        }

        return body;
    }

    async initialize(params: InitializePaymentParams): Promise<InitializePaymentResult> {
        const body = await this.request('/transaction/initialize', {
            method: 'POST',
            body: {
                email: params.email,
                amount: params.amount,
                currency: params.currency,
                reference: params.reference,
                callback_url: params.callbackUrl,
                metadata: params.metadata,
            },
        });

        return { checkoutUrl: body.data.authorization_url, providerReference: String(body.data.reference) };
    }

    async verify(reference: string): Promise<VerifyPaymentResult> {
        const body = await this.request(`/transaction/verify/${encodeURIComponent(reference)}`);
        const data = body.data;

        const status: PaymentVerificationStatus = data.status === 'success' ? 'success' : data.status === 'abandoned' ? 'pending' : 'failed';

        return {
            status,
            amount: data.amount,
            currency: data.currency,
            reference: data.reference,
            providerReference: String(data.id),
        };
    }

    async refund(params: RefundPaymentParams): Promise<RefundPaymentResult> {
        const body = await this.request('/refund', {
            method: 'POST',
            body: {
                transaction: params.providerReference,
                amount: params.amount,
                merchant_note: params.reason,
            },
        });

        return { status: body.data.status, providerRefundId: String(body.data.id) };
    }

    verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
        const expected = createHmac('sha512', this.secretKey).update(rawBody).digest('hex');
        const expectedBuffer = Buffer.from(expected, 'utf8');
        const signatureBuffer = Buffer.from(signature, 'utf8');

        if (expectedBuffer.length !== signatureBuffer.length) return false;
        return timingSafeEqual(expectedBuffer, signatureBuffer);
    }
}
