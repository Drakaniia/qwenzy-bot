const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Make the bot leave the current voice channel'),
    async execute(interaction) {
        const connection = getVoiceConnection(interaction.guild.id);
        
        if (!connection) {
            return await interaction.reply({
                content: '❌ I\'m not in any voice channel!',
                flags: [64]
            });
        }

        const voiceChannel = interaction.member.voice.channel;
        const botChannelId = connection.joinConfig.channelId;
        const botChannel = interaction.guild.channels.cache.get(botChannelId);

        try {
            await connection.destroy();
            
            await interaction.reply({
                content: `✅ Left **${botChannel?.name || 'voice channel'}**!`
            });
            
        } catch (error) {
            console.error('[LEAVE] Error leaving voice channel:', error);
            
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({
                        content: '❌ Failed to leave voice channel. Please try again.',
                        flags: [64]
                    });
                } else {
                    await interaction.reply({
                        content: '❌ Failed to leave voice channel. Please try again.',
                        flags: [64]
                    });
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