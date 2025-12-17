const { createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnection, VoiceConnectionStatus } = require('@discordjs/voice');
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
                    const stream = await play.stream(previousTrack.url);
                    resource = createAudioResource(stream.stream, { inputType: stream.type });
                    break;
                } catch (streamError) {
                    streamRetryCount++;
                    
                    // Handle specific play-dl errors
                    if (streamError.message && streamError.message.includes('429') && streamRetryCount < maxStreamRetries) {
                        console.log(`[STREAM] Rate limit hit, retry ${streamRetryCount}/${maxStreamRetries} in 5 seconds...`);
                        await new Promise(resolve => setTimeout(resolve, 5000 * streamRetryCount));
                        continue;
                    } else if (streamError.message && streamError.message.includes('trim')) {
                        console.log(`[STREAM] play-dl trim error, retry ${streamRetryCount}/${maxStreamRetries} in 2 seconds...`);
                        if (streamRetryCount < maxStreamRetries) {
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            continue;
                        }
                    } else if (streamError.message && (streamError.message.includes('Private') || streamError.message.includes('403'))) {
                        throw new Error('This video is private or restricted and cannot be played');
                    }
                    
                    console.error('[VOICE] Failed to create audio stream:', streamError.message);
                    throw new Error(`Failed to create audio stream: ${streamError.message}`);
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

        try {
            // Create audio resource with improved error handling
            let resource;
            let streamRetryCount = 0;
            const maxStreamRetries = 3;

            while (streamRetryCount < maxStreamRetries) {
                try {
                    const stream = await play.stream(nextTrack.url);
                    resource = createAudioResource(stream.stream, { inputType: stream.type });
                    break;
                } catch (streamError) {
                    streamRetryCount++;
                    
                    // Handle specific play-dl errors
                    if (streamError.message && streamError.message.includes('429') && streamRetryCount < maxStreamRetries) {
                        console.log(`[STREAM] Rate limit hit, retry ${streamRetryCount}/${maxStreamRetries} in 5 seconds...`);
                        await new Promise(resolve => setTimeout(resolve, 5000 * streamRetryCount));
                        continue;
                    } else if (streamError.message && streamError.message.includes('trim')) {
                        console.log(`[STREAM] play-dl trim error, retry ${streamRetryCount}/${maxStreamRetries} in 2 seconds...`);
                        if (streamRetryCount < maxStreamRetries) {
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            continue;
                        }
                    } else if (streamError.message && (streamError.message.includes('Private') || streamError.message.includes('403'))) {
                        throw new Error('This video is private or restricted and cannot be played');
                    }
                    
                    console.error('[VOICE] Failed to create audio stream:', streamError.message);
                    throw new Error(`Failed to create audio stream: ${streamError.message}`);
                }
            }

            if (resource) {
                // Apply volume to the resource
                const volume = this.getVolume(guildId);
                if (volume !== 1.0) {
                    resource.volume.setVolume(volume);
                }

                player.play(resource);
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
        if (!this.players.has(guildId)) {
            const player = createAudioPlayer();
            this.setPlayer(guildId, player);

            // Set up player events
            player.on(AudioPlayerStatus.Playing, () => {
                const track = this.getCurrentTrack(guildId);
                if (track && interaction) {
                    // Update bot's activity
                    interaction.client.user.setActivity(track.title, { type: 0 });
                }
            });

            player.on(AudioPlayerStatus.Idle, async () => {
                // When a song finishes, play the next one
                await this.playNext(guildId, interaction);
            });

            player.on('error', async (error) => {
                console.error('Audio player error:', error);
                
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
                    await interaction.followUp({ content: errorMessage, flags: [64] });
                }
                
                this.disconnect(guildId);
            });
        }

        const player = this.getPlayer(guildId);
        
        // If there's an active connection, unsubscribe and reconnect
        if (connection) {
            this.setConnection(guildId, connection);
            connection.subscribe(player);
        }

        // Add the song to the queue and play if nothing is currently playing
        this.addToQueue(guildId, song, interaction.user);
        
        // If player is idle or no current track, start playing immediately
        if (!this.getCurrentTrack(guildId) || player.state.status === AudioPlayerStatus.Idle) {
            await this.playNext(guildId, interaction);
        } else {
            // Otherwise, just add to queue
            await interaction.followUp({ 
                content: `🎵 Added **${song.title}** to the queue!`, 
                flags: [64] 
            });
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

// Export a singleton instance
module.exports = new MusicManager();