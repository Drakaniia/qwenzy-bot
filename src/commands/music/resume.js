const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../modules/musicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resume')
        .setDescription('Resume the paused music'),
    async execute(interaction) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: 'You need to be in a voice channel to resume music!', flags: [64] });
        }

        const player = musicManager.getPlayer(interaction.guild.id);
        if (!player) {
            return interaction.reply({ content: 'No music is currently loaded!', flags: [64] });
        }

        try {
            if (!player.paused) {
                return interaction.reply({ content: 'Music is not paused!', flags: [64] });
            }

            const resumed = musicManager.resume(interaction.guild.id);
            if (resumed) {
                await interaction.reply(`▶️ Resumed: **${musicManager.getCurrentTrack(interaction.guild.id)?.info?.title || 'Unknown Track'}**`);
            } else {
                return interaction.reply({ content: 'Could not resume the music!', flags: [64] });
            }
        } catch (error) {
            console.error('Resume command error:', error);
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'An error occurred while trying to resume the music.', flags: [64] });
                } else {
                    await interaction.reply({ content: 'An error occurred while trying to resume the music.', flags: [64] });
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