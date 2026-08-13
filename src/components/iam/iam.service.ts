import { DolphServiceHandler } from '@dolphjs/dolph/classes';
import { ConflictException, Dolph, NotFoundException, UnauthorizedException } from '@dolphjs/dolph/common';
import { DService } from '@dolphjs/dolph/decorators';
import { compareHashedString, logger } from '@dolphjs/dolph/utilities';
import { EmailService } from '../../shared/email';
import { LoginDto, RegisterDto } from './iam.dto';
import { TokenService } from './token.service';
import { UserService } from './user.service';

/**
 * Upper-level service — the only one IamController talks to. Orchestrates
 * UserService and TokenService (both lower-level); see the README's
 * "Services: upper-level vs lower-level" section.
 */
@DService()
export class IamService extends DolphServiceHandler<Dolph> {
    constructor(
        private userService: UserService,
        private tokenService: TokenService,
        private emailService: EmailService,
    ) {
        super('iamService');
    }

    async register(dto: RegisterDto, userAgent?: string) {
        const existing = await this.userService.findByEmail(dto.email);
        if (existing) throw new ConflictException('an account with this email already exists');

        const user = await this.userService.create(dto);
        const accessToken = this.tokenService.signAccessToken(user);
        const refreshToken = await this.tokenService.issueRefreshToken(user, userAgent);

        this.emailService
            .sendTemplate('welcome', { firstName: user.firstName }, { to: user.email, subject: 'Welcome to DolphStore' })
            .catch((err) => logger.error(`Failed to send welcome email to ${user.email}: ${err.message}`));

        return { user: this.userService.toSafeUser(user), accessToken, refreshToken };
    }

    async login(dto: LoginDto, userAgent?: string) {
        const user = await this.userService.findByEmailWithPassword(dto.email);
        if (!user || !compareHashedString(dto.password, user.password)) {
            throw new UnauthorizedException('invalid email or password');
        }

        const accessToken = this.tokenService.signAccessToken(user);
        const refreshToken = await this.tokenService.issueRefreshToken(user, userAgent);

        return { user: this.userService.toSafeUser(user), accessToken, refreshToken };
    }

    async refresh(refreshToken: string, userAgent?: string) {
        const consumed = await this.tokenService.verifyAndConsumeRefreshToken(refreshToken);
        if (!consumed) throw new UnauthorizedException('invalid or expired refresh token');

        const user = await this.userService.findById(consumed.userId);
        if (!user) throw new UnauthorizedException('invalid or expired refresh token');

        const accessToken = this.tokenService.signAccessToken(user);
        const newRefreshToken = await this.tokenService.issueRefreshToken(user, userAgent);

        return { accessToken, refreshToken: newRefreshToken };
    }

    async logout(refreshToken: string) {
        const consumed = await this.tokenService.verifyAndConsumeRefreshToken(refreshToken);
        if (!consumed) throw new UnauthorizedException('invalid or expired refresh token');
    }

    async logoutAll(userId: string) {
        await this.tokenService.revokeAllForUser(userId);
    }

    async me(userId: string) {
        const user = await this.userService.findById(userId);
        if (!user) throw new NotFoundException('user not found');
        return this.userService.toSafeUser(user);
    }
}
