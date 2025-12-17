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

const { createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnection, VoiceConnectionStatus, demuxProbe } = require('@discordjs/voice');
const play = require('play-dl');
const rateLimiter = require('../utils/rateLimiter');

class MusicManager {
    constructor() {
        // Map to store music queues for each guild
        this.queues = new Map();
        // Map to store connections for each guild
        this.connections = new Map();
        // Map to store players for each guild
        this.players = new Map();
        // Map to store current track info for each guild
        this.currentTracks = new Map();
        // Map to store previous tracks for each guild
        this.previousTracks = new Map(); // Array of previously played tracks
        // Map to store volume levels for each guild
        this.volumes = new Map();
        // Map to store loop modes for each guild
        this.loopModes = new Map(); // none, track, queue
    }

    getQueue(guildId) {
        if (!this.queues.has(guildId)) {
            this.queues.set(guildId, []);
        }
        return this.queues.get(guildId);
    }

    addToQueue(guildId, song, requester) {
        const queue = this.getQueue(guildId);
        queue.push({
            ...song,
            requester: requester
        });
    }

    removeFromQueue(guildId, index) {
        const queue = this.getQueue(guildId);
        if (index >= 0 && index < queue.length) {
            return queue.splice(index, 1)[0];
        }
        return null;
    }

    clearQueue(guildId) {
        this.queues.set(guildId, []);
    }

    getCurrentTrack(guildId) {
        return this.currentTracks.get(guildId);
    }

    setCurrentTrack(guildId, track) {
        this.currentTracks.set(guildId, track);
    }

    getPlayer(guildId) {
        return this.players.get(guildId);
    }

    setPlayer(guildId, player) {
        this.players.set(guildId, player);
    }

    getConnection(guildId) {
        return this.connections.get(guildId);
    }

    setConnection(guildId, connection) {
        this.connections.set(guildId, connection);
    }

    getVolume(guildId) {
        return this.volumes.get(guildId) || 1.0; // Default volume is 100%
    }

    setVolume(guildId, volume) {
        this.volumes.set(guildId, volume);
    }

    getLoopMode(guildId) {
        return this.loopModes.get(guildId) || 'none';
    }

    setLoopMode(guildId, mode) {
        this.loopModes.set(guildId, mode);
    }

    getPreviousTracks(guildId) {
        if (!this.previousTracks.has(guildId)) {
            this.previousTracks.set(guildId, []);
        }
        return this.previousTracks.get(guildId);
    }

    addPreviousTrack(guildId, track) {
        const previousTracks = this.getPreviousTracks(guildId);
        // Limit to last 20 previous tracks to prevent memory issues
        if (previousTracks.length >= 20) {
            previousTracks.shift(); // Remove the oldest track
        }
        previousTracks.push(track);
    }

