import { SendByteError } from '@sendbyte/node';
import { EmailSendException } from '../email.errors';
import { SendbyteEmailProvider } from './sendbyte.provider';

const sendMock = jest.fn();

jest.mock('@sendbyte/node', () => {
    const actual = jest.requireActual('@sendbyte/node');
    return {
        ...actual,
        SendByte: jest.fn().mockImplementation(() => ({
            emails: { send: sendMock },
        })),
    };
});

describe('SendbyteEmailProvider', () => {
    beforeEach(() => {
        sendMock.mockReset();
    });

    it('maps EmailMessage fields onto the SendByte SDK request shape', async () => {
        sendMock.mockResolvedValue({ id: 'em_123', status: 'queued' });

        const provider = new SendbyteEmailProvider('sk_test_x');
        const result = await provider.send({
            from: 'DolphStore <no-reply@dolphstore.test>',
            to: 'user@example.com',
            subject: 'Hi',
            html: '<p>hi</p>',
            text: 'hi',
            replyTo: 'support@dolphstore.test',
            idempotencyKey: 'key-1',
        });

        expect(sendMock).toHaveBeenCalledWith(
            expect.objectContaining({
                from: 'DolphStore <no-reply@dolphstore.test>',
                to: 'user@example.com',
                subject: 'Hi',
                html: '<p>hi</p>',
                text: 'hi',
                reply_to: 'support@dolphstore.test',
                idempotency_key: 'key-1',
            }),
        );
        expect(result).toEqual({ id: 'em_123', status: 'queued' });
    });

    it('rejects when "from" is missing', async () => {
        const provider = new SendbyteEmailProvider('sk_test_x');
        await expect(provider.send({ to: 'user@example.com', subject: 'Hi', html: '<p>hi</p>' })).rejects.toThrow(EmailSendException);
        expect(sendMock).not.toHaveBeenCalled();
    });

    it('wraps a SendByteError into an EmailSendException', async () => {
        sendMock.mockRejectedValue(new SendByteError('domain_not_verified', 'Domain not verified', 403));

        const provider = new SendbyteEmailProvider('sk_test_x');

        await expect(
            provider.send({ from: 'a@b.com', to: 'user@example.com', subject: 'Hi', html: '<p>hi</p>' }),
        ).rejects.toMatchObject({
            providerCode: 'domain_not_verified',
        });
    });
});
