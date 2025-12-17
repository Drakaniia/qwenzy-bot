const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('joke')
        .setDescription('Tells a random programming joke.'),
    async execute(interaction) {
        let useEditReply = false;
        
        try {
            await interaction.deferReply(); // Jokes might take a second to fetch
            useEditReply = true;
        } catch (deferError) {
            if (deferError.code !== 40060) {
                throw deferError; // Re-throw if it's not the "already acknowledged" error
            }
            console.log('[INFO] Interaction already deferred, continuing...');
            // If deferReply failed with 40060, the interaction was already acknowledged
            // so we should still use editReply
            useEditReply = true;
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

            if (useEditReply) {
                await interaction.editReply(`🤖 **System.out.joke:**\n${joke}`);
            } else {
                await interaction.reply(`🤖 **System.out.joke:**\n${joke}`);
            }
        } catch (error) {
            console.error(error);
            try {
                if (useEditReply) {
                    await interaction.editReply('404 Joke Not Found. My sense of humor is offline.');
                } else {
                    await interaction.reply('404 Joke Not Found. My sense of humor is offline.');
                }
            } catch (replyError) {
                console.log('[INFO] Interaction already acknowledged, skipping error reply');
            }
        }
    },
};
