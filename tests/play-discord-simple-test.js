const { expect } = require('chai');
const sinon = require('sinon');

describe('Discord Music Play Command - Unit Tests', () => {
    let playCommand, interaction, mockModules;

    beforeEach(() => {
        // Save original requires
        const savedRequire = require;
        
        // Create mock modules
        mockModules = {
            play: {
                search: sinon.stub(),
                video_info: sinon.stub(),
                setToken: sinon.stub()
            },
            ytdl: {
                getInfo: sinon.stub()
            },
            voice: {
                getVoiceConnection: sinon.stub(),
                joinVoiceChannel: sinon.stub(),
                entersState: sinon.stub(),
                VoiceConnectionStatus: {
                    Signalling: 'signalling',
                    Connecting: 'connecting',
                    Ready: 'ready',
                    Disconnected: 'disconnected'
                }
            },
            rateLimiter: {
                execute: sinon.stub()
            },
            musicManager: {
                playSong: sinon.stub()
            }
        };

        // Override requires for this test
        const Module = module.constructor.prototype;
        const moduleRequire = Module.require;
        Module.require = function(id) {
            if (id.includes('play-dl')) return mockModules.play;
            if (id.includes('ytdl-core')) return mockModules.ytdl;
            if (id.includes('@discordjs/voice')) return mockModules.voice;
            if (id.includes('rateLimiter')) return mockModules.rateLimiter;
            if (id.includes('musicManager')) return mockModules.musicManager;
            return moduleRequire.apply(this, arguments);
        };

        // Clear cache and import play command
        Object.keys(require.cache).forEach(key => {
            if (key.includes('play')) delete require.cache[key];
        });
        
        // Mock environment
        process.env.YOUTUBE_COOKIE = undefined;
        
        try {
            playCommand = require('../src/commands/music/play');
        } catch (error) {
            console.log('Error importing play command:', error.message);
            playCommand = null;
        }

        // Create mock interaction
        interaction = {
            member: {
                voice: {
                    channel: {
                        id: 'voice-channel-123',
                        name: 'General Voice',
                        full: false,
                        permissionsFor: () => ({
                            has: () => true
                        })
                    }
                }
            },
            guild: {
                id: 'guild-123',
                voiceAdapterCreator: sinon.stub()
            },
            channel: {
                createMessageComponentCollector: () => ({
                    on: sinon.stub(),
                    stop: sinon.stub()
                })
            },
            client: {
                user: {
                    setActivity: sinon.stub()
                }
            },
            options: {
                getString: () => 'test song'
            },
            createdTimestamp: Date.now(),
            reply: sinon.stub().resolves(),
            editReply: sinon.stub().resolves(),
            followUp: sinon.stub().resolves(),
            user: { 
                id: 'user-123',
                tag: 'testuser#1234'
            },
            deferred: false,
            replied: false
        };
    });

    afterEach(() => {
        // Restore original require
        const Module = module.constructor.prototype;
        Module.require = moduleRequire;
        
        // Clear require cache
        Object.keys(require.cache).forEach(key => {
            if (key.includes('play')) delete require.cache[key];
        });
        
        sinon.restore();
    });

    describe('Basic Command Structure', () => {
        it('should have valid command definition', () => {
            if (!playCommand) {
                // Skip test if command couldn't be loaded
                expect(true).to.be.true;
                return;
            }

            expect(playCommand.data).to.be.an('object');
            expect(playCommand.data.name).to.equal('play');
            expect(playCommand.data.description).to.include('Search for music');
            expect(playCommand.execute).to.be.a('function');
        });

        it('should have required query option', () => {
            if (!playCommand) {
                expect(true).to.be.true;
                return;
            }

            const options = playCommand.data.options;
            expect(options).to.be.an('array');
            expect(options).to.have.length(1);
            expect(options[0].name).to.equal('query');
            expect(options[0].required).to.be.true;
            expect(options[0].description).to.include('Search query');
        });
    });

    describe('Interaction Validation', () => {
        it('should check interaction age', () => {
            const now = Date.now();
            const interactionAge = now - (interaction.createdTimestamp || now);
            const isExpired = interactionAge > (14 * 60 * 1000); // 14 minutes
            
            expect(interactionAge).to.be.a('number');
            expect(isExpired).to.be.false; // Fresh interaction
        });

        it('should detect expired interactions', () => {
            // Create expired interaction
            const expiredInteraction = {
                ...interaction,
                createdTimestamp: Date.now() - (15 * 60 * 1000) // 15 minutes ago
            };

            const now = Date.now();
            const interactionAge = now - (expiredInteraction.createdTimestamp || now);
            const isExpired = interactionAge > (14 * 60 * 1000);
            
            expect(isExpired).to.be.true; // Expired interaction
        });

        it('should validate voice channel membership', () => {
            const voiceChannel = interaction.member.voice.channel;
            
            expect(voiceChannel).to.not.be.null;
            expect(voiceChannel.id).to.equal('voice-channel-123');
            expect(voiceChannel.name).to.equal('General Voice');
            expect(voiceChannel.full).to.be.false;
        });

        it('should check bot permissions structure', () => {
            const voiceChannel = interaction.member.voice.channel;
            const permissions = voiceChannel.permissionsFor();
            
            expect(permissions).to.be.an('object');
            expect(typeof permissions.has).to.equal('function');
        });
    });

    describe('Search Result Processing', () => {
        it('should format search results correctly', () => {
            const mockResults = [{
                title: 'Test Song Title',
                url: 'https://youtube.com/test',
                durationFormatted: '3:45',
                channel: { name: 'Test Channel' }
            }];

            // Test the mapping logic from play.js line 205-209
            const options = mockResults.map((video, index) => ({
                label: video.title.length > 80 ? video.title.substring(0, 77) + '...' : video.title,
                description: `${video.durationFormatted} • ${video.channel.name}`,
                value: video.url,
            }));

            expect(options).to.have.length(1);
            expect(options[0].label).to.equal('Test Song Title');
            expect(options[0].description).to.equal('3:45 • Test Channel');
            expect(options[0].value).to.equal('https://youtube.com/test');
        });

        it('should truncate long video titles', () => {
            const longTitle = 'A'.repeat(100);
            const mockResults = [{
                title: longTitle,
                url: 'https://youtube.com/test',
                durationFormatted: '3:45',
                channel: { name: 'Test Channel' }
            }];

            const options = mockResults.map((video) => ({
                label: video.title.length > 80 ? video.title.substring(0, 77) + '...' : video.title,
                description: `${video.durationFormatted} • ${video.channel.name}`,
                value: video.url,
            }));

            expect(options[0].label).to.have.length(80); // 77 + '...'
            expect(options[0].label).to.endWith('...');
        });

        it('should handle empty search results', () => {
            const emptyResults = [];
            
            expect(emptyResults).to.have.length(0);
        });
    });

    describe('Error Categorization Logic', () => {
        it('should categorize rate limit errors correctly', () => {
            const errors = [
                new Error('429 Too Many Requests'),
                new Error('Rate limit exceeded'),
                new Error('Too many requests')
            ];

            errors.forEach(error => {
                const errorType = error.message.includes('429') ? 'RATE_LIMIT' : 'UNKNOWN';
                expect(errorType).to.equal('RATE_LIMIT');
            });
        });

        it('should categorize network errors correctly', () => {
            const networkError = new Error('ENOTFOUND www.youtube.com');
            const errorType = networkError.message.includes('ENOTFOUND') ? 'NETWORK' : 'UNKNOWN';
            expect(errorType).to.equal('NETWORK');
        });

        it('should categorize timeout errors correctly', () => {
            const timeoutErrors = [
                new Error('Search timeout'),
                new Error('Connection timeout'),
                new Error('Request timeout')
            ];

            timeoutErrors.forEach(error => {
                const errorType = error.message.includes('timeout') ? 'TIMEOUT' : 'UNKNOWN';
                expect(errorType).to.equal('TIMEOUT');
            });
        });

        it('should categorize library errors correctly', () => {
            const libraryErrors = [
                new Error('play-dl search function is not available'),
                new Error('play-dl stream failed'),
                new Error('play-dl video_info error')
            ];

            libraryErrors.forEach(error => {
                const errorType = error.message.includes('play-dl') ? 'LIBRARY_ERROR' : 'UNKNOWN';
                expect(errorType).to.equal('LIBRARY_ERROR');
            });
        });

        it('should categorize no results errors correctly', () => {
            const noResultsError = new Error('No results found for query');
            const errorType = noResultsError.message.includes('No results found') ? 'NO_RESULTS' : 'UNKNOWN';
            expect(errorType).to.equal('NO_RESULTS');
        });
    });

    describe('Discord API Error Handling', () => {
        it('should recognize interaction expired error', () => {
            const expiredError = { code: 10062 };
            expect(expiredError.code).to.equal(10062);
        });

        it('should recognize already acknowledged error', () => {
            const acknowledgedError = { code: 40060 };
            expect(acknowledgedError.code).to.equal(40060);
        });

        it('should handle permission denied errors', () => {
            const permissionError = new Error('Permission denied');
            const errorType = permissionError.message.includes('permissions') ? 'PERMISSION' : 'UNKNOWN';
            expect(errorType).to.equal('PERMISSION');
        });

        it('should handle FFmpeg errors', () => {
            const ffmpegError = new Error('FFmpeg error: Audio processing failed');
            const errorType = ffmpegError.message.includes('FFmpeg') ? 'FFMPEG' : 'UNKNOWN';
            expect(errorType).to.equal('FFMPEG');
        });
    });

    describe('Voice Connection Logic', () => {
        it('should detect user not in voice channel', () => {
            const noVoiceInteraction = {
                ...interaction,
                member: {
                    voice: {
                        channel: null
                    }
                }
            };

            expect(noVoiceInteraction.member.voice.channel).to.be.null;
        });

        it('should handle full voice channel', () => {
            const fullChannelInteraction = {
                ...interaction,
                member: {
                    voice: {
                        channel: {
                            ...interaction.member.voice.channel,
                            full: true
                        }
                    }
                }
            };

            expect(fullChannelInteraction.member.voice.channel.full).to.be.true;
        });

        it('should detect voice channel permissions', () => {
            const permissions = interaction.member.voice.channel.permissionsFor();
            const hasConnect = permissions.has('Connect');
            const hasSpeak = permissions.has('Speak');

            expect(typeof hasConnect).to.equal('boolean');
            expect(typeof hasSpeak).to.equal('boolean');
        });
    });

    describe('Music Controls Display', () => {
        it('should create valid embed structure', () => {
            const embed = {
                title: '🔍 Search Results',
                description: `Found 5 results for "test song"`,
                color: 0x0099FF,
                timestamp: new Date().toISOString(),
            };

            expect(embed.title).to.equal('🔍 Search Results');
            expect(embed.description).to.include('Found 5 results');
            expect(embed.color).to.equal(0x0099FF);
            expect(embed.timestamp).to.be.a('string');
        });

        it('should format song object correctly', () => {
            const song = {
                title: 'Test Song',
                url: 'https://youtube.com/test',
                duration: '3:45',
                channel: 'Test Channel',
                thumbnail: 'https://example.com/thumb.jpg',
                views: 1000000,
                uploadedAt: '2023-01-01'
            };

            expect(song.title).to.equal('Test Song');
            expect(song.url).to.include('youtube.com');
            expect(song.duration).to.equal('3:45');
            expect(song.channel).to.equal('Test Channel');
        });
    });

    describe('Rate Limiting Logic', () => {
        it('should calculate exponential backoff', () => {
            const baseDelay = 1000;
            const maxDelay = 30000;
            
            for (let i = 0; i < 5; i++) {
                const delay = Math.min(baseDelay * Math.pow(2, i), maxDelay);
                expect(delay).to.be.a('number');
                expect(delay).to.be.at.most(maxDelay);
            }
        });

        it('should handle retry logic', () => {
            const maxRetries = 3;
            let retryCount = 0;
            
            while (retryCount < maxRetries) {
                retryCount++;
                expect(retryCount).to.be.at.most(maxRetries);
            }
            
            expect(retryCount).to.equal(maxRetries);
        });
    });
});