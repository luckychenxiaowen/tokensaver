/**
 * 上下文文件压缩模块
 * 
 * 参考 caveman-compress 原理：
 * - 压缩规则文件、记忆文件等上下文
 * - 保留代码块、URL、路径、技术术语逐字节不变
 * - 去除冗余描述、填充词、重复内容
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

// ============ 中文压缩规则 ============
const CN_FILLER_PATTERNS = [
  // 句末语气词
  { pattern: /[的了呢吧啊嘛呀哦哈嘿哟]+/g, replacement: '' },
  // 冗余副词
  { pattern: /(非常|十分|特别|相当|极其|格外|异常|无比)/g, replacement: '' },
  // 冗余连词
  { pattern: /(而且|并且|此外|另外|同时|与此同时)/g, replacement: ';' },
  // 冗余程度修饰
  { pattern: /(比较|较为|相对|略|稍微|有点|有些)/g, replacement: '' },
  // 填充短语
  { pattern: /(当然|没问题|很高兴|我可以帮你|没问题|好的[，,]|让我|请你|麻烦你)/g, replacement: '' },
  { pattern: /([，,]\s*)+/g, replacement: '，' },
  { pattern: /([。.]\s*)+\s*/g, replacement: '。' },
  { pattern: /\s{2,}/g, replacement: ' ' },
];

const EN_FILLER_PATTERNS = [
  // Articles
  { pattern: /\b(the|a|an)\s+/gi, replacement: '' },
  // Filler words
  { pattern: /\b(just|really|basically|actually|simply|quite|rather|very|extremely|definitely|certainly|absolutely)\s+/gi, replacement: '' },
  // Pleasantries
  { pattern: /\b(sure|certainly|of course|happy to|glad to|I would|I will|please|kindly)\s*/gi, replacement: '' },
  // Hedging
  { pattern: /\b(perhaps|maybe|possibly|potentially|generally|typically|usually)\s*/gi, replacement: '' },
  // Extra spaces
  { pattern: /\s{2,}/g, replacement: ' ' },
];

/**
 * 核心文本压缩函数
 */
function compressText(text, mode = 'full') {
  let result = text;
  
  // 提取并保护代码块
  const codeBlocks = [];
  result = result.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });
  
  // 提取并保护 URL
  const urls = [];
  result = result.replace(/https?:\/\/[^\s]+/g, (match) => {
    urls.push(match);
    return `__URL_${urls.length - 1}__`;
  });
  
  // 提取并保护文件路径
  const paths = [];
  result = result.replace(/(?:[A-Za-z]:\\[^\s,;]+|\/[^\s,;]+)/g, (match) => {
    if (match.includes('\\') || match.includes('/')) {
      paths.push(match);
      return `__PATH_${paths.length - 1}__`;
    }
    return match;
  });
  
  // 根据模式应用压缩
  switch (mode) {
    case 'lite':
      result = applyLiteCompression(result);
      break;
    case 'full':
      result = applyFullCompression(result);
      break;
    case 'ultra':
      result = applyUltraCompression(result);
      break;
    case 'wenyan':
      result = applyWenyanCompression(result);
      break;
    default:
      result = applyFullCompression(result);
  }
  
  // 恢复保护的内容
  codeBlocks.forEach((block, i) => {
    result = result.replace(`__CODE_BLOCK_${i}__`, block);
  });
  urls.forEach((url, i) => {
    result = result.replace(`__URL_${i}__`, url);
  });
  paths.forEach((p, i) => {
    result = result.replace(`__PATH_${i}__`, p);
  });
  
  // 清理多余空白
  result = result.replace(/\n{4,}/g, '\n\n\n');
  result = result.replace(/[ \t]+$/gm, '');
  
  return result.trim();
}

function applyLiteCompression(text) {
  // Lite 模式：仅去除明显的填充词和语气词
  let result = text;
  
  // 中文填充词
  result = result.replace(/(当然|没问题|很高兴|我可以帮你|好的[，,])\s*/g, '');
  result = result.replace(/(呢|吧|啊|嘛|呀|哦|哈|嘿|哟)/g, '');
  
  // 英文填充词
  result = result.replace(/\b(sure|certainly|of course|happy to|glad to)\s*/gi, '');
  
  return result;
}

function applyFullCompression(text) {
  // Full 模式：全面压缩
  let result = text;
  
  // 应用所有中文规则
  for (const rule of CN_FILLER_PATTERNS) {
    result = result.replace(rule.pattern, rule.replacement);
  }
  
  // 应用英文规则
  for (const rule of EN_FILLER_PATTERNS) {
    result = result.replace(rule.pattern, rule.replacement);
  }
  
  // 合并连续标点
  result = result.replace(/[，,]{2,}/g, '，');
  result = result.replace(/[。.]{2,}/g, '。');
  result = result.replace(/[；;]{2,}/g, '；');
  
  // 移除空括号
  result = result.replace(/[（(]\s*[）)]/g, '');
  
  // 缩短常用短语
  const phraseMap = {
    '因为': '因',
    '所以': '故',
    '但是': '但',
    '如果': '若',
    '虽然': '虽',
    '应该': '应',
    '可以': '可',
    '需要': '需',
    '已经': '已',
    '没有': '无',
    '这个': '此',
    '那个': '彼',
    '什么': '何',
    '怎么': '如何',
    '为什么': '为何',
    '在哪里': '何处',
    '什么时候': '何时',
    '这样': '如此',
    '的方法': '之法',
    '的问题': '之题',
    '对于': '对',
    '通过': '以',
    '根据': '据',
  };
  
  for (const [long, short] of Object.entries(phraseMap)) {
    result = result.replace(new RegExp(long, 'g'), short);
  }
  
  return result;
}

