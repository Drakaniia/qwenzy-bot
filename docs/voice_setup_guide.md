# Discord Bot Voice Setup Guide

This guide covers the complete setup process for enabling voice functionality in your Discord bot.

## Prerequisites

- Node.js Discord bot project
- Discord Developer Portal access
- Server administrator permissions

## 1. Discord Developer Portal Setup

### Enable Privileged Gateway Intents

1. **Go to Discord Developer Portal**: https://discord.com/developers/applications
2. **Select your application** (qweny-bot)
3. **Go to "Bot" tab** on the left sidebar
4. **Scroll down to "Privileged Gateway Intents"**
5. **Enable these intents**:
   - ✅ **GUILD_VOICE_STATES** (critical for voice channels)
   - ✅ **GUILDS** (usually enabled)
   - ✅ **GUILD_MESSAGES** (for commands)

### Configure Bot Permissions

1. **Still in Bot tab**, scroll to "Bot Permissions"
2. **Add these permissions**:
   - ✅ **Connect**
   - ✅ **Speak**
   - ✅ **Use Voice Activity**
   - ✅ **Read Message History**
   - ✅ **Send Messages**
   - ✅ **Embed Links**

## 2. Generate New Invite Link

1. **Go to "OAuth2" → "URL Generator"**
2. **Select these scopes**:
   - ✅ **bot**
   - ✅ **applications.commands**
3. **Select these permissions**:
   - ✅ **Connect**
   - ✅ **Speak**
   - ✅ **Use Voice Activity**
   - ✅ **Read Message History**
   - ✅ **Send Messages**
   - ✅ **Embed Links**
   - ✅ **Use Application Commands**
4. **Copy the generated URL**

## 3. Re-invite Bot to Server

1. **Paste the URL in your browser**
2. **Select your server**
3. **Authorize the bot**
4. **Confirm the bot shows up with all permissions**

## 4. Server-side Setup

### Voice Channel Configuration

1. **Go to your Discord server**
2. **Create a voice channel** (if you don't have one)
3. **Right-click the voice channel → Edit Channel**
4. **Go to "Permissions" tab**
5. **Add your bot as a member/role**
6. **Grant these specific permissions**:
   - ✅ **Connect**
   - ✅ **Speak**
   - ✅ **Use Voice Activity**

### Server Permissions

1. **Go to Server Settings → Roles**
2. **Find your bot's role**
3. **Ensure these permissions are enabled**:
   - ✅ **Connect**
   - ✅ **Speak**
   - ✅ **Use Voice Activity**
   - ✅ **Read Message History**

## 5. Project Dependencies

Ensure your `package.json` includes these dependencies:

```json
{
  "dependencies": {
    "@discordjs/voice": "^0.18.0",
    "discord.js": "^14.25.1",
    "ffmpeg-static": "^5.3.0",
    "play-dl": "^1.9.7"
  }
}
```

Install dependencies:
```bash
npm install
```

## 6. Testing the Bot

### Start the Bot

```bash
npm start
# or
node deploy.js
```

### Test Voice Connection

1. **Join a voice channel** in your Discord server
2. **Use the `/play` command**:
   ```
   /play query:your song name
   ```
3. **Check console for debug messages**:
   - `[DEBUG] Voice channel: [channel-id]`
   - `[DEBUG] Bot permissions: {connect: true, speak: true, ...}`
   - `[DEBUG] Existing connection: none/found`

## 7. Troubleshooting

### Common Issues and Solutions

#### Bot Won't Join Voice Channel

**Problem**: No voice connection, no error message
**Solution**: 
- Check GUILD_VOICE_STATES intent is enabled
- Verify bot has Connect and Speak permissions
- Ensure voice channel isn't full

#### Permission Errors

**Problem**: "I need permission to connect and speak"
**Solution**:
- Re-invite bot with proper permissions
- Check server role permissions
- Verify voice channel specific permissions

#### FFmpeg Issues

**Problem**: Audio processing errors
**Solution**:
- Ensure `ffmpeg-static` is installed
- Check system has FFmpeg installed
- Verify audio format compatibility

#### Rate Limiting

**Problem**: YouTube rate limit errors
**Solution**:
- Built-in retry logic handles this
- Wait a few minutes between requests
- Consider premium YouTube API for heavy usage

### Debug Commands

Add these debug checks to your voice commands:

```javascript
// Debug voice channel
console.log('[DEBUG] Voice channel:', voiceChannel?.id || 'null');

// Debug permissions
console.log('[DEBUG] Bot permissions:', {
    connect: permissions.has(PermissionFlagsBits.Connect),
    speak: permissions.has(PermissionFlagsBits.Speak),
    viewChannel: permissions.has(PermissionFlagsBits.ViewChannel)
});

// Debug existing connection
console.log('[DEBUG] Existing connection:', existingConnection ? 'found' : 'none');
```

### Console Output Analysis

Look for these console messages:
- `[VOICE] FFmpeg path available: true`
- `[VOICE] Requesting permission to join voice channel...`
- `[VOICE] Establishing connection...`
- `[VOICE] Connection ready - playing audio!`

### Error Message Reference

| Error | Cause | Solution |
|-------|-------|----------|
| "You need to be in a voice channel" | User not in voice channel | Join a voice channel first |
| "I need permission to connect and speak" | Missing bot permissions | Re-invite with voice permissions |
| "The voice channel is full" | Channel at capacity | Increase user limit or free up space |
| "Already playing in another channel" | Bot busy elsewhere | Use the same channel or wait |
| "YouTube rate limit reached" | Too many requests | Wait and retry automatically |

## 8. Advanced Configuration

### Environment Variables

Create `.env` file:
```env
DISCORD_TOKEN=your_bot_token
CLIENT_ID=your_client_id
GUILD_ID=your_server_id
```

### Production Deployment

For production (Railway, Render, etc.):
1. Set environment variables in hosting platform
2. Ensure FFmpeg is available in deployment environment
3. Configure proper restart policies
4. Monitor logs for voice connection issues

## 9. Security Considerations

- Never commit Discord tokens to version control
- Use environment variables for sensitive data
- Limit bot permissions to only what's necessary
- Monitor for unusual voice connection patterns
- Implement rate limiting for voice commands

## 10. Performance Optimization

- Implement voice connection caching
- Use efficient audio streaming
- Set appropriate timeouts for voice operations
- Monitor memory usage during long sessions
- Implement proper cleanup on bot disconnect

---

**Need Help?** Check the console output when testing voice commands and refer to the troubleshooting section above.