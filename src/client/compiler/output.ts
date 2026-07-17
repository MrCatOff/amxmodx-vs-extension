import * as Path from 'node:path';
import * as vscode from 'vscode';
import { t } from '../../shared/l10n.js';

interface OutputDiagnostic {
    type: 'warning' | 'error';
    startLine: number;
    endLine?: number;
    message: string;
}

interface FileOutput {
    diagnostics: OutputDiagnostic[];
}

// Group 1 = filename, 2 = start line, 3 = end line (optional), 4 = severity, 5 = message
const OUTPUT_REGEX = /(.+?)\((\d+)(?:\s--\s(\d+))?\)\s:\s(warning|error)\s\d+:\s(.*)/g;

/**
 * Convert `target` into a workspace-relative path when it lives inside the
 * given root; otherwise return it unchanged.
 *
 * @example
 * relativeIfInside('/proj', '/proj/a.sma');           // 'a.sma'
 * relativeIfInside('/proj', '/other/a.sma');          // '/other/a.sma'
 * relativeIfInside(undefined, '/proj/a.sma');         // '/proj/a.sma'
 */
export function relativeIfInside(root: string | undefined, target: string): string {
    if (!root) return target;
    const rel = Path.relative(root, target);
    return rel.startsWith('..') ? target : rel;
}

/**
 * Parse the buffered amxxpc stdout, group errors/warnings by file, log a
 * human-readable summary to `outputChannel`, and populate `diagnosticCollection`
 * with matching VS Code diagnostics.
 *
 * @example
 * formatCompilerOutput(stdout, '/proj/a.amxx', '/proj', channel, diagCollection);
 */
export function formatCompilerOutput(
    stdout: string,
    outputPath: string,
    workspaceRoot: string | undefined,
    outputChannel: vscode.OutputChannel,
    diagnosticCollection: vscode.DiagnosticCollection,
): void {
    const perFile = new Map<string, FileOutput>();

    OUTPUT_REGEX.lastIndex = 0;
    for (let m: RegExpExecArray | null; (m = OUTPUT_REGEX.exec(stdout)); ) {
        const [, file, startStr, endStr, sev, msg] = m;
        const entry = perFile.get(file) ?? { diagnostics: [] };
        entry.diagnostics.push({
            type: sev as 'warning' | 'error',
            message: msg,
            startLine: Number.parseInt(startStr, 10),
            endLine: endStr !== undefined ? Number.parseInt(endStr, 10) : undefined,
        });
        perFile.set(file, entry);
    }

    if (/Done\./.test(stdout)) {
        outputChannel.appendLine(t('Success'));
        outputChannel.appendLine(t('Output: {0}', relativeIfInside(workspaceRoot, outputPath)) + '\n');
    }

    for (const [file, out] of perFile) {
        const display = relativeIfInside(workspaceRoot, file);
        const resourceDiagnostics: vscode.Diagnostic[] = [];
        outputChannel.appendLine(`===== ${display} =====`);

        for (const kind of ['warning', 'error'] as const) {
            for (const d of out.diagnostics.filter((x) => x.type === kind)) {
                const label = kind === 'warning' ? t('WARNING') : t('ERROR');
                const lineRange = d.endLine !== undefined ? `${d.startLine} -- ${d.endLine}` : `${d.startLine}`;
                outputChannel.appendLine(`${label} [${lineRange}]: ${d.message}`);

                const range = new vscode.Range(
                    d.startLine - 1,
                    0,
                    (d.endLine ?? d.startLine) - 1,
                    Number.MAX_VALUE,
                );
                resourceDiagnostics.push(
                    new vscode.Diagnostic(
                        range,
                        `${label}: ${d.message}`,
                        kind === 'warning'
                            ? vscode.DiagnosticSeverity.Warning
                            : vscode.DiagnosticSeverity.Error,
                    ),
                );
            }
        }

        diagnosticCollection.set(vscode.Uri.file(file), resourceDiagnostics);
        outputChannel.append('\n');
    }
}
