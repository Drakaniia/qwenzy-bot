const fs = require('fs');

// Create a simple programming-themed SVG
const svgContent = `
<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <rect width="128" height="128" fill="#1e1e1e"/>
  <text x="64" y="40" font-family="monospace" font-size="14" fill="#569cd6" text-anchor="middle">&lt;/&gt;</text>
  <text x="64" y="65" font-family="monospace" font-size="12" fill="#4ec9b0" text-anchor="middle">{}</text>
  <text x="64" y="90" font-family="monospace" font-size="12" fill="#dcdcaa" text-anchor="middle">function()</text>
  <text x="64" y="110" font-family="monospace" font-size="10" fill="#ce9178" text-anchor="middle">// code</text>
</svg>
`;

fs.writeFileSync('bot-avatar.svg', svgContent);
console.log('SVG avatar created!');

// Convert to base64 for embedding
const base64Data = Buffer.from(svgContent).toString('base64');
const dataUri = `data:image/svg+xml;base64,${base64Data}`;

console.log('Data URI for .env file:');
console.log(`BOT_AVATAR_URL=${dataUri}`);

// Update .env file
let envContent = '';
try {
    envContent = fs.readFileSync('.env', 'utf8');
} catch (e) {
    envContent = '';
}

if (envContent.includes('BOT_AVATAR_URL=')) {
    envContent = envContent.replace(/BOT_AVATAR_URL=.*/g, `BOT_AVATAR_URL=${dataUri}`);
} else {
    envContent += `\nBOT_AVATAR_URL=${dataUri}`;
}

fs.writeFileSync('.env', envContent);
console.log('Updated .env file with avatar URL!');