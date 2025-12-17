# Qweny Bot

Qweny is a feature-rich Discord bot built with Node.js and `discord.js`. It features a "Programming Humor" personality and offers music, economy, AI capabilities, and more!

## Music Commands
- **`/play <query>`** - Search for music on YouTube and select to play directly
- **`/pause`** - Pause the current playing music
- **`/resume`** - Resume the paused music
- **`/skip`** - Skip the current song and disconnect
- **`/stop`** - Stop the music and leave the voice channel

## General Commands
- **`/ping`** - Check bot latency
- **`/ask <question>`** - Ask questions to the AI (supports both Google Gemini and Groq API)

## Fun Commands
- **`/joke`** - Get a programming joke

## Economy Commands
- **`/balance`** - Check your current balance
- **`/work`** - Earn money by working

## Setup Instructions

### Prerequisites
- Node.js 18 or higher
- Discord Bot Token
- Google Gemini API Key or Groq API Key (optional, for AI features)

### Local Setup
1. **Clone the repository**
   ```bash
   git clone https://github.com/Drakaniia/qwenzy-bot.git
   cd qwenzy-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment variables**
   Create a `.env` file in the root directory:
   ```env
   DISCORD_TOKEN=your_discord_bot_token
   CLIENT_ID=your_discord_application_client_id
   GUILD_ID=your_discord_server_id

   # Lavalink (recommended for stable music playback)
   LAVALINK_HOST=localhost
   LAVALINK_PORT=2333
   LAVALINK_PASSWORD=youshallnotpass
   LAVALINK_SECURE=false
   LAVALINK_SEARCH_PREFIX=ytsearch

   GEMINI_API_KEY=your_google_gemini_api_key
   BOT_AVATAR_URL=optional_avatar_url
   ```

4. **(Recommended) Start Lavalink locally**
   This repo includes a ready-to-run Lavalink v4 node via docker-compose:
   ```bash
   docker compose up -d lavalink
   ```

5. **Deploy slash commands**
   ```bash
   node deploy-commands.js
   ```

6. **Start the bot**
   ```bash
   npm start
   ```

## Environment Variables

### Required
- `DISCORD_TOKEN` - Your Discord bot token from the Discord Developer Portal
- `CLIENT_ID` - Your Discord application client ID

### Optional but Recommended
- `GUILD_ID` - Your Discord server ID for faster command deployment
- `GEMINI_API_KEY` - Google Generative AI API key for AI chat features (optional)
- `GROQ_API_KEY` - Groq API key for AI chat features (alternative to Gemini, optional)
- `BOT_AVATAR_URL` - URL for bot avatar image

## Deployment Options

### Render (Recommended Setup)

#### Step 1: Deploy Lavalink Service
1. Create a new **Web Service** on Render
2. Select "Docker" as the environment
3. Connect your GitHub repository
4. **Dockerfile Path**: `lavalink.Dockerfile`
5. **Service Name**: `qwenzy-lavalink` (or your preferred name)
6. Set environment variables:
   - `PORT=2333`
7. Note the internal service URL (e.g., `qwenzy-lavalink:2333`)

#### Step 2: Deploy Bot Service
1. Create another new **Web Service** on Render
2. Connect your GitHub repository
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`
5. Add environment variables:
   - `DISCORD_TOKEN=your_discord_bot_token`
   - `CLIENT_ID=your_discord_application_client_id`
   - `GUILD_ID=your_discord_server_id`
   - `LAVALINK_HOST=qwenzy-lavalink` (use your Lavalink service name)
   - `LAVALINK_PORT=2333`
   - `LAVALINK_PASSWORD=youshallnotpass`
   - `LAVALINK_SECURE=false`
   - `LAVALINK_SEARCH_PREFIX=ytsearch`
   - `GEMINI_API_KEY=your_google_gemini_api_key` (optional)
   - `GROQ_API_KEY=your_groq_api_key` (alternative to Gemini, optional)

**Important**: Both services must be in the same Render project to communicate via internal URLs.

### Railway
1. Create a new project on Railway
2. Connect your GitHub repository
3. Add environment variables in the dashboard
4. Railway will automatically detect and deploy the Node.js application

### Docker
```bash
docker build -t qweny-bot .
docker run -d --env-file .env --name qweny-bot qweny-bot
```

Or using docker-compose:
```bash
docker-compose up -d
```

## Music Features

The music system includes:
- **Lavalink (recommended)**: Stable playback via a local/remote Lavalink node (configured via env vars)
- **Search + Select UI**: Search for tracks and pick from a dropdown
- **Voice Channel Management**: Automatic permission checking and connection management
- **Playback Controls**: Pause, resume, skip, stop, queue, volume, loop, shuffle
- **Status Updates**: Bot status updates to show currently playing track

### How to Use Music Commands
1. Join a voice channel
2. Use `/play your song query` to search for music
3. Select from the dropdown menu that appears
4. The music will play in your voice channel
5. Use `/pause`, `/resume`, `/skip`, or `/stop` to control playback

## Bot Configuration

### Discord Bot Permissions
Make sure your bot has these permissions:
- `Connect` - Join voice channels
- `Speak` - Play audio
- `View Channel` - View voice channels
- `Read Messages` - Read channel messages
- `Send Messages` - Send messages
- `Embed Links` - Send rich embeds
- `Use External Emojis` - Use custom emojis
- `Manage Channels` (optional) - For advanced voice features

### Intents Required
The bot requires these Discord intents:
- `Guilds`
- `GuildMessages`
- `MessageContent`
- `GuildVoiceStates`

## Documentation
- [Detailed Setup Guide](docs/setup_guide.md) - Step-by-step creation story
- [Discord.js Documentation](https://discord.js.org/) - Framework documentation
- [Lavalink Documentation](https://lavalink.dev/) - Music server documentation

## Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Troubleshooting

### Common Issues
- **Commands not registering**: Ensure you've run `node deploy-commands.js`
- **"No nodes are available" error**: 
  - Check that your Lavalink service is running
  - Verify `LAVALINK_HOST` points to the correct service (use service name for Render, `localhost` for local)
  - Ensure both bot and Lavalink services are in the same Render project
  - Check Lavalink logs for connection errors
- **Music not playing**: 
  - Verify bot has voice permissions in the channel
  - Ensure you're in a voice channel when using music commands
  - Check Lavalink service status and logs
- **AI responses not working**: Verify your `GEMINI_API_KEY` or `GROQ_API_KEY` is valid
- **Bot disconnecting**: Check internet connection and Discord API status
- **"Unknown interaction" errors**: These are typically caused by timeouts and are now properly handled

### Debug Mode
Enable debug logging by setting `DEBUG=true` in your environment variables.

## License
This project is licensed under the ISC License.

## Support
For support, create an issue in the GitHub repository or join our Discord server.