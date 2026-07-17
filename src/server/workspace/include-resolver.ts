import * as fs from 'node:fs';
import * as Path from 'node:path';
import { URI } from 'vscode-uri';

/**
 * Locate an included file on disk by trying every configured include path,
 * with an optional workspace-local fallback tried first. Returns the resolved
 * URI, or `undefined` when the file is not found.
 *
 * Mirrors amxxpc's own lookup — tries the bare filename first, then the same
 * name with a `.inc` suffix.
 *
 * @example
 * resolveIncludePath(
 *     'amxmodx',
 *     '/proj/scripting',
 *     ['/opt/amxmodx/scripting/include'],
 * );
 * // → 'file:///opt/amxmodx/scripting/include/amxmodx.inc' (if it exists)
 */
export function resolveIncludePath(
    filename: string,
    localTo: string | undefined,
    includePaths: readonly string[],
): string | undefined {
    const candidates = localTo !== undefined ? [localTo, ...includePaths] : [...includePaths];

    for (const dir of candidates) {
        const bare = Path.join(dir, filename);
        try {
            fs.accessSync(bare, fs.constants.R_OK);
            return URI.file(bare).toString();
        } catch {
            const withExt = bare + '.inc';
            try {
                fs.accessSync(withExt, fs.constants.R_OK);
                return URI.file(withExt).toString();
            } catch {
                continue;
            }
        }
    }
    return undefined;
}
