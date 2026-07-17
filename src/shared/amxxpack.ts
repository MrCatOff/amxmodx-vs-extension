import * as fs from 'node:fs';
import * as Path from 'node:path';

/**
 * Nested `{ dir, output }` shape used by `input.scripts` / `input.include`
 * entries. Only `dir` matters for our purposes (include-path discovery); the
 * `output` block controls how amxxpack emits files during a build and is
 * ignored by the language service.
 *
 * @example
 * const entry: AmxxpackInputEntry = { dir: './src/include' };
 */
export interface AmxxpackInputEntry {
    dir: string;
    output?: unknown;
}

/** A single entry in one of the `input.*` fields — string shorthand or object. */
export type AmxxpackInputSpec = string | AmxxpackInputEntry;

/**
 * The subset of `.amxxpack.json` fields that the extension inspects. Every
 * field is optional — real projects use only some of them and we accept any
 * combination.
 *
 * @example
 * const config: AmxxpackConfig = {
 *     include: ['./.compiler/include'],
 *     input: { include: './src/include' },
 * };
 */
export interface AmxxpackConfig {
    compiler?: {
        version?: string;
        addons?: string[];
        dev?: boolean;
    };
    include?: string[];
    input?: {
        scripts?: AmxxpackInputSpec | AmxxpackInputSpec[];
        include?: AmxxpackInputSpec | AmxxpackInputSpec[];
        assets?: AmxxpackInputSpec | AmxxpackInputSpec[];
    };
    output?: {
        base?: string;
        plugins?: string;
        scripts?: string;
        include?: string;
        assets?: string;
    };
    thirdparty?: {
        dir?: string;
        dependencies?: unknown[];
    };
}

/**
 * Parse a `.amxxpack.json` string into an {@link AmxxpackConfig}. Non-JSON
 * input, or JSON that isn't a plain object, returns `undefined`.
 *
 * We deliberately don't fail loudly on unknown fields — amxxpack keeps adding
 * knobs and we only care about a small subset.
 *
 * @example
 * parseAmxxpackConfig('{"include":["./inc"]}');
 * // → { include: ['./inc'] }
 * parseAmxxpackConfig('not json'); // → undefined
 */
export function parseAmxxpackConfig(text: string): AmxxpackConfig | undefined {
    try {
        const parsed = JSON.parse(text) as unknown;
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined;
        return parsed as AmxxpackConfig;
    } catch {
        return undefined;
    }
}

/**
 * Read `.amxxpack.json` from `absolutePath` synchronously. Returns `undefined`
 * when the file does not exist, is unreadable, or contains invalid JSON.
 *
 * @example
 * const cfg = loadAmxxpackConfig('/proj/.amxxpack.json');
 */
export function loadAmxxpackConfig(absolutePath: string): AmxxpackConfig | undefined {
    let text: string;
    try {
        text = fs.readFileSync(absolutePath, 'utf-8');
    } catch {
        return undefined;
    }
    return parseAmxxpackConfig(text);
}

function toArray<T>(v: T | T[] | undefined): T[] {
    if (v === undefined) return [];
    return Array.isArray(v) ? v : [v];
}

function specToDir(spec: AmxxpackInputSpec): string | undefined {
    if (typeof spec === 'string') return spec;
    if (spec && typeof spec === 'object' && typeof spec.dir === 'string') return spec.dir;
    return undefined;
}

/**
 * Extract the effective compiler include directories from a parsed
 * {@link AmxxpackConfig}. Combines:
 *
 * - `input.include` — the user's own include folder(s)
 * - `include[]` — third-party / compiler include folders
 *
 * All returned paths are absolute. Relative paths are resolved against
 * `workspaceRoot`.
 *
 * @example
 * collectAmxxpackIncludePaths(
 *     { include: ['./.compiler/include'], input: { include: './src/include' } },
 *     '/proj',
 * );
 * // → ['/proj/src/include', '/proj/.compiler/include']
 */
export function collectAmxxpackIncludePaths(
    config: AmxxpackConfig,
    workspaceRoot: string,
): string[] {
    const raw: string[] = [];

    for (const spec of toArray(config.input?.include)) {
        const dir = specToDir(spec);
        if (dir) raw.push(dir);
    }
    for (const p of config.include ?? []) {
        if (typeof p === 'string' && p.length > 0) raw.push(p);
    }

    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of raw) {
        const abs = Path.isAbsolute(p) ? Path.normalize(p) : Path.resolve(workspaceRoot, p);
        if (!seen.has(abs)) {
            seen.add(abs);
            out.push(abs);
        }
    }
    return out;
}
