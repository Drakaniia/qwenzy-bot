const { EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member) {
        try {
            // Check if the member is a bot
            if (member.user.bot) return;

            // Get the guild (server) the member joined
            const guild = member.guild;

            // Find a suitable text channel to send the welcome message
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
                // Generate welcome image
                const welcomeImage = await generateWelcomeImage(member, guild);
                
                // Create an embed for the welcome message
                const welcomeEmbed = new EmbedBuilder()
                    .setColor('#00ff00') // Green color for positive welcome
                    .setTitle(`Welcome to ${guild.name}, ${member.user.username}!`)
                    .setDescription(
                        `Hello there ${member}! We're excited to have you here!\n\n` +
                        `**${member.user.username}** just joined the server. Say hi!`
                    )
                    .setImage('attachment://welcome.png')
                    .setFooter({
                        text: `Member #${guild.memberCount}`,
                        iconURL: guild.iconURL({ dynamic: true })
                    })
                    .setTimestamp();

                await welcomeChannel.send({ 
                    embeds: [welcomeEmbed],
                    files: [welcomeImage]
                });
                console.log(`[WELCOME] Sent welcome message for ${member.user.tag} to #${welcomeChannel.name} in ${guild.name}`);
            } else {
                console.log(`[WELCOME] Could not find a suitable channel to send welcome message for ${member.user.tag} in ${guild.name}`);
            }
        } catch (error) {
            console.error('[WELCOME] Error sending welcome message:', error);
        }
    },
};

async function generateWelcomeImage(member, guild) {
    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext('2d');

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add decorative circles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.beginPath();
    ctx.arc(100, 100, 80, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(700, 300, 100, 0, Math.PI * 2);
    ctx.fill();

    // Load and draw user avatar
    try {
        const avatarUrl = member.user.displayAvatarURL({ format: 'png', size: 256 });
        const avatar = await loadImage(avatarUrl);
        
        // Create circular clipping path for avatar
        ctx.save();
        ctx.beginPath();
        ctx.arc(150, 200, 80, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        
        // Draw avatar
        ctx.drawImage(avatar, 70, 120, 160, 160);
        ctx.restore();
        
        // Add border around avatar
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(150, 200, 80, 0, Math.PI * 2);
        ctx.stroke();
    } catch (error) {
        console.error('[WELCOME] Error loading avatar:', error);
        // Draw placeholder if avatar fails to load
        ctx.fillStyle = '#444';
        ctx.beginPath();
        ctx.arc(150, 200, 80, 0, Math.PI * 2);
        ctx.fill();
    }

    // Welcome text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Welcome', 280, 120);

    // Username
    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 32px Arial';
    ctx.fillText(member.user.username, 280, 170);

    // Server name (using washme.wepp as specified)
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px Arial';
    ctx.fillText('washme.wepp', 280, 220);

    // Join position
    const position = getOrdinalNumber(guild.memberCount);
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '20px Arial';
    ctx.fillText(`You are the ${position} member`, 280, 270);

    // Join date
    const joinDate = new Date().toLocaleDateString();
    ctx.fillStyle = '#888888';
    ctx.font = '16px Arial';
    ctx.fillText(`Joined: ${joinDate}`, 280, 310);

    // Footer decoration
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(280, 350, 400, 3);

    // Save the canvas to a buffer
    const buffer = canvas.toBuffer('image/png');
    
    // Return as Discord attachment
    return {
        attachment: buffer,
        name: 'welcome.png'
    };
}

function getOrdinalNumber(num) {
    const j = num % 10;
    const k = num % 100;
    
    if (j === 1 && k !== 11) {
        return `${num}st`;
    }
    if (j === 2 && k !== 12) {
        return `${num}nd`;
    }
    if (j === 3 && k !== 13) {
        return `${num}rd`;
    }
    return `${num}th`;
}