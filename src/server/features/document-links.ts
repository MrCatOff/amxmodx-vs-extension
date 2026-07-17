import type { DocumentLink } from 'vscode-languageserver/node.js';
import { amxmodxDefaultHeaders } from '../constants/default-headers.js';
import type { ResolvedInclusion } from '../types.js';

/**
 * Turn every `#include` targeting a known AMX Mod X default header into a
 * `DocumentLink` pointing at the online API reference. All other includes are
 * dropped (already navigable via "Go to Definition").
 *
 * @example
 * const links = buildIncludeLinks([{
 *     uri: 'file:///path/amxmodx.inc',
 *     descriptor: { filename: 'amxmodx', start, end, isLocal: false, isSilent: false },
 * }]);
 * // → [{ target: 'https://amxmodx.org/api/amxmodx', range: { ... } }]
 */
export function buildIncludeLinks(inclusions: ResolvedInclusion[]): DocumentLink[] {
    const links: DocumentLink[] = [];
    for (const inc of inclusions) {
        let filename = inc.descriptor.filename;
        if (filename.endsWith('.inc')) filename = filename.substring(0, filename.length - 4);
        if (amxmodxDefaultHeaders.includes(filename)) {
            links.push({
                target: `https://amxmodx.org/api/${filename}`,
                range: { start: inc.descriptor.start, end: inc.descriptor.end },
            });
        }
    }
    return links;
}
