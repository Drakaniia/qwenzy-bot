const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const token = process.env.DISCORD_TOKEN;

if (!clientId || !token) {
    console.error('❌ Missing required environment variables: CLIENT_ID or DISCORD_TOKEN');
    process.exit(1);
}

// Refresh slash commands
async function refreshCommands() {
    const rest = new REST().setToken(token);

    try {
        console.log('🔄 Refreshing slash commands...');

        // Load commands
        const commands = [];
        const foldersPath = path.join(__dirname, 'src/commands');
        const commandFolders = fs.readdirSync(foldersPath);

        for (const folder of commandFolders) {
            const commandsPath = path.join(foldersPath, folder);
            const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
            
            for (const file of commandFiles) {
                const filePath = path.join(commandsPath, file);
                const command = require(filePath);
                
                if ('data' in command && 'execute' in command) {
                    commands.push(command.data.toJSON());
                } else {
                    console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
                }
            }
        }

        console.log(`📋 Found ${commands.length} commands to register`);

        // Deploy commands globally (this replaces all existing commands)
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands }
        );

        console.log('✅ Successfully reloaded slash commands!');

        // Also deploy to the specific guild if provided (for faster propagation in development)
        if (guildId) {
            await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands }
            );
            console.log(`✅ Also registered commands in guild: ${guildId}`);
        }

        console.log('\n💡 If button interactions still don\'t work:');
        console.log('1. Make sure your bot was invited with the "applications.commands" scope');
        console.log('2. Check that privileged intents are enabled in Developer Portal');
        console.log('3. Ensure your bot has the "View Channel", "Send Messages", and "Read Message History" permissions');
        console.log('\n🔗 Use this invite link to ensure proper permissions:');
        console.log(`https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=37088768&scope=bot%20applications.commands`);
        
    } catch (error) {
        console.error('❌ Error refreshing commands:', error);
    }
}

refreshCommands();