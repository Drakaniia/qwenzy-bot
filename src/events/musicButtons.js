const { Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const musicManager = require('../modules/musicManager');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Handle button interactions for music controls
        if (!interaction.isButton()) return;

        // Check if the button is a music control button
        if (!interaction.customId.startsWith('music_')) return;

        const [_, action, guildId] = interaction.customId.split('_');
        
        try {
            switch (action) {
                case 'previous':
                    await handlePrevious(interaction, guildId);
                    break;
                case 'stop':
                    await handleStop(interaction, guildId);
                    break;
                case 'pause':
                    await handlePause(interaction, guildId);
                    break;
                case 'skip':
                    await handleSkip(interaction, guildId);
                    break;
                case 'like':
                    await handleLike(interaction, guildId);
                    break;
                case 'volumedown':
                    await handleVolumeDown(interaction, guildId);
                    break;
                case 'volumeup':
                    await handleVolumeUp(interaction, guildId);
                    break;
                case 'loop':
                    await handleLoop(interaction, guildId);
                    break;
                case 'viewqueue':
                    await handleViewQueue(interaction, guildId);
                    break;
                case 'shuffle':
                    await handleShuffle(interaction, guildId);
                    break;
                default:
                    await interaction.reply({ content: 'Unknown music command', flags: [64] });
            }
        } catch (error) {
            console.error('Error handling music button:', error);
            await interaction.reply({ content: 'An error occurred while processing your request', flags: [64] });
        }
    },
};

async function handlePrevious(interaction, guildId) {
    const currentTrack = musicManager.getCurrentTrack(guildId);
    const hasPrevious = await musicManager.playPrevious(guildId, interaction);

    if (hasPrevious) {
        await interaction.update({
            content: `⏮️ Playing previous track...`,
            components: createMusicButtons(guildId)
        });
    } else {
        await interaction.reply({
            content: currentTrack
                ? '⏮️ Playing the first track, no previous track available'
                : '❌ No music is currently playing!',
            flags: [64]
        });
    }
}

async function handleStop(interaction, guildId) {
    const success = musicManager.stop(guildId);
    if (success) {
        await interaction.reply({ content: '🛑 Stopped the music and cleared the queue!', flags: [64] });
        // Clear the bot's activity
        interaction.client.user.setActivity(null);
    } else {
        await interaction.reply({ content: '❌ Nothing to stop!', flags: [64] });
    }
}

async function handlePause(interaction, guildId) {
    const player = musicManager.getPlayer(guildId);
    if (!player) {
        await interaction.reply({ content: '❌ No music is currently playing!', flags: [64] });
        return;
    }

    if (player.state.status === 'paused') {
        const resumed = musicManager.resume(guildId);
        if (resumed) {
            await interaction.update({
                content: `▶️ Resumed: **${musicManager.getCurrentTrack(guildId)?.title || 'Unknown Track'}**`,
                components: createMusicButtons(guildId)
            });
        } else {
            await interaction.reply({ content: '❌ Could not resume the music!', flags: [64] });
        }
    } else {
        const paused = musicManager.pause(guildId);
        if (paused) {
            await interaction.update({
                content: `⏸️ Paused: **${musicManager.getCurrentTrack(guildId)?.title || 'Unknown Track'}**`,
                components: createMusicButtons(guildId)
            });
        } else {
            await interaction.reply({ content: '❌ Could not pause the music!', flags: [64] });
        }
    }
}

async function handleSkip(interaction, guildId) {
    const skipped = musicManager.skip(guildId, interaction);
    if (skipped) {
        await interaction.update({
            content: '⏭️ Skipping to the next track...',
            components: createMusicButtons(guildId)
        });
    } else {
        await interaction.reply({ content: '❌ Nothing to skip!', flags: [64] });
    }
}

async function handleLike(interaction, guildId) {
    const currentTrack = musicManager.getCurrentTrack(guildId);
    if (currentTrack) {
        await interaction.reply({ content: `❤️ You liked **${currentTrack.title}**! This feature is for demonstration.`, flags: [64] });
    } else {
        await interaction.reply({ content: '❌ No track is currently playing!', flags: [64] });
    }
}

