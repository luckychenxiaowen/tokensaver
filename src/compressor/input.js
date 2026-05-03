/**
 * Input Compressor — 输入消息压缩器
 * 
 * 从 tokcut 移植并增强。对用户消息进行语义压缩，减少输入 Token 消耗。
 * 支持 modes: safe (20-40%), aggressive (50-75%)
 */

const { ContentProtector } = require('../protector/content-protector');

// 填充词集合（中英文）
const FILLER_WORDS = new Set([
  // 英文
  'please', 'kindly', 'just', 'really', 'very', 'basically',
  'actually', 'essentially', 'simply', 'quite',
  // 中文
  '请', '麻烦', '帮忙', '真的', '非常', '基本上', '实际上',
  '确实', '完全', '特别', '比较', '相当',
]);

// 中文填充短语（多字）
const FILLER_PHRASES = [
  '能不能', '可不可以', '能否', '可以不可以',
  '请问一下', '我想问一下', '我想知道', '我想了解',
  '对我来说', '在我看来', '个人认为',
];

class InputCompressor {
  /**
   * @param {string} mode - 'safe' | 'aggressive'
   */
  constructor(mode = 'safe') {
    this.mode = mode;
    this.protector = new ContentProtector();
  }

  /**
   * 压缩单段文本
   * @param {string} text - 原始文本
   * @returns {string} 压缩后的文本
   */
  compressText(text) {
    if (!text || text.trim().length === 0) return text;

    // 1. 保护技术内容
    let protected_ = this.protector.protect(text);

    // 2. 根据模式压缩正文
    if (this.mode === 'safe') {
      protected_ = this._safeCompress(protected_);
    } else if (this.mode === 'aggressive') {
      protected_ = this._aggressiveCompress(protected_);
    }

    // 3. 还原被保护的内容
    let result = this.protector.restore(protected_);

    return result.trim();
  }

  /**
   * 压缩消息列表中的用户消息
   * 仅压缩 role === 'user' 的消息
   * @param {Array<{role: string, content: string}>} messages
   * @returns {Array<{role: string, content: string}>}
   */
  compressMessages(messages) {
    return messages.map(msg => {
      if (msg.role === 'user') {
        return { ...msg, content: this.compressText(msg.content) };
      }
      return msg;
    });
  }

  /**
   * 安全模式：去重复行 + 过滤填充词
   * @private
   */
  _safeCompress(text) {
    // 去连续重复行
    const lines = text.split('\n');
    const deduped = [];
    let prev = null;
    for (const line of lines) {
      const stripped = line.trim();
      if (stripped !== prev) {
        deduped.push(line);
        prev = stripped;
      }
    }
    text = deduped.join('\n');

    // 移除中文填充短语
    for (const phrase of FILLER_PHRASES) {
      text = text.replace(new RegExp(phrase, 'g'), '');
    }

    // 过滤填充词（仅移除独立的填充词，不影响复合词）
    const words = text.split(/(\s+)/);
    const filtered = words.map(word => {
      const cleaned = word.replace(/[，,。.！!？?；;：:、""''（）()【】\[\]]/g, '').toLowerCase().trim();
      if (FILLER_WORDS.has(cleaned) && cleaned.length > 0) {
        return '';
      }
      return word;
    });

    return filtered.join('').replace(/\s{2,}/g, ' ').trim();
  }

  /**
   * 激进模式：截断70% + 过滤填充词
   * @private
   */
  _aggressiveCompress(text) {
    // 先安全压缩
    text = this._safeCompress(text);

    // 截断到70%（如果文本含占位符则跳过截断，避免切断占位符）
    if (!text.includes('__TOKENSAVER_PROTECTED_')) {
      const limit = Math.max(Math.floor(text.length * 0.7), 1);
      text = text.substring(0, limit);
    }

    // 额外：移除多余标点和空白行
    text = text.replace(/[，,。.！!？?；;：:、]{2,}/g, '。');
    text = text.replace(/\n{3,}/g, '\n\n');

    return text;
  }
}

module.exports = { InputCompressor };
