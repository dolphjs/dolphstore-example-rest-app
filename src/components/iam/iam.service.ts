import { DolphServiceHandler } from '@dolphjs/dolph/classes';
import { ConflictException, Dolph, ForbiddenException, NotFoundException, UnauthorizedException } from '@dolphjs/dolph/common';
import { DService } from '@dolphjs/dolph/decorators';
import { compareHashedString, logger } from '@dolphjs/dolph/utilities';
import { EmailService } from '../../shared/email';
import { EmailVerificationService } from './email-verification.service';
import { LoginDto, RegisterDto } from './iam.dto';
import { TokenService } from './token.service';
import { User } from './user.entity';
import { UserService } from './user.service';

/**
 * Upper-level service — the only one IamController talks to. Orchestrates
 * UserService, TokenService, EmailService, and EmailVerificationService
 * (all lower-level); see the README's "Services: upper-level vs
 * lower-level" section.
 */
@DService()
export class IamService extends DolphServiceHandler<Dolph> {
    constructor(
        private userService: UserService,
        private tokenService: TokenService,
        private emailService: EmailService,
        private emailVerificationService: EmailVerificationService,
    ) {
        super('iamService');
    }

    private async issueAndSendVerificationCode(user: User): Promise<void> {
        const code = await this.emailVerificationService.issueCode(user.id);
        if (!code) return;

        this.emailService
            .sendTemplate('verify-email', { firstName: user.firstName, code }, { to: user.email, subject: 'Verify your email' })
            .catch((err) => logger.error(`Failed to send verification email to ${user.email}: ${err.message}`));
    }

    async register(dto: RegisterDto) {
        const existing = await this.userService.findByEmail(dto.email);
        if (existing) throw new ConflictException('an account with this email already exists');

        const user = await this.userService.create(dto);
        await this.issueAndSendVerificationCode(user);

        return { message: 'Registration successful. Check your email for a verification code.', user: this.userService.toSafeUser(user) };
    }

    async login(dto: LoginDto, userAgent?: string) {
        const user = await this.userService.findByEmailWithPassword(dto.email);
        if (!user || !compareHashedString(dto.password, user.password)) {
            throw new UnauthorizedException('invalid email or password');
        }
        if (!user.emailVerifiedAt) {
            throw new ForbiddenException('please verify your email before logging in');
        }

        const accessToken = this.tokenService.signAccessToken(user);
        const refreshToken = await this.tokenService.issueRefreshToken(user, userAgent);

        return { user: this.userService.toSafeUser(user), accessToken, refreshToken };
    }

    async verifyEmail(email: string, code: string, userAgent?: string) {
        const user = await this.userService.findByEmail(email);
        if (!user) throw new UnauthorizedException('invalid or expired code');
        if (user.emailVerifiedAt) throw new ConflictException('email already verified');

        const valid = await this.emailVerificationService.verifyCode(user.id, code);
        if (!valid) throw new UnauthorizedException('invalid or expired code');

        await this.userService.markEmailVerified(user.id);
        const verifiedUser = (await this.userService.findById(user.id))!;

        const accessToken = this.tokenService.signAccessToken(verifiedUser);
        const refreshToken = await this.tokenService.issueRefreshToken(verifiedUser, userAgent);

        return { user: this.userService.toSafeUser(verifiedUser), accessToken, refreshToken };
    }

    async resendVerificationCode(email: string) {
        const user = await this.userService.findByEmail(email);
        if (user && !user.emailVerifiedAt) {
            await this.issueAndSendVerificationCode(user);
        }

        return { message: 'If an account with this email exists and is not yet verified, a new code has been sent.' };
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
