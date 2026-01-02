const autoResponseManager = require('../modules/autoResponseManager');

module.exports = {
    name: 'messageCreate',
    async execute(message) {
        // Skip if message doesn't meet basic requirements
        if (!message || !message.content) {
            return;
        }

        // Skip bot messages (including our own)
        if (message.author?.bot) {
            return;
        }

        // Skip DMs (only respond in guilds)
        if (!message.guild) {
            return;
        }

        // Check if auto-response feature is enabled
        if (!autoResponseManager.isEnabled()) {
            return;
        }

        try {
            // Check if message contains any trigger words
            const trigger = autoResponseManager.checkTrigger(message);

            if (!trigger) {
                return;
            }

            const { triggerWord, settings } = trigger;

            console.log(`[AUTO_RESPONSE] Trigger detected: "${triggerWord}" by user ${message.author.tag}`);

            // Get formatted response with username
            const response = autoResponseManager.getResponse(triggerWord, message.author.username);

            if (!response) {
                console.warn(`[AUTO_RESPONSE] No response configured for trigger: "${triggerWord}"`);
                return;
            }

            // Check bot permissions before sending
            const permissions = message.channel.permissionsFor(message.client.user);
            if (!permissions?.has('SendMessages')) {
                console.warn(`[AUTO_RESPONSE] Missing SendMessages permission in channel ${message.channel.id}`);
                return;
            }

            // Send the response
            await message.channel.send(response).catch(error => {
                console.error('[AUTO_RESPONSE] Failed to send message:', error);
            });

            // Update rate limit
            autoResponseManager.updateRateLimit(message.author.id, triggerWord);

            console.log(`[AUTO_RESPONSE] Response sent to user ${message.author.tag}`);

        } catch (error) {
            console.error('[AUTO_RESPONSE] Error processing message:', error);
        }
    }
};