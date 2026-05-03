/**
 * tokensaver Proxy Server — 透明 LLM 代理层
 * 
 * 从 tokcut 移植的核心能力。部署在应用与 LLM API 之间，
 * 兼容 OpenAI /v1/chat/completions 接口，零代码侵入。
 * 
 * 流程：缓存检查 → 输入压缩 → 注入压缩 System Prompt → 转发 → 后处理 → 返回
 */

const http = require('http');
const { generateSystemPrompt } = require('./compressor/output');
const { InputCompressor } = require('./compressor/input');
const { SemanticCache } = require('./cache/semantic-cache');
const { PostProcessor } = require('./post-processor');
const { countTextTokens } = require('./monitor/token-counter');

// ── 已知模型自动匹配 ──────────────────────────────

const KNOWN_MODELS = {
  'deepseek': 'https://api.deepseek.com/v1/chat/completions',
  'glm': 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  'hunyuan': 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions',
  'moonshot': 'https://api.moonshot.cn/v1/chat/completions',
  'kimi': 'https://api.moonshot.cn/v1/chat/completions',
  'minimax': 'https://api.minimax.chat/v1/text/chatcompletion_v2',
  'gpt': 'https://api.openai.com/v1/chat/completions',
  'openai': 'https://api.openai.com/v1/chat/completions',
  'qwen': 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  'ernie': 'https://qianfan.baidubce.com/v2/chat/completions',
};

class ProxyServer {
  /**
   * @param {object} options - 服务器配置
   * @param {number} options.port - 监听端口，默认 8800
   * @param {string} options.host - 监听地址，默认 0.0.0.0
   * @param {object} options.compressor - 输出压缩配置
   * @param {boolean} options.compressor.enabled
   * @param {string} options.compressor.level - 'lite' | 'full' | 'ultra' | 'cn-lite' | 'cn-full' | 'cn-ultra' | 'wenyan'
   * @param {object} options.promptCompressor - 输入压缩配置
   * @param {boolean} options.promptCompressor.enabled
   * @param {string} options.promptCompressor.mode - 'safe' | 'aggressive'
   * @param {object} options.cache - 缓存配置
   * @param {boolean} options.cache.enabled
   * @param {number} options.logLevel - 0=error, 1=warn, 2=info, 3=debug
   */
  constructor(options = {}) {
    this.port = options.port || 8800;
    this.host = options.host || '0.0.0.0';

    // 压缩配置
    this.compressEnabled = options.compressor?.enabled !== false;
    this.compressLevel = options.compressor?.level || 'cn-full';
    this.promptCompressEnabled = options.promptCompressor?.enabled || false;
    this.promptCompressMode = options.promptCompressor?.mode || 'safe';

    // 组件初始化
    this.inputCompressor = new InputCompressor(this.promptCompressMode);
    this.postProcessor = new PostProcessor();
    this.cache = new SemanticCache(options.cache || { enabled: true });

    // 日志级别
    this.logLevel = options.logLevel ?? 2;

    // 统计
    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      totalInputTokensSaved: 0,
      totalOutputTokensSaved: 0,
      startTime: Date.now(),
    };

