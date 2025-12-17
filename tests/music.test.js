const { expect } = require('chai');
const sinon = require('sinon');
const proxyquire = require('proxyquire').noCallThru();

describe('Music Commands (Lavalink/Riffy)', () => {
    let interaction;

    beforeEach(() => {
        interaction = {
            member: {
                voice: {
                    channel: {
                        id: 'voice-channel-123',
                        permissionsFor: sinon.stub().returns({
                            has: sinon.stub().returns(true)
                        })
                    }
                }
            },
            guild: { id: 'guild-123' },
            channel: { id: 'text-channel-123' },
            client: { user: { setActivity: sinon.stub() } },
            options: {
                getString: sinon.stub().returns('test song'),
                getInteger: sinon.stub().returns(null),
            },
            user: { id: 'user-123' },
            reply: sinon.stub().resolves(),
            editReply: sinon.stub().resolves(),
        };
    });

    afterEach(() => sinon.restore());

    it('/play should error when user is not in a voice channel', async () => {
        interaction.member.voice.channel = null;

        const musicManager = {
            search: sinon.stub(),
        };

        const playCommand = proxyquire('../src/commands/music/play', {
            '../../modules/musicManager': musicManager,
        });

        await playCommand.execute(interaction);

        expect(interaction.reply.calledOnce).to.equal(true);
        const arg = interaction.reply.firstCall.args[0];
        expect(arg.content).to.match(/need to be in a voice channel/i);
    });

    it('/play should show no results when Lavalink returns 0 tracks', async () => {
        const musicManager = {
            search: sinon.stub().resolves({ loadType: 'search', tracks: [] }),
        };

        const playCommand = proxyquire('../src/commands/music/play', {
            '../../modules/musicManager': musicManager,
        });

        await playCommand.execute(interaction);

        expect(musicManager.search.calledOnce).to.equal(true);
        expect(interaction.editReply.calledOnce).to.equal(true);
        const arg = interaction.editReply.firstCall.args[0];
        expect(arg.content).to.match(/no results/i);
    });

    it('/pause should call musicManager.pause', async () => {
        const musicManager = {
            getPlayer: sinon.stub().returns({ paused: false }),
            pause: sinon.stub().returns(true),
            getCurrentTrack: sinon.stub().returns({ info: { title: 'Track A' } }),
        };

        const pauseCommand = proxyquire('../src/commands/music/pause', {
            '../../modules/musicManager': musicManager,
        });

        await pauseCommand.execute(interaction);

        expect(musicManager.pause.calledWith('guild-123')).to.equal(true);
        expect(interaction.reply.calledOnce).to.equal(true);
    });

    it('/resume should call musicManager.resume', async () => {
        const musicManager = {
            getPlayer: sinon.stub().returns({ paused: true }),
            resume: sinon.stub().returns(true),
            getCurrentTrack: sinon.stub().returns({ info: { title: 'Track A' } }),
        };

        const resumeCommand = proxyquire('../src/commands/music/resume', {
            '../../modules/musicManager': musicManager,
        });

        await resumeCommand.execute(interaction);

        expect(musicManager.resume.calledWith('guild-123')).to.equal(true);
        expect(interaction.reply.calledOnce).to.equal(true);
    });

    it('/skip should call musicManager.skip', async () => {
        const musicManager = {
            getPlayer: sinon.stub().returns({}),
            skip: sinon.stub().resolves(true),
        };

        const skipCommand = proxyquire('../src/commands/music/skip', {
            '../../modules/musicManager': musicManager,
        });

        await skipCommand.execute(interaction);

        expect(musicManager.skip.calledWith('guild-123')).to.equal(true);
        expect(interaction.reply.calledOnce).to.equal(true);
    });

    it('/queue should respond empty if no current track and no queue', async () => {
        const musicManager = {
            getCurrentTrack: sinon.stub().returns(null),
            getQueue: sinon.stub().returns([]),
        };

        const queueCommand = proxyquire('../src/commands/music/queue', {
            '../../modules/musicManager': musicManager,
        });

        await queueCommand.execute(interaction);

        const arg = interaction.reply.firstCall.args[0];
        expect(arg.content).to.match(/queue is empty/i);
    });

    it('/volume should error if there is no active player', async () => {
        const musicManager = {
            getPlayer: sinon.stub().returns(null),
        };

        const volumeCommand = proxyquire('../src/commands/music/volume', {
            '../../modules/musicManager': musicManager,
        });

        await volumeCommand.execute(interaction);
        const arg = interaction.reply.firstCall.args[0];
        expect(arg.content).to.match(/no active player/i);
    });
});
