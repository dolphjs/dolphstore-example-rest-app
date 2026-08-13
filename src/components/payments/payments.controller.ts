import { DolphControllerHandler } from '@dolphjs/dolph/classes';
import { BadRequestException, DRequest, Dolph } from '@dolphjs/dolph/common';
import { DBody, DHeaders, DParam, DPayload, DQuery, DReq, Get, Post, Route, UseMiddleware } from '@dolphjs/dolph/decorators';
import { PaginationDto } from '../../shared/dto';
import { Role } from '../../shared/enums';
import { JwtPayload } from '../../shared/interfaces';
import { requireRole } from '../../shared/middlewares';
import { authShield } from '../iam/iam.shield';
import { InitiateFeaturePaymentDto, PaymentIdParamDto, PaymentReferenceParamDto, RefundPaymentDto } from './payment.dto';
import { PaymentsService } from './payments.service';
import { PropertyIdParamDto } from '../properties/property.dto';

@Route('')
export class PaymentsController extends DolphControllerHandler<Dolph> {
    constructor(private paymentsService: PaymentsService) {
        super();
    }

    @UseMiddleware(requireRole(Role.AGENT, Role.ADMIN))
    @UseMiddleware(authShield)
    @Post('properties/:id/feature')
    async initiateFeaturePayment(
        @DParam(PropertyIdParamDto) params: PropertyIdParamDto,
        @DPayload() payload: JwtPayload,
        @DBody(InitiateFeaturePaymentDto) body: InitiateFeaturePaymentDto,
    ) {
        return this.paymentsService.initiateFeaturePayment(params.id, { userId: payload.sub, role: payload.info.role }, body);
    }

    @UseMiddleware(authShield)
    @Get('payments/mine')
    async mine(@DPayload() payload: JwtPayload, @DQuery(PaginationDto) query: PaginationDto) {
        return this.paymentsService.listMine({ userId: payload.sub, role: payload.info.role }, query);
    }

    @UseMiddleware(authShield)
    @Get('payments/:reference')
    async getByReference(@DParam(PaymentReferenceParamDto) params: PaymentReferenceParamDto, @DPayload() payload: JwtPayload) {
        return this.paymentsService.getByReference(params.reference, { userId: payload.sub, role: payload.info.role });
    }

    @UseMiddleware(requireRole(Role.ADMIN))
    @UseMiddleware(authShield)
    @Post('payments/:id/refund')
    async refund(@DParam(PaymentIdParamDto) params: PaymentIdParamDto, @DBody(RefundPaymentDto) body: RefundPaymentDto) {
        return this.paymentsService.refund(params.id, body);
    }

    @Post('payments/webhooks/paystack')
    async paystackWebhook(@DReq() req: DRequest, @DHeaders() headers: Record<string, string>) {
        if (!req.rawBody) throw new BadRequestException('missing raw request body');

        await this.paymentsService.handleWebhook(req.rawBody, headers['x-paystack-signature'], req.body);
        return { received: true };
    }
}
