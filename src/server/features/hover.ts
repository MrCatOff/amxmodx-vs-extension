import type { Hover, Position } from 'vscode-languageserver/node.js';
import { positionToOffset } from '../parser/parser.js';
import type { DocumentData } from '../types.js';
import type { FileDependency } from '../workspace/dependency-manager.js';
import { collectSymbols } from '../workspace/symbol-collector.js';
import { findIdentifierAtCursor } from './cursor.js';

/**
 * Build the hover card for the symbol under the cursor. Returns two markdown
 * code blocks: the declaration itself (highlighted as `amxmodx`), and its
 * doc-comment (highlighted as `pawndoc`).
 *
 * @returns A hover, or `null` if the cursor is not on a known symbol, or if
 *   the cursor is *on* the symbol's declaration line (we don't self-hover).
 *
 * @example
 * provideHover(text, { line: 42, character: 6 }, data, deps);
 * // → { contents: [{ language: 'amxmodx', value: '...' }, ...] }
 */
export function provideHover(
    content: string,
    position: Position,
    data: DocumentData,
    dependenciesData: WeakMap<FileDependency, DocumentData>,
): Hover | null {
    const cursorIndex = positionToOffset(content, position);
    const { identifier, isCallable } = findIdentifierAtCursor(content, cursorIndex);
    if (identifier.length === 0) return null;

    const symbols = collectSymbols(data, dependenciesData);
    if (isCallable) {
        const callable = symbols.callables.find((c) => c.identifier === identifier);
        if (!callable) return null;
        if (callable.start.line === position.line) return null;
        return {
            contents: [
                { language: 'amxmodx', value: callable.label },
                { language: 'pawndoc', value: callable.documentation },
            ],
        };
    }
    const value = symbols.values.find((v) => v.identifier === identifier);
    if (!value) return null;
    if (value.range.start.line === position.line) return null;
    return {
        contents: [
            { language: 'amxmodx', value: value.label },
            { language: 'pawndoc', value: value.documentation },
        ],
    };
}
