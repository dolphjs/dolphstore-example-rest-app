import { SendByte, SendByteError } from '@sendbyte/node';
import { EmailMessage, EmailProvider, EmailSendResult } from '../email-provider.interface';
import { EmailSendException } from '../email.errors';

export class SendbyteEmailProvider implements EmailProvider {
    private client: SendByte;

    constructor(apiKey: string) {
        this.client = new SendByte(apiKey);
    }

    async send(message: EmailMessage): Promise<EmailSendResult> {
        if (!message.from) {
            throw new EmailSendException('"from" is required to send an email');
        }

        try {
            const result = await this.client.emails.send({
                from: message.from,
                to: message.to,
                subject: message.subject,
                html: message.html,
                text: message.text,
                cc: message.cc,
                bcc: message.bcc,
                reply_to: message.replyTo,
                attachments: message.attachments?.map((attachment) => ({
                    filename: attachment.filename,
                    content: attachment.content,
                    content_type: attachment.contentType,
                })),
                idempotency_key: message.idempotencyKey,
            });

            return { id: result.id, status: result.status };
        } catch (err) {
            if (err instanceof SendByteError) {
                throw new EmailSendException(err.message, err.code);
            }
            throw err;
        }
    }
}
