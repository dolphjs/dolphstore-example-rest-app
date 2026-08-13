import { DataSource } from 'typeorm';
import { seedSqliteDataSource } from '../../../tests/utils/sqlite-datasource';
import { EmailService } from '../../shared/email';
import { EmailVerificationCode } from './email-verification-code.entity';
import { EmailVerificationService } from './email-verification.service';
import { RegisterDto } from './iam.dto';
import { IamService } from './iam.service';
import { RefreshToken } from './refresh-token.entity';
import { TokenService } from './token.service';
import { User } from './user.entity';
import { UserService } from './user.service';

describe('IamService', () => {
    let dataSource: DataSource;
    let iamService: IamService;
    let emailService: { sendTemplate: jest.Mock; send: jest.Mock };
    let counter = 0;

    beforeAll(async () => {
        dataSource = await seedSqliteDataSource([User, RefreshToken, EmailVerificationCode]);
    });

    beforeEach(() => {
        emailService = {
            sendTemplate: jest.fn().mockResolvedValue({ id: 'em_mock', status: 'queued' }),
            send: jest.fn().mockResolvedValue({ id: 'em_mock', status: 'queued' }),
        };
        iamService = new IamService(new UserService(), new TokenService(), emailService as unknown as EmailService, new EmailVerificationService());
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    function nextCredentials(): RegisterDto {
        counter += 1;
        return {
            email: `orchestrator-${counter}@dolphstore.test`,
            password: 'password123',
            firstName: 'Orch',
            lastName: 'Estrator',
            phone: '+15550000002',
        };
    }

    function lastSentCode(): string {
        const call = emailService.sendTemplate.mock.calls.at(-1);
        return call[1].code;
    }

    async function registerAndVerify(credentials: RegisterDto) {
        await iamService.register(credentials);
        const code = lastSentCode();
        return iamService.verifyEmail(credentials.email, code);
    }

    it('registers a new user without issuing tokens, and sends a verification code', async () => {
        const credentials = nextCredentials();
        const result = await iamService.register(credentials);

        expect(result.user.email).toBe(credentials.email);
        expect((result.user as any).password).toBeUndefined();
        expect((result as any).accessToken).toBeUndefined();

        expect(emailService.sendTemplate).toHaveBeenCalledWith(
            'verify-email',
            { firstName: credentials.firstName, code: expect.stringMatching(/^\d{6}$/) },
            { to: credentials.email, subject: 'Verify your email' },
        );
    });

    it('still registers the user when the verification email fails to send', async () => {
        emailService.sendTemplate.mockRejectedValueOnce(new Error('provider unreachable'));
        const credentials = nextCredentials();

        const result = await iamService.register(credentials);
        expect(result.user.email).toBe(credentials.email);
    });

    it('rejects registering the same email twice', async () => {
        const credentials = nextCredentials();
        await iamService.register(credentials);
        await expect(iamService.register(credentials)).rejects.toThrow(/already exists/);
    });

    it('rejects login before the email is verified', async () => {
        const credentials = nextCredentials();
        await iamService.register(credentials);

        await expect(iamService.login({ email: credentials.email, password: credentials.password })).rejects.toThrow(
            /verify your email/,
        );
    });

    it('verifyEmail rejects an incorrect code', async () => {
        const credentials = nextCredentials();
        await iamService.register(credentials);

        await expect(iamService.verifyEmail(credentials.email, '000000')).rejects.toThrow(/invalid or expired code/);
    });

    it('verifyEmail succeeds and returns tokens, allowing login afterward', async () => {
        const credentials = nextCredentials();
        const result = await registerAndVerify(credentials);

        expect(result.user.email).toBe(credentials.email);
        expect(result.accessToken).toBeDefined();
        expect(result.refreshToken).toBeDefined();

        const login = await iamService.login({ email: credentials.email, password: credentials.password });
        expect(login.accessToken).toBeDefined();
    });

    it('verifyEmail rejects an already-verified email', async () => {
        const credentials = nextCredentials();
        await registerAndVerify(credentials);

        await expect(iamService.verifyEmail(credentials.email, '123456')).rejects.toThrow(/already verified/);
    });

    it('resendVerificationCode issues a new code for an unverified user, once the cooldown has passed', async () => {
        const credentials = nextCredentials();
        const { user } = await iamService.register(credentials);

        await dataSource
            .getRepository(EmailVerificationCode)
            .update({ userId: user.id }, { createdAt: new Date(Date.now() - 61_000) });

        const result = await iamService.resendVerificationCode(credentials.email);
        expect(result.message).toMatch(/if an account/i);
        expect(emailService.sendTemplate).toHaveBeenCalledTimes(2);
    });

    it('resendVerificationCode is a silent no-op within the cooldown window', async () => {
        const credentials = nextCredentials();
        await iamService.register(credentials);

        await iamService.resendVerificationCode(credentials.email);
        expect(emailService.sendTemplate).toHaveBeenCalledTimes(1);
    });

    it('resendVerificationCode is a no-op for an already-verified or unknown email, without leaking which', async () => {
        const credentials = nextCredentials();
        await registerAndVerify(credentials);
        emailService.sendTemplate.mockClear();

        const verified = await iamService.resendVerificationCode(credentials.email);
        const unknown = await iamService.resendVerificationCode('nobody@dolphstore.test');

        expect(verified.message).toBe(unknown.message);
        expect(emailService.sendTemplate).not.toHaveBeenCalled();
    });

    it('rejects login with the wrong password', async () => {
        const credentials = nextCredentials();
        await registerAndVerify(credentials);

        await expect(iamService.login({ email: credentials.email, password: 'wrong-password' })).rejects.toThrow(
            /invalid email or password/,
        );
    });

    it('rejects login for an unknown email', async () => {
        await expect(iamService.login({ email: 'nobody@dolphstore.test', password: 'whatever123' })).rejects.toThrow();
    });

    it('refresh rotates the token pair and old refresh token stops working', async () => {
        const credentials = nextCredentials();
        await registerAndVerify(credentials);
        const { refreshToken } = await iamService.login({ email: credentials.email, password: credentials.password });

        const rotated = await iamService.refresh(refreshToken);
        expect(rotated.accessToken).toBeDefined();
        expect(rotated.refreshToken).not.toBe(refreshToken);

        await expect(iamService.refresh(refreshToken)).rejects.toThrow(/invalid or expired refresh token/);
    });

    it('logout revokes the refresh token used', async () => {
        const credentials = nextCredentials();
        await registerAndVerify(credentials);
        const { refreshToken } = await iamService.login({ email: credentials.email, password: credentials.password });

        await iamService.logout(refreshToken);

        await expect(iamService.refresh(refreshToken)).rejects.toThrow();
    });

    it('logoutAll revokes every outstanding refresh token for the user', async () => {
        const credentials = nextCredentials();
        await registerAndVerify(credentials);

        const a = await iamService.login({ email: credentials.email, password: credentials.password });
        const b = await iamService.login({ email: credentials.email, password: credentials.password });

        await iamService.logoutAll(a.user.id);

        await expect(iamService.refresh(a.refreshToken)).rejects.toThrow();
        await expect(iamService.refresh(b.refreshToken)).rejects.toThrow();
    });

    it('me returns the current safe user profile', async () => {
        const credentials = nextCredentials();
        await registerAndVerify(credentials);
        const { user } = await iamService.login({ email: credentials.email, password: credentials.password });

        const me = await iamService.me(user.id);

        expect(me.email).toBe(credentials.email);
        expect((me as any).password).toBeUndefined();
    });

    it('me throws for an unknown userId', async () => {
        await expect(iamService.me('00000000-0000-0000-0000-000000000000')).rejects.toThrow(/user not found/);
    });
});
