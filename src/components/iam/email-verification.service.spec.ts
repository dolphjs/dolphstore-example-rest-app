import { DataSource } from 'typeorm';
import { seedSqliteDataSource } from '../../../tests/utils/sqlite-datasource';
import { EmailVerificationCode } from './email-verification-code.entity';
import { EmailVerificationService } from './email-verification.service';
import { RefreshToken } from './refresh-token.entity';
import { User } from './user.entity';
import { UserService } from './user.service';

describe('EmailVerificationService', () => {
    let dataSource: DataSource;
    let service: EmailVerificationService;
    let userService: UserService;
    let counter = 0;

    beforeAll(async () => {
        dataSource = await seedSqliteDataSource([User, RefreshToken, EmailVerificationCode]);
        service = new EmailVerificationService();
        userService = new UserService();
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    async function createUser() {
        counter += 1;
        const user = await userService.create({
            email: `verify-service-${counter}@dolphstore.test`,
            password: 'password123',
            firstName: 'Vera',
            lastName: 'Fye',
            phone: '+15550000004',
        });
        return user.id;
    }

    it('issues a 6-digit code', async () => {
        const userId = await createUser();
        const code = await service.issueCode(userId);
        expect(code).toMatch(/^\d{6}$/);
    });

    it('verifies the correct code', async () => {
        const userId = await createUser();
        const code = (await service.issueCode(userId))!;

        expect(await service.verifyCode(userId, code)).toBe(true);
    });

    it('rejects an incorrect code', async () => {
        const userId = await createUser();
        await service.issueCode(userId);

        expect(await service.verifyCode(userId, '000000')).toBe(false);
    });

    it('a code can only be used once', async () => {
        const userId = await createUser();
        const code = (await service.issueCode(userId))!;

        expect(await service.verifyCode(userId, code)).toBe(true);
        expect(await service.verifyCode(userId, code)).toBe(false);
    });

    it('respects the resend cooldown', async () => {
        const userId = await createUser();
        await service.issueCode(userId);

        const second = await service.issueCode(userId);
        expect(second).toBeNull();
    });

    it('locks the code out after too many failed attempts', async () => {
        const userId = await createUser();
        const code = (await service.issueCode(userId))!;

        for (let i = 0; i < 5; i++) {
            expect(await service.verifyCode(userId, '111111')).toBe(false);
        }

        // Correct code, but the record was consumed by the 5th failed attempt.
        expect(await service.verifyCode(userId, code)).toBe(false);
    });

    it('rejects an expired code even with the right value', async () => {
        const userId = await createUser();
        const code = (await service.issueCode(userId))!;

        const repo = dataSource.getRepository(EmailVerificationCode);
        await repo.update({ userId }, { expiresAt: new Date(Date.now() - 1000) });

        expect(await service.verifyCode(userId, code)).toBe(false);
    });
});
