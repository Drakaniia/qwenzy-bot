const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member) {
        try {
            // Check if the member is a bot
            if (member.user.bot) return;

            // Get the guild (server) the member joined
            const guild = member.guild;

            // Find a suitable text channel to send the welcome message
            // This could be a dedicated welcome channel or the default channel
            let welcomeChannel = null;

            // Look for a channel named 'welcome', 'general', or 'rules-and-welcome'
            const possibleWelcomeChannels = ['welcome', 'general', 'rules-and-welcome', 'lobby'];
            for (const channelName of possibleWelcomeChannels) {
                welcomeChannel = guild.channels.cache.find(channel =>
                    channel.name.toLowerCase().includes(channelName) &&
                    channel.type === 0 // 0 corresponds to GuildText
                );

                if (welcomeChannel) break;
            }

            // If no specific welcome channel is found, use the system channel if available
            if (!welcomeChannel && guild.systemChannel) {
                welcomeChannel = guild.systemChannel;
            }

            // If still no channel is found, look for any text channel the bot can send messages to
            if (!welcomeChannel) {
                welcomeChannel = guild.channels.cache
                    .filter(channel => channel.type === 0 && channel.permissionsFor(guild.me)?.has('SendMessages'))
                    .first();
            }

            // Send the welcome message if a suitable channel is found
            if (welcomeChannel) {
                // Create an embed for the welcome message
                const welcomeEmbed = new EmbedBuilder()
                    .setColor('#00ff00') // Green color for positive welcome
                    .setTitle(`Welcome to ${guild.name}, ${member.user.username}!`)
                    .setDescription(
                        `>Hello there ${member}! We're excited to have you here!\n\n` +
                        `**${member.user.username}** just joined the server. Say hi!`
                    )
                    .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 })) // User's avatar
                    .setFooter({
                        text: `Member #${guild.memberCount}`,
                        iconURL: guild.iconURL({ dynamic: true })
                    })
                    .setTimestamp();

                await welcomeChannel.send({ embeds: [welcomeEmbed] });
                console.log(`[WELCOME] Sent welcome message for ${member.user.tag} to #${welcomeChannel.name} in ${guild.name}`);
            } else {
                console.log(`[WELCOME] Could not find a suitable channel to send welcome message for ${member.user.tag} in ${guild.name}`);
            }
        } catch (error) {
            console.error('[WELCOME] Error sending welcome message:', error);
        }
    },
};