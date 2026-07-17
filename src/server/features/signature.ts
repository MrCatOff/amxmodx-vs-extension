import type { Position, SignatureHelp } from 'vscode-languageserver/node.js';
import { positionToOffset } from '../parser/parser.js';
import type { CallableDescriptor } from '../types.js';
import { findEnclosingCall } from './cursor.js';

/**
 * Build the signature-help popup shown when the cursor is inside a call.
 *
 * @param callables - The pool of callables to search — usually every symbol
 *   visible from the document (own + transitively included).
 * @returns A signature help object with the callable's label and the active
 *   parameter index, or `null` if we can't find an enclosing call or a matching
 *   callable.
 *
 * @example
 * // Cursor after 'client_print(id, |' — inside second argument:
 * provideSignatureHelp(text, cursorPos, callables);
 * // → { activeSignature: 0, activeParameter: 1, signatures: [...] }
 */
export function provideSignatureHelp(
    content: string,
    position: Position,
    callables: CallableDescriptor[],
): SignatureHelp | null {
    const cursorIndex = positionToOffset(content, position);
    const { identifier, parameterIndex } = findEnclosingCall(content, cursorIndex);
    if (identifier === '') return null;

    const callable = callables.find((c) => c.identifier === identifier);
    if (!callable) return null;
    if (callable.start.line === position.line) return null;

    return {
        activeSignature: 0,
        activeParameter: parameterIndex,
        signatures: [
            {
                label: callable.label,
                parameters: callable.parameters,
                documentation: callable.documentation,
            },
        ],
    };
}
