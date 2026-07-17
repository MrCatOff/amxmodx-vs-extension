import * as path from 'node:path';
import { promises as fs } from 'node:fs';

interface MochaLike {
    new (options: { ui: string; color: boolean; timeout: number }): {
        addFile(file: string): void;
        run(cb: (failures: number) => void): void;
    };
}

export async function run(): Promise<void> {
    const MochaCtor = (await import('mocha')).default as unknown as MochaLike;
    const mocha = new MochaCtor({ ui: 'bdd', color: true, timeout: 30_000 });

    const testsRoot = path.resolve(__dirname);
    const entries = await fs.readdir(testsRoot);
    for (const entry of entries) {
        if (entry.endsWith('.test.js')) {
            mocha.addFile(path.join(testsRoot, entry));
        }
    }

    return new Promise((resolve, reject) => {
        try {
            mocha.run((failures) => {
                if (failures > 0) reject(new Error(`${failures} test(s) failed.`));
                else resolve();
            });
        } catch (err) {
            reject(err);
        }
    });
}
