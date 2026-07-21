import * as fs from 'node:fs';
import * as Path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import * as oniguruma from 'vscode-oniguruma';
import * as vsctm from 'vscode-textmate';

const GRAMMAR_PATH = Path.resolve(__dirname, '../../syntaxes/amxmodx.tmLanguage.json');

let registry: vsctm.Registry;
let grammar: vsctm.IGrammar;

async function loadGrammar(): Promise<void> {
    const onigWasm = fs.readFileSync(
        require.resolve('vscode-oniguruma/release/onig.wasm'),
    );
    await oniguruma.loadWASM(onigWasm.buffer);

    registry = new vsctm.Registry({
        onigLib: Promise.resolve({
            createOnigScanner: (patterns) => new oniguruma.OnigScanner(patterns),
            createOnigString: (s) => new oniguruma.OnigString(s),
        }),
        loadGrammar: async (scopeName) => {
            if (scopeName === 'source.amxmodx') {
                const raw = fs.readFileSync(GRAMMAR_PATH, 'utf-8');
                return vsctm.parseRawGrammar(raw, GRAMMAR_PATH);
            }
            return null;
        },
    });
    const g = await registry.loadGrammar('source.amxmodx');
    if (!g) throw new Error('Failed to load grammar');
    grammar = g;
}

/**
 * Return the ordered list of the grammar scopes assigned to each character span
 * on `line`, filtered to those under the amxmodx source.
 */
function tokenScopes(line: string): Array<{ text: string; scopes: string[] }> {
    const r = grammar.tokenizeLine(line, vsctm.INITIAL);
    return r.tokens.map((t) => ({
        text: line.substring(t.startIndex, t.endIndex),
        scopes: t.scopes,
    }));
}

function scopeAt(line: string, needle: string): string[] {
    const tokens = tokenScopes(line);
    const tok = tokens.find((t) => t.text.includes(needle));
    if (!tok) throw new Error(`No token containing '${needle}' in '${line}'`);
    return tok.scopes;
}

