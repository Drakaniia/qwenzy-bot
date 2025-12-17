const { SlashCommandBuilder } = require('discord.js');

// Simple rate limiter
const rateLimiter = {
    lastCall: 0,
    minInterval: 2000, // 2 seconds between calls
    
    async wait() {
        const now = Date.now();
        const timeSinceLastCall = now - this.lastCall;
        
        if (timeSinceLastCall < this.minInterval) {
            const waitTime = this.minInterval - timeSinceLastCall;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        this.lastCall = Date.now();
    }
};

// Groq API function
async function askGroq(prompt, apiKey) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile', // Fast and capable model
            messages: [
                {
                    role: 'system',
                    content: 'You are Qweny, a helpful Discord bot with slightly sarcastic programming humor. You love code jokes. Keep responses brief (under 2000 chars for Discord).'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7,
            max_tokens: 1000
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

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
        
        // Validate interaction
        if (!interaction || !interaction.id) {
            console.log('[ERROR] Invalid interaction object in ask command');
            return;
        }

        // Check if interaction is expired
        const now = Date.now();
        const interactionTimestamp = interaction.createdTimestamp || now;
        const maxAge = 15 * 60 * 1000;
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
                console.log('[INFO] Interaction already acknowledged');
                if (interaction.replied || interaction.deferred) {
                    deferred = true;
                } else {
                    await interaction.reply('🧠 Processing your AI request...');
                    deferred = true;
                }
            } else if (deferError.code === 10062) {
                console.log('[INFO] Interaction expired (10062), ignoring');
                return;
            } else {
                throw deferError;
            }
        }
        
        const prompt = interaction.options.getString('prompt');

        // Check for API key (supports both Groq and Gemini)
        const groqKey = process.env.GROQ_API_KEY;
        const geminiKey = process.env.GEMINI_API_KEY;

        if (!groqKey && !geminiKey) {
            await interaction.editReply(
                '❌ **AI Brain Not Configured**\n\n' +
                'No API key found. Please set one of:\n' +
                '• `GROQ_API_KEY` (recommended - free at https://console.groq.com/)\n' +
                '• `GEMINI_API_KEY` (free at https://ai.google.dev/)'
            );
            return;
        }

        try {
            await rateLimiter.wait();
            
            let response;
            
            // Try Groq first (if available), fall back to Gemini
            if (groqKey) {
                console.log('[AI] Using Groq API');
                response = await askGroq(prompt, groqKey);
            } else {
                console.log('[AI] Using Gemini API');
                const { GoogleGenerativeAI } = require("@google/generative-ai");
                const genAI = new GoogleGenerativeAI(geminiKey);
                const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
                
                const result = await model.generateContent(`
                    You are Qweny, a helpful Discord bot with slightly sarcastic programming humor.
                    You love code jokes. Keep responses brief (under 2000 chars for Discord).
                    
                    User asks: ${prompt}
                `);
                
                response = result.response.text();
            }

            // Discord max length check
            if (response.length > 1900) {
                await interaction.editReply(response.substring(0, 1900) + '...\n\n*(Response truncated)*');
            } else {
                await interaction.editReply(response);
            }

        } catch (error) {
            console.error('Ask command error:', error);
            
            // Handle quota/rate limit errors
            if (error.status === 429 || error.message?.includes('quota') || error.message?.includes('rate limit')) {
                await interaction.editReply(
                    `⏳ **Rate Limit Reached**\n\n` +
                    `The AI service is temporarily rate-limited.\n` +
                    `Please try again in a few moments.\n\n` +
                    `💡 *Tip: Consider using Groq API for faster, more reliable responses!*\n` +
                    `Get free API key at: https://console.groq.com/`
                );
                return;
            }
            
            // Check if interaction expired
            const interactionAge = Date.now() - (interaction.createdTimestamp || Date.now());
            if (interactionAge > (15 * 60 * 1000)) {
                console.log('[INFO] Interaction expired, not sending error message');
                return;
            }
            
            // Generic error handling
            let errorMessage = '🤯 Brain freeze! (Error connecting to AI)';
            
            if (error.message?.includes('ENOTFOUND') || error.message?.includes('network')) {
                errorMessage = '🌐 Network error. Please check connection and try again.';
            } else if (error.message?.includes('timeout')) {
                errorMessage = '⏱️ Request timeout. Please try again.';
            } else if (error.message?.includes('API key')) {
                errorMessage = '🔑 Invalid API key. Please check your configuration.';
            }
            
            try {
                await interaction.editReply(errorMessage);
            } catch (replyError) {
                if (replyError.code !== 40060 && replyError.code !== 10062) {
                    console.error('Failed to send error message:', replyError);
                }
            }
        }
    },
};