const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop the music and leave the voice channel'),
    async execute(interaction) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: 'You need to be in a voice channel to stop music!', ephemeral: true });
        }

        const connection = getVoiceConnection(interaction.guild.id);
        if (!connection) {
            return interaction.reply({ content: 'I am not currently in a voice channel!', ephemeral: true });
        }

        try {
            connection.destroy();
            await interaction.reply('🛑 Stopped the music and left the voice channel!');
        } catch (error) {
            console.error('Stop command error:', error);
            interaction.reply({ content: 'An error occurred while trying to stop the music.', ephemeral: true });
        }
    },
};