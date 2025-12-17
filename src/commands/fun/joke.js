const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('joke')
        .setDescription('Tells a random programming joke.'),
    async execute(interaction) {
        let deferred = false;

        // Step 1: Validate interaction and try to defer or reply
        if (!interaction || !interaction.id) {
            console.log('[ERROR] Invalid interaction object');
            return;
        }

        // Check if interaction is still valid (not expired)
        const now = Date.now();
        const interactionTimestamp = interaction.createdTimestamp || now;
        const maxAge = 15 * 60 * 1000; // 15 minutes
        const isExpired = (now - interactionTimestamp) > maxAge;

        if (isExpired) {
            console.log('[INFO] Interaction expired, ignoring');
            return;
        }

        try {
            await interaction.deferReply(); // Jokes might take a second to fetch
            deferred = true;
        } catch (deferError) {
            if (deferError.code === 40060) {
                // Interaction already acknowledged by another command/middleware
                console.log('[INFO] Interaction already acknowledged, attempting to editReply...');
                // Check if we can detect this was already replied to
                if (interaction.replied || interaction.deferred) {
                    deferred = true;
                } else {
                    // Try immediate reply as fallback
                    await interaction.reply('🤖 Processing your joke request...');
                    deferred = true;
                }
            } else if (deferError.code === 10062) {
                // Interaction expired or unknown
                console.log('[INFO] Interaction expired (10062), ignoring');
                return;
            } else {
                // Different error, re-throw
                throw deferError;
            }
        }

        try {
            const response = await fetch('https://v2.jokeapi.dev/joke/Programming?safe-mode&type=single');
            const data = await response.json();

            let joke = "";
            if (data.joke) {
                joke = data.joke;
            } else {
                // Fallback for two-part jokes
                joke = `${data.setup}\n\n||${data.delivery}||`;
            }

            // Step 2: Always try editReply first (works for both deferred and normal replies)
            try {
                await interaction.editReply(`🤖 **System.out.joke:**\n${joke}`);
            } catch (editError) {
                if (editError.code === 40060) {
                    // Try followUp as last resort
                    console.log('[INFO] editReply failed, trying followUp...');
                    try {
                        await interaction.followUp({
                            content: `🤖 **System.out.joke:**\n${joke}`,
                            flags: [64] // Ephemeral
                        });
                    } catch (followUpError) {
                        if (followUpError.code === 10062) {
                            console.log('[INFO] Interaction expired during followUp, ignoring');
                        } else {
                            console.log('[ERROR] FollowUp failed:', followUpError.message);
                        }
                    }
                } else if (editError.code === 10062) {
                    console.log('[INFO] Interaction expired during editReply, ignoring');
                } else {
                    console.log('[ERROR] EditReply failed:', editError.message);
                    throw editError;
                }
            }
        } catch (error) {
            console.error('Joke command error:', error);

            // Don't try to send error if interaction is expired
            const now = Date.now();
            const interactionAge = now - (interaction.createdTimestamp || now);
            const isExpired = interactionAge > (15 * 60 * 1000); // 15 minutes

            if (isExpired) {
                console.log('[INFO] Interaction expired, not sending error message');
                return;
            }

            try {
                if (deferred) {
                    await interaction.editReply('404 Joke Not Found. My sense of humor is offline.');
                } else {
                    await interaction.reply('404 Joke Not Found. My sense of humor is offline.');
                }
            } catch (replyError) {
                if (replyError.code === 40060 || replyError.code === 10062) {
                    console.log('[INFO] Interaction expired or already acknowledged, cannot send error');
                } else {
                    console.error('Failed to send error message:', replyError);
                }
            }
        }
    },
};
