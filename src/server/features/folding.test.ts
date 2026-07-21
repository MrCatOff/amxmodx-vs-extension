import { describe, expect, it } from 'vitest';
import { FoldingRangeKind } from 'vscode-languageserver/node.js';
import { provideFoldingRanges } from './folding.js';

describe('folding ranges', () => {
    describe('// #region markers', () => {
        it('folds a region/endregion pair', () => {
            const src = ['// #region API', 'foo()', 'bar()', '// #endregion', ''].join('\n');
            const r = provideFoldingRanges(src);
            expect(r).toEqual([
                { startLine: 0, endLine: 3, kind: FoldingRangeKind.Region },
            ]);
        });

        it('accepts the hash-less variant', () => {
            const src = ['// region', 'x', '// endregion'].join('\n');
            const r = provideFoldingRanges(src);
            expect(r).toEqual([
                { startLine: 0, endLine: 2, kind: FoldingRangeKind.Region },
            ]);
        });

        it('nests region pairs correctly', () => {
            const src = [
                '// #region outer',
                '// #region inner',
                'body',
                '// #endregion',
                '// #endregion',
            ].join('\n');
            const r = provideFoldingRanges(src);
            expect(r).toContainEqual({ startLine: 1, endLine: 3, kind: FoldingRangeKind.Region });
            expect(r).toContainEqual({ startLine: 0, endLine: 4, kind: FoldingRangeKind.Region });
        });

        it('ignores a stray #endregion', () => {
            const src = ['a', '// #endregion'].join('\n');
            expect(provideFoldingRanges(src)).toEqual([]);
        });
    });

    describe('banner comments', () => {
        it('folds from one dash-bracket banner to the line before the next', () => {
            const src = [
                '/*--------[ Section A ]--------*/', // 0
                'a',                                 // 1
                'b',                                 // 2
                '/*--------[ Section B ]--------*/', // 3
                'c',                                 // 4
                'd',                                 // 5
            ].join('\n');
            const r = provideFoldingRanges(src);
            expect(r).toContainEqual({ startLine: 0, endLine: 2, kind: FoldingRangeKind.Region });
            expect(r).toContainEqual({ startLine: 3, endLine: 5, kind: FoldingRangeKind.Region });
        });

        it('folds the last banner to EOF', () => {
            const src = ['/*--[ Only ]--*/', 'x', 'y', ''].join('\n');
            const r = provideFoldingRanges(src);
            expect(r).toEqual([
                { startLine: 0, endLine: 3, kind: FoldingRangeKind.Region },
            ]);
        });

        it('also recognises the `/* = Label = */` equals-style banner', () => {
            const src = [
                '/* = Header = */', // 0
                'contents',         // 1
                '/* = Next = */',   // 2
                'more',             // 3
            ].join('\n');
            const r = provideFoldingRanges(src);
            // endLine points at the last hidden line: collapsing 0..1 hides the
            // section body but leaves the next banner (line 2) visible.
            expect(r).toContainEqual({ startLine: 0, endLine: 1, kind: FoldingRangeKind.Region });
            expect(r).toContainEqual({ startLine: 2, endLine: 3, kind: FoldingRangeKind.Region });
        });

        it('does not fold when a banner is followed immediately by the next banner', () => {
            const src = ['/*--[ A ]--*/', '/*--[ B ]--*/', 'x'].join('\n');
            const r = provideFoldingRanges(src);
            // First banner has nothing between it and the second → no range.
            // Second banner folds to EOF.
            expect(r).toEqual([
                { startLine: 1, endLine: 2, kind: FoldingRangeKind.Region },
            ]);
        });
    });

    it('combines region pairs and banners in one document', () => {
        const src = [
            '/*--[ Setup ]--*/', // 0
            'init()',            // 1
            '// #region Loop',   // 2
            'body()',            // 3
            '// #endregion',     // 4
            'cleanup()',         // 5
        ].join('\n');
        const r = provideFoldingRanges(src);
        expect(r).toContainEqual({ startLine: 2, endLine: 4, kind: FoldingRangeKind.Region });
        expect(r).toContainEqual({ startLine: 0, endLine: 5, kind: FoldingRangeKind.Region });
    });

    it('returns an empty array for an empty document', () => {
        expect(provideFoldingRanges('')).toEqual([]);
    });
});
