import { DiagnosticSeverity } from 'vscode-languageserver/node.js';
import type { ParameterInformation, Position, Range } from 'vscode-languageserver/node.js';
import { t } from '../../shared/l10n.js';
import type { CallableDescriptor, ParserResults, ValueDescriptor } from '../types.js';
import { tokenize, type PreprocessorToken, type Token } from './tokenizer.js';

/** The diagnostic source string reported to the LSP client. */
export const DIAGNOSTIC_SOURCE = 'amxmodx';

const STORAGE_SPECIFIERS = new Set(['new', 'static', 'public', 'stock', 'const']);

interface SpecifierState {
    isStatic: boolean;
    isPublic: boolean;
    isConst: boolean;
    isStock: boolean;
    isNew: boolean;
}

function emptySpecifiers(): SpecifierState {
    return { isStatic: false, isPublic: false, isConst: false, isStock: false, isNew: false };
}

function createValueLabel(identifier: string, tag: string, sp: SpecifierState, suffix: string): string {
    let label = '';
    if (sp.isPublic) label += 'public ';
    if (sp.isStatic) label += 'static ';
    if (sp.isStock) label += 'stock ';
    if (sp.isConst) label += 'const ';
    if (label === '') label += 'new ';
    if (tag !== '') label += `${tag}:`;
    label += identifier;
    return label + suffix;
}

class TokenCursor {
    constructor(private readonly tokens: Token[], private pos = 0) {}

    peek(offset = 0): Token {
        return this.tokens[this.pos + offset] ?? this.tokens[this.tokens.length - 1];
    }
    consume(): Token {
        const t = this.tokens[this.pos];
        if (this.pos < this.tokens.length - 1) this.pos++;
        return t;
    }
    save(): number {
        return this.pos;
    }
    restore(p: number): void {
        this.pos = p;
    }
    eof(): boolean {
        return this.peek().kind === 'eof';
    }
}

/**
 * Parse a Pawn source file into headers, callables, values, and diagnostics.
 *
 * Only global-scope declarations are captured; function bodies are skipped via
 * brace-depth tracking. Doc comments starting with `/**` that appear
 * immediately before a declaration are attached to it as documentation.
 *
 * @param fileUri - The URI to embed in every produced descriptor.
 * @param content - Raw source text.
 * @param skipStatic - When `true`, `static` declarations are dropped. Used for
 *   included files, since `static` symbols are not visible to the including file.
 *
 * @example
 * const r = parse('file:///plugin.sma', 'public plugin_init() { }\n', false);
 * r.callables[0].identifier; // 'plugin_init'
 * r.diagnostics.length;      // 0
 */
export function parse(fileUri: string, content: string, skipStatic: boolean): ParserResults {
    const results: ParserResults = {
        headerInclusions: [],
        callables: [],
        values: [],
        diagnostics: [],
    };

    const tokens = tokenize(content);
    const cursor = new TokenCursor(tokens);
    let depth = 0;
    let lastDoc = '';

    while (!cursor.eof()) {
        const tok = cursor.peek();

        if (tok.kind === 'preprocessor') {
            cursor.consume();
            handlePreprocessor(tok as PreprocessorToken, results);
            continue;
        }

        if (tok.kind === 'doc-comment') {
            cursor.consume();
            lastDoc = tok.value;
            continue;
        }

        if (tok.kind === 'punct') {
            if (tok.value === '{') {
                depth++;
                cursor.consume();
                continue;
            }
            if (tok.value === '}') {
                if (depth === 0) {
                    results.diagnostics.push({
                        message: t('Unmatched closing brace'),
                        severity: DiagnosticSeverity.Error,
                        source: DIAGNOSTIC_SOURCE,
                        range: { start: tok.start, end: tok.end },
                    });
                } else {
                    depth--;
                }
                cursor.consume();
                continue;
            }
        }

        if (depth > 0) {
            cursor.consume();
            continue;
        }

        if (tok.kind === 'ident') {
            const consumed = tryParseGlobalDeclaration(
                cursor,
                fileUri,
                content,
                results,
                lastDoc,
                skipStatic,
            );
            if (consumed) {
                lastDoc = '';
                continue;
            }
        }

        cursor.consume();
    }

    return results;
}

