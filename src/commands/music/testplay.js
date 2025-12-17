const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('testplay')
        .setDescription('Simple test play command to debug voice issues'),
    async execute(interaction) {
        const voiceChannel = interaction.member.voice.channel;
        
        if (!voiceChannel) {
            return interaction.reply({
                content: '❌ You need to be in a voice channel!',
                flags: [64]
            });
        }

        try {
            await interaction.deferReply();
        } catch (deferError) {
            if (deferError.code !== 40060) {
                throw deferError;
            }
        }

        try {
            // Check if bot already has a connection
            const existingConnection = getVoiceConnection(interaction.guild.id);
            console.log('[TEST] Existing connection:', existingConnection ? 'found' : 'none');
            
            if (existingConnection) {
                console.log('[TEST] Bot already connected to channel:', existingConnection.joinConfig.channelId);
                console.log('[TEST] User is in channel:', voiceChannel.id);
                console.log('[TEST] Same channel?', existingConnection.joinConfig.channelId === voiceChannel.id);
                
                if (existingConnection.joinConfig.channelId === voiceChannel.id) {
                    await interaction.editReply({
                        content: `✅ I'm already in your voice channel (**${voiceChannel.name}**)!\n🎵 You can use /play to add songs to the queue.`
                    });
                } else {
                    await interaction.editReply({
                        content: `❌ I'm in another voice channel! Please join **${voiceChannel.name}** or wait for me to finish.`
                    });
                }
                return;
            }

            // Try to join voice channel directly
            console.log('[TEST] Attempting to join voice channel:', voiceChannel.name);
            
            const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
            
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            });

            console.log('[TEST] Connection object created');

            // Monitor connection states
            connection.on(VoiceConnectionStatus.Signalling, () => {
                console.log('[TEST] Connection state: Signalling');
            });

            connection.on(VoiceConnectionStatus.Connecting, () => {
                console.log('[TEST] Connection state: Connecting');
            });

            connection.on(VoiceConnectionStatus.Ready, () => {
                console.log('[TEST] Connection state: Ready');
                interaction.editReply({
                    content: `✅ Successfully joined **${voiceChannel.name}**! Voice connection is ready.\n🎵 You can now use /play to play music.`
                });
            });

            connection.on(VoiceConnectionStatus.Disconnected, () => {
                console.log('[TEST] Connection state: Disconnected');
            });

            connection.on('error', (error) => {
                console.error('[TEST] Connection error:', error);
                interaction.followUp({
                    content: `❌ Voice connection error: ${error.message}`,
                    flags: [64]
                }).catch(() => {});
            });

            console.log('[TEST] Waiting for connection to be ready...');
            await entersState(connection, VoiceConnectionStatus.Ready, 15000);
            
            console.log('[TEST] Connection should be ready now');

        } catch (error) {
            console.error('[TEST] Error in testplay:', error);
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.editReply(`❌ Error: ${error.message}`);
                } else {
                    await interaction.reply({ content: `❌ Error: ${error.message}`, flags: [64] });
                }
            } catch (replyError) {
                if (replyError.code === 40060 || replyError.code === 10062) {
                    console.log('[INFO] Interaction expired, cannot send error');
                }
            }
        }
    },
};