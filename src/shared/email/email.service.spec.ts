import { EmailProvider } from './email-provider.interface';
import { EmailService } from './email.service';

describe('EmailService', () => {
    let emailService: EmailService;
    let provider: { send: jest.Mock };

    beforeEach(() => {
        emailService = new EmailService();
        provider = { send: jest.fn().mockResolvedValue({ id: 'em_1', status: 'queued' }) };
        (emailService as unknown as { provider: EmailProvider }).provider = provider as unknown as EmailProvider;
    });

    it('send() fills in the default "from" address when the caller omits one', async () => {
        await emailService.send({ to: 'user@example.com', subject: 'Hi', html: '<p>hi</p>' });

        expect(provider.send).toHaveBeenCalledWith(
            expect.objectContaining({ from: 'DolphStore <no-reply@dolphstore.test>', to: 'user@example.com' }),
        );
    });

    it('send() lets the caller override "from"', async () => {
        await emailService.send({ from: 'custom@dolphstore.test', to: 'user@example.com', subject: 'Hi', html: '<p>hi</p>' });

        expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({ from: 'custom@dolphstore.test' }));
    });

    it('sendTemplate() renders the named MJML template and sends the resulting HTML', async () => {
        await emailService.sendTemplate('verify-email', { firstName: 'Amaka', code: '482913' }, { to: 'user@example.com', subject: 'Verify' });

        const call = provider.send.mock.calls[0][0];
        expect(call.html).toContain('Verify your email, Amaka');
        expect(call.html).toContain('482913');
        expect(call.to).toBe('user@example.com');
        expect(call.subject).toBe('Verify');
    });
});
