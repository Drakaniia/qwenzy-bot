const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Stop the current song and disconnect'),
    async execute(interaction) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: 'You need to be in a voice channel to stop music!', flags: [64] });
        }

        const connection = getVoiceConnection(interaction.guild.id);
        if (!connection) {
            return interaction.reply({ content: 'I am not currently playing any music!', flags: [64] });
        }

        const player = connection.state.subscription?.player;
        if (!player) {
            return interaction.reply({ content: 'No music is currently playing!', flags: [64] });
        }

        try {
            player.stop();
            connection.destroy();
            // Clear the bot's activity status when skipping
            interaction.client.user.setActivity(null);
            await interaction.reply('⏹️ Stopped the music and disconnected!');
        } catch (error) {
            console.error('Skip command error:', error);
            interaction.reply({ content: 'An error occurred while trying to stop the song.', flags: [64] });
        }
    },
};