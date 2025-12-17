const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire');

describe.skip('Play Command with Proxyquire Tests (legacy play-dl pipeline)', () => {
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
            stubs['../../utils/rateLimiter'].execute.onCall(0).resolves([{
                title: 'Test Song',
                url: 'https://youtube.com/test',
                durationFormatted: '3:45',
                channel: { name: 'Test Channel' }
            }]);

            try {
                await playCommand.execute(mockInteraction);
            } catch (error) {
                // Expected to fail at collector stage as the collector won't receive a selection
            }

            // Check that reply was called with the initial searching message
            expect(mockInteraction.reply.calledOnce).to.be.true;
            const firstCall = mockInteraction.reply.firstCall;
            const args = firstCall.args[0];
            const content = typeof args === 'string' ? args : (args && args.content) ? args.content : args;

            // The initial message should be "🔍 Searching..."
            expect(content).to.include('🔍 Searching...');
        });
    });

    describe('Error Handling', () => {
        it('should handle rate limit errors', async function() {
            this.timeout(20000); // Increase timeout for this test

            const mockInteraction = {
                member: { voice: { channel: { id: 'test' } } },
                guild: { id: 'test' },
                options: { getString: () => 'test' },
                createdTimestamp: Date.now(),
                reply: sinon.stub().resolves(),
                editReply: sinon.stub().resolves(),
                followUp: sinon.stub().resolves()
            };

            // Mock rate limiter to throw rate limit error multiple times to trigger the max retries
            const rateLimitError = new Error('429 Too Many Requests');
            stubs['../../utils/rateLimiter'].execute.onCall(0).rejects(rateLimitError);
            stubs['../../utils/rateLimiter'].execute.onCall(1).rejects(rateLimitError);
            stubs['../../utils/rateLimiter'].execute.onCall(2).rejects(rateLimitError);

            await playCommand.execute(mockInteraction);

            // After multiple retries, editReply should be called with failure message
            expect(mockInteraction.editReply.called).to.be.true;
            const calls = mockInteraction.editReply.getCalls();
            let foundMatch = false;
            for (const call of calls) {
                const args = call.args[0];
                const content = typeof args === 'string' ? args : args?.content || args;
                if (content && (typeof content === 'string' ? content : content.content).includes('Failed to search for music after')) {
                    foundMatch = true;
                    break;
                }
            }
            expect(foundMatch).to.be.true;
        });

        it('should handle network errors', async function() {
            this.timeout(15000); // Increase timeout for this test

            const mockInteraction = {
                member: { voice: { channel: { id: 'test' } } },
                guild: { id: 'test' },
                options: { getString: () => 'test' },
                createdTimestamp: Date.now(),
                reply: sinon.stub().resolves(),
                editReply: sinon.stub().resolves(),
                followUp: sinon.stub().resolves()
            };

            // Mock rate limiter to throw network error multiple times
            const networkError = new Error('ENOTFOUND www.youtube.com');
            stubs['../../utils/rateLimiter'].execute.onCall(0).rejects(networkError);
            stubs['../../utils/rateLimiter'].execute.onCall(1).rejects(networkError);
            stubs['../../utils/rateLimiter'].execute.onCall(2).rejects(networkError);

            await playCommand.execute(mockInteraction);

            // editReply should be called after the initial reply with a network error message
            expect(mockInteraction.editReply.called).to.be.true;
            const calls = mockInteraction.editReply.getCalls();
            let foundMatch = false;
            for (const call of calls) {
                const args = call.args[0];
                const content = typeof args === 'string' ? args : args?.content || args;
                if (content && (typeof content === 'string' ? content : content.content).includes('Network error')) {
                    foundMatch = true;
                    break;
                }
            }
            expect(foundMatch).to.be.true;
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
            expect(options[0].label).to.include('...');
        });
    });
});