    this.server = null;
  }

  /**
   * 启动代理服务器
   */
  start() {
    this.server = http.createServer((req, res) => this._handleRequest(req, res));

    return new Promise((resolve, reject) => {
      this.server.listen(this.port, this.host, () => {
        this._log(2, `tokensaver Proxy v2.0.0 started on http://${this.host}:${this.port}`);
        this._log(2, `  Compressor: ${this.compressEnabled ? this.compressLevel : 'disabled'}`);
        this._log(2, `  Prompt Compressor: ${this.promptCompressEnabled ? this.promptCompressMode : 'disabled'}`);
        this._log(2, `  Cache: ${this.cache.enabled ? 'enabled' : 'disabled'}`);
        resolve();
      });

      this.server.on('error', reject);
    });
  }

  /**
   * 停止服务器
   */
  stop() {
    if (this.server) {
      this.cache.destroy();
      return new Promise((resolve) => {
        this.server.close(() => resolve());
      });
    }
  }

  // ── 请求处理 ──────────────────────────────────

  async _handleRequest(req, res) {
    const startTime = Date.now();

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET') {
      if (req.url === '/health') {
        return this._json(res, 200, { status: 'ok', version: '2.0.0', uptime: Math.floor((Date.now() - this.stats.startTime) / 1000) });
      }
      if (req.url === '/stats') {
        return this._json(res, 200, { ...this.stats, cache: this.cache.getStats() });
      }
      if (req.url === '/' || req.url === '') {
        return this._json(res, 200, { service: 'tokensaver-proxy', version: '2.0.0', docs: '/health' });
      }
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    if (req.method !== 'POST') {
      res.writeHead(405);
      res.end('Method Not Allowed');
      return;
    }

    // 读取 body
    let body = '';
    try {
      body = await this._readBody(req);
    } catch {
      return this._json(res, 400, { error: 'Failed to read request body' });
    }

    let data;
    try {
      data = JSON.parse(body);
    } catch {
      return this._json(res, 400, { error: 'Invalid JSON' });
    }

    // 路由分发
    if (req.url === '/v1/chat/completions' || req.url === '/chat/completions') {
      return this._handleChatCompletion(req, res, data, startTime);
    }

    return this._json(res, 404, { error: 'Not Found' });
  }

  // ── 核心：聊天补全代理 ───────────────────────

  async _handleChatCompletion(req, res, data, startTime) {
    const messages = data.messages || [];
    const model = data.model || 'gpt-4';

    if (messages.length === 0) {
      return this._json(res, 400, { error: 'No messages provided' });
    }

    // 解析上游地址
    const upstreamUrl = this._resolveUpstream(req, data);
    if (!upstreamUrl) {
      return this._json(res, 400, { error: 'Missing X-Provider-URL header or unknown model prefix' });
    }

    // API Key
    const authHeader = req.headers['authorization'] || '';
    const apiKey = authHeader.replace(/^Bearer\s+/i, '');

    // 动态控制（Header 覆盖）
    const outputCompressEnabled = this._parseBoolHeader(req.headers['x-tokensaver-compress'], this.compressEnabled);
    const inputCompressEnabled = this._parseBoolHeader(req.headers['x-tokensaver-prompt-compress'], this.promptCompressEnabled);
    const cacheEnabled = this._parseBoolHeader(req.headers['x-tokensaver-cache'], this.cache.enabled);
    const compressLevel = req.headers['x-tokensaver-level'] || this.compressLevel;

    // Token 统计：原始输入
    const origInputTokens = this._countMessagesTokens(messages, model);

    // ── 1. 语义缓存检查 ──
    if (cacheEnabled) {
      const cached = this.cache.get(messages);
      if (cached) {
        this.stats.cacheHits++;
        this.stats.totalRequests++;
        const elapsed = Date.now() - startTime;
        this._log(2, `Cache HIT - saved ${origInputTokens}+ tokens (${elapsed}ms)`);

        return this._json(res, 200, {
          ...cached,
          tokensaver: {
            cache_hit: true,
            input_tokens_before: origInputTokens,
            input_tokens_after: origInputTokens,
            output_tokens: this._countTokens(cached.choices?.[0]?.message?.content || '', model),
            compression_level: compressLevel,
            elapsed_ms: elapsed,
          },
        });
      }
    }

    // ── 2. 输入压缩 ──
    let workingMessages = messages;
    if (inputCompressEnabled) {
      try {
        workingMessages = this.inputCompressor.compressMessages(messages);
      } catch (e) {
        this._log(1, `Input compression failed: ${e.message}, using original`);
        workingMessages = messages;
      }
    }
    const compressedInputTokens = this._countMessagesTokens(workingMessages, model);
    const inputSaved = origInputTokens - compressedInputTokens;

    // ── 3. 注入输出压缩 System Prompt ──
    let enhancedMessages = workingMessages;
    if (outputCompressEnabled) {
      const systemPrompt = generateSystemPrompt(compressLevel);
      enhancedMessages = this._injectSystemPrompt(workingMessages, systemPrompt);
    }

    // ── 4. 转发到上游 LLM ──
    const reqBody = { ...data, messages: enhancedMessages };
    let responseData;
    try {
      responseData = await this._forwardRequest(upstreamUrl, apiKey, reqBody);
    } catch (e) {
      this._log(0, `Upstream error: ${e.message}`);
      return this._json(res, 502, { error: `Upstream API error: ${e.message}` });
    }

    // ── 5. 后处理压缩 ──
    let outputContent = responseData.choices?.[0]?.message?.content || '';
    let originalOutputTokens = 0;
    if (outputCompressEnabled && outputContent) {
      try {
        originalOutputTokens = this._countTokens(outputContent, model);
        outputContent = this.postProcessor.process(outputContent);
        responseData.choices[0].message.content = outputContent;
      } catch (e) {
        this._log(1, `Post-processing failed: ${e.message}`);
      }
    }

    // ── 6. 缓存响应 ──
    if (cacheEnabled) {
      try {
        this.cache.set(messages, responseData);
      } catch (e) {
        this._log(1, `Cache set failed: ${e.message}`);
      }
    }

    // ── 7. 统计信息 ──
    const outputTokens = responseData.usage?.completion_tokens || this._countTokens(outputContent, model);
    const outputSaved = originalOutputTokens ? originalOutputTokens - outputTokens : 0;

    this.stats.totalRequests++;
    this.stats.totalInputTokensSaved += inputSaved;
    this.stats.totalOutputTokensSaved += outputSaved;

    const elapsed = Date.now() - startTime;
    this._log(2, `Request done - input: ${origInputTokens}→${compressedInputTokens}, output: ${outputTokens}, ${elapsed}ms`);

    responseData.tokensaver = {
      cache_hit: false,
      input_tokens_before: origInputTokens,
      input_tokens_after: compressedInputTokens,
      input_tokens_saved: inputSaved,
      output_tokens: outputTokens,
      output_tokens_saved: outputSaved,
      output_compression_applied: outputCompressEnabled,
      prompt_compression_applied: inputCompressEnabled,
      compression_level: compressLevel,
      elapsed_ms: elapsed,
    };

    if (!responseData.usage) {
      responseData.usage = {};
    }

    return this._json(res, 200, responseData);
  }

  // ── 工具方法 ──────────────────────────────────

  _injectSystemPrompt(messages, systemPrompt) {
    const newMessages = [...messages];
    const systemIndex = newMessages.findIndex(m => m.role === 'system');

    if (systemIndex >= 0) {
      newMessages[systemIndex] = {
        ...newMessages[systemIndex],
        content: (newMessages[systemIndex].content || '') + '\n\n' + systemPrompt,
      };
    } else {
      newMessages.unshift({ role: 'system', content: systemPrompt });
    }

    return newMessages;
  }

  _resolveUpstream(req, data) {
    // 1. Header 指定
    const url = req.headers['x-provider-url'];
    if (url) return url.trim();

    // 2. 从 model 字段自动匹配
    const model = (data.model || '').toLowerCase();
    for (const [prefix, endpoint] of Object.entries(KNOWN_MODELS)) {
      if (model.startsWith(prefix)) {
        this._log(2, `Auto-resolved upstream for '${data.model}': ${endpoint}`);
        return endpoint;
      }
    }

    return null;
  }

  async _forwardRequest(url, apiKey, body) {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300000); // 5 min timeout

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const errText = await resp.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${resp.status}: ${errText.substring(0, 500)}`);
      }

      return await resp.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  _countMessagesTokens(messages, model) {
    let total = 0;
    for (const msg of messages) {
      total += this._countTokens(msg.content || '', model);
    }
    return total;
  }

  _countTokens(text, model) {
    try {
      return countTextTokens(text, model || 'deepseek-chat');
    } catch {
      // Fallback: rough estimate
      return Math.ceil(text.length * 0.3);
    }
  }

  _parseBoolHeader(value, defaultValue) {
    if (value === undefined || value === null) return defaultValue;
    const lower = String(value).toLowerCase();
    return lower === 'true' || lower === '1' || lower === 'yes';
  }

  _readBody(req) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      req.on('error', reject);
    });
  }

  _json(res, status, data) {
    const json = JSON.stringify(data);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(json);
  }

  _log(level, message) {
    if (level <= this.logLevel) {
      const prefix = ['[ERROR]', '[WARN]', '[INFO]', '[DEBUG]'][level] || '[INFO]';
      const time = new Date().toISOString().split('T')[1].split('.')[0];
      console.log(`${time} ${prefix} ${message}`);
    }
  }
}

module.exports = { ProxyServer };
