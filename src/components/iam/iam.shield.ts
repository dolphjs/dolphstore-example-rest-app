import { DNextFunc, DRequest, DResponse, UnauthorizedException } from '@dolphjs/dolph/common';
import { verifyJWTwithHMAC } from '@dolphjs/dolph/utilities';
import { env } from '../../shared/configs';
import { JwtPayload } from '../../shared/interfaces';

/**
 * Plain middleware, not a service — shields run outside the `@Component`
 * DI graph, so this verifies the access token directly rather than going
 * through TokenService (which would mean constructing a second,
 * DI-unmanaged instance for no benefit).
 */
export const authShield = (req: DRequest, res: DResponse, next: DNextFunc) => {
    try {
        const header = req.headers['authorization'];
        if (!header || Array.isArray(header) || !header.startsWith('Bearer ')) {
            return next(new UnauthorizedException('provide a valid authorization token header'));
        }

        const token = header.slice('Bearer '.length);
        const payload = verifyJWTwithHMAC({ token, secret: env.jwt.accessSecret }) as unknown as JwtPayload;

        req.payload = payload;
        next();
    } catch {
        next(new UnauthorizedException('invalid or expired token'));
    }
};
