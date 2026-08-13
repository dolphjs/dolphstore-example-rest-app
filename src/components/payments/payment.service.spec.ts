import { DataSource } from 'typeorm';
import { seedSqliteDataSource } from '../../../tests/utils/sqlite-datasource';
import { User } from '../iam/user.entity';
import { UserService } from '../iam/user.service';
import { PropertyImage } from '../properties/property-image.entity';
import { ListingType, PropertyType } from '../properties/property.enums';
import { Property } from '../properties/property.entity';
import { PropertyService } from '../properties/property.service';
import { Payment } from './payment.entity';
import { PaymentStatus } from './payment.enums';
import { PaymentService } from './payment.service';

describe('PaymentService', () => {
    let dataSource: DataSource;
    let paymentService: PaymentService;
    let agentId: string;
    let propertyId: string;

    beforeAll(async () => {
        dataSource = await seedSqliteDataSource([User, Property, PropertyImage, Payment]);
        paymentService = new PaymentService();

        const agent = await new UserService().create({
            email: 'pay-agent@dolphstore.test',
            password: 'password123',
            firstName: 'Pay',
            lastName: 'Agent',
            phone: '+15550111111',
        });
        agentId = agent.id;

        const property = await new PropertyService().create(agentId, {
            title: 'Featurable property',
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

    afterAll(async () => {
        await dataSource.destroy();
    });

    it('creates a payment as PENDING', async () => {
        const payment = await paymentService.create({
            propertyId,
            agentId,
            reference: 'feat_1',
            amount: 350000,
            currency: 'NGN',
            featureDurationDays: 7,
            checkoutUrl: 'https://checkout.paystack.com/1',
        });

        expect(payment.status).toBe(PaymentStatus.PENDING);
        expect(payment.amount).toBe(350000);
    });

    it('findByReference finds the created payment', async () => {
        const found = await paymentService.findByReference('feat_1');
        expect(found?.propertyId).toBe(propertyId);
    });

    it('markPaid sets status, providerReference, and paidAt', async () => {
        const payment = (await paymentService.findByReference('feat_1'))!;
        const updated = await paymentService.markPaid(payment.id, 'ps_ref_123');

        expect(updated.status).toBe(PaymentStatus.PAID);
        expect(updated.providerReference).toBe('ps_ref_123');
        expect(updated.paidAt).toBeInstanceOf(Date);
    });

    it('markFailed sets status to FAILED', async () => {
        const payment = await paymentService.create({
            propertyId,
            agentId,
            reference: 'feat_2',
            amount: 50000,
            currency: 'NGN',
            featureDurationDays: 1,
            checkoutUrl: 'https://checkout.paystack.com/2',
        });

        const updated = await paymentService.markFailed(payment.id);
        expect(updated.status).toBe(PaymentStatus.FAILED);
    });

    it('markRefunded sets status, refundedAt, and refundReason', async () => {
        const payment = await paymentService.create({
            propertyId,
            agentId,
            reference: 'feat_3',
            amount: 50000,
            currency: 'NGN',
            featureDurationDays: 1,
            checkoutUrl: 'https://checkout.paystack.com/3',
        });

        const updated = await paymentService.markRefunded(payment.id, 'duplicate charge');
        expect(updated.status).toBe(PaymentStatus.REFUNDED);
        expect(updated.refundedAt).toBeInstanceOf(Date);
        expect(updated.refundReason).toBe('duplicate charge');
    });

    it('listForAgent paginates and scopes to the agent', async () => {
        const result = await paymentService.listForAgent(agentId, { page: 1, limit: 20, order: 'DESC' });
        expect(result.total).toBeGreaterThanOrEqual(3);
        expect(result.data.every((p) => p.agentId === agentId)).toBe(true);
    });
});
