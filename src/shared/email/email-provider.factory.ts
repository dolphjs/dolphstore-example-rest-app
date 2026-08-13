import { env } from '../configs';
import { EmailProvider } from './email-provider.interface';
import { SendbyteEmailProvider } from './providers/sendbyte.provider';

export function createEmailProvider(): EmailProvider {
    switch (env.email.provider) {
        case 'sendbyte':
            return new SendbyteEmailProvider(env.email.sendbyteApiKey);
        default:
            throw new Error(`Unsupported email provider: ${env.email.provider}`);
    }
}
