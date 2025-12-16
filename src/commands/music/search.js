const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const play = require('play-dl');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('search')
        .setDescription('Search for music on YouTube and select to play directly')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Search query for YouTube videos')
                .setRequired(true)),
    async execute(interaction) {
        const query = interaction.options.getString('query');
        
        try {
            // Reply immediately to show the bot is working
            await interaction.reply({ content: '🔍 Searching...', ephemeral: false });

            const searchResults = await play.search(query, { limit: 8 }); // Reduced from 10 to 8 for speed
            
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
                        ephemeral: true 
                    });
                    return;
                }

                const selectedVideo = searchResults.find(video => video.url === selectInteraction.values[0]);
                
                if (selectedVideo) {
                    await selectInteraction.update({ 
                        content: `🎵 Playing: **${selectedVideo.title}**`,
                        components: [],
                        embeds: []
                    });
                    
                    // Direct playback without calling play command again
                    try {
                        const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
                        
                        const voiceChannel = selectInteraction.member.voice.channel;
                        if (!voiceChannel) {
                            await selectInteraction.followUp({ content: 'You need to be in a voice channel!', ephemeral: true });
                            return;
                        }

                        const videoInfo = await play.video_info(selectedVideo.url);
                        const stream = await play.stream(videoInfo.url);
                        const resource = createAudioResource(stream.stream, { inputType: stream.type });
                        const player = createAudioPlayer();
                        
                        let connection = getVoiceConnection(selectInteraction.guild.id);
                        if (!connection) {
                            connection = joinVoiceChannel({
                                channelId: voiceChannel.id,
                                guildId: selectInteraction.guild.id,
                                adapterCreator: selectInteraction.guild.voiceAdapterCreator,
                            });
                        }

                        player.play(resource);
                        connection.subscribe(player);

                        player.on(AudioPlayerStatus.Playing, () => {
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
                        });

                        player.on('error', error => {
                            console.error('Audio player error:', error);
                            selectInteraction.followUp({ content: 'An error occurred while playing.', ephemeral: true });
                            connection.destroy();
                        });

                    } catch (error) {
                        console.error('Playback error:', error);
                        await selectInteraction.followUp({ content: 'An error occurred while playing the selected song.', ephemeral: true });
                    }
                }
                
                collector.stop();
            });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    interaction.editReply({ 
                        components: [],
                        content: 'Search selection timed out. Please run /search again.'
                    }).catch(console.error);
                }
            });

        } catch (error) {
            console.error('Search command error:', error);
            if (interaction.replied || interaction.deferred) {
                interaction.followUp({ content: 'An error occurred while searching for music.', ephemeral: true });
            } else {
                interaction.reply({ content: 'An error occurred while searching for music.', ephemeral: true });
            }
        }
    },
};