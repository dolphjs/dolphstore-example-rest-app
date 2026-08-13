import * as fs from 'fs';
import * as path from 'path';
import mjml2html from 'mjml';
import Handlebars from 'handlebars';

const compiledTemplates = new Map<string, HandlebarsTemplateDelegate>();

async function compileTemplate(name: string): Promise<HandlebarsTemplateDelegate> {
    const cached = compiledTemplates.get(name);
    if (cached) return cached;

    const filePath = path.join(process.cwd(), 'src/shared/email/templates', `${name}.mjml`);
    const source = fs.readFileSync(filePath, 'utf8');
    const { html, errors } = await mjml2html(source);

    if (errors.length > 0) {
        throw new Error(`Failed to compile email template "${name}": ${errors.map((e) => e.formattedMessage).join('; ')}`);
    }

    const compiled = Handlebars.compile(html);
    compiledTemplates.set(name, compiled);
    return compiled;
}

export async function renderTemplate(name: string, data: Record<string, unknown> = {}): Promise<string> {
    const template = await compileTemplate(name);
    return template(data);
}
