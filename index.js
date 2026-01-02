require('dotenv').config();

// Prevent the process from crashing on unhandled promise rejections / exceptions.
// (Common with voice + streaming libs when requests fail or events emit async handlers.)
process.on('unhandledRejection', (reason) => {
    console.error('[FATAL] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('[FATAL] Uncaught exception:', err);
});

// Polyfill for File object if not available (needed for undici compatibility)
if (typeof File === 'undefined') {
    global.File = class File extends Blob {
        constructor(fileBits, fileName, options = {}) {
            super(fileBits, options);
            this.lastModified = options.lastModified || Date.now();
            this.name = fileName.replace(/\.[^/.]+$/, ""); // Remove extension for name
            this.webkitRelativePath = options.webkitRelativePath || "";
        }
    };
}

// Validate dependencies on startup
// Lavalink playback runs remotely, so we do not require native voice deps (opus/ffmpeg).
function validateDependencies() {
    try {
        require('discord.js');
        require('riffy');
        console.log('[INIT] ✅ Core dependencies are available');
    } catch (error) {
        console.error('[INIT] ❌ Missing required dependencies:', error.message);
        console.error('[DEBUG] Error details:', error);
        process.exit(1);
    }
}

validateDependencies();

const { Client, Collection, GatewayIntentBits, Events, GatewayDispatchEvents } = require('discord.js');
const { Riffy } = require('riffy');
const musicManager = require('./src/modules/musicManager');
const fs = require('fs');
const path = require('path');

// Wispbyte and similar platforms typically don't require an HTTP server
// but it's good practice to have one for health checks
const express = require('express');
const app = express();
const PORT = parseInt(process.env.PORT) || 3000;

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

// Function to find an available port
function startServer(port) {
    const server = app.listen(port, () => {
        console.log(`Health check server running on port ${port}`);
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`Port ${port} is busy, trying port ${port + 1}...`);
            startServer(port + 1); // Recursively try the next port
        } else {
            console.error('Server error:', err);
        }
    });
}

// Start the server
startServer(PORT);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers // Added for member join events
    ]
});

// Lavalink (Riffy) setup with fallback nodes for redundancy
const lavalinkNodes = [
    // Primary node (configured via environment variables)
    {
        host: process.env.LAVALINK_HOST || 'localhost',
        port: Number(process.env.LAVALINK_PORT || 2333),
        password: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
        secure: String(process.env.LAVALINK_SECURE || 'false').toLowerCase() === 'true',
    },
    // Fallback node 1: lavalink.dev (public, stable)
    {
        host: 'lavalink.dev',
        port: 443,
        password: 'lavalink',
        secure: true,
    },
    // Fallback node 2: lavalink.lexnexus.dev (public, stable)
    {
        host: 'lavalink.lexnexus.dev',
        port: 2333,
        password: 'lexnexus',
        secure: false,
    }
];

console.log('[LAVALINK] Configuration:', {
    host: lavalinkNodes[0].host,
    port: lavalinkNodes[0].port,
    secure: lavalinkNodes[0].secure,
    searchPrefix: process.env.LAVALINK_SEARCH_PREFIX || 'ytsearch'
});

client.riffy = new Riffy(
    client,
    lavalinkNodes,
    {
        send: (payload) => {
            const guild = client.guilds.cache.get(payload.d.guild_id);
            if (guild) guild.shard.send(payload);
        },
        defaultSearchPlatform: process.env.LAVALINK_SEARCH_PREFIX || 'ytsearch',
        restVersion: 'v4',
    }
);

client.on('raw', (d) => {
    if (![GatewayDispatchEvents.VoiceStateUpdate, GatewayDispatchEvents.VoiceServerUpdate].includes(d.t)) return;
    client.riffy.updateVoiceState(d);
});

// Lavalink node health monitoring
client.riffy.on('nodeConnect', (node) => {
    console.log(`[LAVALINK] ✅ Node connected: ${node.options.host}:${node.options.port}`);
});

client.riffy.on('nodeError', (node, error) => {
    console.error(`[LAVALINK] ❌ Node error: ${node.options.host}:${node.options.port} - ${error.message}`);
});

client.riffy.on('nodeDisconnect', (node) => {
    console.warn(`[LAVALINK] ⚠️ Node disconnected: ${node.options.host}:${node.options.port}`);
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
    
    // Load test commands folder for debugging
    try {
        const testCommandsPath = path.join(__dirname, 'src/commands/music/test');
        if (fs.existsSync(testCommandsPath)) {
            const testCommandFiles = fs.readdirSync(testCommandsPath).filter(file => file.endsWith('.js'));
            for (const file of testCommandFiles) {
                const filePath = path.join(testCommandsPath, file);
                const command = require(filePath);
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    console.log(`[TEST] Loaded test command: ${command.data.name}`);
                } else {
                    console.log(`[WARNING] The test command at ${filePath} is missing a required "data" or "execute" property.`);
                }
            }
        }
    } catch (error) {
        console.log('[INFO] No test commands folder found, skipping...');
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

    // Init Lavalink client
    try {
        client.riffy.init(client.user.id);
        musicManager.init(client);
        console.log('[LAVALINK] ✅ Riffy initialized');
    } catch (e) {
        console.error('[LAVALINK] ❌ Failed to init Riffy:', e);
    }

    if (process.env.GEMINI_API_KEY) {
        console.log('[INFO] 🧠 Gemini AI Key loaded successfully.');
    } else {
        console.log('[WARN] ⚠️ Gemini AI Key is MISSING in process.env!');
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
        console.error('Command execution error:', error);
        
        // Check if interaction is expired before trying to respond
        const now = Date.now();
        const interactionAge = now - (interaction.createdTimestamp || now);
        const isExpired = interactionAge > (15 * 60 * 1000); // 15 minutes
        
        if (isExpired) {
            console.log('[INFO] Interaction expired, not sending error message');
            return;
        }
        
        try {
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', flags: [64] });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', flags: [64] });
            }
        } catch (replyError) {
            if (replyError.code === 40060 || replyError.code === 10062) {
                console.log('[INFO] Interaction already acknowledged or expired, skipping error reply');
            } else if (replyError.code === 50006) {
                console.log('[INFO] Cannot send empty message, skipping error reply');
            } else {
                console.error('Failed to send error reply:', replyError);
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
