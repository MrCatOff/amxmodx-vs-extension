import * as assert from 'node:assert';
import * as vscode from 'vscode';

suite('AmxModX extension', () => {
    test('is present in the marketplace listing', () => {
        const ext = vscode.extensions.getExtension('KliPPy.amxmodx-language');
        assert.ok(ext, 'Extension should be installed');
    });

    test('activates when an amxmodx document is opened', async () => {
        const ext = vscode.extensions.getExtension('KliPPy.amxmodx-language');
        assert.ok(ext);
        const doc = await vscode.workspace.openTextDocument({
            language: 'amxmodx',
            content: '#include <amxmodx>\npublic plugin_init() { }\n',
        });
        await vscode.window.showTextDocument(doc);

        await new Promise((r) => setTimeout(r, 500));
        assert.strictEqual(ext.isActive, true, 'Extension should activate on amxmodx document');
    });

    test('registers compile commands', async () => {
        const cmds = await vscode.commands.getCommands(true);
        assert.ok(cmds.includes('amxmodx.compile'));
        assert.ok(cmds.includes('amxmodx.compileLocal'));
    });
});
