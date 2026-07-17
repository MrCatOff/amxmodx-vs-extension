import * as Path from 'node:path';

/**
 * Names supported without a namespace prefix. Everything else must be namespaced
 * (currently only `env:` is understood).
 */
const KNOWN_SIMPLE = new Set([
    'workspaceRoot',
    'workspaceFolder',
    'workspaceRootFolderName',
    'workspaceFolderBasename',
    'file',
    'relativeFile',
    'fileBasename',
    'fileBasenameNoExtension',
    'fileDirname',
    'fileExtname',
]);

function substituteSimple(
    name: string,
    workspacePath: string | undefined,
    filePath: string | undefined,
): string | undefined {
    switch (name) {
        case 'workspaceRoot':
        case 'workspaceFolder':
            return workspacePath;
        case 'workspaceRootFolderName':
        case 'workspaceFolderBasename':
            return workspacePath !== undefined ? Path.basename(workspacePath) : undefined;
        case 'file':
            return filePath;
        case 'relativeFile':
            return filePath !== undefined && workspacePath !== undefined
                ? Path.relative(workspacePath, filePath)
                : undefined;
        case 'fileBasename':
            return filePath !== undefined ? Path.basename(filePath) : undefined;
        case 'fileBasenameNoExtension': {
            if (filePath === undefined) return undefined;
            const ext = Path.extname(filePath);
            return Path.basename(filePath, ext);
        }
        case 'fileDirname':
            return filePath !== undefined ? Path.dirname(filePath) : undefined;
        case 'fileExtname':
            return filePath !== undefined ? Path.extname(filePath) : undefined;
        default:
            return undefined;
    }
}

/**
 * Optional external hooks for {@link resolvePathVariables}. Primarily used by tests
 * to inject a synthetic environment without touching `process.env`.
 */
export interface ResolveOptions {
    /** Environment variable lookup; defaults to {@link process.env}. */
    env?: NodeJS.ProcessEnv;
}

/**
 * Resolve VS Code-style `${name}` placeholders inside a path string.
 *
 * Supported placeholders (all others are left in the string verbatim, matching VS Code):
 * - `${workspaceRoot}` / `${workspaceFolder}` — the workspace root directory
 * - `${workspaceRootFolderName}` / `${workspaceFolderBasename}` — its basename
 * - `${file}` — absolute path to the current file
 * - `${relativeFile}` — path relative to the workspace root
 * - `${fileBasename}`, `${fileBasenameNoExtension}`, `${fileDirname}`, `${fileExtname}`
 * - `${env:VarName}` — value of `process.env.VarName` (or `env?.VarName` when
 *   {@link ResolveOptions.env} is provided). If unset, the placeholder is preserved.
 *
 * @example
 * // ${workspaceRoot} substitution
 * resolvePathVariables('${workspaceRoot}/inc', '/proj', '/proj/a.sma');
 * // → '/proj/inc'
 *
 * @example
 * // Environment variable substitution
 * process.env.AMXX_HOME = '/opt/amxmodx';
 * resolvePathVariables('${env:AMXX_HOME}/scripting/include', undefined, undefined);
 * // → '/opt/amxmodx/scripting/include'
 *
 * @example
 * // Unknown variables are left in place
 * resolvePathVariables('${env:MISSING}/inc', undefined, undefined);
 * // → '${env:MISSING}/inc'
 *
 * @param path - Input path that may contain `${...}` placeholders.
 * @param workspacePath - Absolute workspace root, or `undefined` if there is no workspace.
 * @param filePath - Absolute path of the current file, or `undefined`.
 * @param options - Optional overrides (currently just a custom `env` map).
 * @returns The path with every recognized placeholder replaced.
 */
export function resolvePathVariables(
    path: string,
    workspacePath: string | undefined,
    filePath: string | undefined,
    options: ResolveOptions = {},
): string {
    const env = options.env ?? process.env;
    let index = 0;
    let out = '';

    while (index < path.length) {
        if (path[index] === '$' && path[index + 1] === '{') {
            const start = index;
            index += 2;
            while (index < path.length && path[index] !== '}') {
                index++;
            }
            if (index >= path.length) {
                return out + path.substring(start);
            }
            const name = path.substring(start + 2, index).trim();
            const value = resolvePlaceholder(name, workspacePath, filePath, env);
            index++;
            out += value === undefined ? path.substring(start, index) : value;
        } else {
            out += path[index++];
        }
    }

    return out;
}

/**
 * Resolve a single placeholder name (without the surrounding `${}`). Namespaced names
 * of the form `ns:key` are dispatched to their handler; plain names go through
 * {@link substituteSimple}.
 *
 * @example
 * resolvePlaceholder('env:HOME', undefined, undefined, { HOME: '/root' });
 * // → '/root'
 * resolvePlaceholder('workspaceRoot', '/proj', undefined, {});
 * // → '/proj'
 */
function resolvePlaceholder(
    name: string,
    workspacePath: string | undefined,
    filePath: string | undefined,
    env: NodeJS.ProcessEnv,
): string | undefined {
    const colon = name.indexOf(':');
    if (colon > 0) {
        const ns = name.substring(0, colon);
        const key = name.substring(colon + 1).trim();
        if (ns === 'env') return env[key];
        return undefined;
    }
    if (!KNOWN_SIMPLE.has(name)) return undefined;
    return substituteSimple(name, workspacePath, filePath);
}
