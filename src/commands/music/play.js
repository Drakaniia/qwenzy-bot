const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const play = require('play-dl');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Search and play music directly from YouTube')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Search query for YouTube music')
                .setRequired(true)),
    async execute(interaction) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: 'You need to be in a voice channel to play music!', ephemeral: true });
        }

        const query = interaction.options.getString('query');
        
        try {
            await interaction.deferReply();

            let videoInfo;
            
            // Add delay to prevent rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Always search for the query (even if it's a URL)
            const searchResults = await play.search(query, { limit: 1 });
            if (searchResults.length === 0) {
                return interaction.followUp({ content: 'No results found for your search!', ephemeral: true });
            }
            
            // Add another delay before getting video info
            await new Promise(resolve => setTimeout(resolve, 500));
            
            videoInfo = await play.video_info(searchResults[0].url);

            const stream = await play.stream(videoInfo.url);
            const resource = createAudioResource(stream.stream, { inputType: stream.type });
            const player = createAudioPlayer();
            
            // Get or create connection
            let connection = getVoiceConnection(interaction.guild.id);
            if (!connection) {
                connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
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
                
                interaction.followUp({ embeds: [embed] });
            });

            player.on(AudioPlayerStatus.Idle, () => {
                // Disconnect after song ends
                setTimeout(() => {
                    if (connection.state.subscription?.player?.state.status === 'idle') {
                        connection.destroy();
                    }
                }, 5000); // 5 second delay before disconnect
            });

            player.on('error', error => {
                console.error('Audio player error:', error);
                interaction.followUp({ content: 'An error occurred while playing the audio.', ephemeral: true });
                connection.destroy();
            });

        } catch (error) {
            console.error('Play command error:', error);
            
            let errorMessage = 'An error occurred while trying to play the music.';
            
            // Handle specific 429 rate limit error
            if (error.message && error.message.includes('429')) {
                errorMessage = '⚠️ YouTube rate limit reached. Please wait a moment and try again.';
            } else if (error.message && error.message.includes('Captcha')) {
                errorMessage = '⚠️ YouTube detected bot activity. Please try again in a few minutes.';
            }
            
            interaction.followUp({ content: errorMessage, ephemeral: true });
        }
    },
};