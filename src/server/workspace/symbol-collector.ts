import type { CallableDescriptor, DocumentData, ValueDescriptor } from '../types.js';
import type { FileDependency, FileDependencyManager } from './dependency-manager.js';

/**
 * The flattened symbol tables of a document plus everything it transitively
 * includes. Duplicates are preserved so that later stages can honour Pawn's
 * "first declaration wins" semantics if they want to.
 *
 * @example
 * const { callables, values } = collectSymbols(data, dependenciesData);
 */
export interface SymbolsResults {
    callables: CallableDescriptor[];
    values: ValueDescriptor[];
}

/**
 * Recursively walk a document and its dependency tree, concatenating callables
 * and values into one flat listing. Each dependency is visited at most once even
 * if reachable through multiple paths.
 *
 * @example
 * const symbols = collectSymbols(data, dependenciesData);
 * const found = symbols.callables.find((c) => c.identifier === 'client_print');
 *
 * @param data - The root document to start from.
 * @param dependenciesData - Weak map from dependency handle → its parsed data.
 */
export function collectSymbols(
    data: DocumentData,
    dependenciesData: WeakMap<FileDependency, DocumentData>,
): SymbolsResults {
    const visited = new Set<FileDependency>();
    return collectSymbolsImpl(data, dependenciesData, visited);
}

function collectSymbolsImpl(
    data: DocumentData,
    dependenciesData: WeakMap<FileDependency, DocumentData>,
    visited: Set<FileDependency>,
): SymbolsResults {
    const symbols: SymbolsResults = {
        callables: [...data.callables],
        values: [...data.values],
    };
    for (const dep of data.dependencies) {
        if (visited.has(dep)) continue;
        visited.add(dep);
        const depData = dependenciesData.get(dep);
        if (!depData) continue;
        const nested = collectSymbolsImpl(depData, dependenciesData, visited);
        symbols.callables.push(...nested.callables);
        symbols.values.push(...nested.values);
    }
    return symbols;
}

/**
 * Drop one reference to each of the given dependencies. If a dependency's ref
 * count hits zero, the drop propagates transitively to *its* dependencies too.
 *
 * @example
 * releaseDependencies(data.dependencies, dependencyManager, dependenciesData);
 */
export function releaseDependencies(
    deps: FileDependency[],
    dependencyManager: FileDependencyManager,
    dependenciesData: WeakMap<FileDependency, DocumentData>,
): void {
    releaseDependenciesImpl(deps, dependencyManager, dependenciesData, new Set());
}

function releaseDependenciesImpl(
    deps: FileDependency[],
    dependencyManager: FileDependencyManager,
    dependenciesData: WeakMap<FileDependency, DocumentData>,
    visited: Set<FileDependency>,
): void {
    for (const dep of deps) {
        if (visited.has(dep)) continue;
        visited.add(dep);
        if (dependencyManager.getDependency(dep.uri) === undefined) continue;

        dependencyManager.removeReference(dep.uri);
        if (dependencyManager.getDependency(dep.uri) === undefined) {
            const depData = dependenciesData.get(dep);
            if (depData) {
                releaseDependenciesImpl(depData.dependencies, dependencyManager, dependenciesData, visited);
            }
        }
    }
}

/**
 * Garbage-collect any dependency that is no longer reachable from any open root
 * document. Call this after closing a document or after every reparse.
 *
 * @example
 * pruneUnreachableDependencies(openDocs, dependencyManager, dependenciesData);
 */
export function pruneUnreachableDependencies(
    roots: DocumentData[],
    dependencyManager: FileDependencyManager,
    dependenciesData: WeakMap<FileDependency, DocumentData>,
): void {
    const reachable = new Set<FileDependency>();
    const visited = new Set<FileDependency>();
    for (const root of roots) {
        walkReachable(root, dependenciesData, reachable, visited);
    }

    const unreachable = dependencyManager
        .getAllDependencies()
        .filter((dep) => !reachable.has(dep))
        .map((dep) => dep.uri);

    for (const uri of unreachable) {
        const dep = dependencyManager.getDependency(uri);
        if (!dep) continue;
        const depData = dependenciesData.get(dep);
        if (depData) {
            releaseDependencies(depData.dependencies, dependencyManager, dependenciesData);
        }
    }
}

function walkReachable(
    data: DocumentData,
    dependenciesData: WeakMap<FileDependency, DocumentData>,
    reachable: Set<FileDependency>,
    visited: Set<FileDependency>,
): void {
    for (const dep of data.dependencies) {
        reachable.add(dep);
        if (visited.has(dep)) continue;
        visited.add(dep);
        const depData = dependenciesData.get(dep);
        if (depData) walkReachable(depData, dependenciesData, reachable, visited);
    }
}
