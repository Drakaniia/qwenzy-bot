const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const {
    getVoiceConnection,
    joinVoiceChannel,
    entersState,
    VoiceConnectionStatus,
} = require('@discordjs/voice');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voicecheck')
        .setDescription('Debug: verify the bot can join your voice channel (no music playback)'),
    async execute(interaction) {
        const voiceChannel = interaction.member?.voice?.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: '❌ Join a voice channel first, then run /voicecheck.', flags: [64] });
        }

        const permissions = voiceChannel.permissionsFor(interaction.client.user);
        if (!permissions?.has(PermissionFlagsBits.Connect) || !permissions?.has(PermissionFlagsBits.Speak)) {
            return interaction.reply({
                content: '❌ I need **Connect** and **Speak** permissions in your voice channel.',
                flags: [64]
            });
        }

        const existing = getVoiceConnection(interaction.guild.id);
        if (existing && existing.joinConfig?.channelId && existing.joinConfig.channelId !== voiceChannel.id) {
            return interaction.reply({
                content: '❌ I am already connected in another voice channel in this server. Stop/leave there first.',
                flags: [64]
            });
        }

        await interaction.reply({ content: '🔊 Attempting to join your voice channel...', flags: [64] });

        let connection;
        try {
            connection = existing ?? joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
                selfDeaf: false,
                selfMute: false,
            });

            await entersState(connection, VoiceConnectionStatus.Ready, 30000);

            await interaction.editReply('✅ Voice connection is **READY**. Joining works. (Leaving now.)');
        } catch (error) {
            const message = error?.message || String(error);
            try {
                await interaction.editReply(`❌ Voice join failed: ${message}`);
            } catch (_) {
                // ignore
            }
        } finally {
            try {
                // Only destroy if we created it (if we reused an existing connection, leave it alone)
                if (!existing && connection) connection.destroy();
            } catch (_) {
                // ignore
            }
        }
    },
};
