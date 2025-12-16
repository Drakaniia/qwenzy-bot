const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection, AudioPlayerStatus } = require('@discordjs/voice');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause the current playing music'),
    async execute(interaction) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: 'You need to be in a voice channel to pause music!', ephemeral: true });
        }

        const connection = getVoiceConnection(interaction.guild.id);
        if (!connection) {
            return interaction.reply({ content: 'I am not currently playing any music!', ephemeral: true });
        }

        const player = connection.state.subscription?.player;
        if (!player) {
            return interaction.reply({ content: 'No music is currently playing!', ephemeral: true });
        }

        try {
            // Check if player is already paused
            if (player.state.status === AudioPlayerStatus.Paused) {
                return interaction.reply({ content: 'Music is already paused!', ephemeral: true });
            }

            // Pause the player
            player.pause();
            await interaction.reply('⏸️ Paused the music!');
        } catch (error) {
            console.error('Pause command error:', error);
            interaction.reply({ content: 'An error occurred while trying to pause the music.', ephemeral: true });
        }
    },
};