    async playPrevious(guildId, interaction = null) {
        const previousTracks = this.getPreviousTracks(guildId);
        if (previousTracks.length === 0) {
            return false; // No previous tracks
        }

        // Remove the current track from the queue if it was added there
        this.getQueue(guildId).unshift(this.getCurrentTrack(guildId));

        // Get the last played track
        const previousTrack = previousTracks.pop(); // Get and remove the last item

        // Add the current track to previous tracks
        if (this.getCurrentTrack(guildId)) {
            this.addPreviousTrack(guildId, this.getCurrentTrack(guildId));
        }

        // Set the previous track as current
        this.setCurrentTrack(guildId, previousTrack);

        const player = this.getPlayer(guildId);
        if (!player) return false;

        try {
            // Create audio resource for the previous track
            let resource;
            let streamRetryCount = 0;
            const maxStreamRetries = 3;

            while (streamRetryCount < maxStreamRetries) {
                try {
                    // Add timeout protection for streaming
                    const streamPromise = play.stream(previousTrack.url, {
                        quality: 2 // highest quality audio
                    });

                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Stream timeout - YouTube is taking too long to respond')), 10000)
                    );

                    const streamData = await Promise.race([streamPromise, timeoutPromise]);

                    resource = createAudioResource(streamData.stream, {
                        inputType: streamData.type,
                        inlineVolume: true
                    });
                    break;
                } catch (streamError) {
                    streamRetryCount++;

                    // Handle specific ytdl-core errors
                    if (streamError.message && streamError.message.includes('429') && streamRetryCount < maxStreamRetries) {
                        console.log(`[STREAM] Rate limit hit, retry ${streamRetryCount}/${maxStreamRetries} in 5 seconds...`);
                        await new Promise(resolve => setTimeout(resolve, 5000 * streamRetryCount));
                        continue;
                    } else if (streamError.message && (streamError.message.includes('Private') || streamError.message.includes('403'))) {
                        throw new Error('This video is private or restricted and cannot be played');
                    }

                    console.error('[VOICE] Failed to create audio stream:', streamError.message);
                    
                    // Don't throw immediately on last retry, instead return false to continue queue
                    if (streamRetryCount >= maxStreamRetries) {
                        console.log('[VOICE] Max retries reached for previous track');
                        return false;
                    }
                    console.log(`[VOICE] Previous track stream attempt ${streamRetryCount} failed, retrying...`);
                    await new Promise(resolve => setTimeout(resolve, 2000 * streamRetryCount));
                    continue;
                }
            }

            if (resource) {
                // Apply volume to the resource
                const volume = this.getVolume(guildId);
                if (volume !== 1.0) {
                    resource.volume.setVolume(volume);
                }

                player.play(resource);
                return true;
            }
        } catch (error) {
            console.error('Error playing previous track:', error);
            if (interaction) {
                await interaction.followUp({
                    content: `❌ Failed to play previous track: ${previousTrack.title}. ${error.message}`,
                    flags: [64]
                });
            }
            return false;
        }
    }

    async playNext(guildId, interaction = null) {
        const queue = this.getQueue(guildId);
        const player = this.getPlayer(guildId);

        if (!player || !queue || queue.length === 0) {
            // If no more songs in queue and no track is looping
            if (this.getLoopMode(guildId) !== 'track') {
                this.disconnect(guildId);
                if (interaction) {
                    await interaction.followUp({ content: '⏹️ Finished playing all songs!', flags: [64] });
                }
                return;
            }
        }

        if (player.state.status !== AudioPlayerStatus.Idle && this.getLoopMode(guildId) !== 'track') {
            // Player is still playing, wait for it to finish
            return;
        }

        let nextTrack;
        if (this.getLoopMode(guildId) === 'track') {
            // Play the same track again if in track loop mode
            nextTrack = this.getCurrentTrack(guildId);
        } else if (this.getLoopMode(guildId) === 'queue' && queue.length === 0) {
            // If queue loop is enabled but queue is empty, disconnect
            this.disconnect(guildId);
            if (interaction) {
                await interaction.followUp({ content: '⏹️ Finished playing all songs!', flags: [64] });
            }
            return;
        } else {
            // Get next track from queue
            nextTrack = queue.shift();
        }

        if (!nextTrack) {
            this.disconnect(guildId);
            if (interaction) {
                await interaction.followUp({ content: '⏹️ No more songs in queue!', flags: [64] });
            }
            return;
        }

        // Add the current track to previous tracks before changing to the next one
        if (this.getCurrentTrack(guildId)) {
            this.addPreviousTrack(guildId, this.getCurrentTrack(guildId));
        }

        this.setCurrentTrack(guildId, nextTrack);
        console.log(`[MUSIC] Set current track to: ${nextTrack.title}`);

        try {
            // Create audio resource with improved error handling
            let resource;
            let streamRetryCount = 0;
            const maxStreamRetries = 3;
            console.log(`[MUSIC] Starting stream creation for: ${nextTrack.url}`);

            while (streamRetryCount < maxStreamRetries) {
                try {
                    // Add timeout protection for streaming
                    const streamPromise = play.stream(nextTrack.url, {
                        quality: 2 // highest quality audio
                    });

                    const timeoutPromise = new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Stream timeout - YouTube is taking too long to respond')), 10000)
                    );

                    const streamData = await Promise.race([streamPromise, timeoutPromise]);

                    resource = createAudioResource(streamData.stream, {
                        inputType: streamData.type,
                        inlineVolume: true
                    });
                    break;
                } catch (streamError) {
                    streamRetryCount++;

                    // Handle specific ytdl-core errors
                    if (streamError.message && streamError.message.includes('429') && streamRetryCount < maxStreamRetries) {
                        console.log(`[STREAM] Rate limit hit, retry ${streamRetryCount}/${maxStreamRetries} in 10 seconds...`);
                        await new Promise(resolve => setTimeout(resolve, 10000 * streamRetryCount));
                        continue;
                    } else if (streamError.message && (streamError.message.includes('Private') || streamError.message.includes('403'))) {
                        throw new Error('This video is private or restricted and cannot be played');
                    }

                    console.error('[VOICE] Failed to create audio stream:', streamError.message);

                    // Don't throw immediately on last retry, instead return false to continue queue
                    if (streamRetryCount >= maxStreamRetries) {
                        console.log('[VOICE] Max retries reached, skipping to next song');
                        return false;
                    }
                    console.log(`[VOICE] Stream attempt ${streamRetryCount} failed, retrying...`);
                    await new Promise(resolve => setTimeout(resolve, 2000 * streamRetryCount));
                    continue;
                }
            }

            if (resource) {
                // Apply volume to the resource
                const volume = this.getVolume(guildId);
                if (volume !== 1.0) {
                    resource.volume.setVolume(volume);
                    console.log(`[MUSIC] Applied volume: ${volume}`);
                }

                console.log(`[MUSIC] Starting player.play() for: ${nextTrack.title}`);
                player.play(resource);
            } else {
                console.log(`[MUSIC] Failed to create audio resource for: ${nextTrack.title}, skipping to next song`);
                // Don't disconnect, just play next song
                if (this.getLoopMode(guildId) !== 'track') {
                    await this.playNext(guildId, interaction);
                }
                return;
            }
        } catch (error) {
            console.error('Error playing next track:', error);
            if (interaction) {
                await interaction.followUp({
                    content: `❌ Failed to play ${nextTrack.title}. ${error.message}`,
                    flags: [64]
                });
            }

            // Try to play the next track in queue
            if (this.getLoopMode(guildId) !== 'track') {
                await this.playNext(guildId, interaction);
            }
        }
    }

    async playSong(guildId, song, interaction, connection) {
        console.log(`[MUSIC] playSong called for guild ${guildId} with song: ${song.title}`);

        if (!this.players.has(guildId)) {
            console.log(`[MUSIC] Creating new player for guild ${guildId}`);
            const player = createAudioPlayer();
            this.setPlayer(guildId, player);

            // Set up player events
            player.on(AudioPlayerStatus.Playing, () => {
                console.log(`[MUSIC] Player started playing`);
                const track = this.getCurrentTrack(guildId);
                if (track && interaction) {
                    // Update bot's activity
                    interaction.client.user.setActivity(track.title, { type: 0 });
                    console.log(`[MUSIC] Updated bot activity to: ${track.title}`);
                }
            });

            player.on(AudioPlayerStatus.Idle, async () => {
                console.log(`[MUSIC] Player went idle, playing next song`);
                // When a song finishes, play the next one
                await this.playNext(guildId, interaction);
            });

            player.on('error', async (error) => {
                console.error('[MUSIC] Audio player error:', error);

                let errorMessage = 'An error occurred while playing audio.';
                if (error.message.includes('FFmpeg')) {
                    errorMessage = '❌ FFmpeg error: Audio format not supported. Please try another song.';
                } else if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
                    errorMessage = '❌ Network timeout: Could not stream audio. Please try again.';
                } else if (error.message.includes('403') || error.message.includes('forbidden')) {
                    errorMessage = '❌ Video restricted: This video cannot be played due to restrictions.';
                } else if (error.message.includes('429')) {
                    errorMessage = '❌ Rate limited: Too many requests. Please wait a moment and try again.';
                }

                if (interaction) {
                    try {
                        await interaction.followUp({ content: errorMessage, flags: [64] });
                    } catch (followUpError) {
                        console.log('[MUSIC] Could not send error followUp:', followUpError.message);
                    }
                }

                // Don't disconnect immediately, try to play next song instead
                console.log('[MUSIC] Attempting to play next song due to error');
                await this.playNext(guildId, interaction);
            });
        }

        const player = this.getPlayer(guildId);

        // If there's an active connection, subscribe player to it
        if (connection) {
            console.log(`[MUSIC] Subscribing player to connection for guild ${guildId}`);
            this.setConnection(guildId, connection);
            connection.subscribe(player);
        } else {
            console.log(`[MUSIC] No connection provided for guild ${guildId}, this is normal if voice connection failed`);
            return;
        }

        // Add the song to the queue and play if nothing is currently playing
        this.addToQueue(guildId, song, interaction.user);

        // If player is idle or no current track, start playing immediately
        if (!this.getCurrentTrack(guildId) || player.state.status === AudioPlayerStatus.Idle) {
            console.log(`[MUSIC] Starting immediate playback for: ${song.title}`);
            await this.playNext(guildId, interaction);
        } else {
            console.log(`[MUSIC] Adding to queue: ${song.title} (current track exists, player status: ${player.state.status})`);
            // Otherwise, just add to queue
            try {
                await interaction.followUp({
                    content: `🎵 Added **${song.title}** to the queue!`,
                    flags: [64]
                });
            } catch (followUpError) {
                console.log('[MUSIC] Error adding to queue message:', followUpError.message);
            }
        }
    }

    pause(guildId) {
        const player = this.getPlayer(guildId);
        if (player && player.state.status === AudioPlayerStatus.Playing) {
            player.pause();
            return true;
        }
        return false;
    }

    resume(guildId) {
        const player = this.getPlayer(guildId);
        if (player && player.state.status === AudioPlayerStatus.Paused) {
            player.unpause();
            return true;
        }
        return false;
    }

    skip(guildId, interaction = null) {
        const player = this.getPlayer(guildId);
        if (player) {
            player.stop();
            return true;
        }
        return false;
    }

    stop(guildId) {
        const player = this.getPlayer(guildId);
        const connection = this.getConnection(guildId);

        if (player) {
            player.stop();
        }

        if (connection) {
            connection.destroy();
        }

        this.clearQueue(guildId);
        this.setCurrentTrack(guildId, null);
        return true;
    }

    disconnect(guildId) {
        const connection = this.getConnection(guildId);
        const player = this.getPlayer(guildId);

        if (player) {
            player.stop();
            this.players.delete(guildId);
        }

        if (connection) {
            connection.destroy();
            this.connections.delete(guildId);
        }

        this.currentTracks.delete(guildId);
        this.queues.delete(guildId);
        this.volumes.delete(guildId);
        this.loopModes.delete(guildId);
    }

    shuffleQueue(guildId) {
        const queue = this.getQueue(guildId);
        for (let i = queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [queue[i], queue[j]] = [queue[j], queue[i]];
        }
    }

    getQueueLength(guildId) {
        return this.getQueue(guildId).length;
    }
}

// Export a singleton instance with test mode support
const musicManager = new MusicManager();

if (typeof global !== 'undefined' && global.__TEST_MOCKS__ && global.__TEST_MOCKS__.musicManager) {
    module.exports = global.__TEST_MOCKS__.musicManager;
} else {
    module.exports = musicManager;
}