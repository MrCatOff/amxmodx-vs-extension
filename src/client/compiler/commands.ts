import * as fs from 'node:fs/promises';
import * as Path from 'node:path';
import * as vscode from 'vscode';
import { t } from '../../shared/l10n.js';
import { resolvePathVariables } from '../../shared/path-variables.js';
import { resolveProject } from '../../shared/project.js';
import type { CompilerSettings } from '../../shared/settings.js';
import { ensureExecutable, locateLocalExecutable } from './executable.js';
import { formatCompilerOutput } from './output.js';
import { runCompiler } from './process.js';
import { firstWorkspaceRoot, readCompilerSettings, readProjectSettings } from './settings.js';

async function resolveOutputPath(
    settings: CompilerSettings,
    inputPath: string,
    workspaceRoot: string | undefined,
    outputChannel: vscode.OutputChannel,
): Promise<string | undefined> {
    if (settings.outputType === 'source') {
        const base = Path.basename(inputPath, Path.extname(inputPath));
        return Path.join(Path.dirname(inputPath), `${base}.amxx`);
    }
    if (settings.outputType === 'path') {
        const resolved = resolvePathVariables(settings.outputPath, workspaceRoot, inputPath);
        try {
            await fs.access(resolved);
        } catch {
            outputChannel.appendLine(t("Path {0} doesn't exist. Compilation aborted.", resolved));
            return undefined;
        }
        const base = Path.basename(inputPath, Path.extname(inputPath));
        return Path.join(resolved, `${base}.amxx`);
    }
    outputChannel.appendLine(
        t("'amxmodx.compiler.outputType' has an invalid value: {0}", settings.outputType),
    );
    return undefined;
}

async function prepareEditor(
    outputChannel: vscode.OutputChannel,
): Promise<{ editor: vscode.TextEditor; inputPath: string } | undefined> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        outputChannel.appendLine(t('No active window with Pawn code.'));
        return undefined;
    }
    if (editor.document.uri.scheme !== 'file') {
        outputChannel.appendLine(t('The input file is not a file on the disk.'));
        return undefined;
    }
    if (editor.document.isDirty) {
        const saved = await editor.document.save();
        if (!saved) {
            outputChannel.appendLine(t('File save failed.'));
            return undefined;
        }
    }
    return { editor, inputPath: editor.document.uri.fsPath };
}

async function doCompile(
    executablePath: string,
    inputPath: string,
    settings: CompilerSettings,
    outputChannel: vscode.OutputChannel,
    diagnosticCollection: vscode.DiagnosticCollection,
): Promise<void> {
    diagnosticCollection.clear();
    const workspaceRoot = firstWorkspaceRoot();

    const outputPath = await resolveOutputPath(settings, inputPath, workspaceRoot, outputChannel);
    if (!outputPath) return;

    const project = resolveProject(readProjectSettings(), settings, workspaceRoot);
    for (const err of project.errors) outputChannel.appendLine(err);
    if (project.active) {
        outputChannel.appendLine(t('amxxpack config: {0}', project.configPath ?? ''));
    }

    const args: string[] = [
        inputPath,
        ...settings.options,
        ...project.includePaths.map((p) => `-i${resolvePathVariables(p, workspaceRoot, inputPath)}`),
        `-o${outputPath}`,
    ];

    if (settings.showInfoMessages) {
        outputChannel.appendLine(t('Starting amxxpc: {0} {1}', executablePath, args.join(' ')) + '\n');
    }

    const { code, stdout } = await runCompiler(
        executablePath,
        args,
        outputChannel,
        settings.reformatOutput,
    );

    if (settings.reformatOutput) {
        formatCompilerOutput(stdout, outputPath, workspaceRoot, outputChannel, diagnosticCollection);
    }

    if (settings.showInfoMessages) {
        outputChannel.appendLine('\n' + t('amxxpc exited with code {0}.', String(code)));
    }
}

/**
 * Implementation of the `amxmodx.compile` command.
 *
 * Reads the configured `amxmodx.compiler.executablePath`, saves the active
 * editor if dirty, then runs amxxpc and pushes any errors/warnings into
 * `diagnosticCollection`.
 *
 * @example
 * vscode.commands.registerCommand('amxmodx.compile', () => compile(channel, diags));
 */
export async function compile(
    outputChannel: vscode.OutputChannel,
    diagnosticCollection: vscode.DiagnosticCollection,
): Promise<void> {
    outputChannel.clear();
    const settings = readCompilerSettings();
    if (settings.switchToOutput) outputChannel.show();

    const prep = await prepareEditor(outputChannel);
    if (!prep) return;

    const executablePath = resolvePathVariables(
        settings.executablePath,
        firstWorkspaceRoot(),
        prep.inputPath,
    );
    if (!(await ensureExecutable(executablePath, outputChannel))) return;

    await doCompile(executablePath, prep.inputPath, settings, outputChannel, diagnosticCollection);
}

/**
 * Implementation of the `amxmodx.compileLocal` command.
 *
 * Instead of using `amxmodx.compiler.executablePath`, this searches the
 * directory of the active `.sma` for an `amxxpc*` executable. Handy when
 * developers ship amxxpc alongside their source tree.
 *
 * @example
 * vscode.commands.registerCommand('amxmodx.compileLocal', () => compileLocal(channel, diags));
 */
export async function compileLocal(
    outputChannel: vscode.OutputChannel,
    diagnosticCollection: vscode.DiagnosticCollection,
): Promise<void> {
    outputChannel.clear();
    const settings = readCompilerSettings();
    if (settings.switchToOutput) outputChannel.show();

    const prep = await prepareEditor(outputChannel);
    if (!prep) return;

    const executableDir = Path.dirname(prep.inputPath);
    const executablePath = await locateLocalExecutable(executableDir, outputChannel);
    if (!executablePath) return;
    if (!(await ensureExecutable(executablePath, outputChannel))) return;

    await doCompile(executablePath, prep.inputPath, settings, outputChannel, diagnosticCollection);
}
