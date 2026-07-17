const CODE_0 = '0'.charCodeAt(0);
const CODE_9 = '9'.charCodeAt(0);
const CODE_UPPER_A = 'A'.charCodeAt(0);
const CODE_UPPER_Z = 'Z'.charCodeAt(0);
const CODE_LOWER_A = 'a'.charCodeAt(0);
const CODE_LOWER_Z = 'z'.charCodeAt(0);
const CODE_UNDERSCORE = '_'.charCodeAt(0);
const CODE_AT = '@'.charCodeAt(0);

/**
 * True iff `ch` is an ASCII digit `[0-9]`.
 *
 * @example
 * isDigit('7');   // true
 * isDigit('a');   // false
 * isDigit(undefined); // false
 */
export function isDigit(ch: string | undefined): boolean {
    if (!ch) return false;
    const c = ch.charCodeAt(0);
    return c >= CODE_0 && c <= CODE_9;
}

/**
 * True iff `ch` can start a Pawn identifier: `[A-Za-z_@]`.
 *
 * @example
 * isAlpha('_');   // true
 * isAlpha('@');   // true (Pawn allows @-prefixed identifiers)
 * isAlpha('0');   // false
 */
export function isAlpha(ch: string | undefined): boolean {
    if (!ch) return false;
    const c = ch.charCodeAt(0);
    return (
        (c >= CODE_UPPER_A && c <= CODE_UPPER_Z) ||
        (c >= CODE_LOWER_A && c <= CODE_LOWER_Z) ||
        c === CODE_UNDERSCORE ||
        c === CODE_AT
    );
}

/**
 * True iff `ch` can continue a Pawn identifier: `[A-Za-z0-9_@]`.
 *
 * @example
 * isAlphaNum('9');  // true
 * isAlphaNum('.');  // false
 */
export function isAlphaNum(ch: string | undefined): boolean {
    if (!ch) return false;
    return isAlpha(ch) || isDigit(ch);
}

/**
 * True iff `ch` is ASCII whitespace (space, tab, CR, LF, form-feed, vtab).
 *
 * @example
 * isWhitespace(' ');   // true
 * isWhitespace('\n');  // true
 * isWhitespace('a');   // false
 */
export function isWhitespace(ch: string | undefined): boolean {
    return ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n' || ch === '\f' || ch === '\v';
}

/**
 * Reverses a string, using a code-point-aware split so that surrogate pairs stay together.
 *
 * @example
 * reverse('abcd'); // 'dcba'
 * reverse('');     // ''
 */
export function reverse(text: string): string {
    return [...text].reverse().join('');
}

/**
 * Case-insensitive subsequence match — returns true iff every non-space character of
 * `search` appears in `text` in order. Used to filter completions (`clnt_prnt` matches
 * `client_print`).
 *
 * @example
 * fuzzy('client_print', 'cli');   // true
 * fuzzy('client_print', 'cp');    // true (subsequence)
 * fuzzy('client_print', 'xyz');   // false
 * fuzzy('CLIENT_PRINT', 'client');// true (case-insensitive)
 */
export function fuzzy(text: string, search: string): boolean {
    const s = search.toLowerCase();
    const t = text.toLowerCase();

    let j = -1;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === ' ') continue;
        j = t.indexOf(ch, j + 1);
        if (j === -1) return false;
    }
    return true;
}
