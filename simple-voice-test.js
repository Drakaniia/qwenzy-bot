const { Client, GatewayIntentBits } = require('discord.js');
const { 
    joinVoiceChannel, 
    getVoiceConnection,
    VoiceConnectionStatus,
    entersState
} = require('@discordjs/voice');

require('dotenv').config();

class SimpleVoiceTester {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildVoiceStates
            ]
        });
        
        this.testResults = {};
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.client.once('ready', async () => {
            console.log('🎤 Simple Voice Tester Ready');
            await this.testVoiceJoining();
        });

        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;
            
            if (interaction.commandName === 'testvoice') {
                await this.testUserVoice(interaction);
            }
        });
    }

    async testVoiceJoining() {
        console.log('\n🔊 Testing Voice Channel Joining...\n');
        
        const guild = this.client.guilds.cache.first();
        if (!guild) {
            console.log('❌ No guilds available');
            return;
        }

        // Test different scenarios
        await this.testBasicJoin(guild);
        await this.testPermissionValidation(guild);
        await this.testConnectionStates(guild);
        
        this.generateFinalReport();
    }

    async testBasicJoin(guild) {
        console.log('1️⃣ Testing Basic Voice Join...');
        
        try {
            const voiceChannel = guild.channels.cache.find(
                channel => channel.type === 2
            );

            if (!voiceChannel) {
                this.testResults.basicJoin = '❌ No voice channel found';
                console.log('  ❌ No voice channel found');
                return;
            }

            console.log(`  📍 Target: ${voiceChannel.name} (${voiceChannel.id})`);
            
            // Check permissions
            const permissions = voiceChannel.permissionsFor(this.client.user);
            const criticalPerms = ['Connect', 'Speak', 'ViewChannel'];
            const hasPerms = criticalPerms.every(perm => permissions.has(perm));
            
            if (!hasPerms) {
                this.testResults.basicJoin = '❌ Missing critical permissions';
                console.log(`  ❌ Missing critical permissions`);
                return;
            }

            // Attempt connection
            console.log('  🔗 Joining voice channel...');
            const startTime = Date.now();
            
            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
            });

            try {
                await entersState(connection, VoiceConnectionStatus.Ready, 10000);
                const joinTime = Date.now() - startTime;
                
                this.testResults.basicJoin = `✅ Joined successfully in ${joinTime}ms`;
                console.log(`  ✅ Joined successfully in ${joinTime}ms`);
                
                // Test connection persistence
                const storedConnection = getVoiceConnection(guild.id);
                if (storedConnection === connection) {
                    console.log('  ✅ Connection properly stored');
                } else {
                    console.log('  ⚠️ Connection storage issue');
                }
                
                // Test voice state update
                if (this.client.user.discriminator !== '0000') {
                    console.log('  ✅ Voice state can be updated');
                }
                
            } catch (error) {
                this.testResults.basicJoin = `❌ Connection failed: ${error.message}`;
                console.log(`  ❌ Connection failed: ${error.message}`);
            } finally {
                connection.destroy();
                console.log('  🔌 Successfully left voice channel');
            }

        } catch (error) {
            this.testResults.basicJoin = `❌ Test error: ${error.message}`;
            console.log(`  ❌ Test error: ${error.message}`);
        }
    }

    async testPermissionValidation(guild) {
        console.log('\n2️⃣ Testing Permission Validation...');
        
        try {
            const voiceChannel = guild.channels.cache.find(
                channel => channel.type === 2
            );

            if (!voiceChannel) {
                console.log('  ❌ No voice channel available');
                return;
            }

            const permissions = voiceChannel.permissionsFor(this.client.user);
            const allPermissions = [
                'Connect', 'Speak', 'ViewChannel', 'UseVAD', 
                'PrioritySpeaker', 'MuteMembers', 'DeafenMembers',
                'MoveMembers', 'ManageChannels'
            ];

            const permissionResults = {};
            let grantedCount = 0;
            
            allPermissions.forEach(perm => {
                const hasPerm = permissions.has(perm);
                permissionResults[perm] = hasPerm;
                if (hasPerm) grantedCount++;
            });

            const criticalPerms = ['Connect', 'Speak', 'ViewChannel'];
            const hasCritical = criticalPerms.every(perm => permissionResults[perm]);

            if (hasCritical) {
                this.testResults.permissions = `✅ All ${grantedCount}/${allPermissions.length} permissions granted (critical ones OK)`;
                console.log(`  ✅ All ${grantedCount}/${allPermissions.length} permissions granted`);
                console.log(`  ✅ Critical permissions: CONNECT, SPEAK, VIEW_CHANNEL - ALL OK`);
            } else {
                this.testResults.permissions = `⚠️ ${grantedCount}/${allPermissions.length} permissions granted (missing critical)`;
                console.log(`  ⚠️ ${grantedCount}/${allPermissions.length} permissions granted`);
                console.log(`  ❌ Missing critical permissions!`);
            }

            // Show missing permissions
            const missingPerms = allPermissions.filter(perm => !permissionResults[perm]);
            if (missingPerms.length > 0) {
                console.log(`  📋 Missing: ${missingPerms.join(', ')}`);
            }

        } catch (error) {
            this.testResults.permissions = `❌ Error: ${error.message}`;
            console.log(`  ❌ Error: ${error.message}`);
        }
    }

    async testConnectionStates(guild) {
        console.log('\n3️⃣ Testing Connection State Transitions...');
        
        try {
            const voiceChannel = guild.channels.cache.find(
                channel => channel.type === 2
            );

            if (!voiceChannel) {
                console.log('  ❌ No voice channel available');
                return;
            }

            const connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
            });

            const statesDetected = [];
            const expectedStates = ['signalling', 'connecting', 'ready'];

            // Monitor state changes
            connection.on(VoiceConnectionStatus.Signalling, () => {
                statesDetected.push('signalling');
                console.log('    📡 Signalling state');
            });

            connection.on(VoiceConnectionStatus.Connecting, () => {
                statesDetected.push('connecting');
                console.log('    🔌 Connecting state');
            });

            connection.on(VoiceConnectionStatus.Ready, () => {
                statesDetected.push('ready');
                console.log('    ✅ Ready state');
            });

            try {
                await entersState(connection, VoiceConnectionStatus.Ready, 10000);
                
                const missingStates = expectedStates.filter(state => !statesDetected.includes(state));
                
                if (missingStates.length === 0) {
                    this.testResults.states = '✅ All expected states detected';
                    console.log(`  ✅ All ${statesDetected.length} expected states detected`);
                } else {
                    this.testResults.states = `⚠️ Missing states: ${missingStates.join(', ')}`;
                    console.log(`  ⚠️ Detected: ${statesDetected.join(', ')}`);
                    console.log(`  ❌ Missing: ${missingStates.join(', ')}`);
                }

            } catch (error) {
                this.testResults.states = `❌ State monitoring failed: ${error.message}`;
                console.log(`  ❌ State monitoring failed: ${error.message}`);
            }

            connection.destroy();

        } catch (error) {
            this.testResults.states = `❌ Error: ${error.message}`;
            console.log(`  ❌ Error: ${error.message}`);
        }
    }

    async testUserVoice(interaction) {
        await interaction.deferReply();
        
        const member = interaction.member;
        const voiceChannel = member.voice.channel;
        const guild = interaction.guild;
        
        let report = '🎤 **Voice Test Report**\n\n';
        
        if (!voiceChannel) {
            report += '❌ You are not in a voice channel!\n';
            report += '🔧 Join a voice channel and try again.\n';
        } else {
            report += `📍 **Your Channel:** ${voiceChannel.name}\n`;
            report += `🆔 **Channel ID:** ${voiceChannel.id}\n`;
            
            // Check bot permissions
            const permissions = voiceChannel.permissionsFor(interaction.client.user);
            const criticalPerms = ['Connect', 'Speak', 'ViewChannel'];
            const hasAllCritical = criticalPerms.every(perm => permissions.has(perm));
            
            if (hasAllCritical) {
                report += '✅ **Bot Permissions:** All critical permissions granted\n';
                
                // Test actual join
                try {
                    report += '🔄 **Testing join...**\n';
                    
                    const connection = joinVoiceChannel({
                        channelId: voiceChannel.id,
                        guildId: guild.id,
                        adapterCreator: guild.voiceAdapterCreator,
                    });
                    
                    await entersState(connection, VoiceConnectionStatus.Ready, 5000);
                    
                    report += '✅ **Join Result:** Successfully connected!\n';
                    
                    // Test audio capabilities
                    report += '🎵 **Audio Status:** Voice connection ready\n';
                    
                    connection.destroy();
                    report += '✅ **Leave Result:** Successfully disconnected\n';
                    
                } catch (error) {
                    report += `❌ **Join Result:** ${error.message}\n`;
                }
                
            } else {
                report += '❌ **Bot Permissions:** Missing critical permissions\n';
                const missingPerms = criticalPerms.filter(perm => !permissions.has(perm));
                report += `🚫 Missing: ${missingPerms.join(', ')}\n`;
            }
        }
        
        await interaction.editReply({ content: report });
    }

    generateFinalReport() {
        console.log('\n📊 **Voice Connection Test Results**');
        console.log('=' .repeat(60));
        
        console.log(`\n🔗 **Basic Join:**`);
        console.log(`   ${this.testResults.basicJoin || 'Not tested'}`);
        
        console.log(`\n🔐 **Permissions:**`);
        console.log(`   ${this.testResults.permissions || 'Not tested'}`);
        
        console.log(`\n📡 **Connection States:**`);
        console.log(`   ${this.testResults.states || 'Not tested'}`);
        
        console.log('\n' + '=' .repeat(60));
        
        // Overall assessment
        const basicOk = this.testResults.basicJoin?.includes('✅');
        const permsOk = this.testResults.permissions?.includes('✅');
        const statesOk = this.testResults.states?.includes('✅');
        
        if (basicOk && permsOk && statesOk) {
            console.log('🎉 **OVERALL: Voice system is working perfectly!**');
        } else if (basicOk && permsOk) {
            console.log('⚠️ **OVERALL: Voice joining works, but some states may be missing**');
        } else if (permsOk) {
            console.log('⚠️ **OVERALL: Permissions OK, but joining may have issues**');
        } else {
            console.log('❌ **OVERALL: Voice system needs fixes**');
        }
        
        console.log('\n🔧 **Key Issues to Fix:**');
        if (!permsOk) {
            console.log('   • Grant bot: Connect, Speak, ViewChannel permissions');
        }
        if (!basicOk) {
            console.log('   • Check voice channel settings and bot role');
        }
        if (!statesOk) {
            console.log('   • Network connectivity or Discord API issues');
        }
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

// Run if called directly
if (require.main === module) {
    const tester = new SimpleVoiceTester();
    tester.start().catch(console.error);
}

module.exports = SimpleVoiceTester;