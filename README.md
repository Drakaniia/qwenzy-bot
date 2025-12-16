# Qweny Bot 🤖

Qweny is a feature-rich Discord bot built with Node.js and `discord.js`. It features a "Programming Humor" personality and offers music, economy, AI capabilities, and more!

## 🎵 Music Commands
- **`/play <query>`** - Play music from YouTube (supports URLs and search queries)
- **`/search <query>`** - Search for music on YouTube and select from results
- **`/queue`** - View the current music queue
- **`/skip`** - Skip the currently playing song
- **`/stop`** - Stop playing music and clear the queue

## 🤖 General Commands
- **`/ping`** - Check bot latency
- **`/ask <question>`** - Ask questions to the AI (powered by Google Gemini)

## 😄 Fun Commands
- **`/joke`** - Get a programming joke

## 💰 Economy Commands
- **`/balance`** - Check your current balance
- **`/work`** - Earn money by working

## 🚀 Setup Instructions

### Prerequisites
- Node.js 18 or higher
- Discord Bot Token
- Google Gemini API Key (optional, for AI features)

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
   GEMINI_API_KEY=your_google_gemini_api_key
   BOT_AVATAR_URL=optional_avatar_url
   ```

4. **Deploy slash commands**
   ```bash
   node deploy-commands.js
   ```

5. **Start the bot**
   ```bash
   node index.js
   ```

## 📋 Environment Variables

### Required
- `DISCORD_TOKEN` - Your Discord bot token from the Discord Developer Portal
- `CLIENT_ID` - Your Discord application client ID

### Optional but Recommended
- `GUILD_ID` - Your Discord server ID for faster command deployment
- `GEMINI_API_KEY` - Google Generative AI API key for AI chat features
- `BOT_AVATAR_URL` - URL for bot avatar image

## ☁️ Deployment Options

### Render
1. Create a new Web Service on Render
2. Connect your GitHub repository
3. **Build Command**: `npm install`
4. **Start Command**: `npm start`
5. Add all required environment variables

### Railway
1. Create a new project on Railway
2. Connect your GitHub repository
3. Add environment variables in the dashboard
4. Railway will automatically detect and deploy the Node.js application

### Docker
```bash
docker build -t qweny-bot .
docker run -d --name qweny-bot qweny-bot
```

## 🎵 Music Features

The music system includes:
- **YouTube Integration**: Search and play from YouTube's vast library
- **Queue Management**: Add multiple songs to a queue with automatic playback
- **Interactive Search**: Browse search results with a user-friendly dropdown
- **Auto-Disconnect**: Automatically disconnects when queue is empty after 5 minutes
- **Voice Channel Detection**: Ensures users are in voice channels before playing

### How to Use Music Commands
1. Join a voice channel
2. Use `/search your song` to find music
3. Select from the dropdown menu
4. Or use `/play direct_url_or_search_query` for immediate playback
5. Manage your queue with `/queue`, `/skip`, and `/stop`

## 🛠️ Bot Configuration

### Discord Bot Permissions
Make sure your bot has these permissions:
- `Connect` - Join voice channels
- `Speak` - Play audio
- `Read Messages` - Read channel messages
- `Send Messages` - Send messages
- `Embed Links` - Send rich embeds
- `Use External Emojis` - Use custom emojis

### Intents Required
The bot requires these Discord intents:
- `Guilds`
- `GuildMessages`
- `MessageContent`
- `GuildVoiceStates`

## 📚 Documentation
- [Detailed Setup Guide](docs/setup_guide.md) - Step-by-step creation story
- [Discord.js Documentation](https://discord.js.org/) - Framework documentation
- [play-dl Documentation](https://npmjs.com/package/play-dl) - Music playback library

## 🤝 Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 🐛 Troubleshooting

### Common Issues
- **Commands not registering**: Ensure you've run `node deploy-commands.js`
- **Music not playing**: Check that FFmpeg is installed and bot has voice permissions
- **AI responses not working**: Verify your `GEMINI_API_KEY` is valid
- **Bot disconnecting**: Check internet connection and Discord API status

### Debug Mode
Enable debug logging by setting `DEBUG=true` in your environment variables.

## 📄 License
This project is licensed under the ISC License.

## 🌟 Support
For support, create an issue in the GitHub repository or join our Discord server.
