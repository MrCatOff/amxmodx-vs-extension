import * as fs from 'node:fs';
import * as os from 'node:os';
import * as Path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CompilerSettings, ProjectSettings } from './settings.js';
import { hasAmxxpackConfig, resolveProject } from './project.js';

function makeCompilerSettings(overrides: Partial<CompilerSettings> = {}): CompilerSettings {
    return {
        executablePath: '',
        includePaths: [],
        options: [],
        outputType: 'source',
        outputPath: '',
        showInfoMessages: false,
        reformatOutput: true,
        switchToOutput: true,
        ...overrides,
    };
}

describe('resolveProject', () => {
    let tmpRoot: string;

    beforeEach(() => {
        tmpRoot = fs.mkdtempSync(Path.join(os.tmpdir(), 'amxmodx-proj-'));
    });
    afterEach(() => {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    const auto: ProjectSettings = { type: 'auto', configFile: '.amxxpack.json' };
    const defaults: ProjectSettings = { type: 'default', configFile: '.amxxpack.json' };
    const amxxpack: ProjectSettings = { type: 'amxxpack', configFile: '.amxxpack.json' };

    it('type=default ignores amxxpack even if the file exists', () => {
        fs.writeFileSync(Path.join(tmpRoot, '.amxxpack.json'), '{"include":["./inc"]}');
        const result = resolveProject(defaults, makeCompilerSettings({ includePaths: ['/u'] }), tmpRoot);
        expect(result.active).toBe(false);
        expect(result.includePaths).toEqual(['/u']);
        expect(result.errors).toEqual([]);
    });

    it('type=auto with no config file falls back to user includes', () => {
        const result = resolveProject(auto, makeCompilerSettings({ includePaths: ['/u'] }), tmpRoot);
        expect(result.active).toBe(false);
        expect(result.includePaths).toEqual(['/u']);
        expect(result.errors).toEqual([]);
    });

    it('type=auto with config file loads it and merges', () => {
        fs.writeFileSync(
            Path.join(tmpRoot, '.amxxpack.json'),
            JSON.stringify({ include: ['./third'], input: { include: './src/include' } }),
        );
        const result = resolveProject(auto, makeCompilerSettings({ includePaths: ['/u'] }), tmpRoot);
        expect(result.active).toBe(true);
        expect(result.includePaths).toEqual([
            '/u',
            Path.join(tmpRoot, 'src/include'),
            Path.join(tmpRoot, 'third'),
        ]);
    });

    it('type=amxxpack without config file reports an error', () => {
        const result = resolveProject(amxxpack, makeCompilerSettings(), tmpRoot);
        expect(result.active).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('.amxxpack.json');
    });

    it('resolves ${workspaceRoot} in user include paths before merging', () => {
        fs.writeFileSync(Path.join(tmpRoot, '.amxxpack.json'), '{"include":["./third"]}');
        const result = resolveProject(
            auto,
            makeCompilerSettings({ includePaths: ['${workspaceRoot}/user'] }),
            tmpRoot,
        );
        expect(result.includePaths[0]).toBe(`${tmpRoot}/user`);
    });

    it('de-duplicates when user and amxxpack point to the same place', () => {
        const shared = Path.join(tmpRoot, 'shared');
        fs.writeFileSync(Path.join(tmpRoot, '.amxxpack.json'), '{"include":["./shared"]}');
        const result = resolveProject(auto, makeCompilerSettings({ includePaths: [shared] }), tmpRoot);
        expect(result.includePaths).toEqual([shared]);
    });

    it('supports absolute paths in configFile', () => {
        const nested = Path.join(tmpRoot, 'nested');
        fs.mkdirSync(nested);
        const absConfig = Path.join(nested, 'amxx.json');
        fs.writeFileSync(absConfig, '{"include":["./inc"]}');
        const result = resolveProject(
            { type: 'auto', configFile: absConfig },
            makeCompilerSettings(),
            tmpRoot,
        );
        expect(result.active).toBe(true);
        expect(result.includePaths).toEqual([Path.join(nested, 'inc')]);
    });
});

describe('hasAmxxpackConfig', () => {
    let tmpRoot: string;

    beforeEach(() => {
        tmpRoot = fs.mkdtempSync(Path.join(os.tmpdir(), 'amxmodx-has-'));
    });
    afterEach(() => {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
    });

    it('detects an existing file', () => {
        fs.writeFileSync(Path.join(tmpRoot, '.amxxpack.json'), '{}');
        expect(hasAmxxpackConfig({ type: 'auto', configFile: '.amxxpack.json' }, tmpRoot)).toBe(true);
    });

    it('returns false when the file is missing', () => {
        expect(hasAmxxpackConfig({ type: 'auto', configFile: '.amxxpack.json' }, tmpRoot)).toBe(false);
    });

    it('returns false when workspaceRoot is undefined', () => {
        expect(hasAmxxpackConfig({ type: 'auto', configFile: '.amxxpack.json' }, undefined)).toBe(false);
    });
});
