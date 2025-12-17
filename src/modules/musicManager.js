class MusicManager {
    constructor() {
        this.client = null;
    }

    /**
     * Inject the Discord client so we can access client.riffy without creating circular deps.
     */
    init(client) {
        this.client = client;
        return this;
    }

    get riffy() {
        const riffy = this.client?.riffy;
        if (!riffy) {
            throw new Error('Riffy is not initialized on the Discord client. Did you call client.riffy.init() and musicManager.init(client)?');
        }
        return riffy;
    }

    getPlayer(guildId) {
        return this.client?.riffy?.players?.get(guildId) ?? null;
    }

    /**
     * Create or reuse a Lavalink player connection for this guild.
     */
    getOrCreatePlayer({ guildId, voiceChannelId, textChannelId, deaf = true, mute = false }) {
        const existing = this.getPlayer(guildId);
        if (existing) {
            // Keep metadata up to date (useful if commands are used in different text channels)
            if (textChannelId && existing.textChannel !== textChannelId) {
                try { existing.setTextChannel(textChannelId); } catch (_) { /* ignore */ }
            }
            // If the player exists but is in another voice channel, move it.
            if (voiceChannelId && existing.voiceChannel !== voiceChannelId) {
                try { existing.setVoiceChannel(voiceChannelId, { deaf, mute }); } catch (_) { /* ignore */ }
            }
            return existing;
        }

        return this.riffy.createConnection({
            guildId,
            voiceChannel: voiceChannelId,
            textChannel: textChannelId,
            deaf,
            mute,
        });
    }

    async search(query, requester) {
        return this.riffy.resolve({ query, requester });
    }

    getCurrentTrack(guildId) {
        return this.getPlayer(guildId)?.current ?? null;
    }

    getQueue(guildId) {
        return this.getPlayer(guildId)?.queue ?? [];
    }

    /**
     * Legacy interface: volume is 0.0 - 1.0.
     */
    getVolume(guildId) {
        const player = this.getPlayer(guildId);
        if (!player) return 1.0;
        return (player.volume ?? 100) / 100;
    }

    /**
     * Legacy interface: volume is 0.0 - 1.0.
     */
    setVolume(guildId, volume01) {
        const player = this.getPlayer(guildId);
        if (!player) return false;

        const clamped = Math.max(0, Math.min(1, Number(volume01)));
        const volume = Math.round(clamped * 100);
        player.setVolume(volume);
        return true;
    }

    getLoopMode(guildId) {
        return this.getPlayer(guildId)?.loop ?? 'none';
    }

    setLoopMode(guildId, mode) {
        const player = this.getPlayer(guildId);
        if (!player) return false;
        player.setLoop(mode);
        return true;
    }

    shuffleQueue(guildId) {
        const player = this.getPlayer(guildId);
        if (!player) return false;
        player.queue.shuffle();
        return true;
    }

    pause(guildId) {
        const player = this.getPlayer(guildId);
        if (!player || player.paused) return false;
        player.pause(true);
        return true;
    }

    resume(guildId) {
        const player = this.getPlayer(guildId);
        if (!player || !player.paused) return false;
        player.pause(false);
        return true;
    }

    async skip(guildId) {
        const player = this.getPlayer(guildId);
        if (!player) return false;

        // If there are more tracks queued, stop current and immediately start next.
        if (player.queue.length > 0) {
            player.stop();
            await player.play();
            return true;
        }

        player.destroy();
        return true;
    }

    stop(guildId) {
        const player = this.getPlayer(guildId);
        if (!player) return false;

        player.queue.clear();
        player.stop();
        player.destroy();
        return true;
    }

    disconnect(guildId) {
        const player = this.getPlayer(guildId);
        if (!player) return false;

        player.queue.clear();
        player.stop();
        player.destroy();
        return true;
    }

    async playPrevious(guildId) {
        const player = this.getPlayer(guildId);
        if (!player || !player.previous) return false;

        // Put current track back into queue so the user can return to it.
        if (player.current) player.queue.unshift(player.current);

        // Put previous track at the front and play it.
        player.queue.unshift(player.previous);
        player.stop();
        await player.play();
        return true;
    }
}

// Export a singleton instance with test mode support
const musicManager = new MusicManager();

if (typeof global !== 'undefined' && global.__TEST_MOCKS__ && global.__TEST_MOCKS__.musicManager) {
    module.exports = global.__TEST_MOCKS__.musicManager;
} else {
    module.exports = musicManager;
}
