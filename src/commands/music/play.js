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
const play = require('play-dl');
const rateLimiter = require('../../utils/rateLimiter');
const musicManager = require('../../modules/musicManager'); // Import the music manager

// Initialize play-dl with proper YouTube cookie/session if available
let youtubeCookieValid = false;
if (process.env.YOUTUBE_COOKIE) {
    try {
        play.setToken({
            youtube: process.env.YOUTUBE_COOKIE
        });
        youtubeCookieValid = true;
        console.log('[INIT] YouTube cookie loaded successfully');
    } catch (cookieError) {
        console.error('[INIT] Failed to load YouTube cookie:', cookieError.message);
        console.log('[INIT] Continuing without YouTube cookie (may experience rate limits)');
    }
} else {
    console.log('[INIT] No YouTube cookie provided - rate limits may apply');
}

// Initialize play-dl with basic configuration
try {
    // Check if play-dl is properly loaded with YouTube functionality
    if (typeof play.search === 'function') {
        console.log('[INIT] play-dl search function is available');
    } else {
        console.error('[INIT] ERROR: play-dl search function is not available!');
    }
} catch (initError) {
    console.error('[INIT] Error checking play-dl functionality:', initError.message);
}

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
                        console.log('[SEARCH] Attempting YouTube search with play-dl...');

                        // Validate that play-dl search function exists
                        if (typeof play.search !== 'function') {
                            throw new Error('play-dl search function is not available');
                        }

                        // Add timeout protection for search operations
                        const searchPromise = play.search(query, {
                            limit: 5,
                            source: { youtube: 'video' },
                            type: 'video'
                        });

                        const timeoutPromise = new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('Search timeout - YouTube is taking too long to respond')), 15000)
                        );

                        const results = await Promise.race([searchPromise, timeoutPromise]);

                        console.log(`[SEARCH] Found ${results.length} results`);

                        return results.map(video => ({
                            title: video.title || 'Unknown Title',
                            url: video.url,
                            duration: video.durationInSec || 0,
                            durationRaw: video.durationRaw || '0:00',
                            durationFormatted: video.durationRaw || 'N/A',
                            channel: { name: video.channel?.name || 'Unknown Channel' },
                            thumbnail: video.thumbnails?.[0]?.url || null
                        }));
                    });
                    console.log('[SEARCH] Search completed successfully');
                    break;
                } catch (searchError) {
                    retryCount++;
                    console.error(`[SEARCH] Search attempt ${retryCount} failed:`, searchError.message);

                    if (searchError.message && (searchError.message.includes('429') || searchError.message.includes('rate limit')) && retryCount < maxRetries) {
                        console.log(`[SEARCH] Rate limit hit, retry ${retryCount}/${maxRetries} in ${5 * retryCount} seconds...`);
                        await new Promise(resolve => setTimeout(resolve, 5000 * retryCount)); // Exponential backoff
                    } else if (retryCount >= maxRetries) {
                        console.error('[SEARCH] Max search retries reached');
                        await interaction.editReply({
                            content: `❌ Failed to search for music after ${maxRetries} attempts. YouTube might be experiencing rate limits. Please try again later.`,
                        });
                        return;
                    } else if (searchError.message && searchError.message.includes('play-dl search function is not available')) {
                        console.error('[SEARCH] play-dl library issue detected, trying fallback method');
                        
                        // Fallback: Try using ytdl-core search
                        try {
                            console.log('[SEARCH] Using ytdl-core fallback search');
                            const ytdlInfo = await ytdl.getInfo(`ytsearch5:${query}`);
                            
                            const fallbackResults = ytdlInfo.videos.slice(0, 5).map(video => ({
                                title: video.title || 'Unknown Title',
                                url: video.video_url,
                                duration: video.duration || 0,
                                durationRaw: video.duration || '0:00',
                                durationFormatted: video.duration || 'N/A',
                                channel: { name: video.author?.name || 'Unknown Channel' },
                                thumbnail: video.thumbnail || null
                            }));
                            
                            console.log(`[SEARCH] Fallback search found ${fallbackResults.length} results`);
                            searchResults = fallbackResults;
                            break;
                            
                        } catch (fallbackError) {
                            console.error('[SEARCH] Fallback search also failed:', fallbackError.message);
                            await interaction.editReply({
                                content: `❌ Both primary and fallback search methods failed. YouTube may be experiencing issues. Please try again later.`,
                            });
                            return;
                        }
                    } else {
                        console.error('[SEARCH] Unexpected search error:', searchError);
                        // For other errors, we continue to retry
                        if (retryCount >= maxRetries) {
                            throw searchError;
                        }
                        // Wait before retrying
                        await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
                    }
                }
            }

            if (!searchResults || searchResults.length === 0) {
                return interaction.editReply({ 
                    content: `❌ No results found for "${query}". Try a different search term.` 
                });
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
                    try {
                        await selectInteraction.update({
                            content: `▶️ Now playing: **${selectedVideo.title}**`,
                            components: createMusicButtons(selectInteraction.guild.id),
                            embeds: []
                        });
                    } catch (updateError) {
                        if (updateError.code === 10062) {
                            console.log('[INFO] Interaction expired while updating playback');
                            return;
                        } else {
                            throw updateError;
                        }
                    }

                    try {
                        // Fetch complete video information from YouTube
                        console.log('[INFO] Fetching video information from YouTube...');
                        let videoInfo;
                        
                        try {
                            videoInfo = await rateLimiter.execute(async () => {
                                const info = await play.video_info(selectedVideo.url);
                                console.log('[INFO] Successfully fetched video information');
                                return info;
                            });
                        } catch (infoError) {
                            console.error('[ERROR] Failed to fetch video info:', infoError.message);
                            
                            // If video info fails, try to continue with search result data as fallback
                            console.log('[WARN] Falling back to search result data due to video info fetch failure');
                            videoInfo = null;
                        }

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

                            // Create song object using fetched video information or search result data as fallback
                            const song = videoInfo ? {
                                title: videoInfo.video_details.title,
                                url: videoInfo.video_details.url,
                                duration: videoInfo.video_details.durationRaw,
                                channel: videoInfo.video_details.channel?.name || 'Unknown Channel',
                                thumbnail: videoInfo.video_details.thumbnails?.[0]?.url || null,
                                views: videoInfo.video_details.views || 0,
                                uploadedAt: videoInfo.video_details.uploadedAt || null
                            } : {
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
            const timestamp = new Date().toISOString();
            const errorContext = {
                timestamp,
                query,
                guild: interaction.guild?.id,
                user: interaction.user?.tag,
                error: {
                    message: error.message,
                    code: error.code,
                    status: error.status,
                    stack: error.stack
                }
            };

            console.error(`[ERROR][${timestamp}] Search command error:`, JSON.stringify(errorContext, null, 2));

            let errorMessage = 'An error occurred while searching for music.';
            let errorType = 'UNKNOWN';

            // Enhanced error categorization
            if (error.message && error.message.includes('429')) {
                errorMessage = '⚠️ YouTube rate limit reached. Please wait a moment and try again.';
                errorType = 'RATE_LIMIT';
            } else if (error.message && error.message.includes('Captcha') || error.message.includes('bot') || error.message.includes('automated')) {
                errorMessage = '⚠️ YouTube detected bot activity. Please try again in a few minutes.';
                errorType = 'CAPTCHA';
            } else if (error.code === 10062) {
                console.log(`[INFO][${timestamp}] Interaction expired, cannot respond`);
                errorType = 'INTERACTION_EXPIRED';
                return;
            } else if (error.message && error.message.includes('ENOTFOUND') || error.message.includes('network')) {
                errorMessage = '⚠️ Network error. Please check your internet connection and try again.';
                errorType = 'NETWORK';
            } else if (error.message && error.message.includes('timeout')) {
                errorMessage = '⚠️ Search timeout. YouTube is taking too long to respond. Please try again.';
                errorType = 'TIMEOUT';
            } else if (error.message && error.message.includes('play-dl')) {
                errorMessage = '⚠️ Music library error. Please try again in a moment.';
                errorType = 'LIBRARY_ERROR';
            } else if (error.message && error.message.includes('No results found')) {
                errorMessage = '⚠️ No results found. Try a different search term.';
                errorType = 'NO_RESULTS';
            } else if (error.message && error.message.includes('rateLimiter')) {
                errorMessage = '⚠️ Rate limiting error. Please wait a moment and try again.';
                errorType = 'RATE_LIMITER';
            } else if (error.message && error.message.includes('interaction') || error.message.includes('reply')) {
                errorMessage = '⚠️ Discord interaction error. Please try the command again.';
                errorType = 'DISCORD_INTERACTION';
            }

            console.log(`[ERROR][${timestamp}] Categorized error as ${errorType}: ${errorMessage}`);

            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: errorMessage, flags: [64] });
                } else {
                    await interaction.reply({ content: errorMessage, flags: [64] });
                }
            } catch (replyError) {
                console.error(`[ERROR][${timestamp}] Failed to send error message:`, {
                    error: replyError.message,
                    code: replyError.code,
                    originalError: errorType
                });
                if (replyError.code === 10062) {
                    console.log(`[INFO][${timestamp}] Interaction expired, cannot send error message`);
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