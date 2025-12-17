const { Client, GatewayIntentBits } = require('discord.js');
const { 
    joinVoiceChannel, 
    getVoiceConnection,
    createAudioPlayer,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState
} = require('@discordjs/voice');
const { EventEmitter } = require('events');

// Load environment variables
require('dotenv').config();

class VoiceConnectionTester {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildVoiceStates
            ]
        });
        
        this.testResults = {
            basicJoin: null,
            connectionStates: [],
            permissions: {},
            playback: null,
            errorRecovery: null
        };
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.client.once('ready', async () => {
            console.log('🎤 Voice Connection Tester Ready');
            await this.runVoiceTests();
        });

        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;
            
            const command = interaction.commandName;
            if (command === 'testvoice') {
                await this.testVoiceChannel(interaction);
            }
        });
    }

    async runVoiceTests() {
        console.log('\n🔊 Starting Voice Connection Tests...\n');
        
        // Test 1: Basic voice connection attempt
        await this.testBasicVoiceJoin();
        
        // Test 2: Connection state monitoring
        await this.testConnectionStates();
        
        // Test 3: Permission validation
        await this.testVoicePermissions();
        
        // Test 4: Audio playback test
        await this.testAudioPlayback();
        
        // Test 5: Error recovery
        await this.testErrorRecovery();
        
        this.generateReport();
    }

    async testBasicVoiceJoin() {
        console.log('1️⃣ Testing Basic Voice Channel Join...');
        
        try {
            // Get a test guild (replace with actual guild ID)
            const guild = this.client.guilds.cache.first();
            if (!guild) {
                this.testResults.basicJoin = '❌ No guilds available for testing';
                console.log('  ❌ No guilds available for testing');
                return;
            }

            // Find a voice channel
            const voiceChannel = guild.channels.cache.find(
                channel => channel.type === 2 && channel.name.toLowerCase().includes('general')
            );

            if (!voiceChannel) {
                this.testResults.basicJoin = '❌ No suitable voice channel found';
                console.log('  ❌ No suitable voice channel found');
                return;
            }

            console.log(`  🎯 Testing with channel: ${voiceChannel.name} (${voiceChannel.id})`);
            
            // Check permissions before joining
            const permissions = voiceChannel.permissionsFor(this.client.user);
            const requiredPerms = ['Connect', 'Speak', 'ViewChannel'];
            const missingPerms = requiredPerms.filter(perm => !permissions.has(perm));
            
            if (missingPerms.length > 0) {
                this.testResults.basicJoin = `❌ Missing permissions: ${missingPerms.join(', ')}`;
                console.log(`  ❌ Missing permissions: ${missingPerms.join(', ')}`);
                return;
            }

            // Attempt to join
            console.log('  🔗 Attempting to join voice channel...');
            
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
            });

            // Monitor connection states
            const states = [];
            const originalOn = connection.on.bind(connection);
            connection.on = (event, listener) => {
                if (event === 'stateChange') {
                    originalOn(event, (oldState, newState) => {
                        states.push({
                            timestamp: Date.now(),
                            status: newState.status,
                            oldStatus: oldState?.status
                        });
                        console.log(`    📊 State change: ${oldState?.status} → ${newState.status}`);
                        listener(oldState, newState);
                    });
                } else {
                    originalOn(event, listener);
                }
            };

            // Wait for connection to establish
            try {
                await entersState(connection, VoiceConnectionStatus.Ready, 15000);
                this.testResults.basicJoin = '✅ Successfully joined voice channel';
                console.log('  ✅ Voice connection established successfully');
                
                // Test voice state verification
                const currentConnection = getVoiceConnection(guild.id);
                if (currentConnection && currentConnection === connection) {
                    console.log('  ✅ Connection properly registered in guild');
                } else {
                    console.log('  ⚠️ Connection registration issue detected');
                }
                
            } catch (error) {
                this.testResults.basicJoin = `❌ Failed to establish connection: ${error.message}`;
                console.log(`  ❌ Connection failed: ${error.message}`);
            }

            // Test voice channel leave
            console.log('  🔌 Testing voice channel leave...');
            connection.destroy();
            console.log('  ✅ Successfully left voice channel');

        } catch (error) {
            this.testResults.basicJoin = `❌ Test error: ${error.message}`;
            console.log(`  ❌ Test error: ${error.message}`);
        }
    }

    async testConnectionStates() {
        console.log('\n2️⃣ Testing Connection State Monitoring...');
        
        try {
            const guild = this.client.guilds.cache.first();
            if (!guild) {
                this.testResults.connectionStates = ['❌ No guild available'];
                return;
            }

            const voiceChannel = guild.channels.cache.find(
                channel => channel.type === 2
            );

            if (!voiceChannel) {
                this.testResults.connectionStates = ['❌ No voice channel available'];
                return;
            }

            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
            });

            const monitoredStates = [];
            
            // Monitor all voice connection states
            const stateTransitions = {
                'signalling': false,
                'connecting': false,
                'ready': false,
                'disconnected': false
            };

            connection.on(VoiceConnectionStatus.Signalling, () => {
                monitoredStates.push('signalling');
                stateTransitions.signalling = true;
                console.log('    📡 Signalling state detected');
            });

            connection.on(VoiceConnectionStatus.Connecting, () => {
                monitoredStates.push('connecting');
                stateTransitions.connecting = true;
                console.log('    🔌 Connecting state detected');
            });

            connection.on(VoiceConnectionStatus.Ready, () => {
                monitoredStates.push('ready');
                stateTransitions.ready = true;
                console.log('    ✅ Ready state detected');
            });

            connection.on(VoiceConnectionStatus.Disconnected, () => {
                monitoredStates.push('disconnected');
                stateTransitions.disconnected = true;
                console.log('    ❌ Disconnected state detected');
            });

            // Wait for ready state
            try {
                await entersState(connection, VoiceConnectionStatus.Ready, 10000);
                
                // Check if all expected states were hit
                const expectedStates = ['signalling', 'connecting', 'ready'];
                const missingStates = expectedStates.filter(state => !monitoredStates.includes(state));
                
                if (missingStates.length === 0) {
                    this.testResults.connectionStates = ['✅ All connection states working properly'];
                    console.log('  ✅ All connection states detected correctly');
                } else {
                    this.testResults.connectionStates = [`⚠️ Missing states: ${missingStates.join(', ')}`];
                    console.log(`  ⚠️ Missing states: ${missingStates.join(', ')}`);
                }
                
            } catch (error) {
                this.testResults.connectionStates = [`❌ State monitoring failed: ${error.message}`];
                console.log(`  ❌ State monitoring failed: ${error.message}`);
            }

            connection.destroy();

        } catch (error) {
            this.testResults.connectionStates = [`❌ Test error: ${error.message}`];
            console.log(`  ❌ Test error: ${error.message}`);
        }
    }

    async testVoicePermissions() {
        console.log('\n3️⃣ Testing Voice Channel Permissions...');
        
        try {
            const guild = this.client.guilds.cache.first();
            if (!guild) {
                this.testResults.permissions = { error: '❌ No guild available' };
                return;
            }

            const voiceChannel = guild.channels.cache.find(
                channel => channel.type === 2
            );

            if (!voiceChannel) {
                this.testResults.permissions = { error: '❌ No voice channel available' };
                return;
            }

            const permissions = voiceChannel.permissionsFor(this.client.user);
            const requiredPermissions = [
                'Connect',
                'Speak',
                'ViewChannel',
                'UseVAD',
                'PrioritySpeaker'
            ];

            const permissionResults = {};
            requiredPermissions.forEach(perm => {
                permissionResults[perm] = permissions.has(perm);
            });

            this.testResults.permissions = permissionResults;

            console.log('  🔍 Permission Check Results:');
            Object.entries(permissionResults).forEach(([perm, hasPerm]) => {
                const status = hasPerm ? '✅' : '❌';
                console.log(`    ${status} ${perm}`);
            });

            const hasAllRequired = requiredPermissions
                .slice(0, 3) // Only check first 3 as critical
                .every(perm => permissionResults[perm]);

            if (hasAllRequired) {
                console.log('  ✅ All required permissions granted');
            } else {
                console.log('  ⚠️ Some required permissions missing');
            }

        } catch (error) {
            this.testResults.permissions = { error: `❌ Test error: ${error.message}` };
            console.log(`  ❌ Test error: ${error.message}`);
        }
    }

    async testAudioPlayback() {
        console.log('\n4️⃣ Testing Audio Playback...');
        
        try {
            const guild = this.client.guilds.cache.first();
            if (!guild) {
                this.testResults.playback = '❌ No guild available';
                return;
            }

            const voiceChannel = guild.channels.cache.find(
                channel => channel.type === 2
            );

            if (!voiceChannel) {
                this.testResults.playback = '❌ No voice channel available';
                return;
            }

            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
            });

            await entersState(connection, VoiceConnectionStatus.Ready, 10000);

            // Create audio player
            const player = createAudioPlayer();
            connection.subscribe(player);

            // Test player state changes
            let playerStates = [];
            
            player.on('stateChange', (oldState, newState) => {
                playerStates.push({
                    oldStatus: oldState.status,
                    newStatus: newState.status,
                    timestamp: Date.now()
                });
                console.log(`    🎵 Player state: ${oldState.status} → ${newState.status}`);
            });

            // Create a mock audio resource (silence)
            const { createAudioResource } = require('@discordjs/voice');
            
            // Create proper silence buffer for Discord.js voice
            // 48kHz, 2 channels, 16-bit PCM = 48000 * 2 * 2 = 192000 bytes for 1 second
            const sampleRate = 48000;
            const channels = 2;
            const bitDepth = 16;
            const bytesPerSample = bitDepth / 8;
            const silenceDuration = 0.5; // 0.5 seconds of silence
            const bufferSize = Math.floor(sampleRate * channels * bytesPerSample * silenceDuration);
            const silence = Buffer.alloc(bufferSize);
            
            const resource = createAudioResource(silence, {
                inputType: 'raw',
                inlineVolume: true
            });

            console.log('  🎵 Playing test audio...');
            player.play(resource);

            // Wait for playing state
            try {
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Playback timeout')), 5000);
                    
                    player.on('stateChange', (oldState, newState) => {
                        if (newState.status === AudioPlayerStatus.Playing) {
                            clearTimeout(timeout);
                            resolve();
                        }
                    });
                });

                this.testResults.playback = '✅ Audio playback working';
                console.log('  ✅ Audio playback started successfully');

                // Test pause/resume
                player.pause();
                console.log('  ⏸️ Paused audio');
                
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                player.unpause();
                console.log('  ▶️ Resumed audio');

            } catch (error) {
                this.testResults.playback = `❌ Playback failed: ${error.message}`;
                console.log(`  ❌ Playback failed: ${error.message}`);
            }

            player.stop();
            connection.destroy();

        } catch (error) {
            this.testResults.playback = `❌ Test error: ${error.message}`;
            console.log(`  ❌ Test error: ${error.message}`);
        }
    }

    async testErrorRecovery() {
        console.log('\n5️⃣ Testing Error Recovery...');
        
        try {
            const guild = this.client.guilds.cache.first();
            if (!guild) {
                this.testResults.errorRecovery = '❌ No guild available';
                return;
            }

            // Test 1: Invalid channel ID
            console.log('  🧪 Testing invalid channel ID...');
            try {
                joinVoiceChannel({
                    channelId: 'invalid-channel-id',
                    guildId: guild.id,
                    adapterCreator: guild.voiceAdapterCreator,
                });
                
                this.testResults.errorRecovery = '❌ Invalid channel ID not caught';
                console.log('  ❌ Invalid channel ID not caught');
            } catch (error) {
                console.log('  ✅ Invalid channel ID properly caught');
            }

            // Test 2: Missing adapter creator
            console.log('  🧪 Testing missing adapter creator...');
            try {
                const voiceChannel = guild.channels.cache.find(channel => channel.type === 2);
                if (voiceChannel) {
                    joinVoiceChannel({
                        channelId: voiceChannel.id,
                        guildId: guild.id,
                        // Missing adapterCreator
                    });
                    
                    this.testResults.errorRecovery = '❌ Missing adapter creator not caught';
                    console.log('  ❌ Missing adapter creator not caught');
                }
            } catch (error) {
                console.log('  ✅ Missing adapter creator properly caught');
            }

            // Test 3: Connection timeout simulation
            console.log('  🧪 Testing connection timeout handling...');
            try {
                const voiceChannel = guild.channels.cache.find(channel => channel.type === 2);
                if (voiceChannel) {
                    const connection = joinVoiceChannel({
                        channelId: voiceChannel.id,
                        guildId: guild.id,
                        adapterCreator: guild.voiceAdapterCreator,
                    });

                    // Set a very short timeout
                    const readyPromise = entersState(connection, VoiceConnectionStatus.Ready, 1);
                    await readyPromise;
                    
                    console.log('  ✅ Connection handled correctly');
                }
            } catch (error) {
                if (error.message.includes('timeout')) {
                    console.log('  ✅ Connection timeout handled correctly');
                    this.testResults.errorRecovery = '✅ Error recovery working';
                } else {
                    this.testResults.errorRecovery = `⚠️ Unexpected error: ${error.message}`;
                    console.log(`  ⚠️ Unexpected error: ${error.message}`);
                }
            }

        } catch (error) {
            this.testResults.errorRecovery = `❌ Test error: ${error.message}`;
            console.log(`  ❌ Test error: ${error.message}`);
        }
    }

    async testVoiceChannel(interaction) {
        await interaction.deferReply();
        
        const guild = interaction.guild;
        const voiceChannel = interaction.member.voice.channel;
        
        let report = '🎤 **Voice Channel Test Report**\n\n';
        
        if (!voiceChannel) {
            report += '❌ You are not in a voice channel!\n';
        } else {
            report += `📍 **Channel:** ${voiceChannel.name}\n`;
            report += `🆔 **Channel ID:** ${voiceChannel.id}\n`;
            
            // Test permissions
            const permissions = voiceChannel.permissionsFor(interaction.client.user);
            const requiredPerms = ['Connect', 'Speak', 'ViewChannel'];
            const missingPerms = requiredPerms.filter(perm => !permissions.has(perm));
            
            if (missingPerms.length === 0) {
                report += '✅ **Permissions:** All required permissions granted\n';
            } else {
                report += `❌ **Missing Permissions:** ${missingPerms.join(', ')}\n`;
            }
            
            // Test joining
            try {
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: guild.id,
                    adapterCreator: guild.voiceAdapterCreator,
                });
                
                report += '✅ **Join Test:** Successfully initiated join\n';
                
                // Wait for connection
                try {
                    await entersState(connection, VoiceConnectionStatus.Ready, 5000);
                    report += '✅ **Connection Status:** Ready\n';
                    connection.destroy();
                    report += '✅ **Leave Test:** Successfully left\n';
                } catch (error) {
                    report += `❌ **Connection Status:** Failed - ${error.message}\n`;
                }
                
            } catch (error) {
                report += `❌ **Join Test:** Failed - ${error.message}\n`;
            }
        }
        
        await interaction.editReply({ content: report });
    }

    generateReport() {
        console.log('\n📊 Voice Connection Test Report\n');
        console.log('=' .repeat(50));
        
        console.log('\n1️⃣ **Basic Voice Join:**');
        console.log(`   ${this.testResults.basicJoin || 'Not tested'}`);
        
        console.log('\n2️⃣ **Connection States:**');
        if (Array.isArray(this.testResults.connectionStates)) {
            this.testResults.connectionStates.forEach(state => {
                console.log(`   ${state}`);
            });
        } else {
            console.log(`   ${this.testResults.connectionStates || 'Not tested'}`);
        }
        
        console.log('\n3️⃣ **Permissions:**');
        if (typeof this.testResults.permissions === 'object' && !this.testResults.permissions.error) {
            Object.entries(this.testResults.permissions).forEach(([perm, hasPerm]) => {
                const status = hasPerm ? '✅' : '❌';
                console.log(`   ${status} ${perm}`);
            });
        } else {
            console.log(`   ${this.testResults.permissions?.error || 'Not tested'}`);
        }
        
        console.log('\n4️⃣ **Audio Playback:**');
        console.log(`   ${this.testResults.playback || 'Not tested'}`);
        
        console.log('\n5️⃣ **Error Recovery:**');
        console.log(`   ${this.testResults.errorRecovery || 'Not tested'}`);
        
        console.log('\n' + '=' .repeat(50));
        console.log('🎯 **Voice Connection Testing Complete!**');
    }

    async start() {
        try {
            await this.client.login(process.env.DISCORD_TOKEN);
        } catch (error) {
            console.error('❌ Failed to login:', error.message);
            process.exit(1);
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new VoiceConnectionTester();
    tester.start().catch(console.error);
}

module.exports = VoiceConnectionTester;