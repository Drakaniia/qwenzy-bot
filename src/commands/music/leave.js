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
                ephemeral: true
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
            
            await interaction.reply({
                content: '❌ Failed to leave voice channel. Please try again.',
                ephemeral: true
            });
        }
    },
};