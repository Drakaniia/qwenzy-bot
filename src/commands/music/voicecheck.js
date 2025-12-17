const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const musicManager = require('../../modules/musicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voicecheck')
        .setDescription('Debug: verify the bot can join your voice channel (via Lavalink/Riffy)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Connect),

    async execute(interaction) {
        const voiceChannel = interaction.member?.voice?.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: '❌ Join a voice channel first, then run /voicecheck.', flags: [64] });
        }

        const permissions = voiceChannel.permissionsFor(interaction.client.user);
        if (!permissions?.has(PermissionFlagsBits.Connect) || !permissions?.has(PermissionFlagsBits.Speak)) {
            return interaction.reply({ content: '❌ I need **Connect** and **Speak** permissions in your voice channel.', flags: [64] });
        }

        const existing = musicManager.getPlayer(interaction.guild.id);
        if (existing && existing.voiceChannel && existing.voiceChannel !== voiceChannel.id) {
            return interaction.reply({ content: '❌ I am already connected in another voice channel in this server. Stop/leave there first.', flags: [64] });
        }

        await interaction.reply({ content: '🔊 Attempting to join your voice channel...', flags: [64] });

        let player;
        let created = false;
        try {
            if (existing) {
                player = existing;
            } else {
                created = true;
                player = musicManager.getOrCreatePlayer({
                    guildId: interaction.guild.id,
                    voiceChannelId: voiceChannel.id,
                    textChannelId: interaction.channel.id,
                    deaf: true,
                });
            }

            await player.connection.resolve();
            await interaction.editReply('✅ Voice connection is **READY** (Lavalink/Riffy).');
        } catch (error) {
            const message = error?.message || String(error);
            try {
                await interaction.editReply(`❌ Voice join failed: ${message}`);
            } catch (_) {
                // ignore
            }
        } finally {
            // If this was only a check, clean up.
            try {
                if (created && player) player.destroy();
            } catch (_) {
                // ignore
            }
        }
    },
};
