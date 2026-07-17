import { SymbolKind, type SymbolInformation } from 'vscode-languageserver/node.js';
import type { DocumentData } from '../types.js';

/**
 * Build the outline shown in the VS Code Outline view. Currently exposes every
 * top-level callable declared in the document (not includes) as a `Function`.
 *
 * @example
 * provideDocumentSymbols('file:///plugin.sma', data);
 * // → [{ name: 'plugin_init', kind: Function, location: { ... } }, ...]
 */
export function provideDocumentSymbols(uri: string, data: DocumentData): SymbolInformation[] {
    return data.callables.map<SymbolInformation>((c) => ({
        name: c.identifier,
        location: { range: { start: c.start, end: c.end }, uri },
        kind: SymbolKind.Function,
    }));
}
