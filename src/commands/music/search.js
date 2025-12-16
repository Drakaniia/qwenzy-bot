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
            await interaction.deferReply();

            const searchResults = await play.search(query, { limit: 10 });
            
            if (searchResults.length === 0) {
                return interaction.followUp({ content: 'No results found for your search!', ephemeral: true });
            }

            const options = searchResults.map((video, index) => ({
                label: video.title.length > 100 ? video.title.substring(0, 97) + '...' : video.title,
                description: `${video.durationFormatted} • ${video.channel.name}`,
                value: video.url,
            }));

            const row = new ActionRowBuilder()
                .addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('music-select')
                        .setPlaceholder('Select a song to play directly')
                        .addOptions(options)
                );

            const embed = {
                title: '🔍 Search Results',
                description: `Found ${searchResults.length} results for "${query}"`,
                color: 0x0099FF,
                timestamp: new Date().toISOString(),
            };

            const response = await interaction.followUp({ 
                embeds: [embed], 
                components: [row] 
            });

            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                time: 60000 // 60 seconds timeout
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
                        content: `🎵 Selected: **${selectedVideo.title}**. Playing directly...`,
                        components: [],
                        embeds: []
                    });
                    
                    // Import the play command to handle the selected video
                    const playCommand = require('./play.js');
                    
                    // Create a mock interaction with the video title for search
                    const mockInteraction = {
                        ...interaction,
                        options: {
                            getString: () => selectedVideo.title
                        },
                        member: interaction.member,
                        guild: interaction.guild,
                        deferReply: async () => {},
                        followUp: async (options) => {
                            await selectInteraction.followUp(options);
                        },
                        reply: async (options) => {
                            await selectInteraction.followUp(options);
                        }
                    };
                    
                    await playCommand.execute(mockInteraction);
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
            interaction.followUp({ content: 'An error occurred while searching for music.', ephemeral: true });
        }
    },
};