const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus } = require('@discordjs/voice');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Make the bot join your current voice channel'),
    async execute(interaction) {
        const voiceChannel = interaction.member.voice.channel;
        
        if (!voiceChannel) {
            return await interaction.reply({
                content: '❌ You need to be in a voice channel for me to join!',
                flags: [64]
            });
        }

        // Check if bot is already in a voice channel
        const existingConnection = getVoiceConnection(interaction.guild.id);
        if (existingConnection) {
            if (existingConnection.joinConfig.channelId === voiceChannel.id) {
                return await interaction.reply({
                    content: `✅ I'm already in **${voiceChannel.name}**!`,
                    flags: [64]
                });
            } else {
                return await interaction.reply({
                    content: `❌ I'm already in **${existingConnection.joinConfig.channelId}**! Use \`/leave\` first or use \`/play\` to join your current channel.`,
                    flags: [64]
                });
            }
        }

        // Check bot permissions for the voice channel
        const permissions = voiceChannel.permissionsFor(interaction.client.user);
        const requiredPermissions = ['CONNECT', 'SPEAK'];
        
        const missingPermissions = requiredPermissions.filter(perm => !permissions.has(perm));
        if (missingPermissions.length > 0) {
            return await interaction.reply({
                content: `❌ I'm missing these permissions in **${voiceChannel.name}**: ${missingPermissions.map(p => `\`${p}\``).join(', ')}`,
                flags: [64]
            });
        }

        // Check if voice channel is full
        if (voiceChannel.full && !permissions.has('MOVE_MEMBERS')) {
            return await interaction.reply({
                content: `❌ The voice channel **${voiceChannel.name}** is full and I don't have permission to move members!`,
                flags: [64]
            });
        }

        await interaction.deferReply();

        try {
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            });

            // Monitor connection state
            connection.on(VoiceConnectionStatus.Signalling, () => {
                console.log(`[VOICE] Requesting permission to join ${voiceChannel.name}...`);
            });

            connection.on(VoiceConnectionStatus.Connecting, () => {
                console.log(`[VOICE] Connecting to ${voiceChannel.name}...`);
            });

            connection.on(VoiceConnectionStatus.Ready, () => {
                console.log(`[VOICE] Successfully connected to ${voiceChannel.name}!`);
            });

            connection.on(VoiceConnectionStatus.Disconnected, () => {
                console.log(`[VOICE] Disconnected from ${voiceChannel.name}`);
            });

            connection.on('error', (error) => {
                console.error(`[VOICE] Connection error in ${voiceChannel.name}:`, error);
            });

            await interaction.editReply({
                content: `✅ Successfully joined **${voiceChannel.name}**! Use \`/play\` to start playing music.`
            });

        } catch (error) {
            console.error('[JOIN] Error joining voice channel:', error);
            
            let errorMessage = 'Failed to join voice channel.';
            if (error.message.includes('permissions')) {
                errorMessage = '❌ I don\'t have permission to join this voice channel.';
            } else if (error.message.includes('timeout')) {
                errorMessage = '❌ Connection timeout. Please try again.';
            } else {
                errorMessage = `❌ Error: ${error.message}`;
            }
            
            await interaction.editReply({
                content: errorMessage
            });
        }
    },
};