import { renderTemplate } from './template-renderer';

describe('renderTemplate', () => {
    it('compiles the verify-email MJML template and interpolates data', async () => {
        const html = await renderTemplate('verify-email', { firstName: 'Amaka', code: '482913' });

        expect(html).toContain('<!doctype html>');
        expect(html).toContain('Verify your email, Amaka');
        expect(html).toContain('482913');
    });

    it('returns the same output on repeated calls (cached compile)', async () => {
        const first = await renderTemplate('verify-email', { firstName: 'Bo', code: '111111' });
        const second = await renderTemplate('verify-email', { firstName: 'Bo', code: '111111' });

        expect(first).toBe(second);
    });

    it('throws for an unknown template', async () => {
        await expect(renderTemplate('does-not-exist', {})).rejects.toThrow();
    });
});
