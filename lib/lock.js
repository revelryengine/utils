/**
 * Lock utility.
 * @module
 */

/**
 * @param {string} name - The name of the lock.
 * @param {Omit<LockOptions, 'steal'> | LockGrantedCallback<unknown>} options - The lock options or callback.
 * @param {LockGrantedCallback<unknown>} [callback] - The lock callback.
 */
// deno-coverage-ignore-start
const lock = globalThis.navigator.locks?.request.bind(globalThis.navigator.locks)/* c8 ignore start - Deno only */ ?? (await (async () => {
        const Deno = globalThis.Deno;

        if (typeof Deno === 'undefined' ) {
            throw new Error('navigator.locks is not available and not running in a Deno environment.');
        }
        // deno-coverage-ignore-stop
        const tempDirPath = Deno.env.get("TMPDIR") || Deno.env.get("TEMP") || "/tmp";

        /**
         * @param {string} name
         * @param {Omit<LockOptions , 'steal'>} options
         * @param {LockGrantedCallback<unknown>} callback
         */
        return async (name, options, callback) => {
            const mode = options.mode ?? 'exclusive';

            const signal = options.signal;
            if (signal?.aborted) {
                throw new DOMException(signal.reason, 'AbortError');
            }

            Deno.mkdirSync(`${tempDirPath}/${location.host}`, { recursive: true });
            const lockFilePath = `${tempDirPath}/${location.host}/${name.replace(/[^a-zA-Z0-9-_]/g, '_')}.lock`;

            const file = Deno.openSync(lockFilePath, { read: true, write: true, create: true });
            const lock = file.lock(mode === 'exclusive');

            return Promise.race([
                lock.then(() => callback({ mode, name })),
                new Promise((_, reject) => signal?.addEventListener('abort', () => {
                    reject(new DOMException(signal.reason, 'AbortError'));
                }, { once: true }))
            ]).finally(async () => {
                await Deno.remove(lockFilePath).catch(() => {});
                file.unlock();
                file.close();
            });
        }
    })())/* c8 ignore stop */;


/**
 * This is a minimal wrapper around the navigator.locks API with a fallback to Deno file based lock.
 * It does not support the 'steal' option. It does not support 'ifAvailable' option when run in Deno.
 *
 * This can be removed once Deno supports navigator.locks: https://github.com/denoland/deno/issues/15905
 *
 * @template T - The type of the value returned by the lock callback.
 * @param {string} name - The name of the lock.
 * @param {Omit<LockOptions, 'steal'> | LockGrantedCallback<T>} optionsOrCallback - The lock options or callback.
 * @param {LockGrantedCallback<T>} [callback] - The lock callback.
 * @return {Promise<T>}
 */
export function requestLock(name, optionsOrCallback, callback) {
    if (name.length === 0) {
        throw new TypeError('Lock name must be a non-empty string.');
    }
    let normalizedOptions;
    let normalizedCallback;
    if (typeof optionsOrCallback === 'function') {
        normalizedOptions = {};
        normalizedCallback = optionsOrCallback;
    } else {
        normalizedOptions = optionsOrCallback;
        normalizedCallback = callback;
    }
    if (typeof normalizedCallback !== 'function') {
        throw new TypeError('Lock callback must be a function.');
    }

    /* c8 ignore start - Covered by Deno tests */
    if ('ifAvailable' in normalizedOptions && typeof navigator.locks === 'undefined') {
        throw new Error('The ifAvailable option is not supported in this environment.');
    }
    /* c8 ignore stop */

    return lock(name, normalizedOptions, normalizedCallback);
}
