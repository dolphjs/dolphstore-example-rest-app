import { IPayload } from '@dolphjs/dolph/common';
import { Role } from '../enums';

export interface JwtPayload extends IPayload {
    sub: string;
    info: {
        email: string;
        role: Role;
        jti?: string;
    };
}
