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

## 🛡️ Moderation Features
- **Automatic welcome messages** - Sends custom welcome messages to new members in a designated channel
  - Configure by updating `src/events/guildMemberAdd.js` with your desired welcome channel ID
  - Customizable welcome message text

## Economy Commands
- **`/balance`** - Check your current balance
- **`/work`** - Earn money by working

## Documentation
- [Detailed Setup Guide](docs/setup_guide.md) - Complete installation and configuration guide
- [Discord.js Documentation](https://discord.js.org/) - Framework documentation
- [Lavalink Documentation](https://lavalink.dev/) - Music server documentation

## Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License
This project is licensed under the ISC License.

## Support
For support, create an issue in the GitHub repository or join our Discord server.