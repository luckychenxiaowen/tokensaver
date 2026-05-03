/**
 * Post Processor — 响应后处理器
 * 
 * 从 tokcut 移植。对 LLM 响应文本执行后处理规则压缩。
 * 步骤：1.保护技术内容 → 2.删除引导语/客套话 → 3.压缩空格 → 4.还原技术内容
 */

const { ContentProtector } = require('./protector/content-protector');

class PostProcessor {
  constructor() {
    this.protector = new ContentProtector();
  }

  /**
   * 后处理压缩响应文本
   * @param {string} text - LLM 原始响应
   * @returns {string} 压缩后的文本
   */
  process(text) {
    if (!text || text.trim().length === 0) return text;

    try {
      // 1. 保护技术内容
      let protected_ = this.protector.protect(text);

      // 2. 删除常见引导语和客套话（中英文）
      const politePatterns = [
        // 英文
        /^(Sure!?|I['']d be happy to|Certainly!?|Here you go|Of course|Absolutely)\s*[,:，。!]?\s*/gi,
        // 中文
        /^(好的[，,。]?|当然[，,。]?|没问题[，,。]?|让我来[^.。]*?[。.]?|请注意[，,]?|您好[，,]?|很高兴[^.。]*?[。.]?|下面是[^.。]*?[。.]?|以下是[^.。]*?[。.]?|以下为[^.。]*?[。.]?)\s*/gi,
        // 中文引导句
        /^(根据我的[^，,。.]*?[，,。.]|我来[^。.]*?[。.]|让我[^。.]*?[。.])\s*/gi,
      ];

      for (const pattern of politePatterns) {
        protected_ = protected_.replace(pattern, '');
      }

      // 3. 压缩多余空格
      protected_ = protected_.replace(/\s+/g, ' ').trim();

      // 4. 还原被保护的技术内容
      let result = this.protector.restore(protected_);

      return result;
    } catch {
      // 出错时返回原文
      return text;
    }
  }

  /**
   * 轻度后处理：仅去除开头的客套话
   * @param {string} text
   * @returns {string}
   */
  processLite(text) {
    if (!text || text.trim().length === 0) return text;

    // 仅去除明确的引导语
    text = text.replace(/^(好的[，,。]?|当然[，,。]?|没问题[，,。]?|Sure!?|Certainly!?)\s*/gi, '');
    return text.trim();
  }
}

module.exports = { PostProcessor };
