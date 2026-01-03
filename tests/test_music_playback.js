require('dotenv').config();

const { Riffy } = require('riffy');
const { Client, GatewayIntentBits } = require('discord.js');

console.log('='.repeat(60));
console.log('MUSIC PLAYBACK TEST');
console.log('='.repeat(60));

// Test 1: Riffy Instantiation
console.log('\n[TEST 1] Testing Riffy instantiation...');
try {
    const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
    });

    client.user = { id: '123456789' }; // Mock user

    const lavalinkNodes = [
        {
            host: process.env.LAVALINK_HOST || 'localhost',
            port: Number(process.env.LAVALINK_PORT || 2333),
            password: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
            secure: String(process.env.LAVALINK_SECURE || 'false').toLowerCase() === 'true',
        }
    ];

    client.riffy = new Riffy(client, lavalinkNodes, {
        send: (payload) => { /* mock */ },
        defaultSearchPlatform: process.env.LAVALINK_SEARCH_PREFIX || 'ytsearch',
        restVersion: 'v4',
    });

    console.log('✅ PASS: Riffy instantiated without property descriptor error');
} catch (error) {
    console.error('❌ FAIL: Riffy instantiation failed');
    console.error('Error:', error.message);
    process.exit(1);
}

// Test 2: Riffy Initialization
console.log('\n[TEST 2] Testing Riffy initialization...');
try {
    const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
    });

    client.user = { id: '123456789' }; // Mock user

    const lavalinkNodes = [
        {
            host: process.env.LAVALINK_HOST || 'localhost',
            port: Number(process.env.LAVALINK_PORT || 2333),
            password: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
            secure: String(process.env.LAVALINK_SECURE || 'false').toLowerCase() === 'true',
        }
    ];

    client.riffy = new Riffy(client, lavalinkNodes, {
        send: (payload) => { /* mock */ },
        defaultSearchPlatform: process.env.LAVALINK_SEARCH_PREFIX || 'ytsearch',
        restVersion: 'v4',
    });

    client.riffy.init(client.user.id);
    console.log('✅ PASS: Riffy initialized successfully');
} catch (error) {
    console.error('❌ FAIL: Riffy initialization failed');
    console.error('Error:', error.message);
    process.exit(1);
}

// Test 3: Music Manager Integration
console.log('\n[TEST 3] Testing music manager integration...');
try {
    const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
    });

    client.user = { id: '123456789' }; // Mock user
    client.musicReady = true; // Simulate ready state

    const lavalinkNodes = [
        {
            host: process.env.LAVALINK_HOST || 'localhost',
            port: Number(process.env.LAVALINK_PORT || 2333),
            password: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
            secure: String(process.env.LAVALINK_SECURE || 'false').toLowerCase() === 'true',
        }
    ];

    client.riffy = new Riffy(client, lavalinkNodes, {
        send: (payload) => { /* mock */ },
        defaultSearchPlatform: process.env.LAVALINK_SEARCH_PREFIX || 'ytsearch',
        restVersion: 'v4',
    });

    client.riffy.init(client.user.id);

    const musicManager = require('../src/modules/musicManager');
    musicManager.init(client);

    // Verify riffy getter doesn't throw when musicReady is true
    const riffyInstance = musicManager.riffy;

    if (riffyInstance) {
        console.log('✅ PASS: Music manager can access Riffy instance');
    } else {
        throw new Error('Music manager returned null for Riffy');
    }
} catch (error) {
    console.error('❌ FAIL: Music manager integration failed');
    console.error('Error:', error.message);
    process.exit(1);
}

// Test 4: Music Readiness Check
console.log('\n[TEST 4] Testing music readiness check...');
try {
    const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
    });

    client.user = { id: '123456789' }; // Mock user
    client.musicReady = false; // Simulate not ready state

    const lavalinkNodes = [
        {
            host: process.env.LAVALINK_HOST || 'localhost',
            port: Number(process.env.LAVALINK_PORT || 2333),
            password: process.env.LAVALINK_PASSWORD || 'youshallnotpass',
            secure: String(process.env.LAVALINK_SECURE || 'false').toLowerCase() === 'true',
        }
    ];

    client.riffy = new Riffy(client, lavalinkNodes, {
        send: (payload) => { /* mock */ },
        defaultSearchPlatform: process.env.LAVALINK_SEARCH_PREFIX || 'ytsearch',
        restVersion: 'v4',
    });

    client.riffy.init(client.user.id);

    const musicManager = require('../src/modules/musicManager');
    musicManager.init(client);

    // This should throw an error because musicReady is false
    try {
        const riffyInstance = musicManager.riffy;
        console.error('❌ FAIL: Music readiness check should throw when musicReady is false');
        process.exit(1);
    } catch (expectedError) {
        if (expectedError.message.includes('Music system is not ready')) {
            console.log('✅ PASS: Music readiness check correctly prevents access when not ready');
        } else {
            throw expectedError;
        }
    }
} catch (error) {
    console.error('❌ FAIL: Music readiness check failed');
    console.error('Error:', error.message);
    process.exit(1);
}

console.log('\n' + '='.repeat(60));
console.log('ALL TESTS PASSED ✅');
console.log('='.repeat(60));
console.log('\nSummary:');
console.log('  ✅ Riffy instantiation works without property descriptor error');
console.log('  ✅ Riffy initialization completes successfully');
console.log('  ✅ Music manager can access Riffy when ready');
console.log('  ✅ Music readiness check prevents access when not ready');
console.log('\nThe patch has been successfully applied!');
console.log('Music functionality should work correctly on Render.com');
console.log('='.repeat(60));
