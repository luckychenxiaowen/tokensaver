# Usage Guide

## Proxy Mode (Zero-Code Integration)

The proxy server sits between your app and the LLM API, automatically compressing all traffic.

### Start the proxy

```bash
npm run serve
# Proxy running at http://localhost:8800
```

### Python SDK Integration

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8800/v1",        # ← Point to proxy
    api_key="your-api-key",
    default_headers={
        "X-Provider-URL": "https://api.deepseek.com/v1/chat/completions"
    }
)

# Use normally — proxy auto-compresses!
response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[{"role": "user", "content": "解释 Python 装饰器"}]
)

# View savings
print(response.model_extra["tokensaver"])
```

### cURL

```bash
curl -X POST http://localhost:8800/v1/chat/completions \
  -H "Authorization: Bearer sk-xxx" \
  -H "Content-Type: application/json" \
  -H "X-Provider-URL: https://api.deepseek.com/v1/chat/completions" \
  -H "X-Tokensaver-Level: cn-full" \
  -d '{
    "model": "deepseek-chat",
    "messages": [{"role": "user", "content": "解释 Redis 持久化"}]
  }'
```

## CLI Mode

### Generate System Prompt

```bash
node src/index.js prompt -m cn-full
node src/index.js prompt -m wenyan
node src/index.js prompt -m en-full --english
```

### Compress Files

```bash
node src/index.js compress ./my-rules.md -m full
node src/index.js compress ./my-rules.md -m ultra --dry-run
```

### Count Tokens

```bash
node src/index.js count ./my-file.txt -m deepseek-chat
```

### Benchmark

```bash
node src/index.js benchmark -m deepseek,glm,minimax,hunyuan,kimi
```

## Dynamic Control (Headers)

Control compression per-request without restarting the server:

| Header | Values | Default | Description |
|--------|--------|---------|-------------|
| `X-Tokensaver-Compress` | `true` / `false` | `true` | Enable/disable output compression |
| `X-Tokensaver-Prompt-Compress` | `true` / `false` | `false` | Enable/disable input compression |
| `X-Tokensaver-Cache` | `true` / `false` | `true` | Enable/disable semantic cache |
| `X-Tokensaver-Level` | see below | `cn-full` | Set compression level |

## Compression Levels

| Level | Header Value | Output Savings | Notes |
|-------|-------------|:---:|-------|
| Lite | `cn-lite` | ~20% | Remove filler words only |
| **Full** (default) | `cn-full` | **~50%** | Caveman style, balanced |
| Ultra | `cn-ultra` | ~70% | Telegram style, extreme |
| Wenyan | `wenyan` | ~60% | Classical Chinese |
| Wenyan Ultra | `wenyan-ultra` | ~80% | Max compression |
| EN-Full | `en-full` | ~50% | English Caveman |
| EN-Ultra | `en-ultra` | ~70% | English extreme |

## Input Compression Modes

| Mode | Description | Savings |
|------|-------------|:---:|
| `safe` | Deduplicate lines + remove filler words | 20-40% |
| `aggressive` | Safe + truncate to 70% | 50-75% |

Enable with: `node src/index.js serve --input-compress --input-mode aggressive`

## Token Statistics in Response

```json
{
  "tokensaver": {
    "cache_hit": false,
    "input_tokens_before": 150,
    "input_tokens_after": 120,
    "input_tokens_saved": 30,
    "output_tokens": 200,
    "output_tokens_saved": 800,
    "output_compression_applied": true,
    "prompt_compression_applied": false,
    "compression_level": "cn-full",
    "elapsed_ms": 2546
  }
}
```

## Deployment

### Production (with input compression + file cache)

```bash
node src/index.js serve -p 8800 -l cn-full --input-compress --input-mode safe
```

### High Availability (Docker Compose)

```yaml
# docker-compose.yml
services:
  tokensaver:
    image: tokensaver:latest
    ports:
      - "8800:8800"
    restart: unless-stopped
```
