const logger = require("../utils/logger");

class InMemoryQueue {
    constructor(queueName, options = {}) {
        this.queueName = queueName;
        this.delayMs = options.delayMs ?? 120;
        this.jobs = [];
        this.processing = false;
    }

    add(jobName, payload = {}) {
        this.jobs.push({
            jobName,
            payload,
            queuedAt: new Date().toISOString(),
        });

        logger.info("queue.job.added", {
            queue: this.queueName,
            jobName,
            pendingJobs: this.jobs.length,
        });

        this.process().catch((error) => {
            logger.error("queue.process.unhandled", {
                queue: this.queueName,
                message: error.message,
            });
        });
    }

    async process() {
        if (this.processing) return;
        this.processing = true;

        while (this.jobs.length) {
            const job = this.jobs.shift();
            if (!job?.handler || typeof job.handler !== "function") {
                logger.warn("queue.job.skipped", {
                    queue: this.queueName,
                    jobName: job?.jobName || "unknown",
                });
                continue;
            }

            try {
                await new Promise((resolve) => setTimeout(resolve, this.delayMs));
                await job.handler(job.payload);
            } catch (error) {
                logger.error("queue.job.failed", {
                    queue: this.queueName,
                    jobName: job.jobName,
                    message: error.message,
                });
            }
        }

        this.processing = false;
    }

    addWithHandler(jobName, payload, handler) {
        this.jobs.push({
            jobName,
            payload,
            handler,
            queuedAt: new Date().toISOString(),
        });

        this.process().catch((error) => {
            logger.error("queue.process.unhandled", {
                queue: this.queueName,
                message: error.message,
            });
        });
    }
}

module.exports = InMemoryQueue;
