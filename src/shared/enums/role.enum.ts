/**
 * Platform-wide user roles. Referenced by the JWT payload (see
 * `JwtPayload`) and by authorization checks in route shields/guards once
 * the IAM module is built.
 */
export enum Role {
    ADMIN = 'admin',
    AGENT = 'agent',
    USER = 'user',
}
