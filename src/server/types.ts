import type { Diagnostic, ParameterInformation, Position, Range } from 'vscode-languageserver/node.js';
import type { FileDependency } from './workspace/dependency-manager.js';

/**
 * A single `#include` / `#tryinclude` directive found in a source file, with the
 * range of the whole directive line so the client can render document-link
 * highlights over the filename.
 *
 * @example
 * const inc: InclusionDescriptor = {
 *     filename: 'amxmodx',
 *     isLocal: false,
 *     isSilent: false,
 *     start: { line: 0, character: 0 },
 *     end: { line: 0, character: 18 },
 * };
 */
export interface InclusionDescriptor {
    filename: string;
    isLocal: boolean;
    isSilent: boolean;
    start: Position;
    end: Position;
}

/**
 * An {@link InclusionDescriptor} paired with the fully resolved file URI. Present
 * only on directives whose target file exists on disk.
 */
export interface ResolvedInclusion {
    descriptor: InclusionDescriptor;
    uri: string;
}

/**
 * A parsed Pawn callable — `public plugin_init()`, `stock foo(a, b)`, etc.
 *
 * @example
 * const c: CallableDescriptor = {
 *     label: 'public plugin_init()',
 *     identifier: 'plugin_init',
 *     fileUri: 'file:///plugin.sma',
 *     start: { line: 3, character: 0 },
 *     end: { line: 3, character: 20 },
 *     parameters: [],
 *     documentation: '',
 * };
 */
export interface CallableDescriptor {
    label: string;
    identifier: string;
    fileUri: string;
    start: Position;
    end: Position;
    parameters: ParameterInformation[];
    documentation: string;
}

/**
 * A parsed Pawn value declaration — `new g_count`, `new const MAX = 32`, etc.
 */
export interface ValueDescriptor {
    label: string;
    identifier: string;
    isConst: boolean;
    fileUri: string;
    range: Range;
    documentation: string;
}

/**
 * The bag of information produced by a single {@link parse} invocation.
 */
export interface ParserResults {
    headerInclusions: InclusionDescriptor[];
    callables: CallableDescriptor[];
    values: ValueDescriptor[];
    diagnostics: Diagnostic[];
}

/**
 * Per-document state stored server-side: last parse results, transitively
 * resolved includes, and the timer used to debounce reparses.
 *
 * @example
 * const data = new DocumentData('file:///plugin.sma');
 * data.callables.push(callable);
 */
export class DocumentData {
    reparseTimer: NodeJS.Timeout | null = null;
    resolvedInclusions: ResolvedInclusion[] = [];
    callables: CallableDescriptor[] = [];
    values: ValueDescriptor[] = [];
    dependencies: FileDependency[] = [];

    constructor(public readonly uri: string) {}
}
