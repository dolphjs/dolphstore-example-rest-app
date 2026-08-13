import { DataSource } from 'typeorm';
import { seedSqliteDataSource } from '../../../tests/utils/sqlite-datasource';
import { Role } from '../../shared/enums';
import { RefreshToken } from './refresh-token.entity';
import { RegisterDto } from './iam.dto';
import { User } from './user.entity';
import { UserService } from './user.service';

describe('UserService', () => {
    let dataSource: DataSource;
    let userService: UserService;

    beforeAll(async () => {
        dataSource = await seedSqliteDataSource([User, RefreshToken]);
        userService = new UserService();
    });

    afterAll(async () => {
        await dataSource.destroy();
    });

    const registerDto: RegisterDto = {
        email: 'jane@dolphstore.test',
        password: 'password123',
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '+15550000000',
    };

    it('creates a user with a hashed password and default role', async () => {
        const user = await userService.create(registerDto);

        expect(user.id).toBeDefined();
        expect(user.email).toBe(registerDto.email);
        expect(user.role).toBe(Role.USER);
        expect(user.password).not.toBe(registerDto.password);
    });

    it('does not return the password on findByEmail', async () => {
        const user = await userService.findByEmail(registerDto.email);
        expect(user).toBeDefined();
        expect((user as any).password).toBeUndefined();
    });

    it('returns the password when explicitly requested', async () => {
        const user = await userService.findByEmailWithPassword(registerDto.email);
        expect(user?.password).toBeDefined();
    });

    it('returns null for an unknown email', async () => {
        const user = await userService.findByEmail('nobody@dolphstore.test');
        expect(user).toBeNull();
    });

    it('toSafeUser strips the password field', async () => {
        const user = await userService.findByEmailWithPassword(registerDto.email);
        const safe = userService.toSafeUser(user!);
        expect((safe as any).password).toBeUndefined();
        expect(safe.email).toBe(registerDto.email);
    });

    it('honors an explicit AGENT role at registration', async () => {
        const agent = await userService.create({ ...registerDto, email: 'agent@dolphstore.test', role: Role.AGENT });
        expect(agent.role).toBe(Role.AGENT);
    });
});
