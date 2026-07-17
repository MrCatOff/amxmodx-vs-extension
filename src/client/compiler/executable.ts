import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as Path from 'node:path';
import type * as vscode from 'vscode';
import { t } from '../../shared/l10n.js';

/**
 * Check that the given path is executable by the current process. Emits a
 * message to `outputChannel` on failure and returns `false`.
 *
 * @example
 * if (!(await ensureExecutable('/opt/amxmodx/amxxpc', channel))) return;
 */
export async function ensureExecutable(
    pathToCheck: string,
    outputChannel: vscode.OutputChannel,
): Promise<boolean> {
    try {
        await fs.access(pathToCheck, fsSync.constants.X_OK);
        return true;
    } catch {
        outputChannel.appendLine(
            t("Can't access amxxpc. Please check that the path is correct and that you have execute permission."),
        );
        return false;
    }
}

/**
 * Discover the `amxxpc` executable that lives next to the active `.sma` file
 * (as opposed to the globally configured executable). Rules match the original
 * "Compile Plugin Local" behaviour:
 *
 * 1. If `amxxpc.exe` exists in `directory`, use it (Windows).
 * 2. Otherwise, if exactly one file starting with `amxxpc` exists, use it.
 * 3. If zero or more than one match — report to `outputChannel` and return
 *    `undefined`.
 *
 * @example
 * const exe = await locateLocalExecutable('/proj/scripting', channel);
 * // → '/proj/scripting/amxxpc' or undefined
 */
export async function locateLocalExecutable(
    directory: string,
    outputChannel: vscode.OutputChannel,
): Promise<string | undefined> {
    let entries: string[];
    try {
        entries = await fs.readdir(directory);
    } catch (err) {
        outputChannel.appendLine(t('Failed to read directory {0}: {1}', directory, String(err)));
        return undefined;
    }

    const candidates = entries.filter((f) => f.startsWith('amxxpc'));
    if (candidates.includes('amxxpc.exe')) {
        return Path.join(directory, 'amxxpc.exe');
    }
    if (candidates.length === 0) {
        outputChannel.appendLine(
            t("There are no files starting with 'amxxpc' in '{0}'. Failed detecting amxxpc executable.", directory),
        );
        return undefined;
    }
    if (candidates.length > 1) {
        outputChannel.appendLine(
            t("Ambiguous result: more than 1 file in '{0}' starts with 'amxxpc'. Failed detecting amxxpc executable.", directory),
        );
        return undefined;
    }
    return Path.join(directory, candidates[0]);
}
