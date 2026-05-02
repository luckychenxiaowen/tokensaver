/**
 * Token 计数器模块
 * 
 * 使用 js-tiktoken 进行精确 Token 计数
 * 支持多种模型的 tokenizer 近似
 */

const { encoding_for_model, get_encoding } = require('js-tiktoken');
const fs = require('fs-extra');
const chalk = require('chalk');

// 模型到 encoding 的映射
const MODEL_ENCODING_MAP = {
  // OpenAI 系列
  'gpt-4': 'cl100k_base',
  'gpt-4o': 'o200k_base',
  'gpt-4-turbo': 'cl100k_base',
  'gpt-3.5-turbo': 'cl100k_base',
  'gpt-3.5': 'cl100k_base',
  
  // 国产模型 (使用最接近的 tokenizer 近似)
  'deepseek': 'cl100k_base',      // DeepSeek 使用类似 GPT 的 tokenizer
  'glm': 'cl100k_base',           // GLM 系列
  'minimax': 'cl100k_base',       // MiniMax
  'hunyuan': 'cl100k_base',       // 混元
  'kimi': 'cl100k_base',          // Kimi (Moonshot)
  'qwen': 'cl100k_base',          // 通义千问
  'ernie': 'cl100k_base',         // 文心一言
  
  // Claude 系列
  'claude-3': 'cl100k_base',
  'claude-3.5': 'cl100k_base',
};

// 国产模型中文 Token 调整系数
// 因为 tiktoken 是英文优化，中文 token 数需要乘以调整系数
const CN_MODEL_RATIOS = {
  'deepseek': 0.85,   // DeepSeek 中文 tokenizer 效率较高
  'glm': 0.90,        // GLM 中文效率中等
  'minimax': 0.95,    // MiniMax 中文效率接近标准
  'hunyuan': 0.88,    // 混元中文效率较高
  'kimi': 0.92,       // Kimi 中文效率中等偏上
};

/**
 * 统计文本的 Token 数量
 */
function countTextTokens(text, model = 'gpt-4') {
  try {
    const encodingName = MODEL_ENCODING_MAP[model] || 'cl100k_base';
    const enc = get_encoding(encodingName);
    const tokens = enc.encode(text);
    const count = tokens.length;
    enc.free();
    
    // 应用国产模型调整系数
    const ratio = CN_MODEL_RATIOS[model] || 1.0;
    return Math.round(count * ratio);
  } catch (e) {
    // fallback: 字符数估算
    // 中文大约 1 字符 ≈ 1.5-2 tokens
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherChars = text.length - chineseChars;
    return Math.round(chineseChars * 1.8 + otherChars * 0.3);
  }
}

/**
 * 统计中文字符数
 */
function countChineseChars(text) {
  return (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
}

/**
 * 统计英文字符/单词数
 */
function countEnglishWords(text) {
  const english = text.replace(/[\u4e00-\u9fff]/g, '');
  return english.split(/\s+/).filter(w => w.length > 0).length;
}

/**
 * 执行 count 命令
 */
async function countTokens(file, options) {
  console.log(chalk.blue(`\n📊 正在统计 Token: ${file}\n`));
  
  const content = fs.readFileSync(file, 'utf-8');
  const model = options.model || 'gpt-4';
  const tokens = countTextTokens(content, model);
  const chineseChars = countChineseChars(content);
  const totalChars = content.length;
  
  console.log(chalk.white('═'.repeat(50)));
  console.log(chalk.cyan(`  模型:        ${model}`));
  console.log(chalk.cyan(`  文件:        ${file}`));
  console.log(chalk.cyan(`  总字符数:    ${totalChars.toLocaleString()}`));
  console.log(chalk.cyan(`  中文字符:    ${chineseChars.toLocaleString()}`));
  console.log(chalk.green(`  Token 数:    ${tokens.toLocaleString()}`));
  console.log(chalk.white('═'.repeat(50)));
  
  return { file, model, tokens, totalChars, chineseChars };
}

/**
 * 对比压缩前后
 */
async function compareCompression(file, options) {
  const { compressText } = require('../compressor/context');
  const models = (options.models || 'deepseek,glm,minimax,hunyuan,kimi').split(',');
  const mode = options.mode || 'full';
  
  console.log(chalk.blue(`\n🔬 压缩对比分析: ${file}`));
  console.log(chalk.gray(`   压缩模式: ${mode}\n`));
  
  const content = fs.readFileSync(file, 'utf-8');
  const compressed = compressText(content, mode);
  
  // 计算原始 token
  const originalTokens = countTextTokens(content);
  
  // 对每个模型统计
  console.log(chalk.white('═'.repeat(65)));
  console.log(chalk.bold(`  ${'模型'.padEnd(12)} ${'原始Token'.padEnd(12)} ${'压缩Token'.padEnd(12)} ${'节省'.padEnd(10)} ${'节省率'}`));
  console.log(chalk.white('═'.repeat(65)));
  
  const results = [];
  for (const model of models) {
    const orig = countTextTokens(content, model.trim());
    const comp = countTextTokens(compressed, model.trim());
    const saved = orig - comp;
    const pct = orig > 0 ? ((saved / orig) * 100).toFixed(1) : '0.0';
    
    results.push({ model: model.trim(), original: orig, compressed: comp, saved, pct });
    console.log(`  ${model.trim().padEnd(12)} ${String(orig).padEnd(12)} ${String(comp).padEnd(12)} ${String(saved).padEnd(10)} ${pct}%`);
  }
  
  console.log(chalk.white('═'.repeat(65)));
  
  // 显示压缩后文本预览
  console.log(chalk.yellow('\n📝 压缩后文本预览 (前300字符):'));
  console.log(chalk.gray('─'.repeat(65)));
  console.log(compressed.substring(0, 300) + (compressed.length > 300 ? '...' : ''));
  console.log(chalk.gray('─'.repeat(65)));
  
  return results;
}

module.exports = { countTokens, compareCompression, countTextTokens, countChineseChars, countEnglishWords };
