/**
 * A reference-counted marker for one included file. The manager hands these out
 * as opaque keys — feature code stores them in {@link WeakMap}s so that when a
 * dependency drops to zero references, its data is eligible for GC.
 *
 * @example
 * const dep = new FileDependency('file:///plugins/lib.inc');
 * dep.uri; // 'file:///plugins/lib.inc'
 */
export class FileDependency {
    constructor(public readonly uri: string) {}
}

interface DependencyDescriptor {
    count: number;
    dependency: FileDependency;
}

/**
 * Reference-counted registry of dependency files. Each `.sma` document keeps a
 * list of {@link FileDependency} objects for the includes it transitively
 * touches; the manager makes sure we don't parse the same include twice and
 * that dependencies live exactly as long as their reference count.
 *
 * @example
 * const mgr = new FileDependencyManager();
 * const dep = mgr.addReference('file:///lib.inc');
 * mgr.getDependency('file:///lib.inc'); // → dep
 * mgr.removeReference('file:///lib.inc');
 * mgr.getDependency('file:///lib.inc'); // → undefined
 */
export class FileDependencyManager {
    private readonly deps = new Map<string, DependencyDescriptor>();

    /**
     * Look up an existing dependency by URI without changing its reference count.
     *
     * @example
     * mgr.getDependency('file:///lib.inc');
     */
    getDependency(uri: string): FileDependency | undefined {
        return this.deps.get(uri)?.dependency;
    }

    /**
     * Enumerate every live dependency currently tracked.
     *
     * @example
     * for (const dep of mgr.getAllDependencies()) console.log(dep.uri);
     */
    getAllDependencies(): FileDependency[] {
        return [...this.deps.values()].map((d) => d.dependency);
    }

    /**
     * Add a reference to the dependency at `uri`, creating it if necessary.
     * Idempotent — call once per document that depends on the file.
     *
     * @example
     * const dep = mgr.addReference('file:///lib.inc');
     */
    addReference(uri: string): FileDependency {
        const existing = this.deps.get(uri);
        if (existing) {
            existing.count++;
            return existing.dependency;
        }
        const dep = new FileDependency(uri);
        this.deps.set(uri, { count: 1, dependency: dep });
        return dep;
    }

    /**
     * Drop one reference; deletes the entry when the count hits zero.
     *
     * @throws When `uri` was never registered.
     * @example
     * mgr.removeReference('file:///lib.inc');
     */
    removeReference(uri: string): void {
        const existing = this.deps.get(uri);
        if (!existing) {
            throw new Error(`Tried to remove reference from unknown dependency: ${uri}`);
        }
        existing.count--;
        if (existing.count <= 0) {
            this.deps.delete(uri);
        }
    }
}
