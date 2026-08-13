import { DataSource } from 'typeorm';
import { seedSqliteDataSource } from '../../../tests/utils/sqlite-datasource';
import { RefreshToken } from './refresh-token.entity';
import { TokenService } from './token.service';
import { User } from './user.entity';
import { UserService } from './user.service';

describe('TokenService', () => {
    let dataSource: DataSource;
    let userService: UserService;
    let tokenService: TokenService;
    let user: User;

    beforeAll(async () => {
        dataSource = await seedSqliteDataSource([User, RefreshToken]);
        userService = new UserService();
        tokenService = new TokenService();

        user = await userService.create({
            email: 'token-test@dolphstore.test',
            password: 'password123',
            firstName: 'Tok',
            lastName: 'En',
            phone: '+15550000001',
        });
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    it('signs an access token that verifies back to the same user', () => {
        const token = tokenService.signAccessToken(user);
        const payload = tokenService.verifyAccessToken(token);

        expect(payload.sub).toBe(user.id);
        expect(payload.info.email).toBe(user.email);
    });

    it('rejects a tampered access token', () => {
        const token = tokenService.signAccessToken(user);
        expect(() => tokenService.verifyAccessToken(`${token}tampered`)).toThrow();
    });

    it('issues a refresh token, then consumes it exactly once', async () => {
        const refreshToken = await tokenService.issueRefreshToken(user, 'jest');

        const first = await tokenService.verifyAndConsumeRefreshToken(refreshToken);
        expect(first?.userId).toBe(user.id);

        // Rotation: the same token cannot be used a second time.
        const second = await tokenService.verifyAndConsumeRefreshToken(refreshToken);
        expect(second).toBeNull();
    });

    it('rejects an unknown/forged refresh token', async () => {
        const result = await tokenService.verifyAndConsumeRefreshToken('not-a-real-token');
        expect(result).toBeNull();
    });

    it('revokeAllForUser invalidates every live refresh token for that user', async () => {
        const tokenA = await tokenService.issueRefreshToken(user, 'device-a');
        const tokenB = await tokenService.issueRefreshToken(user, 'device-b');

        await tokenService.revokeAllForUser(user.id);

        expect(await tokenService.verifyAndConsumeRefreshToken(tokenA)).toBeNull();
        expect(await tokenService.verifyAndConsumeRefreshToken(tokenB)).toBeNull();
    });
});
