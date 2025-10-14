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
     * Adds a job to the queue. If the job is already being processed, it will not be re-added.
     * If the queue is not currently processing, it will start processing.
     * @param {Job} job
     */
    add(job) {
        if(this.#processing === job) return;
        this.#queue.add(job);
        this.process();
    }

    /**
     * Removes a job from the queue. If the job is currently being processed, it will be aborted.
     * If the job is not in the queue, it will do nothing.
     * @param {Job} job
     */
    delete(job) {
        if(this.#processing === job) this.#processing?.abort();
        this.#queue.delete(job);
    }

    /**
     * Processes the job queue in insertion order.
     * If a job is aborted before or during processing, it will be skipped.
     * If the queue is disposed, no jobs will be processed.
     *
     * @returns {Promise<number>} The number of jobs processed
     */
    async process(){
        if(this.#disposed) return 0;

        if(this.#queue.size) {
            this.#promise ??= (async () => {
                let i = 0;
                for(const job of this.#queue){
                    if(this.#disposed) break;

                    this.#processing = job;

                    if(!job.signal.aborted) {
                        await job.task(job.signal);
                        i++;
                    }

                    this.#queue.delete(job);
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

    /**
     * Disposes the queue, aborting any currently processing job and preventing further processing.
     */
    dispose() {
        this.#processing?.abort();
        this.#disposed = true;
    }
}
