# Multi-stage Dockerfile for deysis-bypass
# Uses node:20-bullseye for compatibility with playwright and latest packages

FROM node:20-bullseye AS build
WORKDIR /usr/src/app

# Install deps
COPY package*.json ./
RUN npm ci --only=production || npm install --only=production

# Install Playwright browsers (Chromium)
RUN npx playwright install --with-deps chromium

# Copy source
COPY . .

# Production image
FROM node:20-bullseye-slim
WORKDIR /usr/src/app

# Install minimal packages required by Playwright (Chromium)
# Playwright install --with-deps already installed these, but we need them in production image
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates \
       fonts-liberation \
       libasound2 \
       libatk-bridge2.0-0 \
       libatk1.0-0 \
       libatspi2.0-0 \
       libcups2 \
       libdbus-1-3 \
       libdrm2 \
       libgbm1 \
       libgtk-3-0 \
       libnspr4 \
       libnss3 \
       libxcomposite1 \
       libxdamage1 \
       libxfixes3 \
       libxkbcommon0 \
       libxrandr2 \
       libxshmfence1 \
       libxss1 \
       libxtst6 \
       xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Copy installed node_modules and source from build stage
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app .

# Create non-root user for security
RUN useradd --user-group --create-home --shell /bin/false appuser \
    && mkdir -p /home/appuser/.cache/ms-playwright \
    && chown -R appuser:appuser /usr/src/app \
    && chown -R appuser:appuser /home/appuser

# Copy Playwright browsers from build stage (after creating user)
COPY --from=build --chown=appuser:appuser /root/.cache/ms-playwright /home/appuser/.cache/ms-playwright

USER appuser

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/home/appuser/.cache/ms-playwright

CMD ["node", "index.js"]
