// Enhanced rate limiter for YouTube API calls with exponential backoff and circuit breaker
class RateLimiter {
    constructor() {
        this.lastCall = 0;
        this.minInterval = 5000; // 5 seconds between calls
        this.queue = [];
        this.processing = false;
        
        // Circuit breaker properties
        this.circuitState = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failureCount = 0;
        this.failureThreshold = 5; // Open circuit after 5 failures
        this.recoveryTimeout = 60000; // 1 minute recovery time
        this.lastFailureTime = 0;
        
        // Exponential backoff properties
        this.baseDelay = 1000; // 1 second base delay
        this.maxDelay = 30000; // 30 seconds max delay
        this.maxRetries = 3;
        
        // Queue management
        this.maxQueueSize = 10;
        this.requestTimeout = 15000; // 15 seconds timeout per request
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

    // Check if circuit breaker should trip
    shouldTripCircuit() {
        return this.failureCount >= this.failureThreshold;
    }

    // Check if circuit breaker should attempt recovery
    shouldAttemptReset() {
        return this.circuitState === 'OPEN' && 
               (Date.now() - this.lastFailureTime) > this.recoveryTimeout;
    }

    // Calculate exponential backoff delay
    calculateBackoffDelay(attempt) {
        const delay = Math.min(this.baseDelay * Math.pow(2, attempt), this.maxDelay);
        // Add jitter to prevent thundering herd
        return delay + Math.random() * 1000;
    }

    // Execute with timeout
    async executeWithTimeout(fn, timeoutMs) {
        return Promise.race([
            fn(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
            )
        ]);
    }

    async execute(fn, retryCount = 0) {
        const timestamp = new Date().toISOString();
        
        // Check circuit breaker state
        if (this.circuitState === 'OPEN') {
            if (this.shouldAttemptReset()) {
                console.log(`[RATE_LIMITER][${timestamp}] Circuit breaker attempting reset (HALF_OPEN)`);
                this.circuitState = 'HALF_OPEN';
            } else {
                console.log(`[RATE_LIMITER][${timestamp}] Circuit breaker OPEN, rejecting request`);
                throw new Error('Service temporarily unavailable due to repeated failures');
            }
        }

        // Check queue size
        if (this.queue.length >= this.maxQueueSize) {
            console.log(`[RATE_LIMITER][${timestamp}] Queue full, rejecting request`);
            throw new Error('Too many concurrent requests');
        }

        try {
            // Wait for rate limiting
            await this.wait();
            
            console.log(`[RATE_LIMITER][${timestamp}] Executing request (attempt ${retryCount + 1}/${this.maxRetries + 1})`);
            
            // Execute with timeout
            const result = await this.executeWithTimeout(fn, this.requestTimeout);
            
            // Success - reset circuit breaker if it was tripped
            if (this.circuitState === 'HALF_OPEN') {
                console.log(`[RATE_LIMITER][${timestamp}] Circuit breaker reset to CLOSED`);
                this.circuitState = 'CLOSED';
                this.failureCount = 0;
            }
            
            return result;
            
        } catch (error) {
            this.failureCount++;
            this.lastFailureTime = Date.now();
            
            console.error(`[RATE_LIMITER][${timestamp}] Request failed:`, {
                error: error.message,
                attempt: retryCount + 1,
                failureCount: this.failureCount,
                circuitState: this.circuitState
            });

            // Check if we should retry
            const shouldRetry = retryCount < this.maxRetries && 
                              (error.message.includes('429') || 
                               error.message.includes('rate limit') ||
                               error.message.includes('timeout') ||
                               error.message.includes('network'));

            if (shouldRetry) {
                const delay = this.calculateBackoffDelay(retryCount);
                console.log(`[RATE_LIMITER][${timestamp}] Retrying in ${Math.round(delay)}ms...`);
                
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.execute(fn, retryCount + 1);
            }

            // Check if circuit breaker should trip
            if (this.shouldTripCircuit()) {
                this.circuitState = 'OPEN';
                console.log(`[RATE_LIMITER][${timestamp}] Circuit breaker OPENED due to ${this.failureCount} failures`);
            }

            throw error;
        }
    }

    // Get current status for monitoring
    getStatus() {
        return {
            circuitState: this.circuitState,
            failureCount: this.failureCount,
            queueLength: this.queue.length,
            lastCall: this.lastCall,
            lastFailureTime: this.lastFailureTime
        };
    }

    // Manual reset for testing/recovery
    reset() {
        this.circuitState = 'CLOSED';
        this.failureCount = 0;
        this.lastFailureTime = 0;
        console.log('[RATE_LIMITER] Manual reset completed');
    }
}

const rateLimiter = new RateLimiter();

// Support test mode mocking
if (typeof global !== 'undefined' && global.__TEST_MOCKS__ && global.__TEST_MOCKS__.rateLimiter) {
    module.exports = global.__TEST_MOCKS__.rateLimiter;
} else {
    module.exports = rateLimiter;
}