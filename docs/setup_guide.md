# Qweny Bot Setup Guide 📜

This document chronicles the journey of building **Qweny Bot**, a Discord bot with a sarcastic programming personality.

## 1. Project Initialization
We started by creating a blank Node.js project.
```bash
npm init -y
npm install discord.js dotenv
```

## 2. The Foundation (`index.js`)
We built the main entry point to:
- Connect to Discord using the `Client` class.
- Load the **Bot Token** securely from a `.env` file.
- Handle the `ready` event to let us know when Qweny is online.
- We added a "Programming Humor" personality (e.g., status: "Debugging my own life code").

## 3. Slash Commands (`deploy-commands.js`)
We moved away from legacy `!ping` commands to modern Slash Commands (`/ping`).
- We created a script `deploy-commands.js` to register commands with Discord's API.
- We used `Routes.applicationGuildCommands` for instant updates during development (instead of global commands which can take an hour).

## 4. The Brain (`/ask`)
We integrated Google's **Gemini AI** to give Qweny a brain.
- Installed `@google/generative-ai`.
- Created an `/ask` command that takes a user prompt, sends it to Gemini, and replies with a response in Qweny's sarcastic style.

## 5. Docker Support 🐳
Qweny Bot can be deployed using Docker for containerized deployment.

### Building the Docker Image
```bash
# Build the Docker image
docker build -t qwenzy-bot .

# Build with production dependencies only
docker build --target production -t qwenzy-bot .
```

### Running the Bot with Docker
```bash
# Run the bot container (requires .env file in the current directory)
docker run -d --name qwenzy-bot --env-file .env -p 3000:3000 qwenzy-bot

# Run with custom environment variables
docker run -d --name qwenzy-bot -e DISCORD_TOKEN=your_token -e GEMINI_API_KEY=your_key -e CLIENT_ID=your_client_id -e GUILD_ID=your_guild_id -e PORT=3000 -p 3000:3000 qwenzy-bot

# If environment variables are not set, the bot starts a health check server only
docker run -d --name qwenzy-bot -p 3000:3000 qwenzy-bot
```

### Running with Docker Compose
```bash
docker-compose up -d
```

### Docker Container Health Check
If the bot starts without required environment variables (DISCORD_TOKEN or CLIENT_ID), it will run a health check server instead of connecting to Discord:
- Root endpoint: http://localhost:3000
- Health endpoint: http://localhost:3000/health

> Note: The bot uses the PORT environment variable to determine which port to run on. By default, the Dockerfile exposes port 3000, which is the default value if PORT is not specified in your .env file.

## 6. Directory Structure
```
qweny-bot/
├── index.js              # Main bot file
├── deploy-commands.js    # Script to register commands
├── Dockerfile            # Docker configuration
├── .env                  # Secrets (Token, App ID, API Keys)
├── src/
│   ├── commands/
│   │   ├── general/      # ping.js, ask.js
│   │   ├── moderation/   # kick.js
│   │   ├── economy/      # balance.js, work.js
│   │   └── fun/          # joke.js
```

## Troubleshooting
- **Command not showing?** Ensure `deploy-commands.js` was run and the `GUILD_ID` in `.env` is correct.
- **AI Error?** Check if `GEMINI_API_KEY` is valid in `.env`.
- **Docker build fails?** Make sure you have Docker installed and the Docker daemon is running.
- **Docker container exits immediately?** Verify that your `.env` file contains all required environment variables.
