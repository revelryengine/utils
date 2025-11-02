/**
 * Minimal TypeDoc configuration file to validate code documentation.
 */
const config = {
    entryPoints: ['./lib/**/*.js'],
    intentionallyNotDocumented: [
        'lib/cache-helper.Fetcher.__type.init',
        'lib/cache-helper.Fetcher.__type.request',
        'lib/job-queue.JobTask.__type.signal',
        'lib/lru-cache.LRUCache.constructor.T',
        'lib/lru-cache.PersistHandler.get.__type.key',
        'lib/lru-cache.PersistHandler.put.__type.key',
        'lib/lru-cache.PersistHandler.put.__type.value',
        'lib/lru-cache.PersistHandler.delete.__type.key',
        'lib/orbit-control.OnInputCallback.__type.input',
        'lib/orbit-control.OnUpdateCallback.__type.matrix',
        'lib/math.Normalizer.__type.v',
        'lib/merge.merge.__type.k',
        'lib/set-map.SetMap.constructor.K',
        'lib/set-map.SetMap.constructor.T',
        'lib/weak-cache.WeakCache.constructor.T',
    ],
};

export default config;
