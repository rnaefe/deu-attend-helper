# Multi-stage Dockerfile for deysis-bypass
# Uses node:20-bullseye for compatibility with puppeteer and latest packages

FROM node:20-bullseye AS build
WORKDIR /usr/src/app

# Install deps
COPY package*.json ./
RUN npm ci --only=production || npm install --only=production

# Install Puppeteer browsers (Chrome)
RUN npx puppeteer browsers install chrome

# Copy source
COPY . .

# Production image
FROM node:20-bullseye-slim
WORKDIR /usr/src/app

# Install minimal packages required by puppeteer (Chromium)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates \
       fonts-liberation \
       libatk-bridge2.0-0 \
       libatk1.0-0 \
       libasound2 \
       libcairo2 \
       libcups2 \
       libdbus-1-3 \
       libexpat1 \
       libfontconfig1 \
       libgbm1 \
       libgcc1 \
       libglib2.0-0 \
       libgtk-3-0 \
       libnspr4 \
       libnss3 \
       libpango-1.0-0 \
       libpangocairo-1.0-0 \
       libstdc++6 \
       libx11-6 \
       libx11-xcb1 \
       libxcb1 \
       libxcomposite1 \
       libxcursor1 \
       libxdamage1 \
       libxext6 \
       libxfixes3 \
       libxi6 \
       libxrandr2 \
       libxrender1 \
       libxss1 \
       libxtst6 \
       lsb-release \
       wget \
       xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy installed node_modules and source from build stage
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app .

# Copy Puppeteer cache (Chrome binary)
COPY --from=build /root/.cache/puppeteer /home/appuser/.cache/puppeteer

# Create non-root user for security
RUN useradd --user-group --create-home --shell /bin/false appuser \
    && chown -R appuser:appuser /usr/src/app \
    && chown -R appuser:appuser /home/appuser/.cache

USER appuser

ENV NODE_ENV=production
ENV PUPPETEER_CACHE_DIR=/home/appuser/.cache/puppeteer

CMD ["node", "index.js"]
