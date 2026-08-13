import { renderTemplate } from './template-renderer';

describe('renderTemplate', () => {
    it('compiles the welcome MJML template and interpolates data', async () => {
        const html = await renderTemplate('welcome', { firstName: 'Amaka' });

        expect(html).toContain('<!doctype html>');
        expect(html).toContain('Welcome to DolphStore, Amaka!');
    });

    it('returns the same output on repeated calls (cached compile)', async () => {
        const first = await renderTemplate('welcome', { firstName: 'Bo' });
        const second = await renderTemplate('welcome', { firstName: 'Bo' });

        expect(first).toBe(second);
    });

    it('throws for an unknown template', async () => {
        await expect(renderTemplate('does-not-exist', {})).rejects.toThrow();
    });
});