function handlePreprocessor(tok: PreprocessorToken, results: ParserResults): void {
    if (tok.directive !== 'include' && tok.directive !== 'tryinclude') return;

    const isSilent = tok.directive === 'tryinclude';
    const value = tok.value;

    let idx = value.indexOf(tok.directive) + tok.directive.length;
    while (idx < value.length && (value[idx] === ' ' || value[idx] === '\t')) idx++;

    if (idx >= value.length) {
        results.diagnostics.push({
            message: t('The #include statement is not terminated properly'),
            severity: DiagnosticSeverity.Error,
            source: DIAGNOSTIC_SOURCE,
            range: { start: tok.start, end: tok.end },
        });
        return;
    }

    let opener = value[idx];
    let terminator: string | undefined;
    if (opener === '"') terminator = '"';
    else if (opener === '<') terminator = '>';
    else {
        opener = '';
        terminator = undefined;
    }
    if (opener !== '') idx++;

    let filename = '';
    while (idx < value.length && value[idx] !== terminator && value[idx] !== '\n') {
        filename += value[idx];
        idx++;
    }
    filename = filename.trim();

    if (terminator !== undefined && (idx >= value.length || value[idx] !== terminator)) {
        results.diagnostics.push({
            message: t('The #include statement is not terminated properly'),
            severity: DiagnosticSeverity.Error,
            source: DIAGNOSTIC_SOURCE,
            range: { start: tok.start, end: tok.end },
        });
        return;
    }

    if (terminator !== undefined) idx++;

    const rest = value.substring(idx).trim();
    if (terminator !== undefined && rest.length > 0) {
        results.diagnostics.push({
            message: t('No extra characters are allowed after an #include statement'),
            severity: DiagnosticSeverity.Error,
            source: DIAGNOSTIC_SOURCE,
            range: { start: tok.start, end: tok.end },
        });
        return;
    }

    results.headerInclusions.push({
        filename,
        isLocal: terminator !== '>',
        isSilent,
        start: tok.start,
        end: tok.end,
    });
}

function readSpecifiers(cursor: TokenCursor): { specs: SpecifierState; invalid: boolean } {
    const specs = emptySpecifiers();
    let invalid = false;

    while (true) {
        const t = cursor.peek();
        if (t.kind !== 'ident' || !STORAGE_SPECIFIERS.has(t.value)) break;

        const before = { ...specs };
        switch (t.value) {
            case 'new':
                if (specs.isNew || specs.isStatic || specs.isPublic || specs.isStock || specs.isConst) {
                    invalid = true;
                }
                specs.isNew = true;
                break;
            case 'static':
                if (specs.isStatic || specs.isPublic) invalid = true;
                specs.isStatic = true;
                break;
            case 'public':
                if (specs.isPublic || specs.isStatic) invalid = true;
                specs.isPublic = true;
                break;
            case 'stock':
                if (specs.isStock) invalid = true;
                specs.isStock = true;
                break;
            case 'const':
                if (specs.isConst) invalid = true;
                specs.isConst = true;
                break;
        }
        cursor.consume();
        if (invalid) {
            Object.assign(specs, before);
            break;
        }
    }
    return { specs, invalid };
}

function hasAnySpecifier(sp: SpecifierState): boolean {
    return sp.isNew || sp.isStatic || sp.isPublic || sp.isStock || sp.isConst;
}

function tryParseGlobalDeclaration(
    cursor: TokenCursor,
    fileUri: string,
    content: string,
    results: ParserResults,
    doc: string,
    skipStatic: boolean,
): boolean {
    const save = cursor.save();
    const first = cursor.peek();

    let specStart: Position | null = null;
    let sp = emptySpecifiers();
    let invalidCombo = false;

    if (first.kind === 'ident' && STORAGE_SPECIFIERS.has(first.value)) {
        specStart = first.start;
        const r = readSpecifiers(cursor);
        sp = r.specs;
        invalidCombo = r.invalid;
    }

    if (invalidCombo) {
        results.diagnostics.push({
            message: t('Invalid combination of class specifiers'),
            severity: DiagnosticSeverity.Error,
            source: DIAGNOSTIC_SOURCE,
            range: { start: specStart!, end: cursor.peek().start },
        });
        return true;
    }

    let tag = '';
    let identTok: Token | null = null;

    const idOrTag = cursor.peek();
    if (idOrTag.kind === 'ident') {
        const colon = cursor.peek(1);
        if (colon.kind === 'punct' && colon.value === ':') {
            tag = idOrTag.value;
            cursor.consume();
            cursor.consume();
            const after = cursor.peek();
            if (after.kind !== 'ident') {
                if (hasAnySpecifier(sp)) {
                    results.diagnostics.push({
                        message: t('Expected an identifier'),
                        severity: DiagnosticSeverity.Error,
                        source: DIAGNOSTIC_SOURCE,
                        range: { start: after.start, end: after.end },
                    });
                    return true;
                }
                cursor.restore(save);
                return false;
            }
            identTok = after;
            cursor.consume();
        } else {
            identTok = idOrTag;
            cursor.consume();
        }
    } else {
        cursor.restore(save);
        return false;
    }

    const nextTok = cursor.peek();
    if (nextTok.kind === 'punct' && nextTok.value === '(') {
        return parseCallable(cursor, fileUri, content, results, doc, sp, tag, identTok, skipStatic);
    }

    if (!hasAnySpecifier(sp)) {
        cursor.restore(save);
        return false;
    }

    if (skipStatic && sp.isStatic) {
        skipDeclarationTail(cursor);
        return true;
    }

    parseValueDeclaration(cursor, fileUri, results, doc, sp, tag, identTok);
    return true;
}

