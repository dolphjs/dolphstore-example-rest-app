import { DolphServiceHandler } from '@dolphjs/dolph/classes';
import { Dolph } from '@dolphjs/dolph/common';
import { DService } from '@dolphjs/dolph/decorators';
import { getDataSource } from '@dolphjs/dolph/packages/typeorm';
import { generateJWTwithHMAC, verifyJWTwithHMAC, hashString, compareHashedString } from '@dolphjs/dolph/utilities';
import { randomUUID } from 'crypto';
import ms from 'ms';
import { env } from '../../shared/configs';
import { JwtPayload } from '../../shared/interfaces';
import { RefreshToken } from './refresh-token.entity';
import { User } from './user.entity';

export type TokenPair = { accessToken: string; refreshToken: string };

const buildPayload = (user: User, jti?: string): JwtPayload => ({
    sub: user.id,
    iat: Math.floor(Date.now() / 1000),
    exp: 0, // overwritten by callers with the right TTL per token type
    info: { email: user.email, role: user.role, ...(jti && { jti }) },
});

const parseTtlMs = (value: string): number => ms(value as ms.StringValue);

/**
 * Lower-level service (JWT + refresh-token persistence only — no HTTP
 * concerns). IamService is the upper-level orchestrator that calls this
 * alongside UserService.
 */
@DService()
export class TokenService extends DolphServiceHandler<Dolph> {
    constructor() {
        super('tokenService');
    }

    private get repo() {
        return getDataSource().getRepository(RefreshToken);
    }

    signAccessToken(user: User): string {
        const payload = buildPayload(user);
        payload.exp = Math.floor(Date.now() / 1000) + Math.floor(parseTtlMs(env.jwt.accessExpiresIn) / 1000);
        return generateJWTwithHMAC({ payload, secret: env.jwt.accessSecret });
    }

    verifyAccessToken(token: string): JwtPayload {
        return verifyJWTwithHMAC({ token, secret: env.jwt.accessSecret }) as unknown as JwtPayload;
    }

    async issueRefreshToken(user: User, userAgent?: string): Promise<string> {
        const jti = randomUUID();
        const payload = buildPayload(user, jti);
        const ttlMs = parseTtlMs(env.jwt.refreshExpiresIn);
        payload.exp = Math.floor(Date.now() / 1000) + Math.floor(ttlMs / 1000);

        const token = generateJWTwithHMAC({ payload, secret: env.jwt.refreshSecret });

        await this.repo.save(
            this.repo.create({
                id: jti,
                userId: user.id,
                tokenHash: await hashString(token),
                userAgent: userAgent ?? null,
                expiresAt: new Date(Date.now() + ttlMs),
                revokedAt: null,
            }),
        );

        return token;
    }

    async verifyAndConsumeRefreshToken(token: string): Promise<{ userId: string } | null> {
        let payload: JwtPayload;
        try {
            payload = verifyJWTwithHMAC({ token, secret: env.jwt.refreshSecret }) as unknown as JwtPayload;
        } catch {
            return null;
        }

        const jti = payload.info?.jti;
        if (!jti) return null;

        const record = await this.repo.findOne({ where: { id: jti } });
        if (!record || record.revokedAt || record.expiresAt.getTime() < Date.now()) return null;

        const matches = compareHashedString(token, record.tokenHash);
        if (!matches) return null;

        record.revokedAt = new Date();
        await this.repo.save(record);

        return { userId: record.userId };
    }

    async revokeAllForUser(userId: string): Promise<void> {
        await this.repo
            .createQueryBuilder()
            .update(RefreshToken)
            .set({ revokedAt: new Date() })
            .where('userId = :userId AND revokedAt IS NULL', { userId })
            .execute();
    }
}
