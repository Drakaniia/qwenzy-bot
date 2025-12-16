const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');
const play = require('play-dl');
const rateLimiter = require('../../utils/rateLimiter');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Search for music on YouTube and select to play directly')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Search query for YouTube videos')
                .setRequired(true)),
    async execute(interaction) {
        const { getVoiceConnection } = require('@discordjs/voice');
        const query = interaction.options.getString('query');
        
        try {
            // Reply immediately to show the bot is working
            await interaction.reply({ content: '🔍 Searching...', ephemeral: false });

            // Use global rate limiter for search
            const searchResults = await rateLimiter.execute(async () => {
                return await play.search(query, { limit: 5 });
            });
            
            if (searchResults.length === 0) {
                return interaction.editReply({ content: 'No results found for your search!' });
            }

            const options = searchResults.map((video, index) => ({
                label: video.title.length > 80 ? video.title.substring(0, 77) + '...' : video.title, // Shorter labels
                description: `${video.durationFormatted} • ${video.channel.name}`,
                value: video.url,
            }));

            const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('music-select')
                        .setPlaceholder('Select a song to play')
                        .addOptions(options)
                );

            const embed = {
                title: '🔍 Search Results',
                description: `Found ${searchResults.length} results for "${query}"`,
                color: 0x0099FF,
                timestamp: new Date().toISOString(),
            };

            await interaction.editReply({ 
                content: '',
                embeds: [embed], 
                components: [row] 
            });

            const collector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                time: 30000 // Reduced timeout to 30 seconds
            });

            collector.on('collect', async (selectInteraction) => {
                if (selectInteraction.user.id !== interaction.user.id) {
                    await selectInteraction.reply({
                        content: 'You can only use the search results that you requested!',
                        flags: [64] // 64 = EPHEMERAL flag
                    });
                    return;
                }

                const selectedVideo = searchResults.find(video => video.url === selectInteraction.values[0]);

                if (selectedVideo) {
                    // Comprehensive permission and voice channel checks
                    const voiceChannel = selectInteraction.member.voice.channel;
                    if (!voiceChannel) {
                        await selectInteraction.update({
                            content: '❌ You need to be in a voice channel to play music!',
                            components: [],
                            embeds: []
                        });
                        return;
                    }

                    // Check bot permissions for voice channel
                    const permissions = voiceChannel.permissionsFor(selectInteraction.client.user);
                    if (!permissions.has('CONNECT') || !permissions.has('SPEAK')) {
                        await selectInteraction.update({
                            content: '❌ I need permission to connect and speak in your voice channel!',
                            components: [],
                            embeds: []
                        });
                        return;
                    }

                    // Check if voice channel is full
                    if (voiceChannel.full && !permissions.has('MOVE_MEMBERS')) {
                        await selectInteraction.update({
                            content: '❌ The voice channel is full and I cannot move members!',
                            components: [],
                            embeds: []
                        });
                        return;
                    }

                    // Check if user is in the same voice channel as bot
                    const existingConnection = getVoiceConnection(selectInteraction.guild.id);
                    if (existingConnection && existingConnection.joinConfig.channelId !== voiceChannel.id) {
                        await selectInteraction.update({
                            content: '❌ I am already playing in another voice channel! Please use that channel or wait for me to finish.',
                            components: [],
                            embeds: []
                        });
                        return;
                    }

                    await selectInteraction.update({
                                                content: `🔌 Connecting to voice channel... 🎵 **${selectedVideo.title}**`,
                                                components: [],
                                                embeds: []
                                            });
                    // Direct playback without calling play command again
                    try {
                        const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, demuxProbe, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
                        const ffmpeg = require('ffmpeg-static');
                        const { spawn } = require('child_process');

                        // Set FFmpeg path for play-dl (if needed in future versions)
                        // play-dl v1.9.7+ should auto-detect ffmpeg-static when available
                        console.log('[VOICE] FFmpeg path available:', !!ffmpeg);

                        const videoInfo = await rateLimiter.execute(async () => {
                            return await play.video_info(selectedVideo.url);
                        });
                        
                        // Enhanced stream handling with fallbacks
                        let resource;
                        try {
                            const stream = await play.stream(videoInfo.url);
                            const { stream: probeStream, type } = await demuxProbe(stream.stream);
                            resource = createAudioResource(probeStream, { inputType: type });
                            console.log('[VOICE] Using demuxed stream type:', type);
                        } catch (probeError) {
                            console.warn('[VOICE] demuxProbe failed, falling back to default stream:', probeError.message);
                            try {
                                const stream = await play.stream(videoInfo.url);
                                resource = createAudioResource(stream.stream, { inputType: stream.type });
                                console.log('[VOICE] Using fallback stream type:', stream.type);
                            } catch (streamError) {
                                console.error('[VOICE] All stream methods failed:', streamError.message);
                                throw new Error('Failed to create audio stream from video');
                            }
                        }
                        const player = createAudioPlayer();
                        
                        let connection = getVoiceConnection(selectInteraction.guild.id);
                        if (!connection) {
                            connection = joinVoiceChannel({
                                channelId: voiceChannel.id,
                                guildId: selectInteraction.guild.id,
                                adapterCreator: selectInteraction.guild.voiceAdapterCreator,
                            });

                            // Monitor connection state
                            connection.on(VoiceConnectionStatus.Signalling, () => {
                                console.log('[VOICE] Requesting permission to join voice channel...');
                            });

                            connection.on(VoiceConnectionStatus.Connecting, () => {
                                console.log('[VOICE] Establishing connection...');
                            });

                            connection.on(VoiceConnectionStatus.Ready, () => {
                                console.log('[VOICE] Connection ready - playing audio!');
                            });

                            connection.on(VoiceConnectionStatus.Disconnected, async (oldState, newState) => {
                                console.log('[VOICE] Disconnected from voice channel');
                                try {
                                    await Promise.race([
                                        entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
                                        entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
                                    ]);
                                } catch {
                                    connection.destroy();
                                    selectInteraction.client.user.setActivity(null);
                                }
                            });

                            connection.on('error', (error) => {
                                console.error('[VOICE] Connection error:', error);
                                selectInteraction.followUp({ content: '❌ Voice connection error occurred. Please try again.', flags: [64] });
                            });
                        }

                        // Wait for connection to be ready before playing
                        try {
                            await selectInteraction.editReply({
                                content: `🔊 Establishing voice connection... 🎵 **${selectedVideo.title}**`
                            });
                            
                            await entersState(connection, VoiceConnectionStatus.Ready, 15000);
                            
                            await selectInteraction.editReply({
                                content: `▶️ Now playing: **${selectedVideo.title}**`
                            });
                        } catch (error) {
                            console.error('[VOICE] Connection timeout:', error);
                            await selectInteraction.followUp({ 
                                content: '❌ Failed to connect to voice channel. Please check my permissions and try again.', 
                                flags: [64] 
                            });
                            connection.destroy();
                            return;
                        }

                        player.play(resource);
                        connection.subscribe(player);

                        player.on(AudioPlayerStatus.Playing, () => {
                            // Update bot's activity status to show what's playing
                            selectInteraction.client.user.setActivity(videoInfo.video_details.title, { type: 0 }); // 0 is for "PLAYING"

                            const embed = {
                                title: '🎵 Now Playing',
                                description: `**${videoInfo.video_details.title}**`,
                                fields: [
                                    { name: 'Duration', value: videoInfo.video_details.durationFormatted, inline: true },
                                    { name: 'Channel', value: videoInfo.video_details.channel.name, inline: true }
                                ],
                                color: 0x0099FF,
                                thumbnail: videoInfo.video_details.thumbnails[0]?.url ? { url: videoInfo.video_details.thumbnails[0].url } : null,
                            };

                            selectInteraction.followUp({ embeds: [embed] });
                        });

                        player.on(AudioPlayerStatus.Idle, () => {
                            setTimeout(() => {
                                if (connection.state.subscription?.player?.state.status === 'idle') {
                                    connection.destroy();
                                }
                            }, 5000);

                            // Clear the bot's activity status when playback ends
                            selectInteraction.client.user.setActivity(null); // Clears the activity status
                        });

                        player.on('error', error => {
                            console.error('Audio player error:', error);
                            let errorMessage = 'An error occurred while playing audio.';
                            
                            if (error.message.includes('FFmpeg')) {
                                errorMessage = '❌ FFmpeg error: Audio format not supported. Please try another song.';
                            } else if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
                                errorMessage = '❌ Network timeout: Could not stream audio. Please try again.';
                            } else if (error.message.includes('403') || error.message.includes('forbidden')) {
                                errorMessage = '❌ Video restricted: This video cannot be played due to restrictions.';
                            } else if (error.message.includes('429')) {
                                errorMessage = '❌ Rate limited: Too many requests. Please wait a moment and try again.';
                            }
                            
                            selectInteraction.followUp({ content: errorMessage, flags: [64] });
                            connection.destroy();
                            selectInteraction.client.user.setActivity(null);
                        });

                    } catch (error) {
                        console.error('Playback error:', error);
                        
                        let errorMessage = 'An error occurred while playing music.';
                        
                        // Provide specific error messages based on common issues
                        if (error.message.includes('FFmpeg')) {
                            errorMessage = '❌ FFmpeg error: Audio processing failed. This might be due to an unsupported video format.';
                        } else if (error.message.includes('403') || error.message.includes('forbidden')) {
                            errorMessage = '❌ YouTube access denied. The video might be private or region-restricted.';
                        } else if (error.message.includes('429')) {
                            errorMessage = '❌ YouTube rate limit reached. Please wait a moment and try again.';
                        } else if (error.message.includes('Captcha') || error.message.includes('bot')) {
                            errorMessage = '❌ YouTube detected bot activity. Please try again in a few minutes.';
                        } else if (error.message.includes('timeout')) {
                            errorMessage = '❌ Connection timeout. Please check your internet connection and try again.';
                        } else if (error.message.includes('permissions')) {
                            errorMessage = '❌ Permission denied. Please ensure I have the necessary voice channel permissions.';
                        } else if (error.message.includes('stream')) {
                            errorMessage = '❌ Stream error: Unable to process audio from this video. Please try another song.';
                        }
                        
                        await selectInteraction.followUp({ content: errorMessage, flags: [64] });
                        
                        if (connection) {
                            connection.destroy();
                        }
                        // Clear the bot's activity status when there's an error
                        selectInteraction.client.user.setActivity(null);
                    }
                }
                
                collector.stop();
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    try {
                        interaction.editReply({ 
                            components: [],
                            content: 'Search selection timed out. Please run /play again.'
                        }).catch(() => {
                            // If edit fails, the interaction may have expired
                            console.log('[INFO] Interaction expired, could not edit reply');
                        });
                    } catch (error) {
                        console.log('[INFO] Interaction expired or already handled');
                    }
                }
            });

        } catch (error) {
            console.error('Search command error:', error);
            
            let errorMessage = 'An error occurred while searching for music.';
            
            // Handle specific 429 rate limit error
            if (error.message && error.message.includes('429')) {
                errorMessage = '⚠️ YouTube rate limit reached. Please wait a moment and try again.';
            } else if (error.message && error.message.includes('Captcha')) {
                errorMessage = '⚠️ YouTube detected bot activity. Please try again in a few minutes.';
            } else if (error.code === 10062) {
                // Unknown interaction - interaction expired
                console.log('[INFO] Interaction expired, cannot respond');
                return;
            }
            
            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: errorMessage, flags: [64] });
                } else {
                    await interaction.reply({ content: errorMessage, flags: [64] });
                }
            } catch (replyError) {
                if (replyError.code === 10062) {
                    console.log('[INFO] Interaction expired, cannot send error message');
                } else {
                    console.error('Failed to send error message:', replyError);
                }
            }
        }
    },
};