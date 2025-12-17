const { SlashCommandBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Ask Qweny (AI) anything!')
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('The question you want to ask')
                .setRequired(true)),
    async execute(interaction) {
        let deferred = false;
        
        // Step 1: Validate interaction and try to defer or reply
        if (!interaction || !interaction.id) {
            console.log('[ERROR] Invalid interaction object in ask command');
            return;
        }

        // Check if interaction is still valid (not expired)
        const now = Date.now();
        const interactionTimestamp = interaction.createdTimestamp || now;
        const maxAge = 15 * 60 * 1000; // 15 minutes
        const isExpired = (now - interactionTimestamp) > maxAge;

        if (isExpired) {
            console.log('[INFO] Interaction expired in ask command, ignoring');
            return;
        }

        try {
            await interaction.deferReply();
            deferred = true;
        } catch (deferError) {
            if (deferError.code === 40060) {
                // Interaction already acknowledged by another command/middleware
                console.log('[INFO] Interaction already acknowledged, attempting to reply...');
                // Check if we can detect this was already replied to
                if (interaction.replied || interaction.deferred) {
                    deferred = true;
                } else {
                    // Try immediate reply as fallback
                    await interaction.reply('🧠 Processing your AI request...');
                    deferred = true;
                }
            } else if (deferError.code === 10062) {
                // Interaction expired or unknown
                console.log('[INFO] Interaction expired (10062) in ask command, ignoring');
                return;
            } else {
                // Different error, re-throw
                throw deferError;
            }
        }
        
        const prompt = interaction.options.getString('prompt');

        if (!process.env.GEMINI_API_KEY) {
            try {
                await interaction.editReply('❌ My brain is missing! (GEMINI_API_KEY not found in .env)');
            } catch (editError) {
                if (editError.code === 40060) {
                    await interaction.followUp({
                        content: '❌ My brain is missing! (GEMINI_API_KEY not found in .env)',
                        flags: [64]
                    });
                } else {
                    throw editError;
                }
            }
            return;
        }

        try {
            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            // using gemini-2.0-flash as it is the current supported text model
            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

            // Add personality to the status
            const result = await model.generateContent(`
                You are a helpful Discord Bot named Qweny.
                Your personality is: Slightly sarcastic programming humor. You love code jokes.
                You are helpful but brief (Discord message limit is 2000 chars).
                
                User asks: ${prompt}
            `);
            const response = result.response.text();

            // Discord max length check
            if (response.length > 1900) {
                try {
                    await interaction.editReply(response.substring(0, 1900) + '... (Output truncated)');
                } catch (editError) {
                    if (editError.code === 40060) {
                        await interaction.followUp({
                            content: response.substring(0, 1900) + '... (Output truncated)',
                            flags: [64]
                        });
                    } else {
                        throw editError;
                    }
                }
            } else {
                try {
                    await interaction.editReply(response);
                } catch (editError) {
                    if (editError.code === 40060) {
                        await interaction.followUp({
                            content: response,
                            flags: [64]
                        });
                    } else {
                        throw editError;
                    }
                }
            }

        } catch (error) {
            console.error('Ask command error:', error);
            
            // Don't try to send error if interaction is expired
            const now = Date.now();
            const interactionAge = now - (interaction.createdTimestamp || now);
            const isExpired = interactionAge > (15 * 60 * 1000); // 15 minutes
            
            if (isExpired) {
                console.log('[INFO] Interaction expired in ask command, not sending error message');
                return;
            }
            
            try {
                await interaction.editReply('🤯 Brain freeze! (Error connecting to AI)');
            } catch (replyError) {
                if (replyError.code === 40060 || replyError.code === 10062) {
                    console.log('[INFO] Interaction expired or already acknowledged, cannot send error message');
                } else {
                    console.error('Failed to send error message:', replyError);
                }
            }
        }
    },
};
