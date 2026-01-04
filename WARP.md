# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project overview

Qweny is a feature-rich Discord bot built on Node.js and `discord.js` with a focus on music playback (via Lavalink/Riffy), AI-powered Q&A, economy features, and light moderation/utility commands.
The bot is structured around slash commands, a small event system, and a dedicated music subsystem layered on top of Lavalink via the `riffy` client.

## Tooling and commands

### Installation and basics
- Runtime: Node.js 18.x (see `Dockerfile` base image `node:18-alpine`).
- Install dependencies (includes dev deps for tests and `patch-package`):
  - `npm install`
- Environment configuration:
  - Copy `.env.example` to `.env` and fill in at least `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, and the `LAVALINK_*` values.

### Running the bot locally (without Docker)
- Start Lavalink locally (requires `lavalink.jar` in the project root):
  - `npm run start:lavalink`
- Run the bot with a deployment-friendly entrypoint (performs env checks then starts `index.js`):
  - `npm start`
- For direct debugging (skips the deployment pre-checks):
  - `node index.js`

### Running with Docker / docker-compose
- Build and run the full stack (Lavalink + bot) using Docker Compose:
  - `docker-compose up`
- This starts:
  - `lavalink` service on `2333` using `./lavalink/application.yml`.
  - `qweny-bot` service built from the local `Dockerfile`, reading environment from `.env` and exposing port `3000` for the health server.

### Tests
- Run all Mocha tests matching `tests/**/*test.js` (if present):
  - `npm test`
- Watch tests on change:
  - `npm run test:watch`
- Coverage (NYC + Mocha):
  - `npm run test:coverage`
- Music system integration smoke test (Riffy/Lavalink, requires `LAVALINK_*` env to be configured):
  - `npm run test:music`
- Running a single Mocha test file directly (helpful when adding new tests):
  - `npx mocha tests/your-test-file.test.js`

### Slash command registration
- Guild-scoped deployment (fast iteration; requires `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`):
  - `node deploy-commands.js`
- Global + guild deployment (registers globally and also in `GUILD_ID` if set):
  - `node refresh-commands.js`

## High-level architecture

### Runtime entrypoint and infrastructure
- `index.js` is the main entrypoint:
  - Loads environment variables via `dotenv`.
  - Installs global `unhandledRejection` and `uncaughtException` handlers.
  - Polyfills `File` for compatibility with libraries that expect browser-like globals.
  - Starts a small Express HTTP server with `/`, `/health`, and `/ping` endpoints, binding on `PORT` (default `3000`) and automatically incrementing the port if it is in use.
  - Creates a `discord.js` `Client` with intents for guilds, messages, content, voice states, and members.
  - Configures Lavalink nodes from `LAVALINK_HOST`, `LAVALINK_PORT`, `LAVALINK_PASSWORD`, `LAVALINK_SECURE`, and optionally appends public fallback nodes if `USE_FALLBACK_NODES` is not set to `'false'`.
  - Instantiates `Riffy` as `client.riffy` and wires raw gateway events into it for voice state updates.
  - Tracks node connectivity and updates `client.musicReady` so higher-level code can short-circuit when the music system is unavailable.
  - Initializes the music abstraction layer via `musicManager.init(client)`.

### Command system
- Slash commands live under `src/commands/<category>/*.js` where `<category>` is a feature area (`music`, `general`, `fun`, `economy`, etc.).
  - Each command module exports:
    - `data`: a `SlashCommandBuilder` describing the command and its options.
    - `execute(interaction)`: the handler invoked for that slash command.
- `index.js` loads all commands at startup:
  - Reads `src/commands` subfolders and requires each `*.js` file.
  - Validates the presence of `data` and `execute` and registers them into `client.commands` keyed by `data.name`.
  - Optionally loads test commands from `src/commands/music/test` when that folder exists, wiring them the same way.
- The global `interactionCreate` listener in `index.js` handles routing:
  - Checks `interaction.isChatInputCommand()` and looks up `interaction.commandName` in `interaction.client.commands`.
  - Wraps execution in robust error handling that respects interaction expiration and avoids double replies.

### Event system
- Generic Discord events live in `src/events/*.js` and each module exports `{ name, once?, execute }`.
- `index.js` scans `src/events` at startup and attaches handlers via `client.on` or `client.once` based on the `once` flag.
- Key events:
  - `messageCreate.js`:
    - Plugs into the auto-response subsystem (see below) to send canned replies when trigger phrases are detected.
    - Skips bots, DMs, and disabled configurations.
  - `guildMemberAdd.js`:
    - Handles new member joins and sends a customized welcome embed with an image generated using `canvas`.
    - Heuristically selects a suitable text channel (e.g., `welcome`, `general`, `rules-and-welcome`, `lobby`, or the system channel) with the right permissions.
  - `musicButtons.js`:
    - Listens on `InteractionCreate` for button interactions with custom IDs prefixed by `music_`.
    - Bridges UI buttons (playback controls, like, loop, shuffle, etc.) to the music subsystem.
  - `voiceStateUpdate.js`:
    - Cleans up music players when the bot leaves a voice channel or is left alone for a period of time.

### Music / Lavalink subsystem
- `src/modules/musicManager.js` encapsulates all interaction with `client.riffy` and is the primary abstraction used by music-related commands and events.
  - `init(client)` injects the Discord client and returns the singleton.
  - `riffy` getter:
    - Validates that `client.riffy` exists and that `client.musicReady` is `true`.
    - Throws a descriptive error if the music system is not ready, preventing commands from using an uninitialized or disconnected Lavalink node.
  - Player helpers:
    - `getPlayer(guildId)`, `getOrCreatePlayer({ guildId, voiceChannelId, textChannelId, ... })` manage `Riffy` player lifecycles per guild.
    - Queue and playback helpers (`getQueue`, `getCurrentTrack`, `pause`, `resume`, `skip`, `stop`, `disconnect`, `shuffleQueue`, loop mode/volume setters) are thin wrappers over Riffy.
  - `search(query, requester)` delegates to `riffy.resolve` with structured logging and error surfacing.
- `src/events/riffyEvents.js` wires Riffy events to Discord channels and logs:
  - `trackStart`, `trackEnd`, `queueEnd`, `playerCreate`, `playerDestroy`, `playerMove`, `playerError`, and node-level errors.
  - Builds embeds for “Now Playing” messages and posts queue-completion notifications.
- Music commands in `src/commands/music` (`play`, `pause`, `resume`, `skip`, `stop`, `queue`, `voicecheck`, `volume`, etc.):
  - Operate primarily through `musicManager`, never directly through `client.riffy` (except for diagnostic flows like `voicecheck`).
  - The `/play` command implements a multi-step interaction flow:
    - Searches through Lavalink, presents the top results via a select menu, and then hands control to the button-based controller in `musicButtons.js`.
    - Carefully handles Discord interaction lifetimes, expired interactions, permission checks, and common error cases (rate limit, timeouts, forbidden content).

### Auto-response subsystem
- `src/modules/autoResponseManager.js` manages keyword-triggered text responses:
  - Loads configuration from `src/config/autoResponses.json` if present; otherwise defaults to an `enabled: false` configuration.
  - Compiles per-trigger regular expressions respecting `wholeWord` and `caseSensitive` options.
  - Maintains an in-memory per-user, per-trigger cooldown map to avoid spamming (`rateLimits`).
  - Exposes methods for checking triggers (`checkTrigger(message)`), resolving formatted responses (`getResponse`), and introspecting status.
- `src/events/messageCreate.js` acts as the integration point:
  - Early-exits for bots, DMs, or when auto-responses are disabled.
  - Uses `autoResponseManager.checkTrigger` to find matching triggers and sends the configured response into the same channel, honoring channel permissions.

### AI integration
- `src/commands/general/ask.js` provides the `/ask` slash command:
  - Prefers the Groq API when `GROQ_API_KEY` is set (via `https://api.groq.com/openai/v1/chat/completions`).
  - Falls back to Google Gemini (`@google/generative-ai`) when `GEMINI_API_KEY` is set.
  - Implements a very lightweight in-memory rate limiter specific to this command.
  - Enforces response length constraints to stay within Discord’s 2000-character limit, truncating with a note when necessary.

### Welcome image generation
- `src/events/guildMemberAdd.js` uses `canvas` to render a welcome card:
  - Draws a gradient background and decorative elements.
  - Renders the new member’s avatar in a circular frame with a border.
  - Displays username, a fixed server name label used in the graphic, join order (with ordinal suffix), and join date.
  - Sends the image as an attachment referenced by an embed in the chosen welcome channel.

### Utilities, diagnostics, and testing
- `src/utils/rateLimiter.js` implements an advanced rate limiter for outbound requests (e.g., YouTube-related calls):
  - Supports minimum-call interval, a queue, an exponential backoff retry strategy, and a circuit breaker with recovery.
  - Exposes status and manual reset to help debug or recover from repeated failures.
- `src/commands/music/voicecheck.js` exposes a Discord-facing diagnostic command:
  - Reports configured Lavalink nodes and their stats.
  - Lists active players and attempts a sample search to validate connectivity.
  - Includes `client.musicReady` in the output.
- `tests/test_music_playback.js` is a standalone Node script executed via `npm run test:music`:
  - Validates that Riffy can be instantiated and initialized against the configured Lavalink node.
  - Verifies that `musicManager` can access Riffy when `musicReady` is true and that it fails as expected when `musicReady` is false.

## Environment configuration summary

Key environment variables (see `.env.example` and the code):
- Discord / application:
  - `DISCORD_TOKEN` – bot token used both by the bot and the REST registration scripts.
  - `CLIENT_ID` – application (bot) client ID used for slash command registration and invite links.
  - `GUILD_ID` – optional guild ID for faster, guild-scoped command registration.
- Lavalink / music:
  - `LAVALINK_HOST`, `LAVALINK_PORT`, `LAVALINK_PASSWORD`, `LAVALINK_SECURE` – primary Lavalink node configuration.
  - `LAVALINK_SEARCH_PREFIX` – search source prefix (`ytsearch`, `ytmsearch`, etc.), consumed by Riffy.
  - `USE_FALLBACK_NODES` – when set to `'false'`, disables built-in public fallback nodes; otherwise they are added.
- AI / external APIs:
  - `GROQ_API_KEY` – optional; enables Groq-backed responses for `/ask`.
  - `GEMINI_API_KEY` – optional; enables Gemini fallback for `/ask` and is also checked in `index.js` for logging.
  - `YOUTUBE_COOKIE` – optional legacy value referenced in `.env.example` for `play-dl` (not required when relying solely on Lavalink).
- Bot behavior and hosting:
  - `BOT_AVATAR_URL` – optional; if set, `index.js` attempts to set the bot’s avatar on ready.
  - `PORT` – optional; starting port for the Express health server (defaults to `3000`, auto-increments on conflict).
