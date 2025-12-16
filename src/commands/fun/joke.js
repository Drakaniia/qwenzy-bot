const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('joke')
        .setDescription('Tells a random programming joke.'),
    async execute(interaction) {
        await interaction.deferReply(); // Jokes might take a second to fetch

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

            await interaction.editReply(`🤖 **System.out.joke:**\n${joke}`);
        } catch (error) {
            console.error(error);
            await interaction.editReply('404 Joke Not Found. My sense of humor is offline.');
        }
    },
};
