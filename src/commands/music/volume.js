const { SlashCommandBuilder } = require('discord.js');
const musicManager = require('../../modules/musicManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Control the music volume')
        .addIntegerOption(option =>
            option.setName('level')
                .setDescription('Volume level (0-100)')
                .setRequired(false)),
    async execute(interaction) {
        const level = interaction.options.getInteger('level');
        const currentVolume = musicManager.getVolume(interaction.guild.id);
        
        if (level === undefined) {
            // Just show current volume
            return interaction.reply({ 
                content: `🔊 Current volume is ${(currentVolume * 100).toFixed(0)}%`, 
                flags: [64] 
            });
        }
        
        if (level < 0 || level > 100) {
            return interaction.reply({ 
                content: '❌ Volume level must be between 0 and 100!', 
                flags: [64] 
            });
        }
        
        const newVolume = level / 100;
        musicManager.setVolume(interaction.guild.id, newVolume);
        
        await interaction.reply(`🔊 Volume set to ${level}%`);
    },
};