function applyUltraCompression(text) {
  // Ultra 模式：极致压缩
  let result = applyFullCompression(text);
  
  // 更激进的压缩
  const ultraMap = {
    '使用': '用',
    '进行': '做',
    '处理': '理',
    '实现': '现',
    '提供': '供',
    '支持': '支',
    '包括': '含',
    '关于': '关',
    '以及': '与',
    '或者': '或',
    '并且': '且',
    '因此': '故',
    '然而': '然',
    '不过': '但',
    '然后': '则',
    '之后': '后',
    '之前': '前',
    '上面': '上',
    '下面': '下',
    '里面': '内',
    '外面': '外',
    '功能': '功',
    '问题': '题',
    '解决': '解',
    '方式': '法',
    '情况': '况',
    '数据': '据',
    '信息': '信',
    '用户': '户',
    '系统': '系',
    '文件': '档',
    '代码': '码',
    '错误': '错',
    '结果': '果',
    '参数': '参',
  };
  
  for (const [long, short] of Object.entries(ultraMap)) {
    result = result.replace(new RegExp(long, 'g'), short);
  }
  
  // 移除大部分标点间的空格
  result = result.replace(/\s*([，,。.；;：:！!？?])\s*/g, '$1');
  
  return result;
}

function applyWenyanCompression(text) {
  // 文言文模式：尝试将现代中文转为简洁表达
  let result = text;
  
  // 这只是近似转换，真正的文言文需要 LLM 协助
  const wenyanMap = {
    '是因为': '盖',
    '的原因': '之因',
    '指的是': '即',
    '也就是说': '换言之',
    '例如': '如',
    '比如': '譬如',
    '所以': '故',
    '因此': '是以',
    '但是': '然',
    '虽然': '虽',
    '如果': '若',
    '应该': '当',
    '可以': '可',
    '需要': '须',
    '已经': '已',
    '没有': '无',
    '所有': '诸',
    '这个': '此',
    '那个': '彼',
    '这些': '此等',
    '那些': '彼等',
    '不是': '非',
    '不会': '弗',
    '不能': '毋',
    '不要': '勿',
    '在': '于',
    '从': '自',
    '到': '至',
    '和': '与',
    '的': '之',
  };
  
  for (const [modern, classical] of Object.entries(wenyanMap)) {
    result = result.replace(new RegExp(modern, 'g'), classical);
  }
  
  return result;
}

/**
 * 判断文件是否需要压缩（跳过二进制文件等）
 */
function shouldCompress(filePath) {
  const skipExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.ico', '.pdf', '.zip', '.gz', '.exe', '.dll', '.so', '.o', '.bin'];
  const ext = path.extname(filePath).toLowerCase();
  return !skipExtensions.includes(ext);
}

/**
 * compress 命令实现
 */
async function compressFile(file, options) {
  const mode = options.mode || 'full';
  const outputFile = options.output || file.replace(/\.(\w+)$/, '.compressed.$1');
  
  if (!fs.existsSync(file)) {
    console.error(chalk.red(`❌ 文件不存在: ${file}`));
    process.exit(1);
  }
  
  if (!shouldCompress(file)) {
    console.log(chalk.yellow(`⚠️  跳过非文本文件: ${file}`));
    return;
  }
  
  console.log(chalk.blue(`\n🪨 正在压缩文件: ${file}`));
  console.log(chalk.gray(`   模式: ${mode}`));
  
  const content = fs.readFileSync(file, 'utf-8');
  const compressed = compressText(content, mode);
  
  const originalSize = content.length;
  const compressedSize = compressed.length;
  const saved = originalSize - compressedSize;
  const pct = originalSize > 0 ? ((saved / originalSize) * 100).toFixed(1) : '0.0';
  
  console.log(chalk.white('  ──────────────────────────────'));
  console.log(chalk.cyan(`  原始大小:  ${originalSize.toLocaleString()} 字符`));
  console.log(chalk.cyan(`  压缩后:    ${compressedSize.toLocaleString()} 字符`));
  console.log(chalk.green(`  节省:      ${saved.toLocaleString()} 字符 (${pct}%)`));
  console.log(chalk.white('  ──────────────────────────────'));
  
  if (!options.dryRun) {
    // 备份原文件
    const backupFile = file.replace(/\.(\w+)$/, '.original.$1');
    fs.copyFileSync(file, backupFile);
    
    fs.writeFileSync(outputFile, compressed, 'utf-8');
    console.log(chalk.green(`✅ 压缩完成: ${outputFile}`));
    console.log(chalk.gray(`   原文件备份: ${backupFile}`));
  } else {
    console.log(chalk.yellow('\n📝 压缩后预览 (前500字符):'));
    console.log(chalk.gray('─'.repeat(60)));
    console.log(compressed.substring(0, 500));
    if (compressed.length > 500) console.log(chalk.gray('...(省略)'));
    console.log(chalk.gray('─'.repeat(60)));
  }
}

module.exports = { compressText, compressFile, applyLiteCompression, applyFullCompression, applyUltraCompression, applyWenyanCompression };
