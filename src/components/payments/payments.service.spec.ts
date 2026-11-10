import { createHmac } from 'crypto';
import { DataSource } from 'typeorm';
import { seedSqliteDataSource } from '../../../tests/utils/sqlite-datasource';
import { Role } from '../../shared/enums';
import { Requester } from '../../shared/interfaces';
import { PaymentGatewayService } from '../../shared/payment-gateway';
import { User } from '../iam/user.entity';
import { UserService } from '../iam/user.service';
import { PropertyImage } from '../properties/property-image.entity';
import { ListingType, PropertyType } from '../properties/property.enums';
import { Property } from '../properties/property.entity';
import { PropertyService } from '../properties/property.service';
import { Payment } from './payment.entity';
import { PaymentStatus } from './payment.enums';
import { PaymentService } from './payment.service';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
    let dataSource: DataSource;
    let paymentsService: PaymentsService;
    let propertyService: PropertyService;
    let paymentService: PaymentService;
    let gateway: { initialize: jest.Mock; verify: jest.Mock; refund: jest.Mock; verifyWebhookSignature: jest.Mock };
    let owner: Requester;
    let otherAgent: Requester;
    let admin: Requester;
    let propertyId: string;

    beforeAll(async () => {
        dataSource = await seedSqliteDataSource([User, Property, PropertyImage, Payment]);
        propertyService = new PropertyService();
        paymentService = new PaymentService();

        const userService = new UserService();
        const ownerUser = await userService.create({
            email: 'pay-owner@dolphstore.test',
            password: 'password123',
            firstName: 'Owner',
            lastName: 'Agent',
            phone: '+15550111112',
            role: Role.AGENT,
        });
        owner = { userId: ownerUser.id, role: Role.AGENT };

        const otherUser = await userService.create({
            email: 'pay-other@dolphstore.test',
            password: 'password123',
            firstName: 'Other',
            lastName: 'Agent',
            phone: '+15550111113',
            role: Role.AGENT,
        });
        otherAgent = { userId: otherUser.id, role: Role.AGENT };

        const adminUser = await userService.create({
            email: 'pay-admin@dolphstore.test',
            password: 'password123',
            firstName: 'Admin',
            lastName: 'User',
            phone: '+15550111114',
        });
        admin = { userId: adminUser.id, role: Role.ADMIN };

        const property = await propertyService.create(owner.userId, {
            title: 'Payable property',
            description: 'desc',
            price: 1000,
            listingType: ListingType.SALE,
            propertyType: PropertyType.HOUSE,
            address: '1 Main St',
            city: 'Lagos',
            state: 'Lagos',
        });
        propertyId = property.id;
    });

    beforeEach(() => {
        gateway = {
            initialize: jest.fn().mockResolvedValue({ checkoutUrl: 'https://checkout.paystack.com/mock', providerReference: 'mockref' }),
            verify: jest.fn(),
            refund: jest.fn().mockResolvedValue({ status: 'processed', providerRefundId: 'rfd_1' }),
            verifyWebhookSignature: jest.fn().mockReturnValue(true),
        };
        paymentsService = new PaymentsService(paymentService, gateway as unknown as PaymentGatewayService, propertyService, new UserService());
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    it('initiateFeaturePayment computes amount from durationDays and calls the gateway with the agent email', async () => {
        const result = await paymentsService.initiateFeaturePayment(propertyId, owner, { durationDays: 7 });

        expect(gateway.initialize).toHaveBeenCalledWith(
            expect.objectContaining({ amount: 50_000 * 7, currency: 'NGN', email: 'pay-owner@dolphstore.test' }),
        );
        expect(result.checkoutUrl).toBe('https://checkout.paystack.com/mock');
        expect(result.status).toBe(PaymentStatus.PENDING);
    });

    it('rejects initiating a feature payment for a property the requester does not own', async () => {
        await expect(paymentsService.initiateFeaturePayment(propertyId, otherAgent, { durationDays: 7 })).rejects.toThrow(
            /do not own/,
        );
    });

    it('an admin can initiate a feature payment for any property', async () => {
        const result = await paymentsService.initiateFeaturePayment(propertyId, admin, { durationDays: 3 });
        expect(result.amount).toBe(50_000 * 3);
    });

    it('getByReference enforces ownership', async () => {
        const payment = await paymentsService.initiateFeaturePayment(propertyId, owner, { durationDays: 1 });

        await expect(paymentsService.getByReference(payment.reference, otherAgent)).rejects.toThrow(/do not own/);
        const found = await paymentsService.getByReference(payment.reference, owner);
        expect(found.id).toBe(payment.id);
    });

    it('webhook: verifies signature, re-verifies with the gateway, marks paid, and features the property', async () => {
        const payment = await paymentsService.initiateFeaturePayment(propertyId, owner, { durationDays: 5 });
        gateway.verify.mockResolvedValue({ status: 'success', amount: payment.amount, currency: 'NGN', reference: payment.reference, providerReference: 'ps_real_ref' });

        const rawBody = Buffer.from(JSON.stringify({ event: 'charge.success', data: { reference: payment.reference } }));
        await paymentsService.handleWebhook(rawBody, 'valid-signature', JSON.parse(rawBody.toString()));

        const updated = await paymentService.findById(payment.id);
        expect(updated!.status).toBe(PaymentStatus.PAID);
        expect(updated!.providerReference).toBe('ps_real_ref');

        const property = await propertyService.findById(propertyId);
        expect(property!.featuredUntil).toBeInstanceOf(Date);
        expect(property!.featuredUntil!.getTime()).toBeGreaterThan(Date.now());
    });

    it('webhook: rejects an invalid signature', async () => {
        gateway.verifyWebhookSignature.mockReturnValue(false);
        const rawBody = Buffer.from(JSON.stringify({ data: { reference: 'whatever' } }));

        await expect(paymentsService.handleWebhook(rawBody, 'bad-signature', JSON.parse(rawBody.toString()))).rejects.toThrow(
            /invalid webhook signature/,
        );
    });

    it('webhook: is idempotent — a second delivery for an already-paid payment does not re-verify', async () => {
        const payment = await paymentsService.initiateFeaturePayment(propertyId, owner, { durationDays: 2 });
        gateway.verify.mockResolvedValue({ status: 'success', amount: payment.amount, currency: 'NGN', reference: payment.reference, providerReference: 'ps_ref' });

        const rawBody = Buffer.from(JSON.stringify({ data: { reference: payment.reference } }));
        await paymentsService.handleWebhook(rawBody, 'sig', JSON.parse(rawBody.toString()));
        gateway.verify.mockClear();

        await paymentsService.handleWebhook(rawBody, 'sig', JSON.parse(rawBody.toString()));
        expect(gateway.verify).not.toHaveBeenCalled();
    });

    it('webhook: marks the payment failed when the gateway reports failure', async () => {
        const payment = await paymentsService.initiateFeaturePayment(propertyId, owner, { durationDays: 1 });
        gateway.verify.mockResolvedValue({ status: 'failed', amount: payment.amount, currency: 'NGN', reference: payment.reference, providerReference: 'ps_ref' });

        const rawBody = Buffer.from(JSON.stringify({ data: { reference: payment.reference } }));
        await paymentsService.handleWebhook(rawBody, 'sig', JSON.parse(rawBody.toString()));

        const updated = await paymentService.findById(payment.id);
        expect(updated!.status).toBe(PaymentStatus.FAILED);
    });

    it('refund: rejects a payment that is not PAID', async () => {
        const payment = await paymentsService.initiateFeaturePayment(propertyId, owner, { durationDays: 1 });
        await expect(paymentsService.refund(payment.id, {})).rejects.toThrow(/only a paid payment/);
    });

    it('refund: on a paid payment, calls the gateway, marks refunded, and un-features the property', async () => {
        const payment = await paymentsService.initiateFeaturePayment(propertyId, owner, { durationDays: 10 });
        gateway.verify.mockResolvedValue({ status: 'success', amount: payment.amount, currency: 'NGN', reference: payment.reference, providerReference: 'ps_ref_refund' });
        const rawBody = Buffer.from(JSON.stringify({ data: { reference: payment.reference } }));
        await paymentsService.handleWebhook(rawBody, 'sig', JSON.parse(rawBody.toString()));

        const refunded = await paymentsService.refund(payment.id, { reason: 'agent requested' });

        expect(gateway.refund).toHaveBeenCalledWith(expect.objectContaining({ providerReference: 'ps_ref_refund', reason: 'agent requested' }));
        expect(refunded.status).toBe(PaymentStatus.REFUNDED);

        const property = await propertyService.findById(propertyId);
        expect(property!.featuredUntil!.getTime()).toBeLessThanOrEqual(Date.now());
    });
});
