import { describe, expect, it } from 'vitest';
import { DiagnosticSeverity } from 'vscode-languageserver/node.js';
import { parse } from './parser.js';

const URI = 'file:///plugin.sma';

describe('parser', () => {
    describe('#include', () => {
        it('parses global-style include', () => {
            const r = parse(URI, '#include <amxmodx>\n', false);
            expect(r.headerInclusions).toHaveLength(1);
            expect(r.headerInclusions[0].filename).toBe('amxmodx');
            expect(r.headerInclusions[0].isLocal).toBe(false);
            expect(r.headerInclusions[0].isSilent).toBe(false);
        });

        it('parses local-style include', () => {
            const r = parse(URI, '#include "myfile"\n', false);
            expect(r.headerInclusions[0].isLocal).toBe(true);
        });

        it('parses #tryinclude as silent', () => {
            const r = parse(URI, '#tryinclude <optional>\n', false);
            expect(r.headerInclusions[0].isSilent).toBe(true);
        });

        it('parses bare filename without brackets', () => {
            const r = parse(URI, '#include amxmodx\n', false);
            expect(r.headerInclusions[0].filename).toBe('amxmodx');
            expect(r.headerInclusions[0].isLocal).toBe(true);
        });

        it('allows a trailing line comment after the terminator', () => {
            const r = parse(URI, '#include <amxmodx> // core header\n', false);
            expect(r.headerInclusions).toHaveLength(1);
            expect(r.headerInclusions[0].filename).toBe('amxmodx');
            expect(r.diagnostics).toEqual([]);
        });

        it('allows a trailing block comment after the terminator', () => {
            const r = parse(URI, '#include "myfile" /* used only in tests */\n', false);
            expect(r.headerInclusions).toHaveLength(1);
            expect(r.headerInclusions[0].filename).toBe('myfile');
            expect(r.diagnostics).toEqual([]);
        });
    });

    describe('callable declarations', () => {
        it('captures a public function with parameters', () => {
            const r = parse(URI, 'public plugin_init() {\n  return 0;\n}\n', false);
            expect(r.callables).toHaveLength(1);
            expect(r.callables[0].identifier).toBe('plugin_init');
            expect(r.callables[0].parameters).toEqual([]);
            expect(r.callables[0].label).toContain('public');
        });

        it('parses parameters as comma-separated', () => {
            const r = parse(URI, 'stock foo(a, b, c) { }\n', false);
            expect(r.callables[0].parameters).toHaveLength(3);
            expect(r.callables[0].parameters.map((p) => p.label)).toEqual(['a', 'b', 'c']);
        });

        it('captures a tagged function', () => {
            const r = parse(URI, 'Float:distance(Float:a, Float:b) {\n}\n', false);
            expect(r.callables).toHaveLength(1);
            expect(r.callables[0].identifier).toBe('distance');
            expect(r.callables[0].label).toContain('Float:');
        });

        it('skips static functions when skipStatic=true', () => {
            const r = parse(URI, 'static helper() { }\n', true);
            expect(r.callables).toHaveLength(0);
        });

        it('attaches preceding doc comment', () => {
            const r = parse(URI, '/** Sums two ints */\nsum(a, b) { }\n', false);
            expect(r.callables[0].documentation).toContain('Sums two ints');
        });

        it('handles nested parens in parameter list', () => {
            const r = parse(URI, 'foo(a = sizeof(bar), b) { }\n', false);
            expect(r.callables).toHaveLength(1);
            expect(r.callables[0].identifier).toBe('foo');
        });
    });

    describe('value declarations', () => {
        it('captures a new variable', () => {
            const r = parse(URI, 'new g_count;\n', false);
            expect(r.values).toHaveLength(1);
            expect(r.values[0].identifier).toBe('g_count');
            expect(r.values[0].isConst).toBe(false);
        });

        it('captures a const variable', () => {
            const r = parse(URI, 'new const MAX = 32;\n', false);
            expect(r.values).toHaveLength(1);
            expect(r.values[0].identifier).toBe('MAX');
            expect(r.values[0].isConst).toBe(true);
        });

        it('captures tagged variable declarations', () => {
            const r = parse(URI, 'new Float:speed;\n', false);
            expect(r.values[0].identifier).toBe('speed');
            expect(r.values[0].label).toContain('Float:');
        });

        it('skips static when requested', () => {
            const r = parse(URI, 'static hidden;\n', true);
            expect(r.values).toHaveLength(0);
        });

        it('ignores values inside function bodies', () => {
            const r = parse(URI, 'public foo() {\n  new local;\n}\n', false);
            expect(r.values).toHaveLength(0);
            expect(r.callables).toHaveLength(1);
        });
    });

    describe('diagnostics', () => {
        it('flags unmatched closing brace', () => {
            const r = parse(URI, '}\n', false);
            expect(r.diagnostics).toHaveLength(1);
            expect(r.diagnostics[0].severity).toBe(DiagnosticSeverity.Error);
            expect(r.diagnostics[0].source).toBe('amxmodx');
        });

        it('flags malformed include', () => {
            const r = parse(URI, '#include "unterminated\n', false);
            expect(r.diagnostics.some((d) => d.message.includes('terminated'))).toBe(true);
        });

        it('flags invalid combination of specifiers', () => {
            const r = parse(URI, 'public static foo() { }\n', false);
            expect(r.diagnostics.some((d) => d.message.includes('Invalid combination'))).toBe(true);
        });
    });

    describe('comments', () => {
        it('ignores single-line comments', () => {
            const r = parse(URI, '// new g_ignored;\nnew g_real;\n', false);
            expect(r.values).toHaveLength(1);
            expect(r.values[0].identifier).toBe('g_real');
        });

        it('ignores non-doc block comments', () => {
            const r = parse(URI, '/* new g_ignored; */ new g_real;\n', false);
            expect(r.values).toHaveLength(1);
            expect(r.values[0].identifier).toBe('g_real');
        });
    });

    describe('optional semicolons (Pawn `-;+` style)', () => {
        it('captures each of multiple semicolon-less `new` declarations', () => {
            const src = 'new g_a\nnew g_b\nnew g_c\n';
            const r = parse(URI, src, false);
            expect(r.values.map((v) => v.identifier)).toEqual(['g_a', 'g_b', 'g_c']);
            expect(r.diagnostics).toEqual([]);
        });

        it('does not confuse a following callable body for the tail of a `new` declaration', () => {
            const src =
                'new g_a\n' +
                'new g_b\n' +
                'public plugin_precache()\n' +
                '{\n' +
                '\tg_a = 1\n' +
                '\tg_b = 2\n' +
                '}\n';
            const r = parse(URI, src, false);
            // The `}` on the last line is the callable body's closing brace,
            // not an unmatched one. Regression test for the false-positive
            // triggered by cs_ham_bots_api.sma.
            expect(r.diagnostics.filter((d) => d.severity === DiagnosticSeverity.Error)).toEqual([]);
            expect(r.callables.map((c) => c.identifier)).toContain('plugin_precache');
        });

        it('treats a preprocessor directive on the next line as an implicit statement break', () => {
            const src = 'new g_a\n#include <amxmodx>\n';
            const r = parse(URI, src, false);
            expect(r.values.map((v) => v.identifier)).toEqual(['g_a']);
            expect(r.headerInclusions.map((i) => i.filename)).toEqual(['amxmodx']);
        });

        it('still recognises the semicolon terminator when it is present', () => {
            const r = parse(URI, 'new g_a;\nnew g_b;\n', false);
            expect(r.values.map((v) => v.identifier)).toEqual(['g_a', 'g_b']);
        });
    });

    describe('region markers', () => {
        it('accepts `// #region` / `// #endregion` comment markers without diagnostics', () => {
            const src =
                '// #region Public API\n' +
                'public plugin_init() { }\n' +
                '// #endregion\n';
            const r = parse(URI, src, false);
            expect(r.diagnostics).toEqual([]);
            expect(r.callables.map((c) => c.identifier)).toContain('plugin_init');
        });
    });
});
