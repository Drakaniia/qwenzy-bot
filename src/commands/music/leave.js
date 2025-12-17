const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const musicManager = require('../../modules/musicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Make the bot leave the current voice channel'),
    async execute(interaction) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: 'You need to be in a voice channel to use this command!', flags: [64] });
        }

        // Use music manager to disconnect
        musicManager.disconnect(interaction.guild.id);

        // Clear the bot's activity status
        interaction.client.user.setActivity(null);

        await interaction.reply('✅ Left the voice channel!');
    },
};