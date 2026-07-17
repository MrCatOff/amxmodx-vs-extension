import * as Path from 'node:path';
import * as vscode from 'vscode';
import {
    LanguageClient,
    TransportKind,
    type LanguageClientOptions,
    type ServerOptions,
} from 'vscode-languageclient/node.js';
import { initL10n } from '../shared/l10n.js';
import { compile, compileLocal } from './compiler/commands.js';

let client: LanguageClient | undefined;
let diagnosticCollection: vscode.DiagnosticCollection;

/**
 * VS Code extension entry point.
 *
 * Wires up the language client (which spawns the LSP server as a separate Node
 * process over IPC), registers the compile commands, and clears diagnostics on
 * every keystroke so stale amxxpc errors don't linger. Localization is
 * initialized here so shared code and the client compile commands see
 * translated strings.
 *
 * @example
 * // Called automatically by VS Code when a file with language id 'amxmodx' opens.
 * activate(extensionContext);
 */
export async function activate(ctx: vscode.ExtensionContext): Promise<void> {
    const l10nDir = ctx.asAbsolutePath('l10n');
    initL10n(l10nDir, vscode.env.language);

    const serverModulePath = ctx.asAbsolutePath(Path.join('dist', 'server.js'));
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

    const serverOptions: ServerOptions = {
        run: { module: serverModulePath, transport: TransportKind.ipc },
        debug: { module: serverModulePath, transport: TransportKind.ipc, options: debugOptions },
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'amxmodx' }],
        synchronize: {
            configurationSection: ['amxmodx.language', 'amxmodx.compiler', 'amxmodx.project'],
            fileEvents: [
                vscode.workspace.createFileSystemWatcher('**/*.{sma,inc}'),
                vscode.workspace.createFileSystemWatcher('**/.amxxpack.json'),
            ],
        },
        initializationOptions: {
            locale: vscode.env.language,
            l10nBundlePath: l10nDir,
        },
    };

    client = new LanguageClient(
        'amxmodx',
        'AmxModX Language Service',
        serverOptions,
        clientOptions,
    );

    const outputChannel = vscode.window.createOutputChannel('AMXXPC Output / AmxModX');
    diagnosticCollection = vscode.languages.createDiagnosticCollection('amxmodx');

    ctx.subscriptions.push(
        outputChannel,
        diagnosticCollection,
        vscode.commands.registerCommand('amxmodx.compile', () =>
            compile(outputChannel, diagnosticCollection),
        ),
        vscode.commands.registerCommand('amxmodx.compileLocal', () =>
            compileLocal(outputChannel, diagnosticCollection),
        ),
        vscode.workspace.onDidChangeTextDocument((ev) => {
            diagnosticCollection.delete(ev.document.uri);
        }),
    );

    await client.start();
}

/**
 * Deactivation hook — stops the language client cleanly so its server child
 * process is torn down.
 *
 * @example
 * // Called automatically by VS Code on extension shutdown.
 * await deactivate();
 */
export async function deactivate(): Promise<void> {
    if (client) {
        await client.stop();
        client = undefined;
    }
}
