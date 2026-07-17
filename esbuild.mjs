import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
const production = process.argv.includes('--production');

/** @type {import('esbuild').BuildOptions} */
const common = {
    bundle: true,
    format: 'cjs',
    platform: 'node',
    target: 'node20',
    external: ['vscode'],
    sourcemap: !production,
    minify: production,
    logLevel: 'info',
};

const clientCfg = {
    ...common,
    entryPoints: ['src/client/extension.ts'],
    outfile: 'dist/extension.js',
};

const serverCfg = {
    ...common,
    entryPoints: ['src/server/server.ts'],
    outfile: 'dist/server.js',
};

if (watch) {
    const [c, s] = await Promise.all([
        esbuild.context(clientCfg),
        esbuild.context(serverCfg),
    ]);
    await Promise.all([c.watch(), s.watch()]);
    console.log('esbuild watching...');
} else {
    await Promise.all([
        esbuild.build(clientCfg),
        esbuild.build(serverCfg),
    ]);
}
