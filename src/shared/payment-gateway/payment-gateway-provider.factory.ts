import { env } from '../configs';
import { PaymentGatewayProvider } from './payment-gateway-provider.interface';
import { PaystackPaymentGatewayProvider } from './providers/paystack.provider';

export function createPaymentGatewayProvider(): PaymentGatewayProvider {
    switch (env.payments.provider) {
        case 'paystack':
            return new PaystackPaymentGatewayProvider(env.payments.paystackSecretKey);
        default:
            throw new Error(`Unsupported payment provider: ${env.payments.provider}`);
    }
}
