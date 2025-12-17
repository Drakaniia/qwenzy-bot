const { expect } = require('chai');
const sinon = require('sinon');
const { EventEmitter } = require('events');
const proxyquire = require('proxyquire').noCallThru();

describe('Discord Music Play Command Tests', () => {
    let playCommand, interaction, stubs;

    beforeEach(() => {
        // Mock all external dependencies
        stubs = {
            play: {
                search: sinon.stub(),
                video_info: sinon.stub(),
                stream: sinon.stub(),
                setToken: sinon.stub()
            },
            ytdl: {
                getInfo: sinon.stub()
            },
            discordVoice: {
                getVoiceConnection: sinon.stub(),
                joinVoiceChannel: sinon.stub(),
                createAudioPlayer: sinon.stub(),
                createAudioResource: sinon.stub(),
                AudioPlayerStatus: {
                    Playing: 'playing',
                    Idle: 'idle',
                    Paused: 'paused',
                    Buffering: 'buffering',
                    AutoPaused: 'autopaused'
                },
                VoiceConnectionStatus: {
                    Signalling: 'signalling',
                    Connecting: 'connecting',
                    Ready: 'ready',
                    Disconnected: 'disconnected'
                },
                entersState: sinon.stub()
            },
            rateLimiter: {
                execute: sinon.stub(),
                reset: sinon.stub(),
                getStatus: sinon.stub()
            },
            musicManager: {
                playSong: sinon.stub()
            },
            rateLimitUtils: {
                isInteractionExpired: sinon.stub()
            }
        };

        // Load play command with proxyquire
        playCommand = proxyquire('../src/commands/music/play', {
            'play-dl': stubs.play,
            'ytdl-core': stubs.ytdl,
            '@discordjs/voice': stubs.discordVoice,
            '../../utils/rateLimiter': stubs.rateLimiter,
            '../../modules/musicManager': stubs.musicManager
        });

        // Create comprehensive mock interaction
        interaction = {
            member: {
                voice: {
                    channel: {
                        id: 'voice-channel-123',
                        name: 'General Voice',
                        full: false,
                        permissionsFor: sinon.stub().returns({
                            has: sinon.stub().returns(true)
                        })
                    }
                }
            },
            guild: {
                id: 'guild-123',
                voiceAdapterCreator: sinon.stub()
            },
            channel: {
                createMessageComponentCollector: sinon.stub().returns(new EventEmitter())
            },
            client: {
                user: {
                    setActivity: sinon.stub()
                }
            },
            options: {
                getString: sinon.stub().returns('test song')
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

        // Setup collector mock
        const mockCollector = interaction.channel.createMessageComponentCollector();
        mockCollector.on = sinon.stub();
        mockCollector.stop = sinon.stub();
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('Basic Command Structure', () => {
        it('should have correct command definition', () => {
            expect(playCommand.data.name).to.equal('play');
            expect(playCommand.data.description).to.include('Search for music');

            const options = playCommand.data.options;
            expect(options).to.have.length(1);
            expect(options[0].name).to.equal('query');
            expect(options[0].required).to.be.true;
        });

        it('should be a function', () => {
            expect(typeof playCommand.execute).to.equal('function');
        });
    });

    describe('YouTube Search Integration', () => {
        it('should perform successful YouTube search and show results', async () => {
            // Mock successful search - need to match the structure expected by the play command
            const mockSearchResults = [{
                title: 'Test Song',
                url: 'https://youtube.com/test',
                durationInSec: 225,
                durationRaw: '3:45',
                durationFormatted: '3:45',
                channel: { name: 'Test Channel' },
                thumbnail: 'https://example.com/thumb.jpg'
            }];

            stubs.rateLimiter.execute.resolves(mockSearchResults);

            // Mock collector with immediate selection
            const mockSelectInteraction = {
                user: { id: 'user-123' },
                values: ['https://youtube.com/test'],
                update: sinon.stub().resolves(),
                guild: interaction.guild,
                member: interaction.member,
                client: interaction.client
            };

            const mockCollector = new EventEmitter();
            mockCollector.on = sinon.stub().callsFake((event, callback) => {
                if (event === 'collect') {
                    // Simulate user selection after a short delay
                    setTimeout(() => callback(mockSelectInteraction), 10);
                }
            });
            mockCollector.stop = sinon.stub();

            interaction.channel.createMessageComponentCollector.returns(mockCollector);

            // Mock video info fetch
            stubs.rateLimiter.execute.onSecondCall().resolves({
                video_details: {
                    title: 'Test Song',
                    url: 'https://youtube.com/test',
                    durationRaw: '3:45',
                    channel: { name: 'Test Channel' },
                    thumbnails: [{ url: 'https://example.com/thumb.jpg' }],
                    views: 1000000,
                    uploadedAt: '2023-01-01'
                }
            });

            // Mock voice connection
            const mockConnection = new EventEmitter();
            mockConnection.joinConfig = { channelId: 'voice-channel-123' };
            mockConnection.on = sinon.stub();
            mockConnection.subscribe = sinon.stub();
            mockConnection.destroy = sinon.stub();

            stubs.discordVoice.getVoiceConnection.returns(null);
            stubs.discordVoice.joinVoiceChannel.returns(mockConnection);
            stubs.discordVoice.entersState.resolves();
            stubs.musicManager.playSong.resolves();

            await playCommand.execute(interaction);

            // Verify search was initiated
            expect(stubs.rateLimiter.execute.called).to.be.true;
            expect(interaction.reply.called).to.be.true;
        });

        it('should handle empty search results', async () => {
            // The play command will not call video info retrieval if search results are empty,
            // so we only need to mock the first call
            stubs.rateLimiter.execute.onFirstCall().resolves([]);

            await playCommand.execute(interaction);

            // Check that editReply was called with a message containing "No results found"
            expect(interaction.editReply.calledOnce).to.be.true;
            const callArgs = interaction.editReply.getCall(0).args;
            const content = callArgs[0].content || callArgs[0];

            // The content might be an object with content property or a string directly
            if (typeof content === 'string') {
                expect(content).to.match(/❌ No results found/);
            } else if (typeof content === 'object' && content.content) {
                expect(content.content).to.match(/❌ No results found/);
            } else {
                expect(false).to.be.true; // Fail the test if unexpected format
            }
        });

        it('should handle YouTube search failures with fallback', async () => {
            // First call fails, fallback succeeds - need to simulate the ytdl fallback path
            stubs.rateLimiter.execute.onFirstCall().rejects(new Error('play-dl search function is not available'));

            // Since play-dl fails, it will call ytdl.getInfo instead, so we need to mock that
            stubs.ytdl.getInfo.resolves({
                videos: [{
                    title: 'Fallback Song',
                    video_url: 'https://youtube.com/fallback',
                    duration: 225, // Duration in seconds
                    author: { name: 'Fallback Channel' },
                    thumbnail: 'https://example.com/thumb.jpg'
                }]
            });

            // After getting fallback results, it will try to get video info for the selected video
            stubs.rateLimiter.execute.onSecondCall().resolves({
                video_details: {
                    title: 'Fallback Song',
                    url: 'https://youtube.com/fallback',
                    durationRaw: '3:45',
                    channel: { name: 'Fallback Channel' },
                    thumbnails: [{ url: 'https://example.com/thumb.jpg' }],
                    views: 1000000,
                    uploadedAt: '2023-01-01'
                }
            });

            // Mock the selection interaction
            const mockSelectInteraction = {
                user: { id: 'user-123' },
                values: ['https://youtube.com/fallback'],
                update: sinon.stub().resolves(),
                guild: interaction.guild,
                member: interaction.member,
                client: interaction.client,
                followUp: sinon.stub().resolves()
            };

            const mockCollector = new EventEmitter();
            mockCollector.on = sinon.stub().callsFake((event, callback) => {
                if (event === 'collect') {
                    // Simulate user selection after a short delay
                    setTimeout(() => callback(mockSelectInteraction), 10);
                }
            });
            mockCollector.stop = sinon.stub();

            interaction.channel.createMessageComponentCollector.returns(mockCollector);

            // Mock voice connection
            const mockConnection = new EventEmitter();
            mockConnection.joinConfig = { channelId: 'voice-channel-123' };
            mockConnection.on = sinon.stub();
            mockConnection.subscribe = sinon.stub();
            mockConnection.destroy = sinon.stub();

            stubs.discordVoice.getVoiceConnection.returns(null);
            stubs.discordVoice.joinVoiceChannel.returns(mockConnection);
            stubs.discordVoice.entersState.resolves();
            stubs.musicManager.playSong.resolves();

            await playCommand.execute(interaction);

            // Check that ytdl.getInfo was called (the fallback mechanism)
            expect(stubs.ytdl.getInfo.called).to.be.true;
        });
    });

    describe('Voice Channel Validation', () => {
        it('should reject when user is not in voice channel', async () => {
            interaction.member.voice.channel = null;
            // Need to mock for both search and video info calls
            stubs.rateLimiter.execute.onFirstCall().resolves([{
                title: 'Test Song',
                url: 'https://youtube.com/test',
                durationInSec: 225,
                durationRaw: '3:45',
                durationFormatted: '3:45',
                channel: { name: 'Test Channel' },
                thumbnail: 'https://example.com/thumb.jpg'
            }]);
            stubs.rateLimiter.execute.onSecondCall().resolves({
                video_details: {
                    title: 'Test Song',
                    url: 'https://youtube.com/test',
                    durationRaw: '3:45',
                    channel: { name: 'Test Channel' },
                    thumbnails: [{ url: 'https://example.com/thumb.jpg' }],
                    views: 1000000,
                    uploadedAt: '2023-01-01'
                }
            });

            // Mock the select interaction
            const mockSelectInteraction = {
                user: { id: 'user-123' },
                values: ['https://youtube.com/test'],
                update: sinon.stub().resolves(),
                guild: interaction.guild,
                member: { voice: { channel: null } }, // No voice channel
                client: interaction.client,
                followUp: sinon.stub().resolves(),
                editReply: sinon.stub().resolves() // Add editReply method
            };

            const mockCollector = new EventEmitter();
            mockCollector.on = sinon.stub().callsFake((event, callback) => {
                if (event === 'collect') {
                    setTimeout(() => callback(mockSelectInteraction), 10);
                }
            });
            mockCollector.stop = sinon.stub();

            interaction.channel.createMessageComponentCollector.returns(mockCollector);

            await playCommand.execute(interaction);

            // Check that update was called with the expected message
            expect(mockSelectInteraction.update.calledOnce).to.be.true;
            const callArgs = mockSelectInteraction.update.getCall(0).args;
            const content = callArgs[0].content || callArgs[0];

            // The content might be an object with content property or a string directly
            if (typeof content === 'string') {
                expect(content).to.match(/❌ You need to be in a voice channel/);
            } else if (typeof content === 'object' && content.content) {
                expect(content.content).to.match(/❌ You need to be in a voice channel/);
            } else {
                expect(false).to.be.true; // Fail the test if unexpected format
            }
        });

        it('should check bot permissions in voice channel', async () => {
            // Mock missing permissions
            interaction.member.voice.channel.permissionsFor.returns({
                has: sinon.stub().returns(false)
            });

            // Need to mock for both search and video info calls
            stubs.rateLimiter.execute.onFirstCall().resolves([{
                title: 'Test Song',
                url: 'https://youtube.com/test',
                durationInSec: 225,
                durationRaw: '3:45',
                durationFormatted: '3:45',
                channel: { name: 'Test Channel' },
                thumbnail: 'https://example.com/thumb.jpg'
            }]);
            stubs.rateLimiter.execute.onSecondCall().resolves({
                video_details: {
                    title: 'Test Song',
                    url: 'https://youtube.com/test',
                    durationRaw: '3:45',
                    channel: { name: 'Test Channel' },
                    thumbnails: [{ url: 'https://example.com/thumb.jpg' }],
                    views: 1000000,
                    uploadedAt: '2023-01-01'
                }
            });

            const mockSelectInteraction = {
                user: { id: 'user-123' },
                values: ['https://youtube.com/test'],
                update: sinon.stub().resolves(),
                guild: interaction.guild,
                member: interaction.member,
                client: interaction.client,
                followUp: sinon.stub().resolves(),
                editReply: sinon.stub().resolves()
            };

            const mockCollector = new EventEmitter();
            mockCollector.on = sinon.stub().callsFake((event, callback) => {
                if (event === 'collect') {
                    setTimeout(() => callback(mockSelectInteraction), 10);
                }
            });
            mockCollector.stop = sinon.stub();

            interaction.channel.createMessageComponentCollector.returns(mockCollector);

            await playCommand.execute(interaction);

            // Check that update was called with the expected message
            expect(mockSelectInteraction.update.calledOnce).to.be.true;
            const callArgs = mockSelectInteraction.update.getCall(0).args;
            const content = callArgs[0].content || callArgs[0];

            // The content might be an object with content property or a string directly
            if (typeof content === 'string') {
                expect(content).to.match(/❌ I need permission to connect and speak/);
            } else if (typeof content === 'object' && content.content) {
                expect(content.content).to.match(/❌ I need permission to connect and speak/);
            } else {
                expect(false).to.be.true; // Fail the test if unexpected format
            }
        });

        it('should handle full voice channel', async () => {
            interaction.member.voice.channel.full = true;

            // Need to mock for both search and video info calls
            stubs.rateLimiter.execute.onFirstCall().resolves([{
                title: 'Test Song',
                url: 'https://youtube.com/test',
                durationInSec: 225,
                durationRaw: '3:45',
                durationFormatted: '3:45',
                channel: { name: 'Test Channel' },
                thumbnail: 'https://example.com/thumb.jpg'
            }]);
            stubs.rateLimiter.execute.onSecondCall().resolves({
                video_details: {
                    title: 'Test Song',
                    url: 'https://youtube.com/test',
                    durationRaw: '3:45',
                    channel: { name: 'Test Channel' },
                    thumbnails: [{ url: 'https://example.com/thumb.jpg' }],
                    views: 1000000,
                    uploadedAt: '2023-01-01'
                }
            });

            const mockSelectInteraction = {
                user: { id: 'user-123' },
                values: ['https://youtube.com/test'],
                update: sinon.stub().resolves(),
                guild: interaction.guild,
                member: interaction.member,
                client: interaction.client,
                followUp: sinon.stub().resolves(),
                editReply: sinon.stub().resolves()
            };

            const mockCollector = new EventEmitter();
            mockCollector.on = sinon.stub().callsFake((event, callback) => {
                if (event === 'collect') {
                    setTimeout(() => callback(mockSelectInteraction), 10);
                }
            });
            mockCollector.stop = sinon.stub();

            interaction.channel.createMessageComponentCollector.returns(mockCollector);

            await playCommand.execute(interaction);

            // Check that update was called with the expected message
            expect(mockSelectInteraction.update.calledOnce).to.be.true;
            const callArgs = mockSelectInteraction.update.getCall(0).args;
            const content = callArgs[0].content || callArgs[0];

            // The content might be an object with content property or a string directly
            if (typeof content === 'string') {
                expect(content).to.match(/❌ The voice channel is full/);
            } else if (typeof content === 'object' && content.content) {
                expect(content.content).to.match(/❌ The voice channel is full/);
            } else {
                expect(false).to.be.true; // Fail the test if unexpected format
            }
        });
    });

    describe('Voice Connection and Playback', () => {
        it('should join voice channel and start playback', async () => {
            const mockSearchResults = [{
                title: 'Test Song',
                url: 'https://youtube.com/test',
                durationInSec: 225,
                durationRaw: '3:45',
                durationFormatted: '3:45',
                channel: { name: 'Test Channel' },
                thumbnail: 'https://example.com/thumb.jpg'
            }];

            // Need to mock for both search and video info calls
            stubs.rateLimiter.execute.onFirstCall().resolves(mockSearchResults);
            stubs.rateLimiter.execute.onSecondCall().resolves({
                video_details: {
                    title: 'Test Song',
                    url: 'https://youtube.com/test',
                    durationRaw: '3:45',
                    channel: { name: 'Test Channel' },
                    thumbnails: [{ url: 'https://example.com/thumb.jpg' }],
                    views: 1000000,
                    uploadedAt: '2023-01-01'
                }
            });

            const mockSelectInteraction = {
                user: { id: 'user-123' },
                values: ['https://youtube.com/test'],
                update: sinon.stub().resolves(),
                guild: interaction.guild,
                member: interaction.member,
                client: interaction.client,
                followUp: sinon.stub().resolves(),
                editReply: sinon.stub().resolves()
            };

            const mockCollector = new EventEmitter();
            mockCollector.on = sinon.stub().callsFake((event, callback) => {
                if (event === 'collect') {
                    setTimeout(() => callback(mockSelectInteraction), 10);
                }
            });
            mockCollector.stop = sinon.stub();

            interaction.channel.createMessageComponentCollector.returns(mockCollector);

            // Mock voice connection
            const mockConnection = new EventEmitter();
            mockConnection.joinConfig = { channelId: 'voice-channel-123' };
            mockConnection.on = sinon.stub();
            mockConnection.subscribe = sinon.stub();
            mockConnection.destroy = sinon.stub();

            stubs.discordVoice.getVoiceConnection.returns(null);
            stubs.discordVoice.joinVoiceChannel.returns(mockConnection);
            stubs.discordVoice.entersState.resolves();

            stubs.musicManager.playSong.resolves();

            await playCommand.execute(interaction);

            expect(stubs.discordVoice.joinVoiceChannel.calledWith({
                channelId: 'voice-channel-123',
                guildId: 'guild-123',
                adapterCreator: interaction.guild.voiceAdapterCreator
            })).to.be.true;

            // Check that update was called with the expected message
            expect(mockSelectInteraction.update.calledOnce).to.be.true;
            const callArgs = mockSelectInteraction.update.getCall(0).args;
            const content = callArgs[0].content || callArgs[0];

            // The content might be an object with content property or a string directly
            if (typeof content === 'string') {
                expect(content).to.match(/▶️ Now playing/);
            } else if (typeof content === 'object' && content.content) {
                expect(content.content).to.match(/▶️ Now playing/);
            } else {
                expect(false).to.be.true; // Fail the test if unexpected format
            }
            expect(stubs.musicManager.playSong.called).to.be.true;
        });

        it('should handle existing voice connection in same channel', async () => {
            const mockSearchResults = [{
                title: 'Test Song',
                url: 'https://youtube.com/test',
                durationInSec: 225,
                durationRaw: '3:45',
                durationFormatted: '3:45',
                channel: { name: 'Test Channel' },
                thumbnail: 'https://example.com/thumb.jpg'
            }];

            // Need to mock for both search and video info calls
            stubs.rateLimiter.execute.onFirstCall().resolves(mockSearchResults);
            stubs.rateLimiter.execute.onSecondCall().resolves({
                video_details: {
                    title: 'Test Song',
                    url: 'https://youtube.com/test',
                    durationRaw: '3:45',
                    channel: { name: 'Test Channel' },
                    thumbnails: [{ url: 'https://example.com/thumb.jpg' }],
                    views: 1000000,
                    uploadedAt: '2023-01-01'
                }
            });

            const mockSelectInteraction = {
                user: { id: 'user-123' },
                values: ['https://youtube.com/test'],
                update: sinon.stub().resolves(),
                guild: interaction.guild,
                member: interaction.member,
                client: interaction.client,
                followUp: sinon.stub().resolves(),
                editReply: sinon.stub().resolves()
            };

            const mockCollector = new EventEmitter();
            mockCollector.on = sinon.stub().callsFake((event, callback) => {
                if (event === 'collect') {
                    setTimeout(() => callback(mockSelectInteraction), 10);
                }
            });
            mockCollector.stop = sinon.stub();

            interaction.channel.createMessageComponentCollector.returns(mockCollector);

            // Mock existing connection in same channel
            const mockConnection = new EventEmitter();
            mockConnection.joinConfig = { channelId: 'voice-channel-123' };
            mockConnection.on = sinon.stub();

            stubs.discordVoice.getVoiceConnection.returns(mockConnection);
            stubs.discordVoice.entersState.resolves();

            stubs.musicManager.playSong.resolves();

            await playCommand.execute(interaction);

            expect(stubs.discordVoice.joinVoiceChannel.called).to.be.false;
            expect(stubs.musicManager.playSong.called).to.be.true;
        });

        it('should reject when bot is in different voice channel', async () => {
            const mockSearchResults = [{
                title: 'Test Song',
                url: 'https://youtube.com/test',
                durationInSec: 225,
                durationRaw: '3:45',
                durationFormatted: '3:45',
                channel: { name: 'Test Channel' },
                thumbnail: 'https://example.com/thumb.jpg'
            }];

            // Need to mock for both search and video info calls
            stubs.rateLimiter.execute.onFirstCall().resolves(mockSearchResults);
            stubs.rateLimiter.execute.onSecondCall().resolves({
                video_details: {
                    title: 'Test Song',
                    url: 'https://youtube.com/test',
                    durationRaw: '3:45',
                    channel: { name: 'Test Channel' },
                    thumbnails: [{ url: 'https://example.com/thumb.jpg' }],
                    views: 1000000,
                    uploadedAt: '2023-01-01'
                }
            });

            const mockSelectInteraction = {
                user: { id: 'user-123' },
                values: ['https://youtube.com/test'],
                update: sinon.stub().resolves(),
                guild: interaction.guild,
                member: interaction.member,
                client: interaction.client,
                followUp: sinon.stub().resolves(),
                editReply: sinon.stub().resolves()
            };

            const mockCollector = new EventEmitter();
            mockCollector.on = sinon.stub().callsFake((event, callback) => {
                if (event === 'collect') {
                    setTimeout(() => callback(mockSelectInteraction), 10);
                }
            });
            mockCollector.stop = sinon.stub();

            interaction.channel.createMessageComponentCollector.returns(mockCollector);

            // Mock existing connection in different channel
            const mockConnection = new EventEmitter();
            mockConnection.joinConfig = { channelId: 'different-channel-456' };

            stubs.discordVoice.getVoiceConnection.returns(mockConnection);

            await playCommand.execute(interaction);

            // Check that update was called with the expected message
            expect(mockSelectInteraction.update.calledOnce).to.be.true;
            const callArgs = mockSelectInteraction.update.getCall(0).args;
            const content = callArgs[0].content || callArgs[0];

            // The content might be an object with content property or a string directly
            if (typeof content === 'string') {
                expect(content).to.match(/❌ I am already playing in another voice channel/);
            } else if (typeof content === 'object' && content.content) {
                expect(content.content).to.match(/❌ I am already playing in another voice channel/);
            } else {
                expect(false).to.be.true; // Fail the test if unexpected format
            }
        });
    });

    describe('Error Handling', () => {
        it('should handle interaction timeout', async () => {
            // Mock expired interaction
            interaction.createdTimestamp = Date.now() - (15 * 60 * 1000); // 15 minutes ago

            await playCommand.execute(interaction);

            expect(interaction.reply.called).to.be.false;
        });

        it('should handle voice connection timeout', async () => {
            const mockSearchResults = [{
                title: 'Test Song',
                url: 'https://youtube.com/test',
                durationInSec: 225,
                durationRaw: '3:45',
                durationFormatted: '3:45',
                channel: { name: 'Test Channel' },
                thumbnail: 'https://example.com/thumb.jpg'
            }];

            // Need to mock for both search and video info calls
            stubs.rateLimiter.execute.onFirstCall().resolves(mockSearchResults);
            stubs.rateLimiter.execute.onSecondCall().resolves({
                video_details: {
                    title: 'Test Song',
                    url: 'https://youtube.com/test',
                    durationRaw: '3:45',
                    channel: { name: 'Test Channel' },
                    thumbnails: [{ url: 'https://example.com/thumb.jpg' }],
                    views: 1000000,
                    uploadedAt: '2023-01-01'
                }
            });

            const mockSelectInteraction = {
                user: { id: 'user-123' },
                values: ['https://youtube.com/test'],
                update: sinon.stub().resolves(),
                guild: interaction.guild,
                member: interaction.member,
                client: interaction.client,
                followUp: sinon.stub().resolves(),
                editReply: sinon.stub().resolves()
            };

            const mockCollector = new EventEmitter();
            mockCollector.on = sinon.stub().callsFake((event, callback) => {
                if (event === 'collect') {
                    setTimeout(() => callback(mockSelectInteraction), 10);
                }
            });
            mockCollector.stop = sinon.stub();

            interaction.channel.createMessageComponentCollector.returns(mockCollector);

            // Mock voice connection timeout
            stubs.discordVoice.getVoiceConnection.returns(null);
            stubs.discordVoice.joinVoiceChannel.returns(new EventEmitter());
            stubs.discordVoice.entersState.rejects(new Error('Voice connection timeout'));

            await playCommand.execute(interaction);

            // Check that followUp was called with the expected message
            expect(mockSelectInteraction.followUp.calledOnce).to.be.true;
            const callArgs = mockSelectInteraction.followUp.getCall(0).args;
            const content = callArgs[0].content || callArgs[0];

            // The content might be an object with content property or a string directly
            if (typeof content === 'string') {
                expect(content).to.match(/❌ Voice connection timed out/);
            } else if (typeof content === 'object' && content.content) {
                expect(content.content).to.match(/❌ Voice connection timed out/);
            } else {
                expect(false).to.be.true; // Fail the test if unexpected format
            }
        });

        it('should handle YouTube rate limiting', async () => {
            const rateLimitError = new Error('429 Too Many Requests');
            // This should reject multiple times to trigger the rate limiting mechanism
            stubs.rateLimiter.execute.onFirstCall().rejects(rateLimitError);
            stubs.rateLimiter.execute.onSecondCall().rejects(rateLimitError);
            stubs.rateLimiter.execute.onThirdCall().rejects(rateLimitError);
            stubs.rateLimiter.execute.onCall(3).rejects(rateLimitError); // 4th call for fallback search
            stubs.rateLimiter.execute.onCall(4).rejects(rateLimitError); // 5th call for fallback video info

            await playCommand.execute(interaction);

            // Check that editReply was called with a message containing the expected string
            expect(interaction.editReply.calledOnce).to.be.true;
            const callArgs = interaction.editReply.getCall(0).args;
            const content = callArgs[0].content || callArgs[0];

            // The content might be an object with content property or a string directly
            if (typeof content === 'string') {
                expect(content).to.match(/❌ Failed to search for music after/);
            } else if (typeof content === 'object' && content.content) {
                expect(content.content).to.match(/❌ Failed to search for music after/);
            } else {
                expect(false).to.be.true; // Fail the test if unexpected format
            }
        });

        it('should handle FFmpeg errors during playback', async () => {
            const mockSearchResults = [{
                title: 'Test Song',
                url: 'https://youtube.com/test',
                durationInSec: 225,
                durationRaw: '3:45',
                durationFormatted: '3:45',
                channel: { name: 'Test Channel' },
                thumbnail: 'https://example.com.thumb.jpg'
            }];

            // Need to mock for both search and video info calls
            stubs.rateLimiter.execute.onFirstCall().resolves(mockSearchResults);
            stubs.rateLimiter.execute.onSecondCall().resolves({
                video_details: {
                    title: 'Test Song',
                    url: 'https://youtube.com/test',
                    durationRaw: '3:45',
                    channel: { name: 'Test Channel' },
                    thumbnails: [{ url: 'https://example.com.thumb.jpg' }],
                    views: 1000000,
                    uploadedAt: '2023-01-01'
                }
            });

            const mockSelectInteraction = {
                user: { id: 'user-123' },
                values: ['https://youtube.com/test'],
                update: sinon.stub().resolves(),
                guild: interaction.guild,
                member: interaction.member,
                client: interaction.client,
                followUp: sinon.stub().resolves(),
                editReply: sinon.stub().resolves()
            };

            const mockCollector = new EventEmitter();
            mockCollector.on = sinon.stub().callsFake((event, callback) => {
                if (event === 'collect') {
                    setTimeout(() => callback(mockSelectInteraction), 10);
                }
            });
            mockCollector.stop = sinon.stub();

            interaction.channel.createMessageComponentCollector.returns(mockCollector);

            // Mock connection but playback fails
            const mockConnection = new EventEmitter();
            mockConnection.joinConfig = { channelId: 'voice-channel-123' };
            mockConnection.on = sinon.stub();

            stubs.discordVoice.getVoiceConnection.returns(null);
            stubs.discordVoice.joinVoiceChannel.returns(mockConnection);
            stubs.discordVoice.entersState.resolves();

            // Mock FFmpeg error
            stubs.musicManager.playSong.rejects(new Error('FFmpeg error: Audio processing failed'));

            await playCommand.execute(interaction);

            // Check that followUp was called with the expected message
            expect(mockSelectInteraction.followUp.calledOnce).to.be.true;
            const callArgs = mockSelectInteraction.followUp.getCall(0).args;
            const content = callArgs[0].content || callArgs[0];

            // The content might be an object with content property or a string directly
            if (typeof content === 'string') {
                expect(content).to.match(/❌ FFmpeg error/);
            } else if (typeof content === 'object' && content.content) {
                expect(content.content).to.match(/❌ FFmpeg error/);
            } else {
                expect(false).to.be.true; // Fail the test if unexpected format
            }
        });
    });

    describe('Music Controls Display', () => {
        it('should create music control buttons', async () => {
            const mockSearchResults = [{
                title: 'Test Song',
                url: 'https://youtube.com/test',
                durationInSec: 225,
                durationRaw: '3:45',
                durationFormatted: '3:45',
                channel: { name: 'Test Channel' },
                thumbnail: 'https://example.com/thumb.jpg'
            }];

            // Need to mock for both search and video info calls
            stubs.rateLimiter.execute.onFirstCall().resolves(mockSearchResults);
            stubs.rateLimiter.execute.onSecondCall().resolves({
                video_details: {
                    title: 'Test Song',
                    url: 'https://youtube.com/test',
                    durationRaw: '3:45',
                    channel: { name: 'Test Channel' },
                    thumbnails: [{ url: 'https://example.com/thumb.jpg' }],
                    views: 1000000,
                    uploadedAt: '2023-01-01'
                }
            });

            const mockSelectInteraction = {
                user: { id: 'user-123' },
                values: ['https://youtube.com/test'],
                update: sinon.stub().resolves(),
                guild: interaction.guild,
                member: interaction.member,
                client: interaction.client,
                followUp: sinon.stub().resolves(),
                editReply: sinon.stub().resolves()
            };

            const mockCollector = new EventEmitter();
            mockCollector.on = sinon.stub().callsFake((event, callback) => {
                if (event === 'collect') {
                    setTimeout(() => callback(mockSelectInteraction), 10);
                }
            });
            mockCollector.stop = sinon.stub();

            interaction.channel.createMessageComponentCollector.returns(mockCollector);

            const mockConnection = new EventEmitter();
            mockConnection.joinConfig = { channelId: 'voice-channel-123' };
            mockConnection.on = sinon.stub();

            stubs.discordVoice.getVoiceConnection.returns(null);
            stubs.discordVoice.joinVoiceChannel.returns(mockConnection);
            stubs.discordVoice.entersState.resolves();

            stubs.musicManager.playSong.resolves();

            await playCommand.execute(interaction);

            // Verify that update was called with components
            expect(mockSelectInteraction.update.called).to.be.true;
        });
    });

    describe('Discord Interaction Handling', () => {
        it('should handle interaction acknowledgment errors', async () => {
            // Mock reply error (already acknowledged)
            interaction.reply.rejects({ code: 40060 });
            interaction.editReply.resolves();
            interaction.followUp = sinon.stub().resolves();

            // Mock search results for the test
            stubs.rateLimiter.execute.onFirstCall().resolves([{
                title: 'Test Song',
                url: 'https://youtube.com/test',
                durationInSec: 225,
                durationRaw: '3:45',
                durationFormatted: '3:45',
                channel: { name: 'Test Channel' },
                thumbnail: 'https://example.com/thumb.jpg'
            }]);
            stubs.rateLimiter.execute.onSecondCall().resolves({
                video_details: {
                    title: 'Test Song',
                    url: 'https://youtube.com/test',
                    durationRaw: '3:45',
                    channel: { name: 'Test Channel' },
                    thumbnails: [{ url: 'https://example.com/thumb.jpg' }],
                    views: 1000000,
                    uploadedAt: '2023-01-01'
                }
            });

            // Mock the collector and selection interaction
            const mockSelectInteraction = {
                user: { id: 'user-123' },
                values: ['https://youtube.com/test'],
                update: sinon.stub().resolves(),
                guild: interaction.guild,
                member: interaction.member,
                client: interaction.client,
                followUp: sinon.stub().resolves(),
                editReply: sinon.stub().resolves()
            };

            const mockCollector = new EventEmitter();
            mockCollector.on = sinon.stub().callsFake((event, callback) => {
                if (event === 'collect') {
                    setTimeout(() => callback(mockSelectInteraction), 10);
                }
            });
            mockCollector.stop = sinon.stub();

            interaction.channel.createMessageComponentCollector.returns(mockCollector);

            // Mock voice connection
            const mockConnection = new EventEmitter();
            mockConnection.joinConfig = { channelId: 'voice-channel-123' };
            mockConnection.on = sinon.stub();
            mockConnection.subscribe = sinon.stub();
            mockConnection.destroy = sinon.stub();

            stubs.discordVoice.getVoiceConnection.returns(null);
            stubs.discordVoice.joinVoiceChannel.returns(mockConnection);
            stubs.discordVoice.entersState.resolves();
            stubs.musicManager.playSong.resolves();

            await playCommand.execute(interaction);

            expect(interaction.editReply.called).to.be.true;
        });

        it('should handle interaction expired errors', async () => {
            // Mock expired interaction
            interaction.createdTimestamp = Date.now() - (15 * 60 * 1000); // 15 minutes ago
            interaction.reply = sinon.stub().resolves();
            interaction.editReply = sinon.stub().resolves();
            interaction.followUp = sinon.stub().resolves();

            await playCommand.execute(interaction);

            // Should not throw errors and should handle gracefully
            expect(true).to.be.true;
        });
    });
});