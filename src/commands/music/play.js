const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');
const play = require('play-dl');

// Import queue storage from queue command
const { queues } = require('./queue.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play music from YouTube')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('YouTube video URL or search query')
                .setRequired(true)),
    async execute(interaction) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: 'You need to be in a voice channel to play music!', ephemeral: true });
        }

        const query = interaction.options.getString('query');
        const guildId = interaction.guild.id;
        
        try {
            await interaction.deferReply();

            let videoInfo;
            if (query.includes('youtube.com') || query.includes('youtu.be')) {
                videoInfo = await play.video_info(query);
            } else {
                const searchResults = await play.search(query, { limit: 1 });
                if (searchResults.length === 0) {
                    return interaction.followUp({ content: 'No results found for your search!', ephemeral: true });
                }
                videoInfo = await play.video_info(searchResults[0].url);
            }

            const song = {
                title: videoInfo.video_details.title,
                url: videoInfo.url,
                duration: videoInfo.video_details.durationFormatted,
                requestedBy: interaction.user.tag,
                thumbnail: videoInfo.video_details.thumbnails[0]?.url
            };

            // Initialize queue for this guild if it doesn't exist
            if (!queues.has(guildId)) {
                queues.set(guildId, []);
            }

            const queue = queues.get(guildId);
            
            // Get or create voice connection
            let connection = getVoiceConnection(guildId);
            if (!connection) {
                connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: interaction.guild.id,
                    adapterCreator: interaction.guild.voiceAdapterCreator,
                });
            }

            // Create player if it doesn't exist
            let player = connection.state.subscription?.player;
            if (!player) {
                player = createAudioPlayer();
                connection.subscribe(player);
                
                // Set up player event listeners
                player.on(AudioPlayerStatus.Playing, () => {
                    const currentSong = queue[0];
                    if (currentSong) {
                        interaction.followUp(`🎵 Now playing: **${currentSong.title}**`);
                    }
                });

                player.on(AudioPlayerStatus.Idle, () => {
                    // Remove the finished song from queue
                    queue.shift();
                    
                    // Play next song if available
                    if (queue.length > 0) {
                        playNextSong(connection, queue, interaction);
                    } else {
                        // No more songs, disconnect after 5 minutes
                        setTimeout(() => {
                            if (!connection.state.subscription?.player || queue.length === 0) {
                                connection.destroy();
                                queues.delete(guildId);
                            }
                        }, 300000); // 5 minutes
                    }
                });

                player.on('error', error => {
                    console.error('Audio player error:', error);
                    interaction.followUp({ content: 'An error occurred while playing the audio.', ephemeral: true });
                    queue.shift();
                    if (queue.length > 0) {
                        playNextSong(connection, queue, interaction);
                    }
                });
            }

            // Add song to queue
            queue.push(song);

            if (queue.length === 1) {
                // If this is the first song, play it immediately
                await playNextSong(connection, queue, interaction);
            } else {
                // Otherwise, just add to queue
                const embed = {
                    title: '🎵 Added to Queue',
                    description: `**${song.title}**`,
                    fields: [
                        { name: 'Duration', value: song.duration, inline: true },
                        { name: 'Requested by', value: song.requestedBy, inline: true },
                        { name: 'Position in Queue', value: `${queue.length}`, inline: true }
                    ],
                    color: 0x0099FF,
                    thumbnail: song.thumbnail ? { url: song.thumbnail } : null,
                };
                
                interaction.followUp({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Play command error:', error);
            interaction.followUp({ content: 'An error occurred while trying to play the music.', ephemeral: true });
        }
    },
};

async function playNextSong(connection, queue, interaction) {
    if (queue.length === 0) return;
    
    const song = queue[0];
    
    try {
        const stream = await play.stream(song.url);
        const resource = createAudioResource(stream.stream, { inputType: stream.type });
        
        connection.state.subscription.player.play(resource);
    } catch (error) {
        console.error('Error playing next song:', error);
        queue.shift();
        if (queue.length > 0) {
            playNextSong(connection, queue, interaction);
        }
    }
}