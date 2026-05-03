/**
 * Semantic Cache — 语义缓存
 * 
 * 从 tokcut 移植。使用 token 级别的 Jaccard 相似度替代 sentence-transformers，
 * 避免引入重量级 ML 依赖。对相似问题直接返回缓存结果。
 * 
 * 支持两种后端：memory（内存，默认）和 file（持久化到磁盘）。
 */

const fs = require('fs-extra');
const path = require('path');
const { get_encoding } = require('js-tiktoken');

class SemanticCache {
  /**
   * @param {object} config - 缓存配置
   * @param {boolean} config.enabled - 是否启用
   * @param {string} config.backend - 'memory' | 'file'
   * @param {number} config.similarity_threshold - 相似度阈值 (0-1)，默认 0.92
   * @param {number} config.ttl_minutes - 缓存过期时间（分钟），默认 60
   * @param {number} config.max_entries - 最大缓存条目数，默认 10000
   */
  constructor(config = {}) {
    this.enabled = config.enabled !== false;
    this.backend = config.backend || 'memory';
    this.threshold = config.similarity_threshold || 0.92;
    this.ttlMs = (config.ttl_minutes || 60) * 60 * 1000;
    this.maxEntries = config.max_entries || 10000;
    
    this.store = new Map();
    this.accessOrder = [];
    this.hits = 0;
    this.misses = 0;
    
    // Cache file path for file backend
    this.cacheFile = config.cache_file || path.join(process.cwd(), '.tokensaver-cache.json');

    try {
      this.encoder = get_encoding('cl100k_base');
    } catch {
      this.encoder = null;
    }

    // Auto-cleanup every 5 minutes
    this._cleanupInterval = setInterval(() => this._cleanup(), 5 * 60 * 1000);
    
    // Load from file if using file backend
    if (this.backend === 'file') {
      this._loadFromFile();
    }
  }

  /**
   * 获取缓存条目
   * @param {Array<{role: string, content: string}>} messages - 消息列表
   * @returns {object|null} 缓存的响应数据，未命中返回 null
   */
  get(messages) {
    if (!this.enabled) return null;
    if (!messages || messages.length === 0) return null;

    const queryText = this._messagesToText(messages);
    const queryTokens = this._tokenize(queryText);
    if (!queryTokens || queryTokens.length === 0) return null;

    const now = Date.now();
    let bestEntry = null;
    let bestSimilarity = 0;

    for (const [key, entry] of this.store) {
      // 检查过期
      if (now - entry.timestamp > this.ttlMs) {
        this.store.delete(key);
        continue;
      }

      const similarity = this._jaccardSimilarity(queryTokens, entry.tokens);
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestEntry = entry;
      }
    }

    if (bestEntry && bestSimilarity >= this.threshold) {
      this.hits++;
      return bestEntry.response;
    }

    this.misses++;
    return null;
  }

  /**
   * 设置缓存条目
   * @param {Array<{role: string, content: string}>} messages - 消息列表
   * @param {object} response - API 响应数据
   */
  set(messages, response) {
    if (!this.enabled) return;
    if (!messages || messages.length === 0) return;

    const queryText = this._messagesToText(messages);
    const tokens = this._tokenize(queryText);
    if (!tokens || tokens.length === 0) return;

    // 限制条目数
    if (this.store.size >= this.maxEntries) {
      const oldest = this.accessOrder.shift();
      if (oldest) this.store.delete(oldest);
    }

    const key = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const entry = {
      key,
      tokens,
      response,
      timestamp: Date.now(),
      messageCount: messages.length,
    };

    this.store.set(key, entry);
    this.accessOrder.push(key);

    // File backend: async save
    if (this.backend === 'file') {
      this._saveToFile();
    }
  }

  /**
   * 获取缓存统计
   * @returns {{hits: number, misses: number, size: number, hitRate: string}}
   */
  getStats() {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.store.size,
      hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(1) + '%' : '0%',
    };
  }

  /**
   * 清空缓存
   */
  clear() {
    this.store.clear();
    this.accessOrder = [];
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * 停止缓存（清理定时器）
   */
  destroy() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
    }
  }

  /**
   * 将消息列表转为文本用于相似度比较
   * @private
   */
  _messagesToText(messages) {
    return messages
      .map(m => `${m.role}: ${m.content}`)
      .join('\n')
      .toLowerCase()
      .trim();
  }

  /**
   * Tokenize 文本
   * @private
   */
  _tokenize(text) {
    if (this.encoder) {
      try {
        return this.encoder.encode(text);
      } catch {
        // fallback to character-level
      }
    }
    // Fallback: character trigrams
    const trigrams = [];
    for (let i = 0; i < text.length - 2; i++) {
      trigrams.push(text.charCodeAt(i) * 65536 + text.charCodeAt(i + 1) * 256 + text.charCodeAt(i + 2));
    }
    return trigrams;
  }

  /**
   * Jaccard 相似度
   * @private
   */
  _jaccardSimilarity(tokensA, tokensB) {
    const setA = new Set(tokensA);
    const setB = new Set(tokensB);
    
    let intersection = 0;
    for (const item of setA) {
      if (setB.has(item)) intersection++;
    }
    
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  /**
   * 清理过期条目
   * @private
   */
  _cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now - entry.timestamp > this.ttlMs) {
        this.store.delete(key);
      }
    }
  }

  /**
   * 保存缓存到文件
   * @private
   */
  _saveToFile() {
    try {
      const data = [];
      for (const [, entry] of this.store) {
        data.push({
          tokens: Array.from(entry.tokens).slice(0, 100), // 只保留前100个token
          response: entry.response,
          timestamp: entry.timestamp,
        });
      }
      fs.writeFileSync(this.cacheFile, JSON.stringify(data), 'utf-8');
    } catch {
      // Silently fail - cache is best-effort
    }
  }

  /**
   * 从文件加载缓存
   * @private
   */
  _loadFromFile() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const data = JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
        const now = Date.now();
        for (const item of data) {
          if (now - item.timestamp < this.ttlMs) {
            const key = `file_${item.timestamp}_${Math.random().toString(36).substr(2, 5)}`;
            this.store.set(key, {
              key,
              tokens: new Set(item.tokens),
              response: item.response,
              timestamp: item.timestamp,
            });
          }
        }
      }
    } catch {
      // Silently fail
    }
  }
}

module.exports = { SemanticCache };
