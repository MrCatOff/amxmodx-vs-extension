import { isAlphaNum, isDigit, isWhitespace, reverse } from '../../shared/strings.js';

/**
 * Result of {@link findEnclosingCall}: which callable the cursor is inside and
 * how many top-level commas precede the cursor (used to highlight the active
 * parameter in signature help).
 *
 * @example
 * const r = findEnclosingCall('foo(a, b|', 8);
 * // → { identifier: 'foo', parameterIndex: 1 }
 */
export interface EnclosingCall {
    identifier: string;
    parameterIndex: number;
}

/**
 * Walk backwards from `cursorIndex` looking for the innermost unmatched `(`.
 * The identifier immediately before it is the enclosing call; the count of
 * top-level commas seen along the way is the active parameter index.
 *
 * Returns `{ identifier: '', parameterIndex: 0 }` when the cursor is not inside
 * a call.
 *
 * @example
 * findEnclosingCall('client_print(id, print_chat, ""', 32);
 * // → { identifier: 'client_print', parameterIndex: 2 }
 */
export function findEnclosingCall(content: string, cursorIndex: number): EnclosingCall {
    let index = cursorIndex - 1;
    let parenthesisDepth = 0;
    let parameterIndex = 0;

    while (index >= 0) {
        const ch = content[index];
        if (ch === ';') return { identifier: '', parameterIndex: 0 };
        if (ch === ',' && parenthesisDepth === 0) parameterIndex++;
        if (ch === ')') {
            parenthesisDepth++;
            index--;
            continue;
        }
        if (ch === '(') {
            if (parenthesisDepth > 0) {
                parenthesisDepth--;
                index--;
                continue;
            }
            index--;
            while (index >= 0 && isWhitespace(content[index])) index--;

            let ident = '';
            while (index >= 0 && isAlphaNum(content[index])) {
                ident += content[index];
                index--;
            }
            let i = ident.length;
            while (--i >= 0 && isDigit(ident[i])) {
                /* strip leading digits (reversed) */
            }
            if (i !== ident.length - 1) ident = ident.substring(0, i + 1);
            return { identifier: reverse(ident), parameterIndex };
        }
        index--;
    }
    return { identifier: '', parameterIndex: 0 };
}

/**
 * Return the identifier that ends immediately before `cursorIndex` (i.e. the
 * word the user is typing), or `''` if there isn't one.
 *
 * @example
 * findIdentifierBehindCursor('client_pri', 10); // 'client_pri'
 * findIdentifierBehindCursor('foo(', 4);        // ''
 */
export function findIdentifierBehindCursor(content: string, cursorIndex: number): string {
    let index = cursorIndex - 1;
    let ident = '';
    while (index >= 0) {
        const ch = content[index];
        if (!isAlphaNum(ch)) break;
        ident += ch;
        index--;
    }
    let i = ident.length;
    while (--i >= 0 && isDigit(ident[i])) {
        /* strip leading digits (reversed) */
    }
    if (i !== ident.length - 1) ident = ident.substring(0, i + 1);
    return reverse(ident);
}

/**
 * Result of {@link findIdentifierAtCursor}: the identifier under the cursor,
 * plus whether it is followed by `(` (i.e. it is being used as a call target).
 */
export interface IdentifierAtCursor {
    identifier: string;
    isCallable: boolean;
}

/**
 * Return the identifier the cursor sits on. `isCallable` is true when that
 * identifier is followed by an opening parenthesis.
 *
 * @example
 * findIdentifierAtCursor('client_print(', 6);
 * // → { identifier: 'client_print', isCallable: true }
 *
 * findIdentifierAtCursor('new g_count', 6);
 * // → { identifier: 'g_count', isCallable: false }
 */
export function findIdentifierAtCursor(content: string, cursorIndex: number): IdentifierAtCursor {
    const result: IdentifierAtCursor = { identifier: '', isCallable: false };
    const first = content[cursorIndex];
    if (!isAlphaNum(first)) return result;
    if (cursorIndex > 0 && isDigit(first) && isWhitespace(content[cursorIndex - 1])) return result;

    let index = cursorIndex;
    while (index >= 0 && isAlphaNum(content[index])) {
        result.identifier += content[index];
        index--;
    }
    let i = result.identifier.length;
    while (--i >= 0 && isDigit(result.identifier[i])) {
        /* strip leading digits (reversed) */
    }
    if (i !== result.identifier.length - 1) result.identifier = result.identifier.substring(0, i + 1);
    result.identifier = reverse(result.identifier);

    index = cursorIndex + 1;
    while (index < content.length) {
        if (isAlphaNum(content[index])) {
            result.identifier += content[index];
            index++;
            continue;
        }
        while (index < content.length && isWhitespace(content[index])) index++;
        if (content[index] === '(') result.isCallable = true;
        break;
    }

    return result;
}
