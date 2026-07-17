import * as vscode from 'vscode';
import type { CompilerSettings, ProjectSettings } from '../../shared/settings.js';

/** Configuration namespace under which every compiler setting lives. */
export const CONFIG_NAMESPACE = 'amxmodx';

/**
 * Read the current `amxmodx.compiler.*` settings from the workspace.
 *
 * @example
 * const s = readCompilerSettings();
 * s.executablePath; // '/opt/amxmodx/scripting/amxxpc'
 */
export function readCompilerSettings(): CompilerSettings {
    return vscode.workspace
        .getConfiguration(CONFIG_NAMESPACE)
        .get<CompilerSettings>('compiler') as CompilerSettings;
}

/**
 * Read the current `amxmodx.project.*` settings, defaulting missing fields.
 *
 * @example
 * readProjectSettings(); // { type: 'auto', configFile: '.amxxpack.json' }
 */
export function readProjectSettings(): ProjectSettings {
    const cfg = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
    return {
        type: cfg.get<ProjectSettings['type']>('project.type') ?? 'auto',
        configFile: cfg.get<string>('project.configFile') ?? '.amxxpack.json',
    };
}

/**
 * Return the fs path of the first workspace folder, or `undefined` when the
 * user is editing a loose file with no workspace open.
 *
 * @example
 * firstWorkspaceRoot(); // '/home/user/myplugin' or undefined
 */
export function firstWorkspaceRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    return folders && folders.length > 0 ? folders[0].uri.fsPath : undefined;
}
