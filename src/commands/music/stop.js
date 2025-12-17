const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../modules/musicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop the music and clear the queue'),

    async execute(interaction) {
        const voiceChannel = interaction.member?.voice?.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: '❌ You need to be in a voice channel to stop music!', flags: [64] });
        }

        const success = musicManager.stop(interaction.guild.id);
        if (!success) {
            return interaction.reply({ content: '❌ Nothing to stop!', flags: [64] });
        }

        interaction.client.user.setActivity(null);
        await interaction.reply('🛑 Stopped the music and cleared the queue!');
    },
};
