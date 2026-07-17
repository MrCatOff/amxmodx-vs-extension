import { describe, expect, it } from 'vitest';
import { tokenize, type PreprocessorToken } from './tokenizer.js';

describe('tokenizer', () => {
    it('skips line comments', () => {
        const tokens = tokenize('// ignored\nfoo');
        expect(tokens.map((t) => t.kind)).toEqual(['ident', 'eof']);
        expect(tokens[0].value).toBe('foo');
    });

    it('skips regular block comments', () => {
        const tokens = tokenize('/* skip */ foo');
        expect(tokens[0].value).toBe('foo');
    });

    it('preserves /** */ doc comments', () => {
        const tokens = tokenize('/** hello */\nfoo');
        expect(tokens[0].kind).toBe('doc-comment');
        expect(tokens[0].value).toBe('/** hello */');
    });

    it('extracts preprocessor lines with directive', () => {
        const tokens = tokenize('#include <amxmodx>\nfoo');
        expect(tokens[0].kind).toBe('preprocessor');
        expect((tokens[0] as PreprocessorToken).directive).toBe('include');
        expect(tokens[0].value).toBe('#include <amxmodx>');
    });

    it('emits identifiers and punctuators', () => {
        const tokens = tokenize('new x = 5;');
        expect(tokens.map((t) => t.kind)).toEqual([
            'ident',
            'ident',
            'punct',
            'number',
            'punct',
            'eof',
        ]);
    });

    it('handles strings including escapes', () => {
        const tokens = tokenize('"hello \\"world\\""');
        expect(tokens[0].kind).toBe('string');
    });

    it('tracks line and column positions', () => {
        const tokens = tokenize('foo\nbar');
        expect(tokens[0].start).toEqual({ line: 0, character: 0 });
        expect(tokens[1].start).toEqual({ line: 1, character: 0 });
    });

    it('recognizes preprocessor after leading whitespace', () => {
        const tokens = tokenize('  #include\n');
        expect(tokens[0].kind).toBe('preprocessor');
    });
});
