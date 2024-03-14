export class Job extends AbortController {
    /**
     * @param {(signal: AbortSignal) => Promise<void>} task
     */
    constructor(task) {
        super();
        this.task = task;
    }
}

export class Queue {
    /** @type {Set<Job>}*/
    #queue = new Set();

    /**
     * @type {Job|null}
     */
    #processing = null;

    /**
     * @type {Promise<number>|null}
     */
    #promise = null;

    #disposed = false;

    /**
     * @param {Job} job
     */
    add(job) {
        if(this.#processing === job) return;
        this.#queue.add(job);
        this.process();
    }

    /**
     * @param {Job} job
     */
    delete(job) {
        if(this.#processing === job) this.#processing?.abort();
        this.#queue.delete(job);
    }

    async process(){
        if(this.#disposed) return;

        if(this.#queue.size) {
            this.#promise ??= (async () => {
                let i = 0;
                for(const job of this.#queue){
                    if(this.#disposed) break;

                    this.#processing = job;

                    if(!job.signal.aborted) {
                        await job.task(job.signal);
                    }

                    this.#queue.delete(job);
                    i++;
                }
                return i;
            })().then((i) => {
                this.#processing = null;
                this.#promise    = null;
                return i;
            });
        }

        return this.#promise ?? Promise.resolve(0);
    }

    dispose() {
        this.#processing?.abort();
        this.#disposed = true;
    }
}
