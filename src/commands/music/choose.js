const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const play = require('play-dl');
const rateLimiter = require('../../utils/rateLimiter');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('choose')
        .setDescription('Search for music and choose from results to play')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Search query for YouTube videos')
                .setRequired(true)),
    async execute(interaction) {
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
                label: video.title.length > 80 ? video.title.substring(0, 77) + '...' : video.title,
                description: `${video.durationFormatted} • ${video.channel.name}`,
                value: video.url,
            }));

            const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('music-choose')
                        .setPlaceholder('Select a song to play')
                        .addOptions(options)
                );

            const embed = {
                title: '🎵 Choose a Song',
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
                time: 30000
            });

            collector.on('collect', async (selectInteraction) => {
                if (selectInteraction.user.id !== interaction.user.id) {
                    await selectInteraction.reply({ 
                        content: 'You can only use the search results that you requested!', 
                        ephemeral: true 
                    });
                    return;
                }

                const selectedVideo = searchResults.find(video => video.url === selectInteraction.values[0]);
                
                if (selectedVideo) {
                    // Check if user is in a voice channel before attempting to play
                    const voiceChannel = selectInteraction.member.voice.channel;
                    if (!voiceChannel) {
                        await selectInteraction.update({
                            content: '❌ You need to be in a voice channel to play music!',
                            components: [],
                            embeds: []
                        });
                        return;
                    }

                    await selectInteraction.update({
                        content: `🎵 Playing: **${selectedVideo.title}**`,
                        components: [],
                        embeds: []
                    });

                    // Direct playback using rate limiter
                    try {
                        const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');



                        // Use rate limiter for video info
                        const videoInfo = await rateLimiter.execute(async () => {
                            return await play.video_info(selectedVideo.url);
                        });
                        
                        const stream = await play.stream(videoInfo.url);
                        const resource = createAudioResource(stream.stream, { inputType: stream.type });
                        const player = createAudioPlayer();
                        
                        let connection = getVoiceConnection(selectInteraction.guild.id);
                        if (!connection) {
                            console.log(`Creating new voice connection to channel: ${voiceChannel.name} (${voiceChannel.id})`);
                            try {
                                connection = joinVoiceChannel({
                                    channelId: voiceChannel.id,
                                    guildId: selectInteraction.guild.id,
                                    adapterCreator: selectInteraction.guild.voiceAdapterCreator,
                                });
                                console.log(`Successfully joined voice channel: ${voiceChannel.name}`);
                            } catch (error) {
                                console.error('Failed to join voice channel:', error);
                                await selectInteraction.followUp({ content: 'Failed to join voice channel. Check bot permissions.', ephemeral: true });
                                return;
                            }
                        } else {
                            console.log(`Using existing voice connection in channel: ${voiceChannel.name}`);
                        }

                        try {
                            connection.subscribe(player);
                            console.log('Player subscribed to connection');
                            player.play(resource);
                            console.log('Started playing audio resource');
                        } catch (error) {
                            console.error('Failed to play audio:', error);
                            await selectInteraction.followUp({ content: 'Failed to play audio. Please try again.', ephemeral: true });
                            return;
                        }

                        player.on(AudioPlayerStatus.Playing, () => {
                            console.log('Audio player is now playing');
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

                        player.on(AudioPlayerStatus.Buffering, () => {
                            console.log('Audio player is buffering');
                        });

                        player.on(AudioPlayerStatus.AutoPaused, () => {
                            console.log('Audio player auto-paused');
                        });

                        player.on(AudioPlayerStatus.Idle, () => {
                            console.log('Audio player is idle - will disconnect in 5 seconds');
                            setTimeout(() => {
                                if (connection.state.subscription?.player?.state.status === 'idle') {
                                    connection.destroy();
                                    console.log('Disconnected from voice channel');
                                }
                            }, 5000);

                            // Clear the bot's activity status when playback ends
                            selectInteraction.client.user.setActivity(null); // Clears the activity status
                        });

                        player.on('error', error => {
                            console.error('Audio player error:', error);
                            selectInteraction.followUp({ content: 'An error occurred while playing.', ephemeral: true });
                            if (connection) connection.destroy();
                            // Clear the bot's activity status when there's an error
                            selectInteraction.client.user.setActivity(null);
                        });

                    } catch (error) {
                        console.error('Playback error:', error);

                        let errorMessage = 'An error occurred while playing the selected song.';

                        // Handle specific 429 rate limit error
                        if (error.message && error.message.includes('429')) {
                            errorMessage = '⚠️ YouTube rate limit reached. Please wait a moment and try again.';
                        } else if (error.message && error.message.includes('Captcha')) {
                            errorMessage = '⚠️ YouTube detected bot activity. Please try again in a few minutes.';
                        }

                        await selectInteraction.followUp({ content: errorMessage, ephemeral: true });
                        // Clear the bot's activity status when there's an error
                        selectInteraction.client.user.setActivity(null);
                    }
                }
                
                collector.stop();
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    interaction.editReply({ 
                        components: [],
                        content: 'Selection timed out. Please run /choose again.'
                    }).catch(console.error);
                }
            });

        } catch (error) {
            console.error('Choose command error:', error);
            
            let errorMessage = 'An error occurred while searching for music.';
            
            // Handle specific 429 rate limit error
            if (error.message && error.message.includes('429')) {
                errorMessage = '⚠️ YouTube rate limit reached. Please wait a moment and try again.';
            } else if (error.message && error.message.includes('Captcha')) {
                errorMessage = '⚠️ YouTube detected bot activity. Please try again in a few minutes.';
            }
            
            if (interaction.replied || interaction.deferred) {
                interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },
};