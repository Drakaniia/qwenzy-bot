const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Displays information about available commands'),
    async execute(interaction) {
        // Get all commands from the client
        const { commands } = interaction.client;
        
        // Group commands by category (folder)
        const commandGroups = {};
        
        for (const command of commands.values()) {
            // Get the file path to determine the category
            // For this to work properly, we'd need to track the folder in the command
            // Since we don't have that metadata, we'll group them based on description or other criteria
            
            // Default to 'general' category if we can't determine otherwise
            let category = 'General';
            
            // Determine category based on command name
            if (command.data.name === 'ping' || command.data.name === 'ask') {
                category = 'General';
            } else if (['play', 'pause', 'resume', 'skip', 'stop', 'queue', 'volume', 'leave', 'voicecheck'].includes(command.data.name)) {
                category = 'Music';
            } else if (command.data.name === 'joke') {
                category = 'Fun';
            } else if (['balance', 'work'].includes(command.data.name)) {
                category = 'Economy';
            }
            
            if (!commandGroups[category]) {
                commandGroups[category] = [];
            }
            
            commandGroups[category].push(command.data.name);
        }
        
        // Create an embed to display the information
        const infoEmbed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('🤖 Qwenzy Bot Commands Information')
            .setDescription('Here are the available commands organized by category:')
            .setTimestamp()
            .setFooter({ text: 'Requested by ' + interaction.user.tag, iconURL: interaction.user.displayAvatarURL() });
        
        // Add fields for each category
        for (const [category, commands] of Object.entries(commandGroups)) {
            // Sort commands alphabetically
            commands.sort();
            infoEmbed.addFields({
                name: `📁 ${category} Commands (${commands.length})`,
                value: commands.map(cmd => `• **/${cmd}**`).join('\n'),
                inline: false
            });
        }
        
        // Add information about admin commands if any exist
        const adminCommands = [
            // This is where we can add admin commands in the future
            // For example: 'ban', 'kick', 'purge', etc.
        ];
        
        if (adminCommands.length > 0) {
            infoEmbed.addFields({
                name: `🛡️ Admin Commands (${adminCommands.length})`,
                value: adminCommands.map(cmd => `• **/${cmd}**`).join('\n'),
                inline: false
            });
        } else {
            infoEmbed.addFields({
                name: '🛡️ Admin Commands',
                value: 'No admin-specific commands are currently available. All commands can be used by any user (subject to Discord permissions).',
                inline: false
            });
        }
        
        // Add additional information about the bot
        infoEmbed.addFields({
            name: 'ℹ️ About Qwenzy Bot',
            value: `A versatile Discord bot with music, economy, fun and utility features.\n\n**Total Commands:** ${commands.size}`,
            inline: false
        });
        
        await interaction.reply({ embeds: [infoEmbed] });
    },
};