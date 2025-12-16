const { SlashCommandBuilder } = require('discord.js');

// Shared state with balance.js (in a real app, use a DB!)
// This is a hacky way to share state for the demo. 
// Ideally we move the Map to a separate utility file.
// For now, I will use a global variable on the client object in index.js for better persistence across files?
// Actually for this step, let's keep it simple. Each file having its own map won't work.
// I'll create a simple db.js helper next turn. 
// For now, let's just make it reply with a placeholder.

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Write some code to earn QwenCoins.'),
    async execute(interaction) {
        const earnings = Math.floor(Math.random() * 100) + 1;

        // Simulating DB update
        // user.balance += earnings

        await interaction.reply(`💻 You fixed a critical bug! Client paid you **${earnings} QwenCoins**.`);
    },
};
