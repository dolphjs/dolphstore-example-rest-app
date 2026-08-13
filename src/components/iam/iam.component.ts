import { Component } from '@dolphjs/dolph/decorators';
import { IamController } from './iam.controller';
import { IamService } from './iam.service';
import { TokenService } from './token.service';
import { UserService } from './user.service';

@Component({ controllers: [IamController], services: [IamService, UserService, TokenService] })
export class IamComponent {}
