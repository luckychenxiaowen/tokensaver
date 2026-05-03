# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.0.x   | :white_check_mark: |
| 1.0.x   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in tokensaver, please **do NOT** open a public issue.

Instead, please email the maintainers directly. We aim to:

- Acknowledge receipt within **48 hours**
- Provide an initial assessment within **5 business days**
- Release a fix within **30 days** (or sooner depending on severity)

## Security Considerations

### API Key Handling
tokensaver acts as a proxy and forwards your API key to the upstream LLM provider. The key is:
- Read from the `Authorization` header of incoming requests
- Forwarded directly to the upstream API
- **Never stored** to disk or logged (only the key prefix is logged for debugging)
- Transmitted over the network to the upstream provider

### Cache Data Security
If using the `file` cache backend, cached API responses are stored on disk. These may contain sensitive information. Consider:
- Setting appropriate file permissions on the cache file
- Using the `memory` backend if data sensitivity is a concern
- Configuring a short TTL to limit data retention

### Network Security
For production deployments:
- Run tokensaver behind a reverse proxy (nginx, Caddy) with TLS
- Consider firewall rules to limit access to the proxy port
- Use HTTPS for the upstream API connections

### Dependency Auditing
```bash
npm audit
```
Run regularly to check for known vulnerabilities in dependencies.
