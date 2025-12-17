const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop the music and leave the voice channel'),
    async execute(interaction) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: 'You need to be in a voice channel to stop music!', flags: [64] });
        }

        const connection = getVoiceConnection(interaction.guild.id);
        if (!connection) {
            return interaction.reply({ content: 'I am not currently in a voice channel!', flags: [64] });
        }

        try {
            connection.destroy();
            // Clear the bot's activity status when stopping
            interaction.client.user.setActivity(null);
            await interaction.reply('🛑 Stopped the music and left the voice channel!');
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