import { describe, expect, it } from 'vitest';
import { fuzzy, isAlpha, isAlphaNum, isDigit, isWhitespace, reverse } from './strings.js';

describe('shared/strings', () => {
    it('classifies characters', () => {
        expect(isAlpha('a')).toBe(true);
        expect(isAlpha('Z')).toBe(true);
        expect(isAlpha('_')).toBe(true);
        expect(isAlpha('@')).toBe(true);
        expect(isAlpha('0')).toBe(false);
        expect(isAlpha(' ')).toBe(false);
        expect(isAlpha(undefined)).toBe(false);

        expect(isDigit('0')).toBe(true);
        expect(isDigit('9')).toBe(true);
        expect(isDigit('a')).toBe(false);
        expect(isDigit(undefined)).toBe(false);

        expect(isAlphaNum('a')).toBe(true);
        expect(isAlphaNum('7')).toBe(true);
        expect(isAlphaNum('_')).toBe(true);
        expect(isAlphaNum('.')).toBe(false);

        expect(isWhitespace(' ')).toBe(true);
        expect(isWhitespace('\t')).toBe(true);
        expect(isWhitespace('\n')).toBe(true);
        expect(isWhitespace('a')).toBe(false);
    });

    it('reverses strings including empties', () => {
        expect(reverse('abc')).toBe('cba');
        expect(reverse('')).toBe('');
    });

    it('fuzzy matches subsequences case-insensitively', () => {
        expect(fuzzy('client_print', 'cli')).toBe(true);
        expect(fuzzy('client_print', 'cp')).toBe(true);
        expect(fuzzy('client_print', 'cpr')).toBe(true);
        expect(fuzzy('client_print', 'xyz')).toBe(false);
        expect(fuzzy('CLIENT_PRINT', 'client')).toBe(true);
        expect(fuzzy('abc', 'a b c')).toBe(true);
    });
});
