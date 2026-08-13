import { DolphServiceHandler } from '@dolphjs/dolph/classes';
import { Dolph } from '@dolphjs/dolph/common';
import { DService } from '@dolphjs/dolph/decorators';
import { getDataSource } from '@dolphjs/dolph/packages/typeorm';
import { hashString } from '@dolphjs/dolph/utilities';
import { RegisterDto } from './iam.dto';
import { User } from './user.entity';

/**
 * Lower-level service — no controller talks to this directly. IamService
 * (the upper-level service) is the only consumer; see the README's
 * "Services: upper-level vs lower-level" section.
 */
@DService()
export class UserService extends DolphServiceHandler<Dolph> {
    constructor() {
        super('userService');
    }

    // Getter, not a field initializer — see the caution in
    // docs/techniques/database/typeorm.mdx. @Component constructs every
    // listed service at module-import time, before DolphFactory (and thus
    // autoInitTypeOrm) has run.
    private get repo() {
        return getDataSource().getRepository(User);
    }

    async findByEmail(email: string): Promise<User | null> {
        return this.repo.findOne({ where: { email } });
    }

    async findByEmailWithPassword(email: string): Promise<User | null> {
        return this.repo.createQueryBuilder('user').addSelect('user.password').where('user.email = :email', { email }).getOne();
    }

    async findById(id: string): Promise<User | null> {
        return this.repo.findOne({ where: { id } });
    }

    async create(dto: RegisterDto): Promise<User> {
        const user = this.repo.create({
            email: dto.email,
            password: await hashString(dto.password),
            firstName: dto.firstName,
            lastName: dto.lastName,
            phone: dto.phone,
            role: dto.role,
        });

        return this.repo.save(user);
    }

    toSafeUser(user: User) {
        const { password, ...safeUser } = user;
        return safeUser;
    }
}
