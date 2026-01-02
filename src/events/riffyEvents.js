const musicManager = require('../modules/musicManager');

module.exports = {
    name: 'riffyEvents',
    once: false,
    async execute(client) {
        // Track started playing
        client.riffy.on('trackStart', (player, track) => {
            const channel = client.channels.cache.get(player.textChannel);
            if (channel) {
                const embed = {
                    title: '🎵 Now Playing',
                    description: `**${track.info.title}**\nBy: ${track.info.author}`,
                    color: 0x00FF00,
                    thumbnail: { url: track.info.artworkUrl || null },
                    fields: [
                        {
                            name: 'Duration',
                            value: track.info.length ? `${Math.floor(track.info.length / 60000)}:${String(Math.floor((track.info.length % 60000) / 1000)).padStart(2, '0')}` : 'Live',
                            inline: true
                        },
                        {
                            name: 'Requested by',
                            value: track.requester?.tag || 'Unknown',
                            inline: true
                        }
                    ]
                };
                channel.send({ embeds: [embed] }).catch(console.error);
            }
            console.log(`[LAVALINK] Track started: ${track.info.title}`);
        });

        // Track ended
        client.riffy.on('trackEnd', (player, track) => {
            console.log(`[LAVALINK] Track ended: ${track.info.title}`);
        });

        // Queue ended - destroy player after playing all tracks
        client.riffy.on('queueEnd', (player) => {
            console.log(`[LAVALINK] Queue ended for guild ${player.guildId}`);
            
            const channel = client.channels.cache.get(player.textChannel);
            if (channel) {
                channel.send({ content: '🎵 Queue finished! Add more songs to keep the party going!' }).catch(console.error);
            }
            
            // Destroy player after 5 seconds if no new tracks are added
            setTimeout(() => {
                const currentPlayer = musicManager.getPlayer(player.guildId);
                if (currentPlayer && currentPlayer.queue.length === 0 && !currentPlayer.playing) {
                    currentPlayer.destroy();
                    console.log(`[LAVALINK] Player destroyed after queue end`);
                }
            }, 5000);
        });

        // Player created
        client.riffy.on('playerCreate', (player) => {
            console.log(`[LAVALINK] Player created for guild ${player.guildId}`);
        });

        // Player destroyed
        client.riffy.on('playerDestroy', (player) => {
            console.log(`[LAVALINK] Player destroyed for guild ${player.guildId}`);
            
            const channel = client.channels.cache.get(player.textChannel);
            if (channel) {
                channel.send({ content: '👋 Left the voice channel!' }).catch(console.error);
            }
        });

        // Player moved to a new channel
        client.riffy.on('playerMove', (player, oldChannel, newChannel) => {
            console.log(`[LAVALINK] Player moved from ${oldChannel} to ${newChannel}`);
        });

        // Error occurred during playback
        client.riffy.on('playerError', (player, error) => {
            console.error(`[LAVALINK] Player error in guild ${player.guildId}:`, error);
            
            const channel = client.channels.cache.get(player.textChannel);
            if (channel) {
                channel.send({ content: `❌ An error occurred during playback: ${error.message}` }).catch(console.error);
            }
        });

        // Node error
        client.riffy.on('nodeError', (node, error) => {
            console.error(`[LAVALINK] Node error: ${node.options.host} - ${error.message}`);
        });

        console.log('[LAVALINK] ✅ Riffy event listeners initialized');
    }
};