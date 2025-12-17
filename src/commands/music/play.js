const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, PermissionFlagsBits, ButtonBuilder, ButtonStyle } = require('discord.js');
let musicManager = require('../../modules/musicManager');

if (typeof global !== 'undefined' && global.__TEST_MOCKS__) {
    musicManager = global.__TEST_MOCKS__.musicManager || musicManager;
}

function isInteractionExpired(interaction) {
    const now = Date.now();
    const interactionAge = now - (interaction.createdTimestamp || now);
    return interactionAge > (14 * 60 * 1000);
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

        const voiceChannel = interaction.member?.voice?.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: '❌ You need to be in a voice channel to play music!', flags: [64] });
        }

        const permissions = voiceChannel.permissionsFor(interaction.client.user);
        if (!permissions?.has(PermissionFlagsBits.Connect) || !permissions?.has(PermissionFlagsBits.Speak)) {
            return interaction.reply({ content: '❌ I need **Connect** and **Speak** permissions in your voice channel.', flags: [64] });
        }

        try {
            if (isInteractionExpired(interaction)) {
                console.log('[INFO] Interaction expired before starting search');
                return;
            }

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

            console.log('[SEARCH] Searching with Lavalink/Riffy:', query);
            const searchResults = await musicManager.search(query, interaction.user);

            if (!searchResults || !searchResults.tracks || searchResults.tracks.length === 0) {
                return interaction.editReply({ 
                    content: `❌ No results found for "${query}". Try a different search term.` 
                });
            }

            const tracks = searchResults.tracks.slice(0, 5);
            const options = tracks.map((track, index) => {
                const duration = track.info.length ? `${Math.floor(track.info.length / 60000)}:${String(Math.floor((track.info.length % 60000) / 1000)).padStart(2, '0')}` : 'Live';
                const label = track.info.title.length > 80 ? track.info.title.substring(0, 77) + '...' : track.info.title;
                return {
                    label,
                    description: `${duration} • ${track.info.author}`,
                    value: String(index),
                };
            });

            const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('music-select')
                        .setPlaceholder('Select a song to play')
                        .addOptions(options)
                );

            if (isInteractionExpired(interaction)) {
                console.log('[INFO] Interaction expired before sending search results');
                return;
            }

            const embed = {
                title: '🔍 Search Results',
                description: `Found ${tracks.length} results for "${query}"`,
                color: 0x0099FF,
                timestamp: new Date().toISOString(),
            };

            let replyMessage;
            try {
                replyMessage = await interaction.editReply({
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

            const collectorSource = replyMessage ?? interaction.channel;
            if (!collectorSource || typeof collectorSource.createMessageComponentCollector !== 'function') {
                console.error('[ERROR] Cannot create component collector (missing reply message/channel)');
                try {
                    await interaction.editReply({
                        content: '❌ Could not attach interaction collector. Please try /play again.',
                        components: []
                    });
                } catch (_) {}
                return;
            }

            const collector = collectorSource.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                time: 30000,
                filter: (i) => i.customId === 'music-select'
            });

            collector.on('collect', (selectInteraction) => {
                (async () => {
                    console.log('[DEBUG] Selection received from user:', selectInteraction.user?.tag);
                    if (selectInteraction.user.id !== interaction.user.id) {
                        await selectInteraction.reply({
                            content: 'You can only use the search results that you requested!',
                            flags: [64]
                        });
                        return;
                    }

                    const selectedIndex = parseInt(selectInteraction.values[0]);
                    const selectedTrack = tracks[selectedIndex];
                    console.log('[DEBUG] Selected track:', selectedTrack?.info?.title || 'not found');

                    if (selectedTrack) {
                        const voiceChannel = selectInteraction.member?.voice?.channel ?? interaction.member?.voice?.channel;
                        console.log('[DEBUG] Selected track, checking voice channel:', voiceChannel?.id || 'null');

                        if (!voiceChannel) {
                            await selectInteraction.update({
                                content: '❌ You need to be in a voice channel to play music!',
                                components: [],
                                embeds: []
                            });
                            return;
                        }

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

                        if (voiceChannel.full && !permissions.has(PermissionFlagsBits.MoveMembers)) {
                            await selectInteraction.update({
                                content: '❌ The voice channel is full and I cannot move members!',
                                components: [],
                                embeds: []
                            });
                            return;
                        }

                        const existingPlayer = musicManager.getPlayer(selectInteraction.guild.id);
                        if (existingPlayer && existingPlayer.voiceChannel !== voiceChannel.id) {
                            await selectInteraction.update({
                                content: '❌ I am already playing in another voice channel! Please use that channel or wait for me to finish.',
                                components: [],
                                embeds: []
                            });
                            return;
                        }

                        console.log('[DEBUG] Passed all checks, starting playback...');
                        
                        try {
                            await selectInteraction.update({
                                content: `▶️ Now playing: **${selectedTrack.info.title}**`,
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
                            const player = musicManager.getOrCreatePlayer({
                                guildId: selectInteraction.guild.id,
                                voiceChannelId: voiceChannel.id,
                                textChannelId: selectInteraction.channel.id,
                                deaf: true,
                                mute: false
                            });

                            console.log('[LAVALINK] Player created/retrieved, adding track to queue');
                            player.queue.add(selectedTrack);

                            if (!player.playing && !player.paused) {
                                console.log('[LAVALINK] Starting playback');
                                await player.play();
                            }

                            try {
                                selectInteraction.client.user.setActivity(selectedTrack.info.title, { type: 0 });
                            } catch (activityError) {
                                console.log('[INFO] Could not set bot activity:', activityError.message);
                            }

                            try {
                                await selectInteraction.editReply({
                                    content: `🎵 **${selectedTrack.info.title}** is now playing!`
                                });
                            } catch (editError) {
                                if (editError.code === 10062) {
                                    console.log('[INFO] Interaction expired while updating song ready message');
                                } else {
                                    console.error('Error updating song ready message:', editError);
                                }
                            }

                        } catch (error) {
                            console.error('[ERROR] Playback error occurred:');
                            console.error('[ERROR] Message:', error.message);
                            console.error('[ERROR] Stack:', error.stack);

                            let errorMessage = '❌ An error occurred while playing music.';

                            if (error.message.includes('403') || error.message.includes('forbidden')) {
                                errorMessage = '❌ Access denied. The video might be private or region-restricted.';
                            } else if (error.message.includes('429')) {
                                errorMessage = '❌ Rate limit reached. Please wait a moment and try again.';
                            } else if (error.message.includes('timeout')) {
                                errorMessage = '❌ Connection timeout. Please check your internet connection and try again.';
                            } else if (error.message.includes('permissions')) {
                                errorMessage = '❌ Permission denied. Please ensure I have the necessary voice channel permissions.';
                            }

                            try {
                                await selectInteraction.followUp({ content: errorMessage, flags: [64] });
                                selectInteraction.client.user.setActivity(null);
                            } catch (followUpError) {
                                console.error('[ERROR] Could not send error message:', followUpError);
                            }
                        }
                    }

                    collector.stop();
                })().catch(async (err) => {
                    console.error('[ERROR] Unhandled error in /play selection handler:', err);
                    try {
                        await selectInteraction.followUp({
                            content: '❌ An unexpected error occurred while starting playback. Please try again.',
                            flags: [64]
                        });
                    } catch (_) {}
                });
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

            if (error.message && error.message.includes('429')) {
                errorMessage = '⚠️ Rate limit reached. Please wait a moment and try again.';
                errorType = 'RATE_LIMIT';
            } else if (error.code === 10062) {
                console.log(`[INFO][${timestamp}] Interaction expired, cannot respond`);
                errorType = 'INTERACTION_EXPIRED';
                return;
            } else if (error.message && error.message.includes('ENOTFOUND') || error.message.includes('network')) {
                errorMessage = '⚠️ Network error. Please check your internet connection and try again.';
                errorType = 'NETWORK';
            } else if (error.message && error.message.includes('timeout')) {
                errorMessage = '⚠️ Search timeout. Please try again.';
                errorType = 'TIMEOUT';
            } else if (error.message && error.message.includes('No results found')) {
                errorMessage = '⚠️ No results found. Try a different search term.';
                errorType = 'NO_RESULTS';
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