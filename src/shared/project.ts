import * as fs from 'node:fs';
import * as Path from 'node:path';
import {
    collectAmxxpackIncludePaths,
    loadAmxxpackConfig,
    type AmxxpackConfig,
} from './amxxpack.js';
import { t } from './l10n.js';
import { resolvePathVariables } from './path-variables.js';
import type { CompilerSettings, ProjectSettings } from './settings.js';

/**
 * The outcome of merging user settings with a possibly-present amxxpack
 * config. `active` indicates whether amxxpack mode ended up in effect.
 * `errors` carries user-visible problems (e.g. `type=amxxpack` but no config).
 */
export interface ResolvedProject {
    active: boolean;
    config: AmxxpackConfig | undefined;
    configPath: string | undefined;
    /** Effective compiler include paths in priority order. */
    includePaths: string[];
    errors: string[];
}

function absoluteConfigPath(project: ProjectSettings, workspaceRoot: string | undefined): string | undefined {
    if (!workspaceRoot) return undefined;
    return Path.isAbsolute(project.configFile)
        ? project.configFile
        : Path.resolve(workspaceRoot, project.configFile);
}

/**
 * True iff the workspace has an amxxpack config file at the configured path.
 *
 * @example
 * hasAmxxpackConfig({ type: 'auto', configFile: '.amxxpack.json' }, '/proj');
 * // → true iff /proj/.amxxpack.json exists
 */
export function hasAmxxpackConfig(project: ProjectSettings, workspaceRoot: string | undefined): boolean {
    const abs = absoluteConfigPath(project, workspaceRoot);
    if (!abs) return false;
    try {
        return fs.statSync(abs).isFile();
    } catch {
        return false;
    }
}

/**
 * Merge the user's `amxmodx.compiler.includePaths` with amxxpack-derived
 * include paths (when applicable) into a single ordered list.
 *
 * Precedence (first match wins during include resolution): explicit user
 * `includePaths` first, then amxxpack `input.include`, then amxxpack
 * `include[]`. Duplicates are removed.
 *
 * When `project.type` is `default`, amxxpack is ignored even if a config
 * file is present. When `project.type` is `amxxpack` but the file is
 * missing, an error is returned in {@link ResolvedProject.errors}.
 *
 * @example
 * resolveProject(
 *     { type: 'auto', configFile: '.amxxpack.json' },
 *     compilerSettings,
 *     '/proj',
 * );
 * // → { active: true, includePaths: ['/proj/src/include', ...], ... }
 */
export function resolveProject(
    project: ProjectSettings,
    compiler: CompilerSettings,
    workspaceRoot: string | undefined,
): ResolvedProject {
    const errors: string[] = [];
    const userIncludes = compiler.includePaths.map((p) =>
        resolvePathVariables(p, workspaceRoot, undefined),
    );

    if (project.type === 'default') {
        return {
            active: false,
            config: undefined,
            configPath: undefined,
            includePaths: dedupe(userIncludes),
            errors,
        };
    }

    const abs = absoluteConfigPath(project, workspaceRoot);
    const cfg = abs ? loadAmxxpackConfig(abs) : undefined;

    if (!cfg) {
        if (project.type === 'amxxpack') {
            errors.push(
                t(
                    "Project type is 'amxxpack' but {0} could not be loaded from {1}.",
                    project.configFile,
                    workspaceRoot ?? '',
                ),
            );
        }
        return {
            active: false,
            config: undefined,
            configPath: abs,
            includePaths: dedupe(userIncludes),
            errors,
        };
    }

    // Relative include paths inside .amxxpack.json resolve against the config
    // file's own directory (matching the behaviour of tsconfig/package.json).
    const configDir = abs ? Path.dirname(abs) : workspaceRoot;
    const amxxpackIncludes = configDir ? collectAmxxpackIncludePaths(cfg, configDir) : [];

    return {
        active: true,
        config: cfg,
        configPath: abs,
        includePaths: dedupe([...userIncludes, ...amxxpackIncludes]),
        errors,
    };
}

function dedupe(paths: string[]): string[] {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const p of paths) {
        const key = Path.normalize(p);
        if (!seen.has(key)) {
            seen.add(key);
            out.push(p);
        }
    }
    return out;
}
