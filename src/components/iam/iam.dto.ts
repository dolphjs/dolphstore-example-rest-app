import { IsEmail, IsEnum, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Role } from '../../shared/enums';

export class RegisterDto {
    @IsEmail()
    email!: string;

    @MinLength(8)
    @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
        message: 'password must contain at least one letter and one number',
    })
    password!: string;

    @IsString()
    @MinLength(1)
    firstName!: string;

    @IsString()
    @MinLength(1)
    lastName!: string;

    @IsString()
    @MinLength(1)
    phone!: string;

    // ADMIN is deliberately excluded — see IamService#register.
    @IsIn([Role.USER, Role.AGENT])
    @IsOptional()
    role?: Role;
}

export class LoginDto {
    @IsEmail()
    email!: string;

    @IsString()
    password!: string;
}

export class RefreshTokenDto {
    @IsString()
    refreshToken!: string;
}
