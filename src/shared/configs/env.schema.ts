import Joi from 'joi';

export const envSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'test', 'staging', 'production').default('development'),
    PORT: Joi.number().port().default(3300),
    APP_NAME: Joi.string().default('DolphStore'),
    CORS_ORIGIN: Joi.string().default('*'),


    JWT_ACCESS_SECRET: Joi.string().min(32).required(),
    JWT_ACCESS_EXPIRES_IN: Joi.string()
        .pattern(/^\d+\s?(ms|s|m|h|d|w|y)$/i)
        .default('15m'),
    JWT_REFRESH_SECRET: Joi.string().min(32).required(),
    JWT_REFRESH_EXPIRES_IN: Joi.string()
        .pattern(/^\d+\s?(ms|s|m|h|d|w|y)$/i)
        .default('7d'),
    SQL_HOST: Joi.string().required(),
    SQL_PORT: Joi.number().port().default(5432),
    SQL_USER: Joi.string().required(),
    SQL_PASSWORD: Joi.string().required(),
    SQL_DATABASE: Joi.string().required(),

    EMAIL_PROVIDER: Joi.string().valid('sendbyte').default('sendbyte'),
    EMAIL_FROM: Joi.string().required(),
    SENDBYTE_API_KEY: Joi.string()
        .pattern(/^sk_(test|live)_/)
        .required(),

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
    EMAIL_PROVIDER: 'sendbyte';
    EMAIL_FROM: string;
    SENDBYTE_API_KEY: string;
    PAYSTACK_SECRET_KEY?: string;
    PAYSTACK_PUBLIC_KEY?: string;
    FLUTTERWAVE_SECRET_KEY?: string;
    FLUTTERWAVE_PUBLIC_KEY?: string;
    FLUTTERWAVE_ENCRYPTION_KEY?: string;
};
