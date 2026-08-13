import { DNextFunc, DRequest, DResponse, ForbiddenException } from '@dolphjs/dolph/common';
import { Role } from '../enums';
import { JwtPayload } from '../interfaces';

export const requireRole = (...roles: Role[]) => {
    return (req: DRequest, res: DResponse, next: DNextFunc) => {
        const role = (req.payload as JwtPayload | undefined)?.info?.role;
        if (!role || !roles.includes(role)) {
            return next(new ForbiddenException('you do not have permission to perform this action'));
        }
        next();
    };
};
