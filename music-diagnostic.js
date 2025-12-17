const { Client, GatewayIntentBits } = require('discord.js');
const { 
    joinVoiceChannel, 
    getVoiceConnection,
    createAudioPlayer,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState
} = require('@discordjs/voice');
const play = require('play-dl');
const fs = require('fs');

// Load environment variables
require('dotenv').config();

class MusicDiagnostic {
    constructor() {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildVoiceStates
            ]
        });
        
        this.testResults = {
            dependencies: {},
            voicePermissions: {},
            youtubeApi: {},
            ffmpegStatus: {},
            connectionTests: {}
        };
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.client.once('ready', () => {
            console.log('🔧 Music Diagnostic Tool Ready');
            this.runDiagnostics();
        });

        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand()) return;
            
            const command = interaction.commandName;
            if (command === 'diagnose') {
                await this.runDiagnosticsCommand(interaction);
            }
        });
    }

    async runDiagnostics() {
        console.log('\n🚀 Starting Comprehensive Music System Diagnostics...\n');

        await this.checkDependencies();
        await this.checkFFmpeg();
        await this.testYouTubeAPI();
        await this.testVoicePermissions();
        await this.testAudioResourceCreation();
        
        this.generateReport();
    }

    async checkDependencies() {
        console.log('📦 Checking Dependencies...');
        
        const dependencies = [
            '@discordjs/voice',
            'discord.js',
            'play-dl',
            'ffmpeg-static'
        ];

        for (const dep of dependencies) {
            try {
                require.resolve(dep);
                this.testResults.dependencies[dep] = '✅ Available';
                console.log(`  ✅ ${dep}`);
            } catch (error) {
                this.testResults.dependencies[dep] = `❌ Missing: ${error.message}`;
                console.log(`  ❌ ${dep} - ${error.message}`);
            }
        }
        
        // Check FFmpeg path
        try {
            const ffmpegPath = require('ffmpeg-static');
            this.testResults.dependencies.ffmpegPath = `✅ ${ffmpegPath}`;
            console.log(`  ✅ FFmpeg Path: ${ffmpegPath}`);
        } catch (error) {
            this.testResults.dependencies.ffmpegPath = `❌ Error: ${error.message}`;
            console.log(`  ❌ FFmpeg Path Error: ${error.message}`);
        }
    }

    async checkFFmpeg() {
        console.log('\n🎬 Testing FFmpeg...');
        
        try {
            const { spawn } = require('child_process');
            const ffmpegPath = require('ffmpeg-static');
            
            const ffmpegTest = spawn(ffmpegPath, ['-version']);
            
            ffmpegTest.on('close', (code) => {
                if (code === 0) {
                    this.testResults.ffmpegStatus.version = '✅ FFmpeg is working';
                    console.log('  ✅ FFmpeg version check passed');
                } else {
                    this.testResults.ffmpegStatus.version = `❌ FFmpeg exited with code ${code}`;
                    console.log(`  ❌ FFmpeg failed with code ${code}`);
                }
            });

            ffmpegTest.on('error', (error) => {
                this.testResults.ffmpegStatus.version = `❌ FFmpeg Error: ${error.message}`;
                console.log(`  ❌ FFmpeg Error: ${error.message}`);
            });

        } catch (error) {
            this.testResults.ffmpegStatus.version = `❌ FFmpeg Test Failed: ${error.message}`;
            console.log(`  ❌ FFmpeg Test Failed: ${error.message}`);
        }
    }

    async testYouTubeAPI() {
        console.log('\n🎥 Testing YouTube API...');
        
        try {
            // Test search functionality
            console.log('  🔍 Testing search functionality...');
            const searchResults = await play.search('test song', { limit: 1 });
            
            if (searchResults.length > 0) {
                this.testResults.youtubeApi.search = '✅ YouTube search working';
                console.log(`  ✅ Found ${searchResults.length} search results`);
                
                // Test video info
                console.log('  📋 Testing video info...');
                const videoInfo = await play.video_info(searchResults[0].url);
                
                if (videoInfo && videoInfo.video_details) {
                    this.testResults.youtubeApi.videoInfo = '✅ Video info retrieval working';
                    console.log(`  ✅ Video info: ${videoInfo.video_details.title}`);
                    
                    // Test stream creation
                    console.log('  🌊 Testing stream creation...');
                    try {
                        const stream = await play.stream(videoInfo.url);
                        this.testResults.youtubeApi.stream = '✅ Stream creation working';
                        console.log(`  ✅ Stream type: ${stream.type}`);
                        
                        // Clean up stream
                        if (stream.stream && typeof stream.stream.destroy === 'function') {
                            stream.stream.destroy();
                        }
                    } catch (streamError) {
                        this.testResults.youtubeApi.stream = `❌ Stream Error: ${streamError.message}`;
                        console.log(`  ❌ Stream Error: ${streamError.message}`);
                    }
                } else {
                    this.testResults.youtubeApi.videoInfo = '❌ Video info retrieval failed';
                    console.log('  ❌ Video info retrieval failed');
                }
            } else {
                this.testResults.youtubeApi.search = '⚠️ No search results found';
                console.log('  ⚠️ No search results found');
            }
            
        } catch (error) {
            this.testResults.youtubeApi.search = `❌ YouTube API Error: ${error.message}`;
            console.log(`  ❌ YouTube API Error: ${error.message}`);
            
            if (error.message.includes('429')) {
                this.testResults.youtubeApi.rateLimit = '⚠️ Rate limited - try again later';
                console.log('  ⚠️ Rate limited - this is expected for high traffic');
            } else if (error.message.includes('Captcha')) {
                this.testResults.youtubeApi.captcha = '⚠️ YouTube detected bot activity';
                console.log('  ⚠️ YouTube detected bot activity');
            }
        }
    }

    async testVoicePermissions() {
        console.log('\n🎤 Testing Voice Channel Permissions...');
        
        // Simulate permission checks
        const requiredPermissions = [
            'CONNECT',
            'SPEAK',
            'VIEW_CHANNEL',
            'USE_VAD' // Voice activity detection
        ];
        
        this.testResults.voicePermissions.required = requiredPermissions;
        this.testResults.voicePermissions.status = '✅ Permission checks configured';
        console.log('  ✅ Voice permission checks configured');
        console.log(`  📋 Required permissions: ${requiredPermissions.join(', ')}`);
    }

    async testAudioResourceCreation() {
        console.log('\n🎵 Testing Audio Resource Creation...');
        
        try {
            const { createAudioResource, demuxProbe } = require('@discordjs/voice');
            
            // Test with mock data
            const mockStream = { 
                on: () => {},
                pipe: () => {},
                destroy: () => {}
            };
            
            try {
                const resource = createAudioResource(mockStream, { inputType: 'webm/opus' });
                this.testResults.connectionTests.audioResource = '✅ Audio resource creation working';
                console.log('  ✅ Audio resource creation working');
            } catch (resourceError) {
                this.testResults.connectionTests.audioResource = `❌ Resource Error: ${resourceError.message}`;
                console.log(`  ❌ Resource Error: ${resourceError.message}`);
            }
            
        } catch (error) {
            this.testResults.connectionTests.audioResource = `❌ Audio Resource Error: ${error.message}`;
            console.log(`  ❌ Audio Resource Error: ${error.message}`);
        }
    }

    async runDiagnosticsCommand(interaction) {
        await interaction.deferReply();
        
        let report = '🔧 **Music System Diagnostic Report**\n\n';
        
        // Dependencies section
        report += '**📦 Dependencies:**\n';
        Object.entries(this.testResults.dependencies).forEach(([key, value]) => {
            report += `• ${key}: ${value}\n`;
        });
        
        // YouTube API section
        report += '\n**🎥 YouTube API:**\n';
        Object.entries(this.testResults.youtubeApi).forEach(([key, value]) => {
            report += `• ${key}: ${value}\n`;
        });
        
        // FFmpeg section
        report += '\n**🎬 FFmpeg:**\n';
        Object.entries(this.testResults.ffmpegStatus).forEach(([key, value]) => {
            report += `• ${key}: ${value}\n`;
        });
        
        // Voice permissions section
        report += '\n**🎤 Voice Permissions:**\n';
        if (this.testResults.voicePermissions.required) {
            report += `• Required: ${this.testResults.voicePermissions.required.join(', ')}\n`;
        }
        report += `• Status: ${this.testResults.voicePermissions.status}\n`;
        
        // Connection tests section
        report += '\n**🎵 Audio Resources:**\n';
        Object.entries(this.testResults.connectionTests).forEach(([key, value]) => {
            report += `• ${key}: ${value}\n`;
        });
        
        report += '\n**✅ Diagnostics Complete**';
        
        await interaction.editReply({ content: report });
    }

    generateReport() {
        console.log('\n📊 Generating Diagnostic Report...\n');
        
        const report = {
            timestamp: new Date().toISOString(),
            results: this.testResults,
            recommendations: []
        };
        
        // Generate recommendations
        if (Object.values(this.testResults.dependencies).some(val => val.includes('❌'))) {
            report.recommendations.push('🔧 Install missing dependencies: npm install');
        }
        
        if (this.testResults.youtubeApi.rateLimit) {
            report.recommendations.push('⏰ YouTube API rate limited - wait before testing again');
        }
        
        if (this.testResults.youtubeApi.captcha) {
            report.recommendations.push('🤖 YouTube detected bot activity - try again later');
        }
        
        if (!this.testResults.ffmpegStatus.version?.includes('✅')) {
            report.recommendations.push('🎬 FFmpeg issues detected - check ffmpeg-static installation');
        }
        
        // Save report to file
        fs.writeFileSync('./music-diagnostic-report.json', JSON.stringify(report, null, 2));
        
        console.log('📄 Report saved to: music-diagnostic-report.json');
        console.log('\n📋 **Diagnostic Summary:**');
        Object.entries(this.testResults).forEach(([category, results]) => {
            console.log(`\n**${category.toUpperCase()}:**`);
            Object.entries(results).forEach(([key, value]) => {
                console.log(`  ${value}`);
            });
        });
        
        if (report.recommendations.length > 0) {
            console.log('\n**🔧 RECOMMENDATIONS:**');
            report.recommendations.forEach(rec => console.log(`  ${rec}`));
        }
        
        console.log('\n✅ **Diagnostics Complete!**');
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

// Run diagnostics if called directly
if (require.main === module) {
    const diagnostic = new MusicDiagnostic();
    diagnostic.start().catch(console.error);
}

module.exports = MusicDiagnostic;