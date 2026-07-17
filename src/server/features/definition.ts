import type { Location, Position } from 'vscode-languageserver/node.js';
import { positionToOffset } from '../parser/parser.js';
import type { DocumentData } from '../types.js';
import type { FileDependency } from '../workspace/dependency-manager.js';
import { collectSymbols } from '../workspace/symbol-collector.js';
import { findIdentifierAtCursor } from './cursor.js';

/**
 * Resolve "Go to Definition" for the symbol under the cursor. Include
 * resolution (jumping to an `#include` target) is handled separately in
 * server.ts; this function covers callables and values.
 *
 * @returns A location, or `null` if the cursor is not on a known symbol.
 *
 * @example
 * // Cursor on 'plugin_init(' at line 12:
 * provideDefinition(text, { line: 12, character: 4 }, data, deps);
 * // → { uri: 'file:///plugin.sma', range: { ... } }
 */
export function provideDefinition(
    content: string,
    position: Position,
    data: DocumentData,
    dependenciesData: WeakMap<FileDependency, DocumentData>,
): Location | null {
    const cursorIndex = positionToOffset(content, position);
    const { identifier, isCallable } = findIdentifierAtCursor(content, cursorIndex);
    if (identifier.length === 0) return null;

    const symbols = collectSymbols(data, dependenciesData);
    if (isCallable) {
        const callable = symbols.callables.find((c) => c.identifier === identifier);
        if (!callable) return null;
        return {
            uri: callable.fileUri,
            range: { start: callable.start, end: callable.end },
        };
    }
    const value = symbols.values.find((v) => v.identifier === identifier);
    if (!value) return null;
    if (value.range.start.line === position.line) return null;
    return { uri: value.fileUri, range: value.range };
}
