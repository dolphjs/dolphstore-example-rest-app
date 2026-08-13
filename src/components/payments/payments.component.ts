import { Component } from '@dolphjs/dolph/decorators';
import { PaymentGatewayService } from '../../shared/payment-gateway';
import { UserService } from '../iam/user.service';
import { PropertyService } from '../properties/property.service';
import { PaymentService } from './payment.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Component({
    controllers: [PaymentsController],
    services: [PaymentsService, PaymentService, PaymentGatewayService, PropertyService, UserService],
})
export class PaymentsComponent {}
