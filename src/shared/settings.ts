/**
 * Where the compiled `.amxx` file should land.
 * - `source`: same directory as the input `.sma` file.
 * - `path`: the directory named by {@link CompilerSettings.outputPath}.
 */
export type OutputType = 'source' | 'path';

/**
 * Settings under `amxmodx.compiler.*`.
 *
 * @example
 * const settings: CompilerSettings = {
 *     executablePath: '/opt/amxmodx/scripting/amxxpc',
 *     includePaths: ['${workspaceFolder}/scripting/include'],
 *     options: [],
 *     outputType: 'source',
 *     outputPath: '',
 *     showInfoMessages: false,
 *     reformatOutput: true,
 *     switchToOutput: true,
 * };
 */
export interface CompilerSettings {
    executablePath: string;
    includePaths: string[];
    options: string[];
    outputType: OutputType;
    outputPath: string;
    showInfoMessages: boolean;
    reformatOutput: boolean;
    switchToOutput: boolean;
}

/**
 * Settings under `amxmodx.language.*`.
 *
 * @example
 * const language: LanguageSettings = { reparseInterval: 1500, webApiLinks: true };
 */
export interface LanguageSettings {
    reparseInterval: number;
    webApiLinks: boolean;
}

/**
 * Which project layout the extension should assume.
 *
 * - `auto`: use amxxpack if `.amxxpack.json` exists at the workspace root,
 *   otherwise fall back to plain `amxmodx.compiler.*` settings.
 * - `default`: ignore `.amxxpack.json` even if present.
 * - `amxxpack`: require `.amxxpack.json`; report an error if it is missing.
 */
export type ProjectType = 'auto' | 'default' | 'amxxpack';

/**
 * Settings under `amxmodx.project.*`.
 *
 * @example
 * const project: ProjectSettings = { type: 'auto', configFile: '.amxxpack.json' };
 */
export interface ProjectSettings {
    type: ProjectType;
    configFile: string;
}

/**
 * Root shape synced from the client to the server via `workspace/didChangeConfiguration`.
 *
 * @example
 * const synced: SyncedSettings = {
 *     compiler: { ...compilerDefaults },
 *     language: { reparseInterval: 1500, webApiLinks: true },
 *     project: { type: 'auto', configFile: '.amxxpack.json' },
 * };
 */
export interface SyncedSettings {
    compiler: CompilerSettings;
    language: LanguageSettings;
    project: ProjectSettings;
}
