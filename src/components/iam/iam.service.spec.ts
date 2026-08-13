import { DataSource } from 'typeorm';
import { seedSqliteDataSource } from '../../../tests/utils/sqlite-datasource';
import { EmailService } from '../../shared/email';
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

    const credentials: RegisterDto = {
        email: 'orchestrator@dolphstore.test',
        password: 'password123',
        firstName: 'Orch',
        lastName: 'Estrator',
        phone: '+15550000002',
    };

    beforeAll(async () => {
        dataSource = await seedSqliteDataSource([User, RefreshToken]);
    });

    beforeEach(() => {
        emailService = {
            sendTemplate: jest.fn().mockResolvedValue({ id: 'em_mock', status: 'queued' }),
            send: jest.fn().mockResolvedValue({ id: 'em_mock', status: 'queued' }),
        };
        iamService = new IamService(new UserService(), new TokenService(), emailService as unknown as EmailService);
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    it('registers a new user, returns tokens, and sends a welcome email', async () => {
        const result = await iamService.register(credentials, 'jest');

        expect(result.user.email).toBe(credentials.email);
        expect((result.user as any).password).toBeUndefined();
        expect(result.accessToken).toBeDefined();
        expect(result.refreshToken).toBeDefined();

        expect(emailService.sendTemplate).toHaveBeenCalledWith(
            'welcome',
            { firstName: credentials.firstName },
            { to: credentials.email, subject: 'Welcome to DolphStore' },
        );
    });

    it('still registers the user when the welcome email fails to send', async () => {
        emailService.sendTemplate.mockRejectedValueOnce(new Error('provider unreachable'));

        const result = await iamService.register({ ...credentials, email: 'email-failure@dolphstore.test' }, 'jest');

        expect(result.user.email).toBe('email-failure@dolphstore.test');
    });

    it('rejects registering the same email twice', async () => {
        await expect(iamService.register(credentials, 'jest')).rejects.toThrow(/already exists/);
    });

    it('logs in with correct credentials', async () => {
        const result = await iamService.login({ email: credentials.email, password: credentials.password }, 'jest');
        expect(result.user.email).toBe(credentials.email);
    });

    it('rejects login with the wrong password', async () => {
        await expect(iamService.login({ email: credentials.email, password: 'wrong-password' })).rejects.toThrow(
            /invalid email or password/,
        );
    });

    it('rejects login for an unknown email', async () => {
        await expect(iamService.login({ email: 'nobody@dolphstore.test', password: 'whatever123' })).rejects.toThrow();
    });

    it('refresh rotates the token pair and old refresh token stops working', async () => {
        const { refreshToken } = await iamService.login({ email: credentials.email, password: credentials.password });

        const rotated = await iamService.refresh(refreshToken);
        expect(rotated.accessToken).toBeDefined();
        expect(rotated.refreshToken).not.toBe(refreshToken);

        await expect(iamService.refresh(refreshToken)).rejects.toThrow(/invalid or expired refresh token/);
    });

    it('logout revokes the refresh token used', async () => {
        const { refreshToken } = await iamService.login({ email: credentials.email, password: credentials.password });

        await iamService.logout(refreshToken);

        await expect(iamService.refresh(refreshToken)).rejects.toThrow();
    });

    it('logoutAll revokes every outstanding refresh token for the user', async () => {
        const a = await iamService.login({ email: credentials.email, password: credentials.password });
        const b = await iamService.login({ email: credentials.email, password: credentials.password });

        const me = await iamService.me((await iamService.login({ email: credentials.email, password: credentials.password })).user.id);
        await iamService.logoutAll(me.id);

        await expect(iamService.refresh(a.refreshToken)).rejects.toThrow();
        await expect(iamService.refresh(b.refreshToken)).rejects.toThrow();
    });

    it('me returns the current safe user profile', async () => {
        const { user } = await iamService.login({ email: credentials.email, password: credentials.password });
        const me = await iamService.me(user.id);

        expect(me.email).toBe(credentials.email);
        expect((me as any).password).toBeUndefined();
    });

    it('me throws for an unknown userId', async () => {
        await expect(iamService.me('00000000-0000-0000-0000-000000000000')).rejects.toThrow(/user not found/);
    });
});
