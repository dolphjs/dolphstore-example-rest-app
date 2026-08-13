export interface EmailAttachment {
    filename: string;
    content: string;
    contentType: string;
}

export interface EmailMessage {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    from?: string;
    cc?: string | string[];
    bcc?: string | string[];
    replyTo?: string | string[];
    attachments?: EmailAttachment[];
    idempotencyKey?: string;
}

export interface EmailSendResult {
    id: string;
    status: string;
}

export interface EmailProvider {
    send(message: EmailMessage): Promise<EmailSendResult>;
}
