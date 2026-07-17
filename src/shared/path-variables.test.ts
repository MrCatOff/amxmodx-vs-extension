import { describe, expect, it } from 'vitest';
import { resolvePathVariables } from './path-variables.js';

describe('resolvePathVariables', () => {
    const workspace = '/home/user/project';
    const file = '/home/user/project/plugins/hello.sma';

    it('substitutes ${workspaceRoot}', () => {
        expect(resolvePathVariables('${workspaceRoot}/include', workspace, file)).toBe(
            '/home/user/project/include',
        );
    });

    it('supports ${workspaceFolder} alias', () => {
        expect(resolvePathVariables('${workspaceFolder}/include', workspace, file)).toBe(
            '/home/user/project/include',
        );
    });

    it('resolves file-related variables', () => {
        expect(resolvePathVariables('${fileBasename}', workspace, file)).toBe('hello.sma');
        expect(resolvePathVariables('${fileBasenameNoExtension}', workspace, file)).toBe('hello');
        expect(resolvePathVariables('${fileDirname}', workspace, file)).toBe(
            '/home/user/project/plugins',
        );
        expect(resolvePathVariables('${fileExtname}', workspace, file)).toBe('.sma');
    });

    it('leaves unknown variables in place', () => {
        expect(resolvePathVariables('${unknown}/path', workspace, file)).toBe('${unknown}/path');
    });

    it('leaves unterminated ${ in place', () => {
        expect(resolvePathVariables('foo/${bar', workspace, file)).toBe('foo/${bar');
    });

    it('handles no variables', () => {
        expect(resolvePathVariables('/plain/path', workspace, file)).toBe('/plain/path');
    });

    it('handles multiple substitutions in one string', () => {
        expect(resolvePathVariables('${workspaceRoot}/${fileBasename}', workspace, file)).toBe(
            '/home/user/project/hello.sma',
        );
    });

    describe('${env:...}', () => {
        it('resolves defined env variables', () => {
            expect(
                resolvePathVariables('${env:AMXX_HOME}/inc', undefined, undefined, {
                    env: { AMXX_HOME: '/opt/amxmodx' },
                }),
            ).toBe('/opt/amxmodx/inc');
        });

        it('supports env vars alongside other placeholders', () => {
            expect(
                resolvePathVariables(
                    '${env:PREFIX}${workspaceRoot}/${env:SUFFIX}',
                    '/proj',
                    undefined,
                    { env: { PREFIX: '/root', SUFFIX: 'end' } },
                ),
            ).toBe('/root/proj/end');
        });

        it('leaves unknown env vars in place', () => {
            expect(
                resolvePathVariables('${env:MISSING}/inc', undefined, undefined, { env: {} }),
            ).toBe('${env:MISSING}/inc');
        });

        it('treats empty env var name as unknown', () => {
            expect(
                resolvePathVariables('${env:}/inc', undefined, undefined, { env: {} }),
            ).toBe('${env:}/inc');
        });

        it('reads from process.env by default', () => {
            const key = '__AMXMODX_TEST_ENV__';
            process.env[key] = 'from-process';
            try {
                expect(
                    resolvePathVariables(`\${env:${key}}/inc`, undefined, undefined),
                ).toBe('from-process/inc');
            } finally {
                delete process.env[key];
            }
        });
    });
});
