import { ForbiddenException, NotFoundException, UnauthorizedException, DService, logger } from '@dolphjs/dolph';
import { randomUUID } from 'crypto';
import { PaginationDto } from '../../shared/dto';
import { Role } from '../../shared/enums';
import { Requester } from '../../shared/interfaces';
import { PaymentGatewayService } from '../../shared/payment-gateway';
import { PropertyService } from '../properties/property.service';
import { UserService } from '../iam/user.service';
import { InitiateFeaturePaymentDto, RefundPaymentDto } from './payment.dto';
import { PaymentStatus } from './payment.enums';
import { PaymentService } from './payment.service';

const FEATURE_DAILY_RATE_KOBO = 50_000;

@DService()
export class PaymentsService {
    constructor(
        private paymentService: PaymentService,
        private paymentGatewayService: PaymentGatewayService,
        private propertyService: PropertyService,
        private userService: UserService,
    ) {}

    async initiateFeaturePayment(propertyId: string, requester: Requester, dto: InitiateFeaturePaymentDto) {
        const property = await this.propertyService.findById(propertyId);
        if (!property) throw new NotFoundException('property not found');
        if (property.agentId !== requester.userId && requester.role !== Role.ADMIN) {
            throw new ForbiddenException('you do not own this property');
        }

        const agent = await this.userService.findById(requester.userId);
        if (!agent) throw new NotFoundException('agent not found');

        const amount = FEATURE_DAILY_RATE_KOBO * dto.durationDays;
        const reference = `feat_${randomUUID()}`;

        const { checkoutUrl } = await this.paymentGatewayService.initialize({
            amount,
            currency: 'NGN',
            email: agent.email,
            reference,
            metadata: { propertyId, durationDays: dto.durationDays },
        });

        return this.paymentService.create({
            propertyId,
            agentId: requester.userId,
            reference,
            amount,
            currency: 'NGN',
            featureDurationDays: dto.durationDays,
            checkoutUrl,
        });
    }

    async getByReference(reference: string, requester: Requester) {
        const payment = await this.paymentService.findByReference(reference);
        if (!payment) throw new NotFoundException('payment not found');
        if (payment.agentId !== requester.userId && requester.role !== Role.ADMIN) {
            throw new ForbiddenException('you do not own this payment');
        }
        return payment;
    }

    async listMine(requester: Requester, pagination: PaginationDto) {
        return this.paymentService.listForAgent(requester.userId, pagination);
    }

    async refund(paymentId: string, dto: RefundPaymentDto) {
        const payment = await this.paymentService.findById(paymentId);
        if (!payment) throw new NotFoundException('payment not found');
        if (payment.status !== PaymentStatus.PAID) {
            throw new ForbiddenException('only a paid payment can be refunded');
        }

        await this.paymentGatewayService.refund({
            providerReference: payment.providerReference!,
            reason: dto.reason,
        });

        await this.propertyService.markFeatured(payment.propertyId, new Date());
        return this.paymentService.markRefunded(payment.id, dto.reason);
    }

    async handleWebhook(rawBody: Buffer, signature: string | undefined, body: any): Promise<void> {
        if (!signature || !this.paymentGatewayService.verifyWebhookSignature(rawBody, signature)) {
            throw new UnauthorizedException('invalid webhook signature');
        }

        const reference: string | undefined = body?.data?.reference;
        if (!reference) {
            logger.error('Payment webhook: no reference in payload');
            return;
        }

        const payment = await this.paymentService.findByReference(reference);
        if (!payment) {
            logger.error(`Payment webhook: no payment found for reference ${reference}`);
            return;
        }

        // Idempotent — Paystack may deliver the same event more than once.
        if (payment.status !== PaymentStatus.PENDING) return;

        // Never trust the webhook payload's own status for something this
        // consequential — re-verify against the provider's API directly.
        const verified = await this.paymentGatewayService.verify(reference);

        if (verified.status === 'success') {
            await this.paymentService.markPaid(payment.id, verified.providerReference);
            const until = new Date(Date.now() + payment.featureDurationDays * 24 * 60 * 60 * 1000);
            await this.propertyService.markFeatured(payment.propertyId, until);
        } else if (verified.status === 'failed') {
            await this.paymentService.markFailed(payment.id);
        }
    }
}
