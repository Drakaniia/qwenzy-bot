FROM node:18-alpine

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ cairo-dev jpeg-dev pango-dev giflib-dev

COPY package*.json ./
RUN npm cache clean --force && rm -f package-lock.json
# Install all dependencies (including dev) to run postinstall script
RUN npm install
# Prune dev dependencies after patches are applied
RUN npm prune --production

COPY . .

EXPOSE 3000

# Install bash to support more complex scripts
RUN apk add --no-cache bash

# Create a startup script to handle environment detection
RUN printf '#!/bin/bash\nif [ -z "$DISCORD_TOKEN" ] || [ -z "$CLIENT_ID" ]; then\n  echo "[WARNING] DISCORD_TOKEN or CLIENT_ID not set. Starting health check server only."\n  node -e "\n    const express = require(\"express\");\n    const app = express();\n    const PORT = process.env.PORT || 3000;\n    app.get(\"/\", (req, res) => res.send(\"Qwenzy Bot - Environment variables not set. Health check server running.\"));\n    app.get(\"/health\", (req, res) => res.status(200).json({ status: \"ok\", uptime: process.uptime(), message: \"Environment variables missing\" }));\n    app.listen(PORT, () => console.log(\`Health check server running on port \${PORT}\`));\n  "\nelse\n  echo "[INFO] Starting Qwenzy Bot with environment variables..." \n  node index.js\nfi' > /app/start.sh

RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]