describe('amxmodx.tmLanguage.json', () => {
    beforeAll(loadGrammar);

    it('loads without a parse error', () => {
        expect(grammar).toBeDefined();
    });

    describe('preprocessor', () => {
        it('scopes #include and its filename', () => {
            const s = scopeAt('#include <amxmodx>', 'include');
            expect(s).toContain('keyword.control.import.include.amxmodx');

            const s2 = scopeAt('#include <amxmodx>', 'amxmodx');
            expect(s2.some((x) => x.startsWith('string.quoted.other.lt-gt.include'))).toBe(true);
        });

        it('scopes #tryinclude', () => {
            const s = scopeAt('#tryinclude <optional>', 'tryinclude');
            expect(s).toContain('keyword.control.import.include.amxmodx');
        });

        it('scopes #define and its macro name', () => {
            const s = scopeAt('#define MAX_PLAYERS 32', 'define');
            expect(s).toContain('keyword.control.import.define.amxmodx');

            const s2 = scopeAt('#define MAX_PLAYERS 32', 'MAX_PLAYERS');
            expect(s2).toContain('entity.name.function.preprocessor.amxmodx');
        });

        it('scopes #pragma mark specially', () => {
            const s = scopeAt('#pragma mark Section A', 'pragma');
            expect(s).toContain('keyword.control.import.pragma.amxmodx');
        });

        it('scopes `// #region <label>` folding markers', () => {
            const s = scopeAt('// #region Public API', '#region');
            expect(s).toContain('keyword.control.import.region.amxmodx');

            const label = scopeAt('// #region Public API', 'Public API');
            expect(label).toContain('meta.toc-list.region.amxmodx');
        });

        it('scopes `// #endregion` (with or without a label)', () => {
            expect(scopeAt('// #endregion', '#endregion')).toContain(
                'keyword.control.import.region.amxmodx',
            );
            expect(scopeAt('// #endregion Public API', '#endregion')).toContain(
                'keyword.control.import.region.amxmodx',
            );
        });

        it('also accepts the hash-less `// region` variant', () => {
            expect(scopeAt('// region Setup', 'region')).toContain(
                'keyword.control.import.region.amxmodx',
            );
        });

        it('scopes `/*----[ Label ]----*/` banner comments', () => {
            const line = '/*--------------------------------[ Constants ]--------------------------------*/';
            const tokens = tokenScopes(line);
            expect(tokens.some((t) => t.scopes.includes('comment.block.banner.amxmodx'))).toBe(true);
            const label = tokens.find((t) => t.text === 'Constants');
            expect(label?.scopes).toContain('meta.toc-list.banner.block.amxmodx');
        });
    });

    describe('storage modifiers and constants', () => {
        it('scopes `new` as storage.modifier', () => {
            const s = scopeAt('new g_count = 5;', 'new');
            expect(s).toContain('storage.modifier.amxmodx');
        });

        it('scopes `true` and `false` as language constants', () => {
            expect(scopeAt('if (x == true)', 'true')).toContain('constant.language.amxmodx');
            expect(scopeAt('if (x == false)', 'false')).toContain('constant.language.amxmodx');
        });

        it('scopes `charsmax` (AMX Mod X macro) as a language constant', () => {
            const s = scopeAt('copy(dest, charsmax(dest), src);', 'charsmax');
            expect(s).toContain('constant.language.amxmodx');
        });

        it('scopes `sizeof` and `tagof` as word operators', () => {
            expect(scopeAt('new x = sizeof arr;', 'sizeof')).toContain(
                'keyword.operator.word.amxmodx',
            );
            expect(scopeAt('new x = tagof y;', 'tagof')).toContain(
                'keyword.operator.word.amxmodx',
            );
        });
    });

    describe('numbers', () => {
        it('scopes hex literals', () => {
            const s = scopeAt('new c = 0xFF00AA;', '0xFF00AA');
            expect(s).toContain('constant.numeric.hex.amxmodx');
        });

        it('scopes binary literals (Pawn 3.3)', () => {
            const s = scopeAt('new mask = 0b1010_0011;', '0b1010_0011');
            expect(s).toContain('constant.numeric.binary.amxmodx');
        });

        it('scopes floats with exponents', () => {
            const s = scopeAt('new Float:x = 1.5e-3;', '1.5e-3');
            expect(s).toContain('constant.numeric.float.amxmodx');
        });

        it('scopes plain decimals', () => {
            const s = scopeAt('new n = 42;', '42');
            expect(s).toContain('constant.numeric.decimal.amxmodx');
        });
    });

    describe('strings', () => {
        it('scopes double-quoted strings and their delimiters', () => {
            const tokens = tokenScopes('client_print(0, print_chat, "hello")');
            const strTok = tokens.find((t) => t.text === 'hello');
            expect(strTok?.scopes).toContain('string.quoted.double.amxmodx');
        });

        it('highlights format specifiers inside strings', () => {
            const tokens = tokenScopes('server_print("hi %d world", 5)');
            const percentD = tokens.find((t) => t.text === '%d');
            expect(percentD?.scopes).toContain('constant.other.placeholder.amxmodx');
        });

        it('highlights width/precision format specifiers (%.2f, %-5s)', () => {
            const tokens = tokenScopes('new s[] = "x=%.2f y=%-5s"');
            const pctF = tokens.find((t) => t.text === '%.2f');
            const pctS = tokens.find((t) => t.text === '%-5s');
            expect(pctF?.scopes).toContain('constant.other.placeholder.amxmodx');
            expect(pctS?.scopes).toContain('constant.other.placeholder.amxmodx');
        });

        it('recognises the AMX Mod X-specific %L format specifier', () => {
            const tokens = tokenScopes('client_print(id, print_chat, "%L", id, "MENU_TITLE")');
            const pct = tokens.find((t) => t.text === '%L');
            expect(pct?.scopes).toContain('constant.other.placeholder.amxmodx');
        });

        it('scopes ^ escapes as constant.character.escape', () => {
            const tokens = tokenScopes('server_print("line^n")');
            const esc = tokens.find((t) => t.text === '^n');
            expect(esc?.scopes).toContain('constant.character.escape.amxmodx');
        });
    });

    describe('tags and labels', () => {
        it('scopes tag prefixes as storage.type', () => {
            const s = scopeAt('new Float:pos[3];', 'Float:');
            expect(s).toContain('storage.type.amxmodx');
        });

        it('scopes `case X:` labels as control keywords', () => {
            const tokens = tokenScopes('case FOO:');
            const kw = tokens.find((t) => t.text.includes('case'));
            expect(kw?.scopes).toContain('keyword.control.amxmodx');
        });

        it('scopes `default:` as a control keyword', () => {
            const tokens = tokenScopes('default:');
            const kw = tokens.find((t) => t.text.includes('default'));
            expect(kw?.scopes).toContain('keyword.control.amxmodx');
        });
    });

    describe('function declaration', () => {
        it('captures the function name as entity.name.function', () => {
            const s = scopeAt('public plugin_init()', 'plugin_init');
            expect(s).toContain('entity.name.function.amxmodx');
        });

        it('captures the function name in a native declaration', () => {
            const s = scopeAt('native register_plugin(const name[], const version[], const author[])', 'register_plugin');
            expect(s).toContain('entity.name.function.amxmodx');
        });

        it('captures the function name in a forward declaration', () => {
            const s = scopeAt('forward plugin_end()', 'plugin_end');
            expect(s).toContain('entity.name.function.amxmodx');
        });

        it('captures the function name when preceded by a tag prefix', () => {
            const s = scopeAt('bool:is_ready(const args[] = "")', 'is_ready');
            expect(s).toContain('entity.name.function.amxmodx');

            const tag = scopeAt('bool:is_ready(const args[] = "")', 'bool');
            expect(tag).toContain('storage.type.amxmodx');
        });

        it('captures the function name when the tag prefix has a trailing space', () => {
            const s = scopeAt('Float: compute(Float:x)', 'compute');
            expect(s).toContain('entity.name.function.amxmodx');
        });
    });

    describe('control flow', () => {
        it('scopes `if`, `else`, `for`, `while`, `return` as control keywords', () => {
            for (const kw of ['if', 'else', 'for', 'while', 'return']) {
                const s = scopeAt(`${kw} `, kw);
                expect(s).toContain('keyword.control.amxmodx');
            }
        });
    });
});
