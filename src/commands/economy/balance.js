const { SlashCommandBuilder } = require('discord.js');

// Making a simple in-memory economy for now (will restart when bot restarts)
// In the future, we will move this to a database (SQLite/JSON).
const balance = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your wallet balance.'),
    async execute(interaction) {
        const userStart = balance.get(interaction.user.id) || 0;
        await interaction.reply(`💳 **Balance**: ${userStart} QwenCoins.\n(Need more? Try /work)`);
    },
};
