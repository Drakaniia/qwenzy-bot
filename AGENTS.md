# Agent Instructions for Qweny Bot

## Build/Test Commands
- **Start bot**: `npm start` or `node deploy.js`
- **Run all tests**: `npm test` (mocha tests/**/*.test.js)
- **Run single test**: `mocha tests/path/to/specific.test.js`
- **Watch tests**: `npm run test:watch`
- **Test coverage**: `npm run test:coverage`

## Code Style Guidelines

### Language & Modules
- JavaScript with CommonJS (require/module.exports)
- No TypeScript or ES modules
- Async/await for all async operations

### Naming Conventions
- **Variables/Functions**: camelCase (e.g., `voiceChannel`, `isInteractionExpired`)
- **Classes**: PascalCase (e.g., `RateLimiter`)
- **Files**: kebab-case for commands/events (e.g., `guild-member-add.js`)
- **Constants**: UPPER_SNAKE_CASE for config values

### Imports & Dependencies
- Use `require()` at file top
- Destructure from discord.js imports
- One import per line for clarity

### Error Handling
- Comprehensive try/catch blocks
- Log errors with structured data and timestamps
- Handle Discord interaction expiration (10062 errors)
- Use specific error messages with emojis for user-facing errors

### Logging
- Console with category prefixes: `[INIT]`, `[ERROR]`, `[DEBUG]`, `[INFO]`
- Include timestamps in error logs
- Structured JSON logging for complex error data

### Formatting
- 4-space indentation
- Consistent spacing around operators
- Descriptive variable names
- No semicolons at line ends (optional but consistent)

### Discord.js Patterns
- Commands: `module.exports = { data: new SlashCommandBuilder(), async execute(interaction) {} }`
- Use `flags: [64]` for ephemeral messages
- Extensive permission and voice channel validation
- Handle interaction expiration proactively

### Comments
- Sparse but descriptive comments
- JSDoc-style for class methods
- TODO comments for future improvements</content>
<parameter name="filePath">C:\Users\Qwenzy\Desktop\qweny-bot\AGENTS.md