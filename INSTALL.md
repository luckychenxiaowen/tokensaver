# Installation

## Prerequisites

- **Node.js 18+** (v20+ recommended)
- **npm** (comes with Node.js)

## Quick Install

```bash
# 1. Clone the repository
git clone https://github.com/luckychenxiaowen/tokensaver.git
cd tokensaver

# 2. Install dependencies
npm install

# 3. Verify installation
node src/index.js --version
```

## Proxy Server Setup

```bash
# Start the proxy server (default: localhost:8800)
npm run serve

# Custom port and compression level
node src/index.js serve -p 8888 -l cn-full

# With input compression enabled
node src/index.js serve --input-compress --input-mode safe
```

## Docker (Optional)

```bash
# Build
docker build -t tokensaver .

# Run
docker run -p 8800:8800 tokensaver

# Or with docker-compose
docker-compose up -d
```

## Verification

```bash
# Check health
curl http://localhost:8800/health
# → {"status":"ok","version":"2.0.0"}

# Test with DeepSeek
curl -X POST http://localhost:8800/v1/chat/completions \
  -H "Authorization: Bearer YOUR_DEEPSEEK_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Provider-URL: https://api.deepseek.com/v1/chat/completions" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"Hello!"}]}'
```

## Troubleshooting

### Port already in use
```bash
# Use a different port
node src/index.js serve -p 8801
```

### tiktoken model download slow
The first run downloads the `cl100k_base` tokenizer model (~1MB). If slow, set a mirror:
```bash
export TIKTOKEN_CACHE_DIR=/path/to/cache
```
