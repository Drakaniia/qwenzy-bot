const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection, AudioPlayerStatus } = require('@discordjs/voice');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resume the paused music'),
    async execute(interaction) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: 'You need to be in a voice channel to resume music!', ephemeral: true });
        }

        const connection = getVoiceConnection(interaction.guild.id);
        if (!connection) {
            return interaction.reply({ content: 'I am not currently in a voice channel!', ephemeral: true });
        }

        const player = connection.state.subscription?.player;
        if (!player) {
            return interaction.reply({ content: 'No music is currently loaded!', ephemeral: true });
        }

        try {
            // Check if player is not paused
            if (player.state.status !== AudioPlayerStatus.Paused) {
                return interaction.reply({ content: 'Music is not paused!', ephemeral: true });
            }

            // Resume the player
            player.unpause();
            await interaction.reply('▶️ Resumed the music!');
        } catch (error) {
            console.error('Resume command error:', error);
            interaction.reply({ content: 'An error occurred while trying to resume the music.', ephemeral: true });
        }
    },
};