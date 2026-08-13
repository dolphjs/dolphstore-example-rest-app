import { IPayload } from '@dolphjs/dolph/common';
import { Role } from '../enums';

/**
 * DolphStore's concrete shape for the framework's generic `IPayload`
 * (`sub`/`iat`/`exp`/`info`) — used with `generateJWTwithHMAC`,
 * `verifyJWTwithHMAC`, and `@DPayload()` so route handlers get typed
 * access to `payload.info.role` instead of `any`.
 */
export interface JwtPayload extends IPayload {
    sub: string;
    info: {
        email: string;
        role: Role;
    };
}
