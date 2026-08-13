import { DolphControllerHandler } from '@dolphjs/dolph/classes';
import { Dolph } from '@dolphjs/dolph/common';
import { DBody, DHeaders, DPayload, Get, Post, Route, UseMiddleware } from '@dolphjs/dolph/decorators';
import { JwtPayload } from '../../shared/interfaces';
import { LoginDto, RefreshTokenDto, RegisterDto } from './iam.dto';
import { IamService } from './iam.service';
import { authShield } from './iam.shield';

@Route('auth')
export class IamController extends DolphControllerHandler<Dolph> {
    constructor(private iamService: IamService) {
        super();
    }

    @Post('register')
    async register(@DBody(RegisterDto) body: RegisterDto, @DHeaders() headers: Record<string, string>) {
        return this.iamService.register(body, headers['user-agent']);
    }

    @Post('login')
    async login(@DBody(LoginDto) body: LoginDto, @DHeaders() headers: Record<string, string>) {
        return this.iamService.login(body, headers['user-agent']);
    }

    @Post('refresh')
    async refresh(@DBody(RefreshTokenDto) body: RefreshTokenDto, @DHeaders() headers: Record<string, string>) {
        return this.iamService.refresh(body.refreshToken, headers['user-agent']);
    }

    @UseMiddleware(authShield)
    @Post('logout')
    async logout(@DBody(RefreshTokenDto) body: RefreshTokenDto) {
        await this.iamService.logout(body.refreshToken);
        return { message: 'logged out' };
    }

    @UseMiddleware(authShield)
    @Post('logout-all')
    async logoutAll(@DPayload() payload: JwtPayload) {
        await this.iamService.logoutAll(payload.sub);
        return { message: 'logged out of all devices' };
    }

    @UseMiddleware(authShield)
    @Get('me')
    async me(@DPayload() payload: JwtPayload) {
        return this.iamService.me(payload.sub);
    }
}
