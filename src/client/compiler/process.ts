import * as CP from 'node:child_process';
import * as Path from 'node:path';
import type * as vscode from 'vscode';
import { t } from '../../shared/l10n.js';

/**
 * The concise result of running amxxpc. `code` is `null` when the process
 * failed to start (`spawn ENOENT` etc.).
 */
export interface CompilerResult {
    code: number | null;
    stdout: string;
}

/**
 * Spawn `amxxpc` with the given arguments and collect its output.
 *
 * When `reformat` is false, stdout is streamed live into `outputChannel`.
 * When `reformat` is true, stdout is buffered so that {@link buildDiagnostics}
 * can parse and reformat it after the process exits.
 *
 * @example
 * const { code, stdout } = await runCompiler(
 *     '/opt/amxmodx/amxxpc',
 *     ['plugin.sma', '-oplugin.amxx'],
 *     channel,
 *     true,
 * );
 */
export function runCompiler(
    executablePath: string,
    args: string[],
    outputChannel: vscode.OutputChannel,
    reformat: boolean,
): Promise<CompilerResult> {
    return new Promise((resolve) => {
        const proc = CP.spawn(executablePath, args, {
            env: process.env,
            cwd: Path.dirname(executablePath),
        });
        let stdout = '';

        proc.stdout.on('data', (data: Buffer) => {
            const text = data.toString();
            if (reformat) stdout += text;
            else outputChannel.append(text);
        });
        proc.stderr.on('data', (data: Buffer) => {
            outputChannel.append('stderr: ' + data.toString());
        });
        proc.on('error', (err) => {
            outputChannel.appendLine(t('Failed to start amxxpc: {0}', err.message));
            resolve({ code: null, stdout });
        });
        proc.on('close', (code) => resolve({ code, stdout }));
    });
}
