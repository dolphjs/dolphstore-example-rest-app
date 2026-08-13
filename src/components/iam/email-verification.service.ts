import { DolphServiceHandler } from '@dolphjs/dolph/classes';
import { Dolph } from '@dolphjs/dolph/common';
import { DService } from '@dolphjs/dolph/decorators';
import { getDataSource } from '@dolphjs/dolph/packages/typeorm';
import { compareHashedString, hashString } from '@dolphjs/dolph/utilities';
import { randomInt } from 'crypto';
import { IsNull } from 'typeorm';
import { EmailVerificationCode } from './email-verification-code.entity';

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;

@DService()
export class EmailVerificationService extends DolphServiceHandler<Dolph> {
    constructor() {
        super('emailVerificationService');
    }

    private get repo() {
        return getDataSource().getRepository(EmailVerificationCode);
    }

    private latest(userId: string) {
        return this.repo.findOne({ where: { userId }, order: { createdAt: 'DESC' } });
    }

    async issueCode(userId: string): Promise<string | null> {
        const recent = await this.latest(userId);
        if (recent && Date.now() - recent.createdAt.getTime() < RESEND_COOLDOWN_MS) {
            return null;
        }

        const code = randomInt(0, 1_000_000).toString().padStart(6, '0');

        await this.repo.save(
            this.repo.create({
                userId,
                codeHash: await hashString(code),
                expiresAt: new Date(Date.now() + CODE_TTL_MS),
                attempts: 0,
                consumedAt: null,
            }),
        );

        return code;
    }

    async verifyCode(userId: string, code: string): Promise<boolean> {
        const record = await this.repo.findOne({ where: { userId, consumedAt: IsNull() }, order: { createdAt: 'DESC' } });
        if (!record || record.expiresAt.getTime() < Date.now()) return false;

        const matches = compareHashedString(code, record.codeHash);
        if (!matches) {
            record.attempts += 1;
            if (record.attempts >= MAX_ATTEMPTS) record.consumedAt = new Date();
            await this.repo.save(record);
            return false;
        }

        record.consumedAt = new Date();
        await this.repo.save(record);
        return true;
    }
}
