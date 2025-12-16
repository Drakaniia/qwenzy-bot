const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');

// Simple queue storage (in production, use a database or Map per guild)
const queues = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Show the current music queue'),
    async execute(interaction) {
        const guildId = interaction.guild.id;
        const queue = queues.get(guildId);

        if (!queue || queue.length === 0) {
            return interaction.reply('📝 The queue is currently empty!');
        }

        const queueList = queue.map((song, index) => 
            `${index + 1}. **${song.title}** - ${song.requestedBy}`
        ).join('\n');

        const embed = {
            title: '🎵 Music Queue',
            description: queueList,
            color: 0x0099FF,
            timestamp: new Date().toISOString(),
        };

        await interaction.reply({ embeds: [embed] });
    },
};

// Export the queue storage for other commands to use
module.exports.queues = queues;