function skipDeclarationTail(cursor: TokenCursor): void {
    let paren = 0;
    let bracket = 0;
    while (!cursor.eof()) {
        const t = cursor.peek();
        if (t.kind === 'punct') {
            if (t.value === '(') paren++;
            else if (t.value === ')') paren--;
            else if (t.value === '[') bracket++;
            else if (t.value === ']') bracket--;
            else if (t.value === ';' && paren === 0 && bracket === 0) {
                cursor.consume();
                return;
            } else if (t.value === '{' && paren === 0 && bracket === 0) {
                return;
            }
        }
        cursor.consume();
    }
}

function parseCallable(
    cursor: TokenCursor,
    fileUri: string,
    content: string,
    results: ParserResults,
    doc: string,
    sp: SpecifierState,
    tag: string,
    identTok: Token,
    skipStatic: boolean,
): boolean {
    if (skipStatic && sp.isStatic) {
        skipDeclarationTail(cursor);
        return true;
    }

    const openParen = cursor.consume();
    let depth = 1;
    let closeParen: Token = openParen;
    while (!cursor.eof()) {
        const t = cursor.peek();
        if (t.kind === 'punct') {
            if (t.value === '(') depth++;
            else if (t.value === ')') {
                depth--;
                if (depth === 0) {
                    closeParen = cursor.consume();
                    break;
                }
            }
        }
        cursor.consume();
    }

    const start: Position = identTok.start;
    const end: Position = closeParen.end;

    const paramsText = sliceContent(content, openParen.end, {
        line: closeParen.start.line,
        character: closeParen.start.character,
    });
    const parameters: ParameterInformation[] = paramsText.trim().length > 0
        ? paramsText.split(',').map((s) => ({ label: s.trim() }))
        : [];

    const label = buildCallableLabel(sp, tag, identTok.value, paramsText);

    const callable: CallableDescriptor = {
        label,
        identifier: identTok.value,
        fileUri,
        start,
        end,
        parameters,
        documentation: doc,
    };
    results.callables.push(callable);
    return true;
}

function buildCallableLabel(sp: SpecifierState, tag: string, identifier: string, params: string): string {
    let label = '';
    if (sp.isPublic) label += 'public ';
    if (sp.isStatic) label += 'static ';
    if (sp.isStock) label += 'stock ';
    if (tag !== '') label += `${tag}:`;
    label += identifier;
    label += `(${params.trim()})`;
    return label;
}

function parseValueDeclaration(
    cursor: TokenCursor,
    fileUri: string,
    results: ParserResults,
    doc: string,
    sp: SpecifierState,
    tag: string,
    identTok: Token,
): void {
    let suffix = '';
    let end: Position = identTok.end;
    let paren = 0;
    let bracket = 0;

    while (!cursor.eof()) {
        const t = cursor.peek();
        if (t.kind === 'punct') {
            if (t.value === '(') paren++;
            else if (t.value === ')') paren--;
            else if (t.value === '[') bracket++;
            else if (t.value === ']') bracket--;
            else if (paren === 0 && bracket === 0 && (t.value === ';' || t.value === ',' || t.value === '=')) {
                if (t.value === ';') cursor.consume();
                break;
            }
        }
        end = t.end;
        if (t.kind === 'ident' || t.kind === 'number' || t.kind === 'string') {
            suffix += ` ${t.value}`;
        } else if (t.kind === 'punct') {
            suffix += t.value;
        }
        cursor.consume();
    }

    const range: Range = { start: identTok.start, end };
    const value: ValueDescriptor = {
        identifier: identTok.value,
        label: createValueLabel(identTok.value, tag, sp, suffix),
        isConst: sp.isConst,
        fileUri,
        range,
        documentation: doc,
    };
    results.values.push(value);
}

function sliceContent(content: string, start: Position, end: Position): string {
    const startIdx = positionToOffset(content, start);
    const endIdx = positionToOffset(content, end);
    return content.substring(startIdx, endIdx);
}

/**
 * Convert an LSP {@link Position} (0-based line + character) to a linear string
 * offset. Used by the parser and by cursor-based feature helpers.
 *
 * @example
 * positionToOffset('foo\nbar', { line: 1, character: 2 }); // 6 ('r')
 */
export function positionToOffset(content: string, position: Position): number {
    let line = 0;
    let idx = 0;
    while (idx < content.length && line < position.line) {
        if (content[idx] === '\n') line++;
        idx++;
    }
    return idx + position.character;
}
