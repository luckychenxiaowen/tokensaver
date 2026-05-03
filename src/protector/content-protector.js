/**
 * Content Protector — 内容保护器
 * 
 * 从 tokcut 移植。通过占位符机制在压缩前后保护技术内容不被损坏。
 * 保护内容：代码块、行内代码、URL、文件路径、版本号。
 */

const PLACEHOLDER_PREFIX = '__TOKENSAVER_PROTECTED_';

class ContentProtector {
  constructor() {
    this.placeholders = [];
    this.counter = 0;
  }

  /**
   * 保护文本中的技术内容，替换为占位符
   * @param {string} text - 原始文本
   * @returns {string} 保护后的文本
   */
  protect(text) {
    this.placeholders = [];
    this.counter = 0;
    
    let result = text;

    // 1. 保护多行代码块 ```...```
    result = result.replace(/```[\s\S]*?```/g, (match) => {
      return this._addPlaceholder(match);
    });

    // 2. 保护行内代码 `...`
    result = result.replace(/`[^`]+`/g, (match) => {
      return this._addPlaceholder(match);
    });

    // 3. 保护 URL
    result = result.replace(/https?:\/\/[^\s<>"{}|\\^`\[\]]+/g, (match) => {
      return this._addPlaceholder(match);
    });

    // 4. 保护文件路径
    result = result.replace(/(?:\/[\w.-]+)+\.[a-zA-Z]{1,6}|[A-Za-z]:\\(?:[\w.-]+\\)*[\w.-]+\.[a-zA-Z]{1,6}/g, (match) => {
      // Only protect if it looks like a real path
      if (match.includes('/') || match.includes('\\')) {
        return this._addPlaceholder(match);
      }
      return match;
    });

    // 5. 保护版本号
    result = result.replace(/\b\d+\.\d+\.\d+\b/g, (match) => {
      return this._addPlaceholder(match);
    });

    return result;
  }

  /**
   * 还原被保护的内容
   * @param {string} text - 含占位符的文本
   * @returns {string} 还原后的文本
   */
  restore(text) {
    let result = text;
    // 反向遍历，避免占位符嵌套问题
    for (let i = this.placeholders.length - 1; i >= 0; i--) {
      const placeholder = `${PLACEHOLDER_PREFIX}${i}__`;
      result = result.replace(placeholder, this.placeholders[i]);
    }
    return result;
  }

  /**
   * 添加占位符
   * @private
   */
  _addPlaceholder(content) {
    const placeholder = `${PLACEHOLDER_PREFIX}${this.counter}__`;
    this.placeholders.push(content);
    this.counter++;
    return placeholder;
  }
}

module.exports = { ContentProtector };
