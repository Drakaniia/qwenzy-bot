const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../modules/musicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Make the bot leave the current voice channel'),

    async execute(interaction) {
        const voiceChannel = interaction.member?.voice?.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: '❌ You need to be in a voice channel to use this command!', flags: [64] });
        }

        const success = musicManager.disconnect(interaction.guild.id);
        if (!success) {
            return interaction.reply({ content: '❌ I am not connected.', flags: [64] });
        }

        interaction.client.user.setActivity(null);
        await interaction.reply('✅ Left the voice channel!');
    },
};
