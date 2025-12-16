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

### Deploying on Wispbyte (Recommended for 24/7 uptime)

Wispbyte is recommended as the best option for free 24/7 Discord bot hosting. Follow these steps:

1. Prepare your project files:
   - Make sure all dependencies are listed in `package.json`
   - Create a zip archive of your project (excluding `node_modules` and `.git`)

2. Go to [Wispbyte](https://wispbyte.com/free-discord-bot-hosting)

3. Upload your zipped project file

4. Add your environment variables:
   - `DISCORD_TOKEN`: Your Discord bot token
   - `CLIENT_ID`: Your Discord application client ID
   - `GUILD_ID`: Your Discord guild/server ID (if needed)
   - `GEMINI_API_KEY`: Your Google Generative AI API key (if applicable)

5. Start your bot through the Wispbyte dashboard

### Environment Variables

Make sure to set these environment variables on Wispbyte:

- `DISCORD_TOKEN` - Your Discord bot token
- `CLIENT_ID` - Your Discord application client ID
- `GUILD_ID` - Your Discord server ID (if using slash commands in a specific server)
- `GEMINI_API_KEY` - Your Google Generative AI API key

Wispbyte is designed specifically for Discord bots and will keep yours online 24/7 without sleeping, making it the optimal free solution for persistent bot hosting.
