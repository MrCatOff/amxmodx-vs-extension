import type { Position } from 'vscode-languageserver/node.js';
import { isAlpha, isAlphaNum, isDigit } from '../../shared/strings.js';

/**
 * The set of token flavours emitted by {@link tokenize}. `preprocessor` and
 * `doc-comment` tokens carry the *entire* directive / comment text so the parser
 * can inspect them without re-scanning the source.
 */
export type TokenKind =
    | 'ident'
    | 'number'
    | 'string'
    | 'punct'
    | 'preprocessor'
    | 'doc-comment'
    | 'eof';

/**
 * A tokenizer output element with its LSP-style start/end position.
 */
export interface Token {
    kind: TokenKind;
    value: string;
    start: Position;
    end: Position;
}

/**
 * Specialization of {@link Token} for preprocessor lines. `directive` is the
 * bareword after `#` (e.g. `'include'`), or `''` if the line is malformed.
 */
export interface PreprocessorToken extends Token {
    kind: 'preprocessor';
    directive: string;
}

/**
 * A stateful tokenizer for Pawn source code. Prefer the {@link tokenize} helper
 * unless you need to instantiate one manually.
 *
 * @example
 * const tk = new Tokenizer('new g_count;\n');
 * const tokens = tk.tokenize();
 * // → [ident 'new', ident 'g_count', punct ';', eof]
 */
export class Tokenizer {
    private index = 0;
    private line = 0;
    private col = 0;

    constructor(private readonly source: string) {}

    /**
     * Drain the entire input into an array of tokens, terminated by an `eof`
     * sentinel so callers can peek without bounds-checking.
     *
     * @example
     * const tokens = new Tokenizer('#include <amxmodx>').tokenize();
     * // tokens[0].kind === 'preprocessor'
     */
    tokenize(): Token[] {
        const tokens: Token[] = [];
        while (this.index < this.source.length) {
            this.skipTrivia();
            if (this.index >= this.source.length) break;

            const ch = this.source[this.index];

            if (ch === '/' && this.source[this.index + 1] === '*') {
                const doc = this.readBlockComment();
                if (doc) tokens.push(doc);
                continue;
            }

            if (this.atLineStart() && ch === '#') {
                tokens.push(this.readPreprocessor());
                continue;
            }

            if (ch === '"' || ch === '\'') {
                tokens.push(this.readString(ch));
                continue;
            }

            if (isDigit(ch)) {
                tokens.push(this.readNumber());
                continue;
            }

            if (isAlpha(ch)) {
                tokens.push(this.readIdentifier());
                continue;
            }

            tokens.push(this.readPunct());
        }
        tokens.push({
            kind: 'eof',
            value: '',
            start: this.currentPosition(),
            end: this.currentPosition(),
        });
        return tokens;
    }

    private currentPosition(): Position {
        return { line: this.line, character: this.col };
    }

    private advance(): void {
        if (this.source[this.index] === '\n') {
            this.line++;
            this.col = 0;
        } else {
            this.col++;
        }
        this.index++;
    }

    private atLineStart(): boolean {
        let i = this.index - 1;
        while (i >= 0) {
            const c = this.source[i];
            if (c === '\n') return true;
            if (c !== ' ' && c !== '\t' && c !== '\r') return false;
            i--;
        }
        return true;
    }

    private skipTrivia(): void {
        while (this.index < this.source.length) {
            const ch = this.source[this.index];
            if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
                this.advance();
                continue;
            }
            if (ch === '/' && this.source[this.index + 1] === '/') {
                while (this.index < this.source.length && this.source[this.index] !== '\n') {
                    this.advance();
                }
                continue;
            }
            if (
                ch === '/' &&
                this.source[this.index + 1] === '*' &&
                this.source[this.index + 2] !== '*'
            ) {
                this.advance();
                this.advance();
                while (this.index < this.source.length) {
                    if (this.source[this.index] === '*' && this.source[this.index + 1] === '/') {
                        this.advance();
                        this.advance();
                        break;
                    }
                    this.advance();
                }
                continue;
            }
            return;
        }
    }

    private readBlockComment(): Token | null {
        const start = this.currentPosition();
        const isDoc = this.source[this.index + 2] === '*';
        this.advance(); // '/'
        this.advance(); // '*'

        let value = '/*';
        if (isDoc) {
            value += '*';
            this.advance();
        }
        while (this.index < this.source.length) {
            if (this.source[this.index] === '*' && this.source[this.index + 1] === '/') {
                value += '*/';
                this.advance();
                this.advance();
                break;
            }
            value += this.source[this.index];
            this.advance();
        }
        const end = this.currentPosition();
        return isDoc ? { kind: 'doc-comment', value, start, end } : null;
    }

    private readPreprocessor(): PreprocessorToken {
        const start = this.currentPosition();
        let value = '';
        while (this.index < this.source.length && this.source[this.index] !== '\n') {
            if (
                this.source[this.index] === '\\' &&
                (this.source[this.index + 1] === '\n' ||
                    (this.source[this.index + 1] === '\r' && this.source[this.index + 2] === '\n'))
            ) {
                value += this.source[this.index];
                this.advance();
                if (this.source[this.index] === '\r') this.advance();
                if (this.source[this.index] === '\n') this.advance();
                continue;
            }
            value += this.source[this.index];
            this.advance();
        }
        const end = this.currentPosition();

        const m = /^#\s*([A-Za-z_]+)/.exec(value);
        const directive = m ? m[1] : '';
        return { kind: 'preprocessor', value, start, end, directive };
    }

    private readString(quote: string): Token {
        const start = this.currentPosition();
        let value = quote;
        this.advance();
        while (this.index < this.source.length) {
            const ch = this.source[this.index];
            if (ch === '\n') break;
            if (ch === '\\' && this.source[this.index + 1]) {
                value += ch + this.source[this.index + 1];
                this.advance();
                this.advance();
                continue;
            }
            value += ch;
            this.advance();
            if (ch === quote) break;
        }
        return { kind: 'string', value, start, end: this.currentPosition() };
    }

    private readNumber(): Token {
        const start = this.currentPosition();
        let value = '';
        while (this.index < this.source.length) {
            const ch = this.source[this.index];
            if (isAlphaNum(ch) || ch === '.' || ch === 'x' || ch === 'X') {
                value += ch;
                this.advance();
            } else {
                break;
            }
        }
        return { kind: 'number', value, start, end: this.currentPosition() };
    }

    private readIdentifier(): Token {
        const start = this.currentPosition();
        let value = '';
        while (this.index < this.source.length && isAlphaNum(this.source[this.index])) {
            value += this.source[this.index];
            this.advance();
        }
        return { kind: 'ident', value, start, end: this.currentPosition() };
    }

    private readPunct(): Token {
        const start = this.currentPosition();
        const value = this.source[this.index];
        this.advance();
        return { kind: 'punct', value, start, end: this.currentPosition() };
    }
}

/**
 * Convenience wrapper that instantiates a {@link Tokenizer} and returns the
 * full token array. Preferred entry point for callers.
 *
 * @example
 * const tokens = tokenize('new x = 5;');
 * tokens.map((t) => t.value); // ['new', 'x', '=', '5', ';', '']
 */
export function tokenize(source: string): Token[] {
    return new Tokenizer(source).tokenize();
}
