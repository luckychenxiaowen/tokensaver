FROM node:20-alpine

# Create non-root user
RUN addgroup -g 1001 -S tokensaver && \
    adduser -u 1001 -S tokensaver -G tokensaver

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --production

# Copy source code
COPY src/ ./src/
COPY config/ ./config/

# Set user
USER tokensaver

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8800/health || exit 1

EXPOSE 8800

CMD ["node", "src/index.js", "serve"]
