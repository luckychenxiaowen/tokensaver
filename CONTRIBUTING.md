# Contributing to tokensaver

Thank you for considering contributing! Here's how to get started.

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).

## Development Setup

```bash
# 1. Clone and install
git clone https://github.com/luckychenxiaowen/tokensaver.git
cd tokensaver
npm install

# 2. Verify tests pass
npm test
node tests/run-v2.js
```

## Development Workflow

1. **Find or create an issue** — discuss what you want to change
2. **Create a branch** — `feature/my-feature` or `fix/my-fix`
3. **Write code** — keep it clean and documented
4. **Add tests** — for new features or bug fixes
5. **Run tests** — `npm test && node tests/run-v2.js`
6. **Submit a PR** — describe your changes clearly

## Project Structure

```
tokensaver/
├── config/default.json          # Server configuration
├── src/
│   ├── index.js                 # CLI entry point
│   ├── server.js                # Proxy server
│   ├── post-processor.js        # Response post-processing
│   ├── compressor/
│   │   ├── output.js            # System prompt generation
│   │   ├── input.js             # Input message compression
│   │   └── context.js           # File compression
│   ├── cache/
│   │   └── semantic-cache.js    # Semantic cache
│   ├── protector/
│   │   └── content-protector.js # Content protection
│   ├── monitor/
│   │   └── token-counter.js     # Token counting
│   └── benchmark/
│       └── runner.js            # Multi-model benchmark
└── tests/
    ├── run.js                   # v1 tests (17 cases)
    └── run-v2.js                # v2 tests (20 cases)
```

## Adding a New Compression Mode

1. Add the prompt template in `src/compressor/output.js` (`CAVEMAN_PROMPTS`)
2. Add mode mapping in `generateSystemPrompt()`
3. Add a test case in `tests/run-v2.js`
4. Run tests to verify

## Commit Conventions

- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation
- `test:` — Tests
- `refactor:` — Code restructuring
- `chore:` — Maintenance

Example: `feat: add Japanese compression mode`

## Questions?

Open an issue or discussion on GitHub.
