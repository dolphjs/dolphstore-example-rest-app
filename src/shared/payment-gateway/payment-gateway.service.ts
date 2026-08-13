import { DolphServiceHandler } from '@dolphjs/dolph/classes';
import { Dolph } from '@dolphjs/dolph/common';
import { DService } from '@dolphjs/dolph/decorators';
import { createPaymentGatewayProvider } from './payment-gateway-provider.factory';
import {
    InitializePaymentParams,
    InitializePaymentResult,
    PaymentGatewayProvider,
    RefundPaymentParams,
    RefundPaymentResult,
    VerifyPaymentResult,
} from './payment-gateway-provider.interface';

@DService()
export class PaymentGatewayService extends DolphServiceHandler<Dolph> {
    private provider: PaymentGatewayProvider;

    constructor() {
        super('paymentGatewayService');
        this.provider = createPaymentGatewayProvider();
    }

    initialize(params: InitializePaymentParams): Promise<InitializePaymentResult> {
        return this.provider.initialize(params);
    }

    verify(reference: string): Promise<VerifyPaymentResult> {
        return this.provider.verify(reference);
    }

    refund(params: RefundPaymentParams): Promise<RefundPaymentResult> {
        return this.provider.refund(params);
    }

    verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
        return this.provider.verifyWebhookSignature(rawBody, signature);
    }
}
