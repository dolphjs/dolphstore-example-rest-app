import { DolphServiceHandler } from '@dolphjs/dolph/classes';
import { Dolph } from '@dolphjs/dolph/common';
import { DService } from '@dolphjs/dolph/decorators';
import { env } from '../configs';
import { createEmailProvider } from './email-provider.factory';
import { EmailMessage, EmailProvider, EmailSendResult } from './email-provider.interface';
import { renderTemplate } from './template-renderer';

@DService()
export class EmailService extends DolphServiceHandler<Dolph> {
    private provider: EmailProvider;

    constructor() {
        super('emailService');
        this.provider = createEmailProvider();
    }

    async send(message: EmailMessage): Promise<EmailSendResult> {
        return this.provider.send({ from: env.email.from, ...message });
    }

    async sendTemplate(
        templateName: string,
        data: Record<string, unknown>,
        message: Omit<EmailMessage, 'html'>,
    ): Promise<EmailSendResult> {
        const html = await renderTemplate(templateName, data);
        return this.send({ ...message, html });
    }
}
