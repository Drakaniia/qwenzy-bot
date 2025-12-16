const { SlashCommandBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const play = require('play-dl');

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

            const stream = await play.stream(videoInfo.url);
            const resource = createAudioResource(stream.stream, { inputType: stream.type });
            const player = createAudioPlayer();
            
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: interaction.guild.id,
                adapterCreator: interaction.guild.voiceAdapterCreator,
            });

            player.play(resource);
            connection.subscribe(player);

            player.on(AudioPlayerStatus.Playing, () => {
                interaction.followUp(`🎵 Now playing: **${videoInfo.video_details.title}**`);
            });

            player.on(AudioPlayerStatus.Idle, () => {
                connection.destroy();
            });

            player.on('error', error => {
                console.error('Audio player error:', error);
                interaction.followUp({ content: 'An error occurred while playing the audio.', ephemeral: true });
                connection.destroy();
            });

        } catch (error) {
            console.error('Play command error:', error);
            interaction.followUp({ content: 'An error occurred while trying to play the music.', ephemeral: true });
        }
    },
};