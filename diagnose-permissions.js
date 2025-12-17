const { Client, GatewayIntentBits, Partials } = require('discord.js');
const dotenv = require('dotenv');
dotenv.config();

// Create a client with minimal required intents for the diagnosis
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // Required for slash commands
    ],
    partials: ['MESSAGE', 'CHANNEL', 'USER'], // Needed for button interactions
});

console.log('🔍 Diagnosing Discord bot permissions and capabilities...\n');

client.once('ready', async () => {
    console.log(`✅ Bot logged in as ${client.user.tag}\n`);

    // Check bot permissions in a guild
    const guild = client.guilds.cache.first();
    if (!guild) {
        console.log('❌ No guild found. Invite your bot to a server first!\n');
        process.exit(1);
    }

    console.log(`📊 Guild: ${guild.name} (${guild.id})\n`);

    // Check bot's permissions in the guild
    const botMember = guild.members.cache.get(client.user.id);
    const botPermissions = botMember.permissions;

    console.log('🔐 Bot Permissions:');
    console.log(`  - View Channels: ${botPermissions.has('ViewChannel') ? '✅' : '❌'}`);
    console.log(`  - Send Messages: ${botPermissions.has('SendMessages') ? '✅' : '❌'}`);
    console.log(`  - Manage Messages: ${botPermissions.has('ManageMessages') ? '✅' : '❌'}`);
    console.log(`  - Embed Links: ${botPermissions.has('EmbedLinks') ? '✅' : '❌'}`);
    console.log(`  - Attach Files: ${botPermissions.has('AttachFiles') ? '✅' : '❌'}`);
    console.log(`  - Read Message History: ${botPermissions.has('ReadMessageHistory') ? '✅' : '❌'}`);
    console.log(`  - Mention Everyone: ${botPermissions.has('MentionEveryone') ? '✅' : '❌'}`);
    console.log(`  - Use External Emojis: ${botPermissions.has('UseExternalEmojis') ? '✅' : '❌'}`);
    console.log(`  - Connect (Voice): ${botPermissions.has('Connect') ? '✅' : '❌'}`);
    console.log(`  - Speak (Voice): ${botPermissions.has('Speak') ? '✅' : '❌'}`);
    console.log(`  - Use Voice Activity: ${botPermissions.has('UseVAD') ? '✅' : '❌'}\n`);

    // Check voice permissions specifically
    console.log('🎤 Voice Channel Permissions:');
    const voiceChannels = guild.channels.cache.filter(channel => channel.type === 2); // Voice channels
    if (voiceChannels.size > 0) {
        const firstVoiceChannel = voiceChannels.first();
        const voicePerms = firstVoiceChannel.permissionsFor(botMember);
        
        console.log(`  - Connect in "${firstVoiceChannel.name}": ${voicePerms.has('Connect') ? '✅' : '❌'}`);
        console.log(`  - Speak in "${firstVoiceChannel.name}": ${voicePerms.has('Speak') ? '✅' : '❌'}`);
        console.log(`  - Stream in "${firstVoiceChannel.name}": ${voicePerms.has('Stream') ? '✅' : '❌'}`);
        console.log(`  - Use Voice Activity in "${firstVoiceChannel.name}": ${voicePerms.has('UseVAD') ? '✅' : '❌'}`);
    } else {
        console.log('  - No voice channels found in this guild');
    }
    console.log('');

    // Check bot application features
    console.log('⚙️ Application Settings:');
    console.log('  - Note: Check Discord Developer Portal for Public Bot status and OAuth2 settings');
    console.log('');

    // Check if bot has all required intents enabled in the dev portal
    console.log('📡 Intents Status:');
    console.log('  - Check Discord Developer Portal > Bot > Privileged Gateway Intents for Message Content and Server Members');
    console.log('');

    // Check slash commands
    try {
        const commands = await guild.commands.fetch();
        console.log(`🤖 Available Slash Commands: ${commands.size}`);
        commands.forEach(cmd => {
            console.log(`  - /${cmd.name}: ${cmd.description}`);
        });
        console.log('');
    } catch (error) {
        console.log(`❌ Could not fetch slash commands: ${error.message}\n`);
    }

    console.log('📋 Summary of Common Issues:');
    console.log('1. If "Message Content" intent is disabled, go to Discord Developer Portal > Bot > Privileged Gateway Intents');
    console.log('2. If any voice permissions are ❌, ensure your bot role has these permissions in the server');
    console.log('3. If slash commands aren\'t working, try re-inviting the bot with: bot, applications.commands scopes');
    console.log('');
    
    console.log('🔗 Recommended OAuth2 URL (with proper scopes):');
    console.log(`   https://discord.com/api/oauth2/authorize?client_id=${client.user.id}&permissions=37088768&scope=bot%20applications.commands`);
    console.log('');

    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('❌ Failed to login. Check your DISCORD_TOKEN in .env file:', error.message);
    process.exit(1);
});