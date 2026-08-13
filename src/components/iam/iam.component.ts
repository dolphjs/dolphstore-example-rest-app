import { Component } from '@dolphjs/dolph/decorators';
import { EmailService } from '../../shared/email';
import { IamController } from './iam.controller';
import { IamService } from './iam.service';
import { TokenService } from './token.service';
import { UserService } from './user.service';

@Component({ controllers: [IamController], services: [IamService, UserService, TokenService, EmailService] })
export class IamComponent {}
