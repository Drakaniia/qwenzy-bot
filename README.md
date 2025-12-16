# Qweny Bot 🤖

Qweny is a Discord bot built with Node.js and `discord.js`. It features a "Programming Humor" personality and offers moderation, economy, and AI capabilities.

## Features
- **General**: `/ping` (Latency check), `/ask` (AI Chat powered by Gemini).
- **Fun**: `/joke` (Programming jokes).
- **Moderation**: `/kick` (Kick users with style).
- **Economy**: `/balance`, `/work` (Simple economy system).

## Setup
1.  Clone the repository.
2.  Run `npm install`.
3.  Create a `.env` file (see `.env.example` or Setup Guide).
4.  Run `node deploy-commands.js` to register commands.
5.  Run `node index.js` to start the bot.

## Documentation
See [docs/setup_guide.md](docs/setup_guide.md) for the detailed story of how this bot was created.

## Deployment

### Deploying on Render

1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Set the build command to: `npm install`
4. Set the start command to: `npm start`
5. Add the required environment variables:
   - `DISCORD_TOKEN`: Your Discord bot token
   - `CLIENT_ID`: Your Discord application client ID
   - `GUILD_ID`: Your Discord guild/server ID (if needed)
   - `GEMINI_API_KEY`: Your Google Generative AI API key (if applicable)

### Deploying on Railway

1. Create a new project on Railway
2. Connect your GitHub repository or upload your code
3. Railway will automatically detect the Node.js project
4. Add the required environment variables in the Environment Variables section

For optimal uptime with free hosting services, consider using dedicated Discord bot hosting platforms like Wispbyte or Bot-Hosting.net which are designed specifically for keeping Discord bots online 24/7.

### Environment Variables

Make sure to set these environment variables on your hosting platform:

- `DISCORD_TOKEN` - Your Discord bot token
- `CLIENT_ID` - Your Discord application client ID
- `GUILD_ID` - Your Discord server ID (if using slash commands in a specific server)
- `GEMINI_API_KEY` - Your Google Generative AI API key
