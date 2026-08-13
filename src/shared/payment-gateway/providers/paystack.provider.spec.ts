import { createHmac } from 'crypto';
import { PaymentGatewayException } from '../payment-gateway.errors';
import { PaystackPaymentGatewayProvider } from './paystack.provider';

function mockFetchResponse(ok: boolean, status: number, json: unknown) {
    return { ok, status, json: async () => json } as Response;
}

describe('PaystackPaymentGatewayProvider', () => {
    let provider: PaystackPaymentGatewayProvider;
    let fetchMock: jest.Mock;

    beforeEach(() => {
        provider = new PaystackPaymentGatewayProvider('sk_test_abc123');
        fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    it('initialize() posts to /transaction/initialize with a Bearer secret key and maps the response', async () => {
        fetchMock.mockResolvedValue(
            mockFetchResponse(true, 200, {
                status: true,
                message: 'ok',
                data: { authorization_url: 'https://checkout.paystack.com/abc', access_code: 'ac_1', reference: 'feat_1' },
            }),
        );

        const result = await provider.initialize({
            amount: 50000,
            currency: 'NGN',
            email: 'agent@dolphstore.test',
            reference: 'feat_1',
        });

        expect(fetchMock).toHaveBeenCalledWith(
            'https://api.paystack.co/transaction/initialize',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({ Authorization: 'Bearer sk_test_abc123' }),
            }),
        );
        const [, options] = fetchMock.mock.calls[0];
        expect(JSON.parse(options.body)).toEqual(
            expect.objectContaining({ amount: 50000, currency: 'NGN', email: 'agent@dolphstore.test', reference: 'feat_1' }),
        );
        expect(result).toEqual({ checkoutUrl: 'https://checkout.paystack.com/abc', providerReference: 'feat_1' });
    });

    it('verify() maps a successful transaction', async () => {
        fetchMock.mockResolvedValue(
            mockFetchResponse(true, 200, {
                status: true,
                data: { id: 12345, status: 'success', reference: 'feat_1', amount: 50000, currency: 'NGN' },
            }),
        );

        const result = await provider.verify('feat_1');
        expect(result).toEqual({ status: 'success', amount: 50000, currency: 'NGN', reference: 'feat_1', providerReference: '12345' });
    });

    it('verify() maps an abandoned transaction to "pending"', async () => {
        fetchMock.mockResolvedValue(
            mockFetchResponse(true, 200, {
                status: true,
                data: { id: 12345, status: 'abandoned', reference: 'feat_1', amount: 50000, currency: 'NGN' },
            }),
        );

        const result = await provider.verify('feat_1');
        expect(result.status).toBe('pending');
    });

    it('refund() posts to /refund with the provider reference', async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(true, 200, { status: true, data: { id: 999, status: 'pending' } }));

        const result = await provider.refund({ providerReference: '12345', reason: 'duplicate' });

        const [, options] = fetchMock.mock.calls[0];
        expect(JSON.parse(options.body)).toEqual(expect.objectContaining({ transaction: '12345', merchant_note: 'duplicate' }));
        expect(result).toEqual({ status: 'pending', providerRefundId: '999' });
    });

    it('throws PaymentGatewayException when Paystack returns status: false', async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(true, 200, { status: false, message: 'Invalid reference' }));

        await expect(provider.verify('bad-ref')).rejects.toThrow(PaymentGatewayException);
    });

    it('throws PaymentGatewayException on a non-2xx HTTP response', async () => {
        fetchMock.mockResolvedValue(mockFetchResponse(false, 401, { message: 'Invalid key' }));

        await expect(provider.verify('feat_1')).rejects.toThrow(PaymentGatewayException);
    });

    describe('verifyWebhookSignature', () => {
        it('accepts a correctly signed payload', () => {
            const rawBody = Buffer.from('{"event":"charge.success","data":{"reference":"feat_1"}}');
            const signature = createHmac('sha512', 'sk_test_abc123').update(rawBody).digest('hex');

            expect(provider.verifyWebhookSignature(rawBody, signature)).toBe(true);
        });

        it('rejects a tampered payload', () => {
            const rawBody = Buffer.from('{"event":"charge.success","data":{"reference":"feat_1"}}');
            const signature = createHmac('sha512', 'sk_test_abc123').update(rawBody).digest('hex');
            const tamperedBody = Buffer.from('{"event":"charge.success","data":{"reference":"feat_2"}}');

            expect(provider.verifyWebhookSignature(tamperedBody, signature)).toBe(false);
        });

        it('rejects a signature computed with the wrong secret', () => {
            const rawBody = Buffer.from('{"event":"charge.success"}');
            const wrongSignature = createHmac('sha512', 'a-different-secret').update(rawBody).digest('hex');

            expect(provider.verifyWebhookSignature(rawBody, wrongSignature)).toBe(false);
        });
    });
});
