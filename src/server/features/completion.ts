import {
    CompletionItemKind,
    InsertTextFormat,
    type CompletionItem,
    type ParameterInformation,
    type Position,
} from 'vscode-languageserver/node.js';
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
    const followedByParen = hasParenAfter(content, cursorIndex);

    const items: CompletionItem[] = [];
    for (const v of values) {
        items.push({
            label: v.identifier,
            detail: v.label,
            kind: v.isConst ? KIND_CONSTANT : CompletionItemKind.Variable,
            insertText: stripAtPrefix(v.identifier),
            documentation: v.documentation,
        });
    }
    for (const c of callables) {
        const identifier = stripAtPrefix(c.identifier);
        const item: CompletionItem = {
            label: c.identifier,
            detail: c.label,
            kind: CompletionItemKind.Function,
            documentation: c.documentation,
        };
        if (followedByParen) {
            item.insertText = identifier;
        } else {
            item.insertText = buildCallSnippet(identifier, c.parameters);
            item.insertTextFormat = InsertTextFormat.Snippet;
        }
        items.push(item);
    }
    return items;
}

function stripAtPrefix(identifier: string): string {
    return identifier.startsWith('@') ? identifier.substring(1) : identifier;
}

/**
 * True if the next non-whitespace character after `cursorIndex` is `(`.
 * Used to avoid duplicating parentheses when completing inside an already-open
 * call, e.g. `bind_pcvar_num|(pcvar, var)`.
 */
function hasParenAfter(content: string, cursorIndex: number): boolean {
    let i = cursorIndex;
    while (i < content.length && (content[i] === ' ' || content[i] === '\t')) i++;
    return content[i] === '(';
}

/**
 * Build a VS Code snippet that inserts the call with each parameter as a
 * tab-stop placeholder. Each parameter's label from the `.inc` file becomes
 * the placeholder's default text, so users see the full signature and can
 * tab through the arguments.
 *
 * @example
 * buildCallSnippet('bind_pcvar_num', [{label: 'pcvar'}, {label: '&any:var'}]);
 * // → 'bind_pcvar_num(${1:pcvar}, ${2:&any:var})$0'
 */
function buildCallSnippet(identifier: string, parameters: ParameterInformation[]): string {
    if (parameters.length === 0) return `${identifier}()$0`;
    const placeholders = parameters
        .map((p, i) => {
            const text = typeof p.label === 'string' ? p.label : '';
            return `\${${i + 1}:${escapeSnippet(text)}}`;
        })
        .join(', ');
    return `${identifier}(${placeholders})$0`;
}

/**
 * Escape characters that carry meaning inside a TextMate snippet placeholder
 * default: `\`, `$`, and `}`.
 */
function escapeSnippet(text: string): string {
    return text.replace(/[\\$}]/g, '\\$&');
}
