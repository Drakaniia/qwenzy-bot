const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection, AudioPlayerStatus } = require('@discordjs/voice');
const musicManager = require('../../modules/musicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause the current playing music'),
    async execute(interaction) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: 'You need to be in a voice channel to pause music!', flags: [64] });
        }

        const player = musicManager.getPlayer(interaction.guild.id);
        if (!player) {
            return interaction.reply({ content: 'No music is currently playing!', flags: [64] });
        }

        try {
            // Check if player is already paused
            if (player.state.status === AudioPlayerStatus.Paused) {
                return interaction.reply({ content: 'Music is already paused!', flags: [64] });
            }

            // Pause the player using music manager
            const paused = musicManager.pause(interaction.guild.id);
            if (paused) {
                await interaction.reply(`⏸️ Paused: **${musicManager.getCurrentTrack(interaction.guild.id)?.title || 'Unknown Track'}**`);
            } else {
                return interaction.reply({ content: 'Could not pause the music!', flags: [64] });
            }
        } catch (error) {
            console.error('Pause command error:', error);
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'An error occurred while trying to pause the music.', flags: [64] });
                } else {
                    await interaction.reply({ content: 'An error occurred while trying to pause the music.', flags: [64] });
                }
            } catch (replyError) {
                if (replyError.code === 40060 || replyError.code === 10062) {
                    console.log('[INFO] Interaction already acknowledged, cannot send error');
                } else {
                    console.error('Failed to send error message:', replyError);
                }
            }
        }
    },
};