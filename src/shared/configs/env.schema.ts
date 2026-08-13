import Joi from 'joi';

/**
 * Single source of truth for every environment variable DolphStore reads.
 * Payment provider keys are optional for now — the payments module hasn't
 * been built yet — but are documented here so `.env.example` stays accurate
 * and the schema only needs tightening (`.required()`) once that module
 * lands.
 */
export const envSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'test', 'staging', 'production').default('development'),
    PORT: Joi.number().port().default(3300),
    APP_NAME: Joi.string().default('DolphStore'),
    CORS_ORIGIN: Joi.string().default('*'),

    // Never given a default — a fallback JWT secret compiled into source is
    // a real credential leak waiting to happen, so boot must fail instead.
    JWT_ACCESS_SECRET: Joi.string().min(32).required(),
    JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
    JWT_REFRESH_SECRET: Joi.string().min(32).required(),
    JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

    // Consumed directly by this file, and separately by dolph_config.yaml's
    // `sensitive` credential masking (see docs/techniques/database/typeorm)
    // for SQL_HOST/SQL_USER/SQL_PASSWORD. SQL_PORT/SQL_DATABASE aren't
    // covered by that masking mechanism, so dolph_config.yaml's `port`/
    // `database` fields must be kept in sync with these by hand.
    SQL_HOST: Joi.string().required(),
    SQL_PORT: Joi.number().port().default(5432),
    SQL_USER: Joi.string().required(),
    SQL_PASSWORD: Joi.string().required(),
    SQL_DATABASE: Joi.string().required(),

    // `.allow('')` matters here: an unfilled placeholder in .env.example
    // (`PAYSTACK_SECRET_KEY=`) parses as an empty string, not undefined —
    // without this, Joi treats that as an invalid string and boot fails
    // even though these keys are meant to be optional for now.
    PAYSTACK_SECRET_KEY: Joi.string().allow('').optional(),
    PAYSTACK_PUBLIC_KEY: Joi.string().allow('').optional(),
    FLUTTERWAVE_SECRET_KEY: Joi.string().allow('').optional(),
    FLUTTERWAVE_PUBLIC_KEY: Joi.string().allow('').optional(),
    FLUTTERWAVE_ENCRYPTION_KEY: Joi.string().allow('').optional(),
}).unknown(true);

export type EnvVars = {
    NODE_ENV: 'development' | 'test' | 'staging' | 'production';
    PORT: number;
    APP_NAME: string;
    CORS_ORIGIN: string;
    JWT_ACCESS_SECRET: string;
    JWT_ACCESS_EXPIRES_IN: string;
    JWT_REFRESH_SECRET: string;
    JWT_REFRESH_EXPIRES_IN: string;
    SQL_HOST: string;
    SQL_PORT: number;
    SQL_USER: string;
    SQL_PASSWORD: string;
    SQL_DATABASE: string;
    PAYSTACK_SECRET_KEY?: string;
    PAYSTACK_PUBLIC_KEY?: string;
    FLUTTERWAVE_SECRET_KEY?: string;
    FLUTTERWAVE_PUBLIC_KEY?: string;
    FLUTTERWAVE_ENCRYPTION_KEY?: string;
};
