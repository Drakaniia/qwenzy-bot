const musicManager = require('../modules/musicManager');

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        if (oldState.channelId && !newState.channelId && newState.member.user.bot) {
            const player = musicManager.getPlayer(oldState.guild.id);
            if (player) {
                player.destroy();
                console.log(`Bot left voice channel in ${oldState.guild.name}`);
            }
        }

        if (newState.channel && newState.channel.members.size === 1 && newState.channel.members.first().user.bot) {
            const player = musicManager.getPlayer(newState.guild.id);
            if (player) {
                setTimeout(() => {
                    const channel = newState.channel;
                    if (channel.members.size === 1 && channel.members.first().user.bot) {
                        const playerCheck = musicManager.getPlayer(newState.guild.id);
                        if (playerCheck) {
                            playerCheck.destroy();
                            console.log(`Bot left empty voice channel in ${newState.guild.name}`);
                        }
                    }
                }, 30000);
            }
        }
    },
};