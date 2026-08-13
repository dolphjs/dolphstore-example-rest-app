import * as dotenv from 'dotenv';
import * as path from 'path';
import { envSchema, EnvVars } from './env.schema';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const { error, value: vars } = envSchema.validate(process.env, {
    abortEarly: false,
    stripUnknown: true,
});

if (error) {
    const details = error.details.map((detail) => `  - ${detail.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
}

const validatedVars = vars as EnvVars;

export const env = Object.freeze({
    app: {
        nodeEnv: validatedVars.NODE_ENV,
        port: validatedVars.PORT,
        name: validatedVars.APP_NAME,
        corsOrigin: validatedVars.CORS_ORIGIN,
        isProduction: validatedVars.NODE_ENV === 'production',
        isDevelopment: validatedVars.NODE_ENV === 'development',
        isTest: validatedVars.NODE_ENV === 'test',
    },
    jwt: {
        accessSecret: validatedVars.JWT_ACCESS_SECRET,
        accessExpiresIn: validatedVars.JWT_ACCESS_EXPIRES_IN,
        refreshSecret: validatedVars.JWT_REFRESH_SECRET,
        refreshExpiresIn: validatedVars.JWT_REFRESH_EXPIRES_IN,
    },
    database: {
        host: validatedVars.SQL_HOST,
        port: validatedVars.SQL_PORT,
        username: validatedVars.SQL_USER,
        password: validatedVars.SQL_PASSWORD,
        name: validatedVars.SQL_DATABASE,
    },
    payments: {
        paystack: {
            secretKey: validatedVars.PAYSTACK_SECRET_KEY,
            publicKey: validatedVars.PAYSTACK_PUBLIC_KEY,
        },
        flutterwave: {
            secretKey: validatedVars.FLUTTERWAVE_SECRET_KEY,
            publicKey: validatedVars.FLUTTERWAVE_PUBLIC_KEY,
            encryptionKey: validatedVars.FLUTTERWAVE_ENCRYPTION_KEY,
        },
    },
});

export type Env = typeof env;
