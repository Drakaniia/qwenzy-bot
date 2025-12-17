const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const musicManager = require('../../modules/musicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop the music and clear the queue'),
    async execute(interaction) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: 'You need to be in a voice channel to stop music!', flags: [64] });
        }

        try {
            const success = musicManager.stop(interaction.guild.id);
            if (success) {
                // Clear the bot's activity status when stopping
                interaction.client.user.setActivity(null);
                await interaction.reply('🛑 Stopped the music and cleared the queue!');
            } else {
                return interaction.reply({ content: 'Could not stop the music!', flags: [64] });
            }
        } catch (error) {
            console.error('Stop command error:', error);
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'An error occurred while trying to stop the music.', flags: [64] });
                } else {
                    await interaction.reply({ content: 'An error occurred while trying to stop the music.', flags: [64] });
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