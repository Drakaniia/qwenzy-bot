const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../modules/musicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('View the current music queue'),
    async execute(interaction) {
        const queue = musicManager.getQueue(interaction.guild.id);
        const currentTrack = musicManager.getCurrentTrack(interaction.guild.id);
        
        if (queue.length === 0 && !currentTrack) {
            return interaction.reply({ content: '❌ The queue is empty!', flags: [64] });
        }
        
        let queueText = `🎵 Now Playing: **${currentTrack?.info?.title || 'Nothing'}**\n`;
        
        if (queue.length > 0) {
            queueText += `\n📋 Queue (${queue.length} songs):\n`;
            
            for (let i = 0; i < Math.min(queue.length, 10); i++) {
                const song = queue[i];
                queueText += `${i + 1}. **${song.info?.title || song.title}**\n`;
            }
            
            if (queue.length > 10) {
                queueText += `... and ${queue.length - 10} more songs`;
            }
        } else {
            queueText += '\n📋 Queue is empty';
        }
        
        await interaction.reply({ content: queueText, flags: [64] });
    },
};