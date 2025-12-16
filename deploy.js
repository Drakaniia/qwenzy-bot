#!/usr/bin/env node

/**
 * Deployment helper script for Wispbyte
 *
 * This script checks if all required environment variables are set
 * before starting the bot, which is helpful for deployment platforms.
 */

require('dotenv').config();

console.log('🌱 Initializing Qwenzy Bot for Wispbyte deployment...');

// Check if required environment variables are present
const requiredEnvVars = [
    'DISCORD_TOKEN',
    'CLIENT_ID',
];

// Optional but recommended environment variables
const optionalEnvVars = [
    'GUILD_ID',
    'GEMINI_API_KEY',
];

// Log which required environment variables are missing
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingEnvVars.forEach(envVar => console.error(`  - ${envVar}`));
    process.exit(1);
} else {
    console.log('✅ All required environment variables are set');
}

// Log which optional environment variables are missing
const missingOptionalEnvVars = optionalEnvVars.filter(envVar => !process.env[envVar]);
if (missingOptionalEnvVars.length > 0) {
    console.warn('⚠️  Missing optional environment variables:');
    missingOptionalEnvVars.forEach(envVar => console.warn(`  - ${envVar}`));
} else {
    console.log('✅ All recommended environment variables are set');
}

console.log('🌐 Connecting to Discord...');
console.log('💡 Bot is being deployed to Wispbyte for 24/7 uptime');
// Require the main index file to start the bot
require('./index.js');