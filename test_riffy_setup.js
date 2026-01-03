const { Riffy } = require('riffy');
const { Client, GatewayIntentBits } = require('discord.js');

// Mock client
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});

// Mock user
client.user = { id: '123456789' };

// The nodes we added
const lavalinkNodes = [
    {
        host: 'localhost',
        port: 2333,
        password: 'youshallnotpass',
        secure: false,
    },
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
];

console.log('Testing Riffy instantiation...');
try {
    client.riffy = new Riffy(client, lavalinkNodes, {
        send: (payload) => { console.log('Mock send:', payload); },
        defaultSearchPlatform: 'ytsearch',
        restVersion: 'v4',
    });
    console.log('Riffy instantiated.');

    console.log('Testing Riffy init...');
    client.riffy.init(client.user.id);
    console.log('Riffy initialized successfully.');
} catch (error) {
    console.error('Riffy Init Error:', error);
}
