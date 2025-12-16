const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Select a member and kick them (real programming style).')
        .addUserOption(option =>
            option
                .setName('target')
                .setDescription('The member to kick')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    async execute(interaction) {
        const member = interaction.options.getMember('target');

        if (!member) {
            return interaction.reply({ content: 'Target not found in this memory segment.', ephemeral: true });
        }

        try {
            await member.kick();
            await interaction.reply(`🗑️ **${member.user.tag}** has been garbage collected (kicked).`);
        } catch (error) {
            await interaction.reply({ content: 'Error: Permission denied. Sudo access required (I cannot kick this user).', ephemeral: true });
        }
    },
};
