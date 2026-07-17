import * as fs from 'node:fs';
import * as Path from 'node:path';
import * as l10n from '@vscode/l10n';

/**
 * Re-export the `t` translation function from `@vscode/l10n` so consumers can
 * `import { t } from '../shared/l10n.js'` and get consistent translation
 * behaviour on both the client and the server side.
 *
 * When no bundle has been configured (e.g. in vitest unit tests) `t(source)`
 * returns the source string verbatim, so every call site is safe to use
 * unconditionally.
 *
 * @example
 * import { t } from '../../shared/l10n.js';
 * outputChannel.appendLine(t('Success'));
 * outputChannel.appendLine(t('Output: {0}', outputPath));
 */
export const t = l10n.t;

/**
 * Initialize the `@vscode/l10n` translation bundle by loading
 * `bundle.l10n.<locale>.json` from `bundleDir`. Missing files or bad JSON are
 * ignored — untranslated calls to {@link t} simply return the source string.
 *
 * Callers should invoke this exactly once at startup:
 * - Client: inside `activate()` with `vscode.env.language`.
 * - Server: inside `onInitialize` with `params.locale`.
 *
 * @example
 * initL10n(ctx.asAbsolutePath('l10n'), vscode.env.language);
 * // Now `t('Success')` returns 'Успіх' when the user's UI language is `uk`.
 */
export function initL10n(bundleDir: string, locale: string | undefined): void {
    const normalized = normalizeLocale(locale);
    if (!normalized || normalized === 'en') return;

    const candidates = [
        `bundle.l10n.${normalized}.json`,
        `bundle.l10n.${normalized.split('-')[0]}.json`,
    ];
    for (const name of candidates) {
        const file = Path.join(bundleDir, name);
        try {
            const raw = fs.readFileSync(file, 'utf-8');
            l10n.config({ contents: raw });
            return;
        } catch {
            continue;
        }
    }
}

function normalizeLocale(locale: string | undefined): string | undefined {
    if (!locale) return undefined;
    return locale.toLowerCase().replace('_', '-');
}
