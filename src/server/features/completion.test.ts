import { describe, expect, it } from 'vitest';
import { CompletionItemKind, InsertTextFormat } from 'vscode-languageserver/node.js';
import { parse } from '../parser/parser.js';
import { DocumentData } from '../types.js';
import type { FileDependency } from '../workspace/dependency-manager.js';
import { provideCompletions } from './completion.js';

const URI = 'file:///plugin.sma';

function seed(source: string): DocumentData {
    const data = new DocumentData(URI);
    const r = parse(URI, source, false);
    data.callables = r.callables;
    data.values = r.values;
    return data;
}

/** Offset the cursor `n` chars into the last line of `prefix`. */
function positionAtEnd(prefix: string): { line: number; character: number } {
    const lines = prefix.split('\n');
    return { line: lines.length - 1, character: lines[lines.length - 1].length };
}

describe('provideCompletions', () => {
    const deps = new WeakMap<FileDependency, DocumentData>();

    it('inserts a snippet with each parameter as a tab-stop for callables', () => {
        const data = seed(
            'stock bind_pcvar_num(pcvar, &any:var) { }\n\n' + 'bind_pcvar',
        );
        const pos = positionAtEnd('stock bind_pcvar_num(pcvar, &any:var) { }\n\nbind_pcvar');

        const items = provideCompletions(
            'stock bind_pcvar_num(pcvar, &any:var) { }\n\nbind_pcvar',
            pos,
            data,
            deps,
        );
        const item = items?.find((i) => i.label === 'bind_pcvar_num');
        expect(item).toBeDefined();
        expect(item?.kind).toBe(CompletionItemKind.Function);
        expect(item?.insertTextFormat).toBe(InsertTextFormat.Snippet);
        expect(item?.insertText).toBe('bind_pcvar_num(${1:pcvar}, ${2:&any:var})$0');
    });

    it('inserts just `()` with a final tab-stop for zero-parameter callables', () => {
        const source = 'public plugin_init() { }\n\nplugin_';
        const data = seed(source);

        const items = provideCompletions(source, positionAtEnd(source), data, deps);
        const item = items?.find((i) => i.label === 'plugin_init');
        expect(item?.insertText).toBe('plugin_init()$0');
        expect(item?.insertTextFormat).toBe(InsertTextFormat.Snippet);
    });

    it('does not add parentheses when the cursor is immediately followed by `(`', () => {
        const source = 'stock foo(a, b) { }\n\nfo(1, 2)';
        const data = seed(source);
        // Cursor sits between `fo` and `(`.
        const cursorLine = 2;
        const cursor = { line: cursorLine, character: 2 };

        const items = provideCompletions(source, cursor, data, deps);
        const item = items?.find((i) => i.label === 'foo');
        expect(item?.insertText).toBe('foo');
        expect(item?.insertTextFormat).toBeUndefined();
    });

    it('escapes snippet special characters (`$`, `}`, `\\`) in parameter defaults', () => {
        // Synthesise a callable directly so we can pin the parameter text.
        const data = new DocumentData(URI);
        data.callables = [
            {
                label: 'weird($a, b})',
                identifier: 'weird',
                fileUri: URI,
                start: { line: 0, character: 0 },
                end: { line: 0, character: 5 },
                parameters: [{ label: '$a' }, { label: 'b}' }, { label: 'c\\d' }],
                documentation: '',
            },
        ];

        const items = provideCompletions('weird', { line: 0, character: 5 }, data, deps);
        const item = items?.find((i) => i.label === 'weird');
        expect(item?.insertText).toBe('weird(${1:\\$a}, ${2:b\\}}, ${3:c\\\\d})$0');
    });

    it('strips the leading `@` from public identifiers on insert', () => {
        const data = new DocumentData(URI);
        data.callables = [
            {
                label: 'public @Hook()',
                identifier: '@Hook',
                fileUri: URI,
                start: { line: 0, character: 0 },
                end: { line: 0, character: 5 },
                parameters: [],
                documentation: '',
            },
        ];

        const items = provideCompletions('Hook', { line: 0, character: 4 }, data, deps);
        const item = items?.find((i) => i.label === '@Hook');
        expect(item?.insertText).toBe('Hook()$0');
    });

    it('returns null when there is no identifier under the cursor', () => {
        const data = seed('stock foo() { }\n');
        expect(provideCompletions('stock foo() { }\n', { line: 1, character: 0 }, data, deps)).toBeNull();
    });
});
