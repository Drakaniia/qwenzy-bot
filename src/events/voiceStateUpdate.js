const { getVoiceConnection } = require('@discordjs/voice');

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState) {
        // Check if the bot left a voice channel
        if (oldState.channelId && !newState.channelId && newState.member.user.bot) {
            const connection = getVoiceConnection(oldState.guild.id);
            if (connection) {
                connection.destroy();
                console.log(`Bot left voice channel in ${oldState.guild.name}`);
            }
        }

        // Check if all users left the voice channel and bot is alone
        if (newState.channel && newState.channel.members.size === 1 && newState.channel.members.first().user.bot) {
            const connection = getVoiceConnection(newState.guild.id);
            if (connection) {
                setTimeout(() => {
                    const channel = newState.channel;
                    if (channel.members.size === 1 && channel.members.first().user.bot) {
                        connection.destroy();
                        console.log(`Bot left empty voice channel in ${newState.guild.name}`);
                    }
                }, 30000); // Wait 30 seconds before leaving
            }
        }
    },
};