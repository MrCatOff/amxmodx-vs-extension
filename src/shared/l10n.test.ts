import * as fs from 'node:fs';
import * as os from 'node:os';
import * as Path from 'node:path';
import * as l10n from '@vscode/l10n';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { initL10n, t } from './l10n.js';

describe('initL10n', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(Path.join(os.tmpdir(), 'amxmodx-l10n-'));
    });
    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        // Reset the l10n bundle so one test doesn't leak into another.
        l10n.config({ contents: '{}' });
    });

    it('loads a bundle for the requested locale', () => {
        fs.writeFileSync(
            Path.join(tmpDir, 'bundle.l10n.uk.json'),
            JSON.stringify({ Success: 'Успіх' }),
        );
        initL10n(tmpDir, 'uk');
        expect(t('Success')).toBe('Успіх');
    });

    it('falls back to language-only bundle for regional locales (uk-UA → uk)', () => {
        fs.writeFileSync(
            Path.join(tmpDir, 'bundle.l10n.uk.json'),
            JSON.stringify({ Success: 'Успіх' }),
        );
        initL10n(tmpDir, 'uk-UA');
        expect(t('Success')).toBe('Успіх');
    });

    it('is a no-op for English', () => {
        fs.writeFileSync(
            Path.join(tmpDir, 'bundle.l10n.en.json'),
            JSON.stringify({ Success: 'Should not load' }),
        );
        initL10n(tmpDir, 'en');
        expect(t('Success')).toBe('Success');
    });

    it('is a no-op when locale is undefined', () => {
        initL10n(tmpDir, undefined);
        expect(t('Success')).toBe('Success');
    });

    it('is a no-op when the bundle file is missing', () => {
        initL10n(tmpDir, 'uk');
        expect(t('Success')).toBe('Success');
    });

    it('interpolates positional arguments after translation', () => {
        fs.writeFileSync(
            Path.join(tmpDir, 'bundle.l10n.uk.json'),
            JSON.stringify({ 'Output: {0}': 'Вивід: {0}' }),
        );
        initL10n(tmpDir, 'uk');
        expect(t('Output: {0}', '/tmp/a.amxx')).toBe('Вивід: /tmp/a.amxx');
    });
});
