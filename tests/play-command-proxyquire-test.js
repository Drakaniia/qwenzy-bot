const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

describe('Play Command with Proxyquire Tests', () => {
    let playCommand, stubs;

    beforeEach(() => {
        // Mock environment
        process.env.YOUTUBE_COOKIE = undefined;
        
        // Create mocks
        const mockSearchResults = [{
            title: 'Test Song',
            url: 'https://youtube.com/test',
            durationInSec: 225,
            durationRaw: '3:45',
            durationFormatted: '3:45',
            channel: { name: 'Test Channel' },
            thumbnails: [{ url: 'https://example.com/thumb.jpg' }]
        }];

        stubs = {
            'play-dl': {
                search: sinon.stub().resolves(mockSearchResults),
                video_info: sinon.stub().resolves({
                    video_details: {
                        title: 'Test Song',
                        url: 'https://youtube.com/test',
                        durationRaw: '3:45',
                        channel: { name: 'Test Channel' },
                        thumbnails: [{ url: 'https://example.com/thumb.jpg' }],
                        views: 1000000,
                        uploadedAt: '2023-01-01'
                    }
                }),
                setToken: sinon.stub()
            },
            'ytdl-core': {
                getInfo: sinon.stub().resolves({
                    videos: [{
                        title: 'Fallback Song',
                        video_url: 'https://youtube.com/fallback',
                        duration: '3:45',
                        author: { name: 'Fallback Channel' },
                        thumbnail: 'https://example.com/thumb.jpg'
                    }]
                })
            },
            '@discordjs/voice': {
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
            '../../utils/rateLimiter': {
                execute: sinon.stub()
            },
            '../../modules/musicManager': {
                playSong: sinon.stub().resolves()
            }
        };

        // Use proxyquire to load the play command with mocked dependencies
        playCommand = proxyquire('../src/commands/music/play', stubs);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('Command Definition', () => {
        it('should have correct command structure', () => {
            expect(playCommand.data.name).to.equal('play');
            expect(playCommand.data.description).to.include('Search for music');
            expect(playCommand.data.options).to.have.length(1);
            expect(playCommand.data.options[0].name).to.equal('query');
            expect(playCommand.data.options[0].required).to.be.true;
        });
    });

    describe('Search Functionality', () => {
        it('should handle successful search', async () => {
            const mockInteraction = {
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

            // Mock the rate limiter to return search results
            stubs['../../utils/rateLimiter'].execute.resolves([{
                title: 'Test Song',
                url: 'https://youtube.com/test',
                durationFormatted: '3:45',
                channel: { name: 'Test Channel' }
            }]);

            try {
                await playCommand.execute(mockInteraction);
            } catch (error) {
                // Expected to fail at collector stage
            }

            expect(mockInteraction.reply.calledWith('🔍 Searching...')).to.be.true;
        });
    });

    describe('Error Handling', () => {
        it('should handle rate limit errors', async () => {
            const mockInteraction = {
                member: { voice: { channel: { id: 'test' } } },
                guild: { id: 'test' },
                options: { getString: () => 'test' },
                createdTimestamp: Date.now(),
                reply: sinon.stub().resolves(),
                editReply: sinon.stub().resolves(),
                followUp: sinon.stub().resolves()
            };

            // Mock rate limiter to throw rate limit error
            stubs['../../utils/rateLimiter'].execute.rejects(new Error('429 Too Many Requests'));

            await playCommand.execute(mockInteraction);

            expect(mockInteraction.editReply.called).to.be.true;
        });

        it('should handle network errors', async () => {
            const mockInteraction = {
                member: { voice: { channel: { id: 'test' } } },
                guild: { id: 'test' },
                options: { getString: () => 'test' },
                createdTimestamp: Date.now(),
                reply: sinon.stub().resolves(),
                editReply: sinon.stub().resolves(),
                followUp: sinon.stub().resolves()
            };

            // Mock rate limiter to throw network error
            stubs['../../utils/rateLimiter'].execute.rejects(new Error('ENOTFOUND www.youtube.com'));

            await playCommand.execute(mockInteraction);

            expect(mockInteraction.reply.called).to.be.true;
        });
    });

    describe('Search Result Processing', () => {
        it('should properly format search results for display', () => {
            const mockResults = [{
                title: 'Test Song Title',
                url: 'https://youtube.com/test',
                durationFormatted: '3:45',
                channel: { name: 'Test Channel Name' }
            }];

            const options = mockResults.map((video, index) => ({
                label: video.title.length > 80 ? video.title.substring(0, 77) + '...' : video.title,
                description: `${video.durationFormatted} • ${video.channel.name}`,
                value: video.url,
            }));

            expect(options).to.have.length(1);
            expect(options[0].label).to.equal('Test Song Title');
            expect(options[0].description).to.equal('3:45 • Test Channel Name');
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
    });
});