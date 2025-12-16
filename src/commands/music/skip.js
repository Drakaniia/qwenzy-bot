const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const { queues } = require('./queue.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the current song'),
    async execute(interaction) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: 'You need to be in a voice channel to skip music!', ephemeral: true });
        }

        const connection = getVoiceConnection(interaction.guild.id);
        if (!connection) {
            return interaction.reply({ content: 'I am not currently playing any music!', ephemeral: true });
        }

        const player = connection.state.subscription?.player;
        if (!player) {
            return interaction.reply({ content: 'No music is currently playing!', ephemeral: true });
        }

        const queue = queues.get(interaction.guild.id);
        if (!queue || queue.length === 0) {
            return interaction.reply({ content: 'There are no songs in the queue to skip!', ephemeral: true });
        }

        try {
            const currentSong = queue[0];
            player.stop();
            
            if (queue.length > 1) {
                await interaction.reply(`⏭️ Skipped **${currentSong.title}**! Now playing the next song.`);
            } else {
                await interaction.reply(`⏭️ Skipped **${currentSong.title}**! No more songs in queue.`);
            }
        } catch (error) {
            console.error('Skip command error:', error);
            interaction.reply({ content: 'An error occurred while trying to skip the song.', ephemeral: true });
        }
    },
};