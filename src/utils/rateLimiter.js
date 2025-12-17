// Global rate limiter for YouTube API calls
class RateLimiter {
    constructor() {
        this.lastCall = 0;
        this.minInterval = 5000; // 5 seconds between calls
        this.queue = [];
        this.processing = false;
    }

    async wait() {
        const now = Date.now();
        const timeSinceLastCall = now - this.lastCall;
        
        if (timeSinceLastCall < this.minInterval) {
            const waitTime = this.minInterval - timeSinceLastCall;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        this.lastCall = Date.now();
    }

    async execute(fn) {
        await this.wait();
        return await fn();
    }
}

const rateLimiter = new RateLimiter();

module.exports = rateLimiter;