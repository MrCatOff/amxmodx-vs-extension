import { FoldingRange, FoldingRangeKind } from 'vscode-languageserver/node.js';

const REGION_START = /^\s*\/\/\s*#?region\b/;
const REGION_END = /^\s*\/\/\s*#?endregion\b/;
const BANNER_DASH_BRACKET = /^\s*\/\*-+\[.+?\]-+\*\/\s*$/;
const BANNER_EQUALS = /^\s*\/\*\s*=.*=\s*\*\/\s*$/;

function isBanner(line: string): boolean {
    return BANNER_DASH_BRACKET.test(line) || BANNER_EQUALS.test(line);
}

/**
 * Compute folding ranges for a document. Handles two independent shapes:
 *
 *   1. `// #region` / `// #endregion` comment pairs — folded as the enclosed body.
 *   2. Single-line banner comments (`/*----[ Label ]----* /` or `/* = Label = * /`)
 *      — each banner folds up to the line *before* the next banner (or EOF), so
 *      the reader can collapse an entire logical section without needing an
 *      explicit closing marker.
 */
export function provideFoldingRanges(text: string): FoldingRange[] {
    const lines = text.split(/\r?\n/);
    const ranges: FoldingRange[] = [];
    const regionStack: number[] = [];
    let currentBanner = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (REGION_START.test(line)) {
            regionStack.push(i);
            continue;
        }

        if (REGION_END.test(line)) {
            const start = regionStack.pop();
            if (start !== undefined && i > start) {
                ranges.push({
                    startLine: start,
                    endLine: i,
                    kind: FoldingRangeKind.Region,
                });
            }
            continue;
        }

        if (isBanner(line)) {
            if (currentBanner >= 0 && i - 1 > currentBanner) {
                ranges.push({
                    startLine: currentBanner,
                    endLine: i - 1,
                    kind: FoldingRangeKind.Region,
                });
            }
            currentBanner = i;
        }
    }

    if (currentBanner >= 0 && currentBanner < lines.length - 1) {
        ranges.push({
            startLine: currentBanner,
            endLine: lines.length - 1,
            kind: FoldingRangeKind.Region,
        });
    }

    return ranges;
}
