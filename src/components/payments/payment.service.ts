import { DService, getDataSource } from '@dolphjs/dolph';
import { PaginationDto } from '../../shared/dto';
import { Payment } from './payment.entity';
import { PaymentStatus } from './payment.enums';

export interface CreatePaymentParams {
    propertyId: string;
    agentId: string;
    reference: string;
    amount: number;
    currency: string;
    featureDurationDays: number;
    checkoutUrl: string;
}

export interface PaymentListResult {
    data: Payment[];
    total: number;
    page: number;
    limit: number;
}

@DService()
export class PaymentService {
    private get repo() {
        return getDataSource().getRepository(Payment);
    }

    async create(params: CreatePaymentParams): Promise<Payment> {
        const payment = this.repo.create({ ...params, status: PaymentStatus.PENDING });
        return this.repo.save(payment);
    }

    async findById(id: string): Promise<Payment | null> {
        return this.repo.findOne({ where: { id } });
    }

    async findByReference(reference: string): Promise<Payment | null> {
        return this.repo.findOne({ where: { reference } });
    }

    async listForAgent(agentId: string, pagination: PaginationDto): Promise<PaymentListResult> {
        const [data, total] = await this.repo.findAndCount({
            where: { agentId },
            order: { createdAt: pagination.order },
            skip: (pagination.page - 1) * pagination.limit,
            take: pagination.limit,
        });

        return { data, total, page: pagination.page, limit: pagination.limit };
    }

    async markPaid(id: string, providerReference: string): Promise<Payment> {
        await this.repo.update({ id }, { status: PaymentStatus.PAID, providerReference, paidAt: new Date() });
        return (await this.findById(id))!;
    }

    async markFailed(id: string): Promise<Payment> {
        await this.repo.update({ id }, { status: PaymentStatus.FAILED });
        return (await this.findById(id))!;
    }

    async markRefunded(id: string, reason?: string): Promise<Payment> {
        await this.repo.update({ id }, { status: PaymentStatus.REFUNDED, refundedAt: new Date(), refundReason: reason ?? null });
        return (await this.findById(id))!;
    }
}
