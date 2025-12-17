const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const musicManager = require('../../modules/musicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the current song'),
    async execute(interaction) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: 'You need to be in a voice channel to skip music!', flags: [64] });
        }

        const player = musicManager.getPlayer(interaction.guild.id);
        if (!player) {
            return interaction.reply({ content: 'No music is currently playing!', flags: [64] });
        }

        try {
            const skipped = musicManager.skip(interaction.guild.id, interaction);
            if (skipped) {
                await interaction.reply('⏭️ Skipped to the next track!');
            } else {
                return interaction.reply({ content: 'Could not skip the music!', flags: [64] });
            }
        } catch (error) {
            console.error('Skip command error:', error);
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'An error occurred while trying to skip the song.', flags: [64] });
                } else {
                    await interaction.reply({ content: 'An error occurred while trying to skip the song.', flags: [64] });
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