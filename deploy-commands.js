const { REST, Routes } = require('discord.js');
const { readdirSync } = require('fs');
const path = require('path');
require('dotenv').config();

const commands = [];
const commandFolders = readdirSync(path.join(__dirname, 'src/commands'));

for (const folder of commandFolders) {
    const commandFiles = readdirSync(path.join(__dirname, `src/commands/${folder}`)).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(`./src/commands/${folder}/${file}`);
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
        } else {
            console.log(`[WARNING] The command at ${file} is missing a required "data" or "execute" property.`);
        }
    }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // The put method is used to fully refresh all commands in the guild with the current set
        // Note: For global commands (available in all servers), use Routes.applicationCommands(clientId)
        // But for development, guild commands update instantly.

        // We need the Client ID. Since we are in a standalone script, we need to fetch it or hardcode it.
        // Let's assume the user puts CLIENT_ID in .env or we can parse it from the token?
        // Better option: Just ask the user to add CLIENT_ID to .env or use the main bot file to deploy on ready.
        // For simplicity in this step, I will create a separate deploy script that requires CLIENT_ID.

        if (!process.env.CLIENT_ID || !process.env.GUILD_ID) {
            console.error('[ERROR] CLIENT_ID or GUILD_ID is missing in .env file.');
            process.exit(1);
        }

        // Use applicationGuildCommands for instant updates in development
        const data = await rest.put(
            Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands for Guild ${process.env.GUILD_ID}.`);
    } catch (error) {
        console.error(error);
    }
})();
