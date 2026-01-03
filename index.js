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

// Validate Lavalink environment variables
console.log('[LAVALINK] Validating configuration...');
const lavalinkHost = process.env.LAVALINK_HOST || 'localhost';
const lavalinkPort = Number(process.env.LAVALINK_PORT || 2333);
const lavalinkPassword = process.env.LAVALINK_PASSWORD || 'youshallnotpass';
const lavalinkSecure = String(process.env.LAVALINK_SECURE || 'false').toLowerCase() === 'true';

console.log('[LAVALINK] Using environment configuration:', {
    host: lavalinkHost,
    port: lavalinkPort,
    secure: lavalinkSecure,
    hasPassword: !!lavalinkPassword
});

// Lavalink (Riffy) setup
const lavalinkNodes = [
    // Primary node (configured via environment variables)
    {
        host: lavalinkHost,
        port: lavalinkPort,
        password: lavalinkPassword,
        secure: lavalinkSecure,
    }
];

// Only add public fallback nodes if not in a production environment or if explicitly enabled
if (process.env.USE_FALLBACK_NODES !== 'false') {
    lavalinkNodes.push(
        // Fallback public node (Jirayu)
        {
            host: 'lavalink.jirayu.net',
            port: 443,
            password: 'youshallnotpass',
            secure: true
        },
        // Fallback public node (Rive)
        {
            host: 'lavalink.rive.wtf',
            port: 443,
            password: 'youshallnotpass',
            secure: true
        },
        // Fallback public node (Serenetia)
        {
            host: 'lavalinkv4.serenetia.com',
            port: 443,
            password: 'https://dsc.gg/ajidevserver',
            secure: true
        }
    );
}

console.log(`[LAVALINK] Configured ${lavalinkNodes.length} node(s) for connection`);

console.log('[LAVALINK] Configuration:', {
    host: lavalinkNodes[0].host,
    port: lavalinkNodes[0].port,
    secure: lavalinkNodes[0].secure,
    searchPrefix: process.env.LAVALINK_SEARCH_PREFIX || 'ytsearch'
});

// Log a warning if using localhost which might indicate a configuration issue in Docker environments
if (lavalinkNodes[0].host === 'localhost' && lavalinkPort === 2333) {
    console.warn('[LAVALINK] ⚠️ Using localhost for Lavalink host. If running in docker-compose, set LAVALINK_HOST=lavalink in your .env file.');
    console.warn('[LAVALINK] ⚠️ If Lavalink is not running locally, music commands will fail.');
}

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
    if (node && node.options) {
        console.log(`[LAVALINK] ✅ Node connected: ${node.options.host}:${node.options.port}`);
    } else {
        console.log(`[LAVALINK] ✅ Node connected (no node info available)`);
    }
});

client.riffy.on('nodeError', (node, error) => {
    if (node && node.options) {
        console.error(`[LAVALINK] ❌ Node error: ${node.options.host}:${node.options.port} - ${error.message}`);
    } else {
        console.error(`[LAVALINK] ❌ Node error: ${error.message}`);
    }
});

client.riffy.on('nodeDisconnect', (node) => {
    if (node && node.options) {
        console.warn(`[LAVALINK] ⚠️ Node disconnected: ${node.options.host}:${node.options.port}`);
    } else {
        console.warn(`[LAVALINK] ⚠️ Node disconnected (no node info available)`);
    }

    // Check if all nodes are disconnected, and update musicReady status accordingly
    let allNodesDisconnected = true;
    for (const [nodeId, node] of client.riffy.nodes.entries()) {
        if (node.connected) {
            allNodesDisconnected = false;
            break;
        }
    }

    if (allNodesDisconnected && client.musicReady) {
        console.warn('[LAVALINK] ⚠️ All nodes disconnected, updating music system status');
        client.musicReady = false;
    }
});

// Also monitor when nodes connect to potentially restore musicReady status
client.riffy.on('nodeConnect', (node) => {
    if (node && node.options) {
        console.log(`[LAVALINK] ✅ Node connected: ${node.options.host}:${node.options.port}`);
    } else {
        console.log(`[LAVALINK] ✅ Node connected (no node info available)`);
    }

    // If music wasn't ready but now at least one node is connected, try to set it as ready
    if (!client.musicReady) {
        client.musicReady = true;
        console.log('[LAVALINK] ✅ Music system ready after node reconnection');
    }
});

// Initialize musicManager immediately after creating client.riffy
musicManager.init(client);

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
        console.log('[LAVALINK] ✅ Riffy initialized');

        // Initialize Riffy event listeners
        const riffyEvents = require('./src/events/riffyEvents');
        riffyEvents.execute(client);

        // Wait for at least one node to connect before marking music system as ready
        console.log('[LAVALINK] Waiting for node connections...');

        // Set a timeout for node connection
        const timeoutPromise = new Promise(resolve => {
            setTimeout(() => {
                console.log('[LAVALINK] ⚠️ Timeout waiting for node connections, continuing with available nodes');
                resolve();
            }, 10000); // 10 second timeout
        });

        // Wait for the first successful connection or the timeout
        const connectionPromise = new Promise((resolve) => {
            const onNodeConnect = (node) => {
                if (node && node.options) {
                    console.log(`[LAVALINK] ✅ Node connected: ${node.options.host}:${node.options.port}`);
                } else {
                    console.log(`[LAVALINK] ✅ Node connected (no node info available)`);
                }

                // Remove the listeners to prevent multiple calls
                client.riffy.removeListener('nodeConnect', onNodeConnect);
                client.riffy.removeListener('nodeError', onNodeError);

                resolve();
            };

            const onNodeError = (node, error) => {
                if (node && node.options) {
                    console.error(`[LAVALINK] ❌ Node error: ${node.options.host}:${node.options.port} - ${error.message}`);
                } else {
                    console.error(`[LAVALINK] ❌ Node error: ${error.message}`);
                }
            };

            client.riffy.on('nodeConnect', onNodeConnect);
            client.riffy.on('nodeError', onNodeError);
        });

        // Wait for either a connection or timeout
        await Promise.race([connectionPromise, timeoutPromise]);

        // Mark music system as ready after attempting connection
        client.musicReady = true;
        console.log('[LAVALINK] ✅ Music system ready');
    } catch (e) {
        console.error('[LAVALINK] ❌ Failed to init Riffy:', e);
        client.musicReady = false;
        console.error('[LAVALINK] ⚠️ Music commands will be unavailable');
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
