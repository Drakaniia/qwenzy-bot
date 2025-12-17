# Qweny Bot Setup Guide

This document provides detailed instructions for setting up and configuring the Qweny Discord bot.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Deployment Options](#deployment-options)
- [Configuration](#configuration)

## Prerequisites

- Node.js 18 or higher
- Discord Bot Token
- Google Gemini API Key or Groq API Key (optional, for AI features)

## Local Setup

### 1. Clone the Repository
```bash
git clone https://github.com/Drakaniia/qwenzy-bot.git
cd qwenzy-bot
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Create Environment Variables
Create a `.env` file in the root directory:
```env
DISCORD_TOKEN=your_discord_bot_token
CLIENT_ID=your_discord_application_client_id
GUILD_ID=your_discord_server_id
LAVALINK_HOST=localhost
LAVALINK_PORT=2333
LAVALINK_PASSWORD=youshallnotpass
LAVALINK_SECURE=false
LAVALINK_SEARCH_PREFIX=ytsearch
GEMINI_API_KEY=your_google_gemini_api_key
BOT_AVATAR_URL=your_bot_avatar_image_url
```

### 4. Run the Bot
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

### Lavalink (Music Playback)
- `LAVALINK_HOST` - Hostname of your Lavalink server (default: localhost)
- `LAVALINK_PORT` - Port of your Lavalink server (default: 2333)
- `LAVALINK_PASSWORD` - Password of your Lavalink server (default: youshallnotpass)
- `LAVALINK_SECURE` - Whether to use SSL/TLS for Lavalink connection (default: false)
- `LAVALINK_SEARCH_PREFIX` - Search prefix used by Lavalink (default: ytsearch)

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

#### Step 3: Keep Your Bot Online 24/7
Render free tier services may sleep after 15 minutes of inactivity. To keep your bot running 24/7:
1. Set up an uptime monitoring service (like UptimeRobot, StatusCake, or similar)
2. Configure the monitor to ping your bot's health check endpoint every 5 minutes
3. The health check endpoint is: `https://your-bot-name.onrender.com/health`
4. This prevents the Render service from sleeping, ensuring your bot stays online

### Railway
1. Create a new project on Railway
2. Connect your GitHub repository
3. Set the build command: `npm install`
4. Set the start command: `npm start`
5. Add all required environment variables

### Docker
1. Build the Docker image:
   ```bash
   docker build -t qwenzy-bot .
   ```
2. Run the container with your environment variables:
   ```bash
   docker run -d --env-file .env --name qwenzy-bot qwenzy-bot
   ```

### Docker Compose
1. Create a `docker-compose.yml` file with your environment variables
2. Run the bot:
   ```bash
   docker-compose up -d
   ```

## Configuration

### Discord Bot Permissions
Make sure your bot has these permissions:
- View Channels
- Send Messages
- Embed Links
- Attach Files
- Read Message History
- Connect (for voice channels)
- Speak (for voice channels)
- Use Voice Activity

### Discord Intents
The bot requires these Discord intents:
- `Guilds`
- `GuildMessages`
- `MessageContent`
- `GuildVoiceStates`

### Debug Mode
Enable debug logging by setting `DEBUG=true` in your environment variables.

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