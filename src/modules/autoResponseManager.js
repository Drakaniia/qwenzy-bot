const fs = require('fs');
const path = require('path');

class AutoResponseManager {
    constructor() {
        this.configPath = path.join(__dirname, '../config/autoResponses.json');
        this.config = null;
        this.compiledPatterns = new Map();
        this.rateLimits = new Map(); // Map<userId, Map<triggerWord, timestamp>>
        this.loadConfig();
    }

    /**
     * Load configuration from JSON file
     */
    loadConfig() {
        try {
            if (!fs.existsSync(this.configPath)) {
                console.warn('[AUTO_RESPONSE] Config file not found, using defaults');
                this.config = { enabled: false, triggerWords: {} };
                return;
            }

            const configData = fs.readFileSync(this.configPath, 'utf8');
            this.config = JSON.parse(configData);
            this.compilePatterns();
            console.log('[AUTO_RESPONSE] Configuration loaded successfully');
        } catch (error) {
            console.error('[AUTO_RESPONSE] Failed to load config:', error);
            this.config = { enabled: false, triggerWords: {} };
        }
    }

    /**
     * Reload configuration (useful for runtime updates)
     */
    reloadConfig() {
        this.loadConfig();
    }

    /**
     * Compile regex patterns for trigger words
     */
    compilePatterns() {
        this.compiledPatterns.clear();

        if (!this.config || !this.config.triggerWords) {
            return;
        }

        for (const [triggerWord, settings] of Object.entries(this.config.triggerWords)) {
            try {
                let pattern;

                // Escape the trigger word first
                const escapedWord = this.escapeRegex(triggerWord);

                if (settings.wholeWord) {
                    // Match whole word boundaries (use \\b for word boundary)
                    pattern = settings.caseSensitive
                        ? new RegExp('\\b' + escapedWord + '\\b')
                        : new RegExp('\\b' + escapedWord + '\\b', 'i');
                } else {
                    // Match partial words
                    pattern = settings.caseSensitive
                        ? new RegExp(escapedWord)
                        : new RegExp(escapedWord, 'i');
                }

                this.compiledPatterns.set(triggerWord, pattern);
            } catch (error) {
                console.error(`[AUTO_RESPONSE] Failed to compile pattern for "${triggerWord}":`, error);
            }
        }
    }

    /**
     * Escape special regex characters
     */
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Check if message contains any trigger words
     */
    checkTrigger(message) {
        if (!this.config || !this.config.enabled) {
            return null;
        }

        if (!message || !message.content) {
            return null;
        }

        // Skip bot messages and DMs
        if (message.author?.bot) {
            return null;
        }

        if (!message.guild) {
            return null;
        }

        const content = message.content.trim();

        // Check each trigger word
        for (const [triggerWord, pattern] of this.compiledPatterns) {
            if (pattern.test(content)) {
                const settings = this.config.triggerWords[triggerWord];

                // Check rate limit
                if (this.isRateLimited(message.author.id, triggerWord, settings.cooldown)) {
                    console.log(`[AUTO_RESPONSE] Rate limited: user ${message.author.id} for trigger "${triggerWord}"`);
                    continue;
                }

                return {
                    triggerWord,
                    settings,
                    pattern
                };
            }
        }

        return null;
    }

    /**
     * Get formatted response for a trigger word
     */
    getResponse(triggerWord, username) {
        const settings = this.config.triggerWords[triggerWord];
        if (!settings) {
            return null;
        }

        // Replace placeholders
        let response = settings.response;
        response = response.replace(/<username>/gi, username);
        response = response.replace(/<mention>/gi, `<@${username}>`);

        return response;
    }

    /**
     * Check if user is rate limited for a specific trigger
     */
    isRateLimited(userId, triggerWord, cooldownMs) {
        if (!cooldownMs || cooldownMs <= 0) {
            return false;
        }

        const userLimits = this.rateLimits.get(userId);
        if (!userLimits) {
            return false;
        }

        const lastTriggered = userLimits.get(triggerWord);
        if (!lastTriggered) {
            return false;
        }

        const now = Date.now();
        const timeSinceLastTrigger = now - lastTriggered;

        return timeSinceLastTrigger < cooldownMs;
    }

    /**
     * Update rate limit timestamp for user and trigger
     */
    updateRateLimit(userId, triggerWord) {
        if (!this.rateLimits.has(userId)) {
            this.rateLimits.set(userId, new Map());
        }

        const userLimits = this.rateLimits.get(userId);
        userLimits.set(triggerWord, Date.now());

        // Clean up old entries periodically
        this.cleanupRateLimits();
    }

    /**
     * Clean up old rate limit entries to prevent memory leaks
     */
    cleanupRateLimits() {
        const now = Date.now();
        const maxAge = 60000; // 1 minute

        for (const [userId, userLimits] of this.rateLimits) {
            for (const [triggerWord, timestamp] of userLimits) {
                if (now - timestamp > maxAge) {
                    userLimits.delete(triggerWord);
                }
            }

            if (userLimits.size === 0) {
                this.rateLimits.delete(userId);
            }
        }
    }

    /**
     * Get all configured trigger words
     */
    getTriggerWords() {
        if (!this.config || !this.config.triggerWords) {
            return [];
        }
        return Object.keys(this.config.triggerWords);
    }

    /**
     * Check if feature is enabled
     */
    isEnabled() {
        return this.config && this.config.enabled === true;
    }

    /**
     * Get configuration status
     */
    getStatus() {
        return {
            enabled: this.isEnabled(),
            triggerCount: this.getTriggerWords().length,
            compiledPatterns: this.compiledPatterns.size,
            activeRateLimits: this.rateLimits.size
        };
    }
}

// Export singleton instance
const autoResponseManager = new AutoResponseManager();

if (typeof global !== 'undefined' && global.__TEST_MOCKS__ && global.__TEST_MOCKS__.autoResponseManager) {
    module.exports = global.__TEST_MOCKS__.autoResponseManager;
} else {
    module.exports = autoResponseManager;
}