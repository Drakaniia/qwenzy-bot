const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../modules/musicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('voicecheck')
        .setDescription('Check Lavalink node status and connectivity'),
    async execute(interaction) {
        await interaction.deferReply();

        const riffy = interaction.client.riffy;

        if (!riffy) {
            return interaction.editReply({ content: '❌ Riffy is not initialized!' });
        }

        // Check node status
        const nodes = riffy.nodes;
        let nodeStatus = '📊 **Lavalink Node Status:**\n\n';

        if (nodes && nodes.size > 0) {
            nodes.forEach((node, id) => {
                const status = node.connected ? '✅ Connected' : '❌ Disconnected';
                const stats = node.stats || {};

                nodeStatus += `**Node ${id}:**\n`;
                nodeStatus += `- Status: ${status}\n`;
                nodeStatus += `- Host: ${node.options.host}:${node.options.port}\n`;
                nodeStatus += `- Secure: ${node.options.secure ? 'Yes' : 'No'}\n`;
                nodeStatus += `- Players: ${stats.players || 0}\n`;
                nodeStatus += `- Playing Players: ${stats.playingPlayers || 0}\n`;
                nodeStatus += `- Uptime: ${stats.uptime ? Math.floor(stats.uptime / 1000) + 's' : 'N/A'}\n\n`;
            });
        } else {
            nodeStatus += '❌ No nodes configured or available!\n';
        }

        // Check active players
        const activePlayers = [];
        riffy.players.forEach((player, guildId) => {
            activePlayers.push({
                guildId,
                voiceChannel: player.voiceChannel,
                textChannel: player.textChannel,
                playing: player.playing,
                paused: player.paused,
                queueLength: player.queue.length,
                currentTrack: player.current?.info?.title || 'None'
            });
        });

        let playerStatus = '\n🎵 **Active Players:**\n\n';
        if (activePlayers.length > 0) {
            activePlayers.forEach(p => {
                playerStatus += `**Guild ${p.guildId}:**\n`;
                playerStatus += `- Playing: ${p.playing ? 'Yes' : 'No'}\n`;
                playerStatus += `- Paused: ${p.paused ? 'Yes' : 'No'}\n`;
                playerStatus += `- Queue: ${p.queueLength} tracks\n`;
                playerStatus += `- Current: ${p.currentTrack}\n\n`;
            });
        } else {
            playerStatus += 'No active players.\n';
        }

        // Test search functionality
        playerStatus += '\n🔍 **Testing Search:**\n';
        try {
            console.log('[VOICECHECK] Testing search functionality...');
            const testResult = await riffy.resolve({ query: 'ytsearch:test', requester: interaction.user });
            console.log('[VOICECHECK] Search test result:', testResult);
            if (testResult && testResult.tracks && testResult.tracks.length > 0) {
                playerStatus += '✅ Search is working!\n';
            } else {
                playerStatus += '⚠️ Search returned no results.\n';
            }
        } catch (error) {
            console.error('[VOICECHECK] Search test failed:', error);
            playerStatus += `❌ Search failed: ${error.message}\n`;
        }

        // Add musicReady status
        const musicReadyStatus = interaction.client.musicReady ? '✅ Ready' : '❌ Not Ready';
        playerStatus += `\n🎧 **Music System:** ${musicReadyStatus}\n`;

        await interaction.editReply({
            content: nodeStatus + playerStatus,
            flags: []
        });
    }
};