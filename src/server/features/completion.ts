import { CompletionItemKind, type CompletionItem, type Position } from 'vscode-languageserver/node.js';
import { fuzzy } from '../../shared/strings.js';
import { positionToOffset } from '../parser/parser.js';
import type { DocumentData } from '../types.js';
import type { FileDependency } from '../workspace/dependency-manager.js';
import { collectSymbols } from '../workspace/symbol-collector.js';
import { findIdentifierBehindCursor } from './cursor.js';

// LSP has no constant kind — 21 is the VS Code Constant icon value.
const KIND_CONSTANT = 21 as CompletionItemKind;

/**
 * Build the completion list shown by VS Code at `position`.
 *
 * The identifier under construction is scanned backwards from the cursor; every
 * callable and value visible from the document (own + transitively included) is
 * filtered through a case-insensitive subsequence match against that identifier.
 *
 * @returns The list of completions, or `null` if there is no typed prefix.
 *
 * @example
 * // User types 'cli' in an .sma file:
 * provideCompletions(text, cursorPos, data, deps);
 * // → [{ label: 'client_print', kind: Function, ... }, ...]
 */
export function provideCompletions(
    content: string,
    position: Position,
    data: DocumentData,
    dependenciesData: WeakMap<FileDependency, DocumentData>,
): CompletionItem[] | null {
    const cursorIndex = positionToOffset(content, position);
    const query = findIdentifierBehindCursor(content, cursorIndex).toLowerCase();
    if (query.length === 0) return null;

    const results = collectSymbols(data, dependenciesData);
    const values = results.values.filter((v) => fuzzy(v.identifier, query));
    const callables = results.callables.filter((c) => fuzzy(c.identifier, query));

    const items: CompletionItem[] = [];
    for (const v of values) {
        items.push({
            label: v.identifier,
            detail: v.label,
            kind: v.isConst ? KIND_CONSTANT : CompletionItemKind.Variable,
            insertText: v.identifier.startsWith('@') ? v.identifier.substring(1) : v.identifier,
            documentation: v.documentation,
        });
    }
    for (const c of callables) {
        items.push({
            label: c.identifier,
            detail: c.label,
            kind: CompletionItemKind.Function,
            insertText: c.identifier.startsWith('@') ? c.identifier.substring(1) : c.identifier,
            documentation: c.documentation,
        });
    }
    return items;
}
