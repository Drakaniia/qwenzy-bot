const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection, AudioPlayerStatus } = require('@discordjs/voice');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resume the paused music'),
    async execute(interaction) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: 'You need to be in a voice channel to resume music!', flags: [64] });
        }

        const connection = getVoiceConnection(interaction.guild.id);
        if (!connection) {
            return interaction.reply({ content: 'I am not currently in a voice channel!', flags: [64] });
        }

        const player = connection.state.subscription?.player;
        if (!player) {
            return interaction.reply({ content: 'No music is currently loaded!', flags: [64] });
        }

        try {
            // Check if player is not paused
            if (player.state.status !== AudioPlayerStatus.Paused) {
                return interaction.reply({ content: 'Music is not paused!', flags: [64] });
            }

            // Resume the player
            player.unpause();
            await interaction.reply('▶️ Resumed the music!');
        } catch (error) {
            console.error('Resume command error:', error);
            interaction.reply({ content: 'An error occurred while trying to resume the music.', flags: [64] });
        }
    },
};