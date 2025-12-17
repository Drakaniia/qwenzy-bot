// Polyfill for File object if not available (needed for undici compatibility)
if (typeof File === 'undefined') {
    global.File = class File extends Blob {
        constructor(fileBits, fileName, options = {}) {
            super(fileBits, options);
            this.lastModified = options.lastModified || Date.now();
            this.name = fileName.replace(/\.[^/.]+$/, ""); // Remove extension for name
            this.webkitRelativePath = options.webkitRelativePath || "";
        }
    };
}

const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, PermissionFlagsBits, EmbedBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getVoiceConnection, joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, demuxProbe, VoiceConnectionStatus, entersState } = require('@discordjs/voice');
const ytdl = require('ytdl-core');
const ytsr = require('ytsr');
const rateLimiter = require('../../utils/rateLimiter');
const musicManager = require('../../modules/musicManager'); // Import the music manager

// Helper function to check if interaction is expired
function isInteractionExpired(interaction) {
    const now = Date.now();
    const interactionAge = now - (interaction.createdTimestamp || now);
    return interactionAge > (14 * 60 * 1000); // 14 minutes buffer
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Search for music on YouTube and select to play directly')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Search query for YouTube videos')
                .setRequired(true)),
    async execute(interaction) {
        const query = interaction.options.getString('query');

        try {
            // Check if interaction is expired before starting
            const now = Date.now();
            const interactionAge = now - (interaction.createdTimestamp || now);
            const isExpired = interactionAge > (14 * 60 * 1000); // 14 minutes (give 1 minute buffer)
            
            if (isExpired) {
                console.log('[INFO] Interaction expired before starting search');
                return;
            }

            // Handle Railway environment interaction timing
            let replied = false;
            try {
                await interaction.reply({ content: '🔍 Searching...', flags: [] });
                replied = true;
            } catch (replyError) {
                if (replyError.code === 40060) {
                    console.log('[INFO] Interaction already acknowledged, using editReply');
                    await interaction.editReply({ content: '🔍 Searching...', flags: [] });
                    replied = true;
                } else if (replyError.code === 10062) {
                    console.log('[INFO] Interaction expired, cannot respond');
                    return;
                } else {
                    throw replyError;
                }
            }

            // Use global rate limiter for search with retry logic
            let searchResults;
            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount < maxRetries) {
                // Check interaction timeout before each search attempt
                const currentAge = Date.now() - (interaction.createdTimestamp || Date.now());
                if (currentAge > (14 * 60 * 1000)) {
                    console.log('[INFO] Interaction expired during search retries');
                    return;
                }

                try {
                    searchResults = await rateLimiter.execute(async () => {
                        const results = await ytsr.search(query, { limit: 5 });
                        // Format the results to match the expected structure
                        return results.items.filter(item => item.type === 'video').slice(0, 5).map(result => ({
                            title: result.title,
                            url: result.url,
                            duration: result.duration,
                            durationRaw: result.duration,
                            durationFormatted: result.duration || 'N/A',
                            channel: { name: result.author?.name || 'Unknown Channel' },
                            thumbnail: result.bestThumbnail || result.thumbnails?.[0] || null
                        }));
                    });
                    break;
                } catch (searchError) {
                    retryCount++;
                    if (searchError.message && searchError.message.includes('429') && retryCount < maxRetries) {
                        console.log(`[SEARCH] Rate limit hit, retry ${retryCount}/${maxRetries} in 5 seconds...`);
                        await new Promise(resolve => setTimeout(resolve, 5000 * retryCount)); // Exponential backoff
                    } else {
                        throw searchError;
                    }
                }
            }

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

            // Check interaction timeout before sending search results
            const currentAge = Date.now() - (interaction.createdTimestamp || Date.now());
            if (currentAge > (14 * 60 * 1000)) {
                console.log('[INFO] Interaction expired before sending search results');
                return;
            }

            const embed = {
                title: '🔍 Search Results',
                description: `Found ${searchResults.length} results for "${query}"`,
                color: 0x0099FF,
                timestamp: new Date().toISOString(),
            };

            try {
                await interaction.editReply({
                    content: '',
                    embeds: [embed],
                    components: [row]
                });
            } catch (editError) {
                if (editError.code === 10062) {
                    console.log('[INFO] Interaction expired while sending search results');
                    return;
                } else {
                    throw editError;
                }
            }

            const collector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                time: 30000 // Reduced timeout to 30 seconds
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    console.log('[DEBUG] Collector timed out');
                    if (isInteractionExpired(interaction)) {
                        console.log('[INFO] Interaction expired, skipping timeout message');
                        return;
                    }
                    try {
                        interaction.editReply({
                            components: [],
                            content: 'Search selection timed out. Please run /play again.'
                        }).catch(() => {
                            console.log('[INFO] Interaction expired, could not edit reply');
                        });
                    } catch (error) {
                        console.log('[INFO] Interaction expired during timeout handling');
                    }
                }
            });

            collector.on('collect', async (selectInteraction) => {
                console.log('[DEBUG] Selection received from user:', selectInteraction.user.tag);
                if (selectInteraction.user.id !== interaction.user.id) {
                    await selectInteraction.reply({
                        content: 'You can only use the search results that you requested!',
                        flags: [64] // 64 = EPHEMERAL flag
                    });
                    return;
                }

                const selectedVideo = searchResults.find(video => video.url === selectInteraction.values[0]);
                console.log('[DEBUG] Selected video:', selectedVideo?.title || 'not found');

                if (selectedVideo) {
                    // Comprehensive permission and voice channel checks
                    const voiceChannel = selectInteraction.member.voice.channel;
                    console.log('[DEBUG] Selected video, checking voice channel:', voiceChannel?.id || 'null');

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
                    console.log('[DEBUG] Bot permissions:', {
                        connect: permissions.has(PermissionFlagsBits.Connect),
                        speak: permissions.has(PermissionFlagsBits.Speak),
                        viewChannel: permissions.has(PermissionFlagsBits.ViewChannel)
                    });

                    if (!permissions.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
                        await selectInteraction.update({
                            content: '❌ I need permission to connect and speak in your voice channel!',
                            components: [],
                            embeds: []
                        });
                        return;
                    }

                    // Check if voice channel is full
                    if (voiceChannel.full && !permissions.has(PermissionFlagsBits.MoveMembers)) {
                        await selectInteraction.update({
                            content: '❌ The voice channel is full and I cannot move members!',
                            components: [],
                            embeds: []
                        });
                        return;
                    }

                    // Check if user is in the same voice channel as bot
                    const existingConnection = getVoiceConnection(selectInteraction.guild.id);
                    console.log('[DEBUG] Existing connection:', existingConnection ? 'found' : 'none');

                    if (existingConnection && existingConnection.joinConfig.channelId !== voiceChannel.id) {
                        await selectInteraction.update({
                            content: '❌ I am already playing in another voice channel! Please use that channel or wait for me to finish.',
                            components: [],
                            embeds: []
                        });
                        return;
                    }

                    console.log('[DEBUG] Passed all checks, starting playback...');
                    
                    // Immediately acknowledge and show music controls
                    await selectInteraction.update({
                        content: `▶️ Now playing: **${selectedVideo.title}**`,
                        components: createMusicButtons(selectInteraction.guild.id),
                        embeds: []
                    });

                    try {
                        // Skip video info fetching for now to avoid rate limiting
                        // Use the search results data instead
                        console.log('[INFO] Using search result data to avoid YouTube rate limiting');
                        const videoInfo = null;

                        // Join voice channel if not connected
                        let connection = getVoiceConnection(selectInteraction.guild.id);
                        try {
                            if (!connection) {
                                console.log('[DEBUG] Joining voice channel:', voiceChannel.id);
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
                                        try {
                                            connection.destroy();
                                        } catch (e) {
                                            console.error('[VOICE] Error destroying connection:', e);
                                        }
                                        selectInteraction.client.user.setActivity(null);
                                    }
                                });

                                connection.on('error', (error) => {
                                    console.error('[VOICE] Connection error details:', error);
                                    selectInteraction.followUp({ content: `❌ Voice connection error: ${error.message}. Please try again.`, flags: [64] }).catch(console.error);
                                });
                            } else if (connection.joinConfig.channelId !== voiceChannel.id) {
                                // If connected but to a different channel (should be caught by checks above, but safety net)
                                console.log('[DEBUG] Rejoining voice channel:', voiceChannel.id);
                                connection.rejoin({
                                    channelId: voiceChannel.id,
                                    selfDeaf: false,
                                    selfMute: false
                                });
                            }
                        } catch (joinError) {
                            console.error('[VOICE] Critical join error:', joinError);
                            return selectInteraction.followUp({
                                content: `❌ Failed to join voice channel: ${joinError.message}. Make sure I have permissions!`,
                                flags: [64]
                            });
                        }

                        // Wait for connection to be ready before playing
                        try {
                            await Promise.race([
                                entersState(connection, VoiceConnectionStatus.Ready, 15000),
                                new Promise((_, reject) => 
                                    setTimeout(() => reject(new Error('Voice connection timeout')), 20000)
                                )
                            ]);

                            // Create song object using search result data
                            const song = {
                                title: selectedVideo.title,
                                url: selectedVideo.url,
                                duration: selectedVideo.durationRaw || 0,
                                channel: selectedVideo.channel?.name || 'Unknown Channel',
                                thumbnail: selectedVideo.thumbnail || null
                            };

                            
                            // Set bot activity
                            try {
                                selectInteraction.client.user.setActivity(song.title, { type: 0 });
                            } catch (activityError) {
                                console.log('[INFO] Could not set bot activity:', activityError.message);
                            }

                            // Actually play the song using the music manager
                            await musicManager.playSong(selectInteraction.guild.id, song, selectInteraction, connection);

                            // Update the message with current status if possible
                            try {
                                await selectInteraction.editReply({
                                    content: `🎵 **${song.title}** is ready to play!`
                                });
                            } catch (editError) {
                                if (editError.code === 10062) {
                                    console.log('[INFO] Interaction expired while updating song ready message');
                                } else {
                                    console.error('Error updating song ready message:', editError);
                                }
                            }

                        } catch (error) {
                            console.error('[VOICE] Connection timeout:', error);
                            let errorMessage = '❌ Failed to connect to voice channel. Please check my permissions and try again.';
                            if (error.message === 'Voice connection timeout') {
                                errorMessage = '❌ Voice connection timed out. Please try again.';
                            }
                            
                            try {
                                await selectInteraction.followUp({
                                    content: errorMessage,
                                    flags: [64]
                                });
                            } catch (followUpError) {
                                console.log('[INFO] Could not send connection error:', followUpError.message);
                            }
                            if (connection) {
                                try {
                                    connection.destroy();
                                } catch (destroyError) {
                                    console.error('[VOICE] Error destroying connection:', destroyError);
                                }
                            }
                            return;
                        }
                    } catch (error) {
                        console.error('[ERROR] Playback error occurred:');
                        console.error('[ERROR] Message:', error.message);
                        console.error('[ERROR] Stack:', error.stack);

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

                        // Clear the bot's activity status when there's an error
                        selectInteraction.client.user.setActivity(null);
                    }
                }

                collector.stop();
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    if (isInteractionExpired(interaction)) {
                        console.log('[INFO] Interaction expired, skipping timeout message');
                        return;
                    }
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

// Function to create music control buttons
function createMusicButtons(guildId) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`music_previous_${guildId}`)
                    .setLabel('⏮️ Previous')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`music_stop_${guildId}`)
                    .setLabel('⏹️ Stop')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`music_pause_${guildId}`)
                    .setLabel('⏸️ Pause')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`music_skip_${guildId}`)
                    .setLabel('⏭️ Skip')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`music_like_${guildId}`)
                    .setLabel('❤️ Like')
                    .setStyle(ButtonStyle.Secondary)
            ),
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`music_volumedown_${guildId}`)
                    .setLabel('🔉 Vol -')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`music_volumeup_${guildId}`)
                    .setLabel('🔊 Vol +')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`music_loop_${guildId}`)
                    .setLabel('🔄 Loop')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`music_viewqueue_${guildId}`)
                    .setLabel('📋 Queue')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`music_shuffle_${guildId}`)
                    .setLabel('🔀 Shuffle')
                    .setStyle(ButtonStyle.Secondary)
            )
    ];
}