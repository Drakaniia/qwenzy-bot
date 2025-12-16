require('dotenv').config();

// Validate dependencies on startup
function validateDependencies() {
    try {
        require('discord.js');
        require('@discordjs/voice');
        require('play-dl');
        require('ffmpeg-static');
        console.log('[INIT] ✅ All required dependencies are available');
    } catch (error) {
        console.error('[INIT] ❌ Missing required dependencies:', error.message);
        process.exit(1);
    }
}

// Validate voice dependencies specifically
function validateVoiceDependencies() {
    try {
        // Test if we can create required components
        const play = require('play-dl');
        const ffmpegPath = require('ffmpeg-static');
        console.log('[VOICE] ✅ play-dl and ffmpeg-static are available');

        // play-dl should work with ffmpeg-static automatically
        console.log('[VOICE] FFmpeg path:', ffmpegPath);
    } catch (error) {
        console.error('[ERROR] ❌ Voice dependency validation failed:', error.message);
        console.log('[ERROR] Voice commands may not work properly!');
    }
}

validateDependencies();
validateVoiceDependencies();

const { Client, Collection, GatewayIntentBits, Events } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Wispbyte and similar platforms typically don't require an HTTP server
// but it's good practice to have one for health checks
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint for Wispbyte or similar hosting platforms
app.get('/', (req, res) => {
    res.send('Qwenzy Bot is running!');
});

// Additional health check endpoint for monitoring
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Ping endpoint to keep the bot alive
app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

// Keep the server running for platforms that need it
const server = app.listen(PORT, () => {
    console.log(`Health check server running on port ${PORT}`);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.commands = new Collection();

// LOAD COMMANDS
const foldersPath = path.join(__dirname, 'src/commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
}

// LOAD EVENTS
const eventsPath = path.join(__dirname, 'src/events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// EVENTS
client.once(Events.ClientReady, async () => {
    console.log(`[INIT] Logged in as ${client.user.tag}!`);
    console.log(`[INFO] Ready to compile some fun.`);

    if (process.env.GEMINI_API_KEY) {
        console.log('[INFO] 🧠 Gemini AI Key loaded successfully.');
    } else {
        console.log('[WARN] ⚠️ Gemini AI Key is MISSING in process.env!');
    }

    // Validate voice dependencies
    try {
        const { generateDependencyReport } = require('@discordjs/voice');
        const ffmpeg = require('ffmpeg-static');
        
        console.log('[INFO] 🎵 Voice dependencies validated successfully.');
        console.log('[INFO] 📦 FFmpeg path:', ffmpeg);
        
        // Optional: Log dependency report for debugging
        // console.log(generateDependencyReport());
    } catch (error) {
        console.error('[ERROR] ❌ Voice dependency validation failed:', error.message);
        console.error('[ERROR] Voice commands may not work properly!');
    }

    // Set bot avatar if BOT_AVATAR_URL is provided
    if (process.env.BOT_AVATAR_URL) {
        try {
            await client.user.setAvatar(process.env.BOT_AVATAR_URL);
            console.log('[INFO] 🖼️ Bot avatar updated successfully.');
        } catch (error) {
            console.error('[ERROR] Failed to set bot avatar:', error);
        }
    }

    client.user.setActivity('/help | Debugging life', { type: 'PLAYING' });
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', flags: [64] });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', flags: [64] });
            }
        } catch (replyError) {
            console.error('Failed to send error reply:', replyError);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