async function handleVolumeDown(interaction, guildId) {
    let currentVolume = musicManager.getVolume(guildId);
    currentVolume = Math.max(0, currentVolume - 0.1); // Decrease by 10%
    musicManager.setVolume(guildId, currentVolume);
    
    await interaction.update({
        content: `🔉 Volume decreased to ${(currentVolume * 100).toFixed(0)}%`,
        components: createMusicButtons(guildId)
    });
}

async function handleVolumeUp(interaction, guildId) {
    let currentVolume = musicManager.getVolume(guildId);
    currentVolume = Math.min(1, currentVolume + 0.1); // Increase by 10%
    musicManager.setVolume(guildId, currentVolume);
    
    await interaction.update({
        content: `🔊 Volume increased to ${(currentVolume * 100).toFixed(0)}%`,
        components: createMusicButtons(guildId)
    });
}

async function handleLoop(interaction, guildId) {
    const currentMode = musicManager.getLoopMode(guildId);
    let newMode;
    
    switch (currentMode) {
        case 'none':
            newMode = 'track';
            break;
        case 'track':
            newMode = 'queue';
            break;
        case 'queue':
            newMode = 'none';
            break;
        default:
            newMode = 'none';
    }
    
    musicManager.setLoopMode(guildId, newMode);
    
    let modeText = '';
    switch (newMode) {
        case 'track':
            modeText = '🔂 Track';
            break;
        case 'queue':
            modeText = '🔁 Queue';
            break;
        case 'none':
            modeText = '➡️ Off';
            break;
    }
    
    await interaction.update({
        content: `🔄 Loop mode set to: ${modeText}`,
        components: createMusicButtons(guildId)
    });
}

async function handleViewQueue(interaction, guildId) {
    const queue = musicManager.getQueue(guildId);
    const currentTrack = musicManager.getCurrentTrack(guildId);
    
    if (queue.length === 0 && !currentTrack) {
        await interaction.reply({ content: '❌ The queue is empty!', flags: [64] });
        return;
    }
    
    let queueText = `🎵 Now Playing: **${currentTrack?.title || 'Nothing'}**\n`;
    
    if (queue.length > 0) {
        queueText += `\n📋 Next up (${queue.length} songs):\n`;
        
        // Show first 10 songs in queue
        for (let i = 0; i < Math.min(queue.length, 10); i++) {
            const song = queue[i];
            queueText += `${i + 1}. **${song.title}**\n`;
        }
        
        if (queue.length > 10) {
            queueText += `... and ${queue.length - 10} more songs`;
        }
    } else {
        queueText += '\n📋 Queue is empty';
    }
    
    await interaction.reply({ content: queueText, flags: [64] });
}

async function handleShuffle(interaction, guildId) {
    musicManager.shuffleQueue(guildId);
    await interaction.update({
        content: '🔀 Queue shuffled!',
        components: createMusicButtons(guildId)
    });
}

function createMusicButtons(guildId) {
    return [
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`music_previous_${guildId}`)
                    .setLabel('⏮️ Previous')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`music_stop_${guildId}`)
                    .setLabel('⏹️ Stop')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`music_pause_${guildId}`)
                    .setLabel('⏸️ Pause')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`music_skip_${guildId}`)
                    .setLabel('⏭️ Skip')
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`music_like_${guildId}`)
                    .setLabel('❤️ Like')
                    .setStyle(ButtonStyle.Secondary)
            ),
        new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`music_volumedown_${guildId}`)
                    .setLabel('🔉 Vol -')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`music_volumeup_${guildId}`)
                    .setLabel('🔊 Vol +')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`music_loop_${guildId}`)
                    .setLabel('🔄 Loop')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`music_viewqueue_${guildId}`)
                    .setLabel('📋 Queue')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId(`music_shuffle_${guildId}`)
                    .setLabel('🔀 Shuffle')
                    .setStyle(ButtonStyle.Secondary)
            )
    ];
}