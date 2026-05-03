/**
 * tokensaver v2.0 — 新增模块测试
 * 测试从 tokcut 移植的模块：ContentProtector, InputCompressor, 
 * SemanticCache, PostProcessor, ProxyServer
 */

const chalk = require('chalk');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(chalk.green(`  ✅ ${name}`));
  } catch (e) {
    failed++;
    console.log(chalk.red(`  ❌ ${name}`));
    console.log(chalk.red(`     ${e.message}`));
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

console.log(chalk.cyan('\n🧪 tokensaver v2.0 — 新增模块测试 (tokcut 移植)\n'));

// =====================
// 6. Content Protector
// =====================
console.log(chalk.yellow('📋 6. Content Protector 测试'));

const { ContentProtector } = require('../src/protector/content-protector');

test('保护并还原代码块', () => {
  const p = new ContentProtector();
  const text = 'hello ```python\nprint("hi")\n``` world';
  const protected_ = p.protect(text);
  assert(!protected_.includes('```'), '代码块应被保护');
  const restored = p.restore(protected_);
  assert(restored === text, '还原后应与原文一致');
});

test('保护并还原 URL', () => {
  const p = new ContentProtector();
  const text = 'visit https://api.deepseek.com/v1 for details';
  const protected_ = p.protect(text);
  assert(!protected_.includes('https://'), 'URL 应被保护');
  const restored = p.restore(protected_);
  assert(restored === text, '还原后应与原文一致');
});

test('保护行内代码', () => {
  const p = new ContentProtector();
  const text = 'use `useMemo` for optimization';
  const protected_ = p.protect(text);
  assert(!protected_.includes('`useMemo`'), '行内代码应被保护');
  const restored = p.restore(protected_);
  assert(restored === text, '还原后应与原文一致');
});

test('保护版本号', () => {
  const p = new ContentProtector();
  const text = 'Python 3.12.5 is required';
  const protected_ = p.protect(text);
  assert(!protected_.includes('3.12.5'), '版本号应被保护');
  const restored = p.restore(protected_);
  assert(restored === text, '还原后应与原文一致');
});

// =====================
// 7. Input Compressor
// =====================
console.log(chalk.yellow('\n📋 7. Input Compressor 测试'));

const { InputCompressor } = require('../src/compressor/input');

test('Safe 模式去重行', () => {
  const c = new InputCompressor('safe');
  const result = c.compressText('hello\nhello\nworld');
  assert(!result.includes('hello\nhello'), '重复行应被去除');
  assert(result.includes('world'), '应保留非重复内容');
});

test('Safe 模式过滤填充词', () => {
  const c = new InputCompressor('safe');
  const result = c.compressText('请 please 帮我看看这段代码');
  // '请' is in filler words
  assert(result.length < '请 please 帮我看看这段代码'.length, '应缩短');
});

test('Aggressive 模式压缩更狠', () => {
  const c1 = new InputCompressor('safe');
  const c2 = new InputCompressor('aggressive');
  const long = 'A'.repeat(500) + ' 请 请 请 真的 真的 非常';
  const r1 = c1.compressText(long);
  const r2 = c2.compressText(long);
  assert(r1.length > r2.length, 'Aggressive 应比 Safe 压缩更多');
});

test('代码块在压缩时被保护', () => {
  const c = new InputCompressor('aggressive');
  const result = c.compressText('```js\nconst x = 1;\n```');
  assert(result.includes('const x = 1;'), '代码块内容应完整保留');
});

// =====================
// 8. Semantic Cache
// =====================
console.log(chalk.yellow('\n📋 8. Semantic Cache 测试'));

const { SemanticCache } = require('../src/cache/semantic-cache');

test('缓存命中相同消息', () => {
  const c = new SemanticCache({ enabled: true, ttl_minutes: 1 });
  const msg = [{ role: 'user', content: 'What is Node.js?' }];
  c.set(msg, { answer: 'a JS runtime' });
  const result = c.get(msg);
  assert(result !== null, '应命中缓存');
  assert(result.answer === 'a JS runtime', '内容应正确');
});

test('完全不同的消息不命中', () => {
  const c = new SemanticCache({ enabled: true, threshold: 0.9, ttl_minutes: 1 });
  c.set([{ role: 'user', content: 'What is Node.js?' }], { answer: 'a JS runtime' });
  const result = c.get([{ role: 'user', content: 'How to train a neural network from scratch with PyTorch?' }]);
  assert(result === null, '完全不同不应命中');
});

test('缓存过期', () => {
  const c = new SemanticCache({ enabled: true, ttl_minutes: 0.001 }); // 60ms
  c.set([{ role: 'user', content: 'test' }], { answer: 'ok' });
  // 等待过期
  const start = Date.now();
  while (Date.now() - start < 100) { /* wait */ }
  c._cleanup();
  const result = c.get([{ role: 'user', content: 'test' }]);
  assert(result === null, '过期后不应命中');
});

test('缓存统计正确', () => {
  const c = new SemanticCache({ enabled: true, ttl_minutes: 1 });
  c.set([{ role: 'user', content: 'q1' }], { a: 1 });
  c.get([{ role: 'user', content: 'q1' }]); // hit
  c.get([{ role: 'user', content: 'q2' }]); // miss
  const stats = c.getStats();
  assert(stats.hits === 1, 'hits 应为 1');
  assert(stats.misses === 1, 'misses 应为 1');
  assert(stats.size === 1, 'size 应为 1');
});

// =====================
// 9. Post Processor
// =====================
console.log(chalk.yellow('\n📋 9. Post Processor 测试'));

const { PostProcessor } = require('../src/post-processor');

test('去除英文引导语', () => {
  const p = new PostProcessor();
  const result = p.process('Sure! Here is the answer:\n\nThe sky is blue.');
  assert(!result.startsWith('Sure'), '应去除 Sure!');
});

test('去除中文引导语', () => {
  const p = new PostProcessor();
  const result = p.process('好的，让我来帮你解决这个问题。首先需要安装依赖。');
  assert(!result.startsWith('好的'), '应去除"好的"');
});

test('去除"以下是"引导', () => {
  const p = new PostProcessor();
  const result = p.process('以下是解决方案：\n\n1. 第一步\n2. 第二步');
  assert(!result.startsWith('以下是'), '应去除"以下是"');
});

test('代码块在后处理中被保护', () => {
  const p = new PostProcessor();
  const result = p.process('好的，```js\nconst x = 1;\n``` 这是答案');
  assert(result.includes('```js'), '代码块应保留');
  assert(result.includes('const x = 1;'), '代码内容应保留');
});

// =====================
// 10. Output Compressor (enhanced)
// =====================
console.log(chalk.yellow('\n📋 10. Output Compressor 增强测试'));

const { generateSystemPrompt } = require('../src/compressor/output');

test('支持 cn-full 模式', () => {
  const prompt = generateSystemPrompt('cn-full');
  assert(prompt.includes('原始人模式'), '应包含中文 Caveman 提示');
});

test('支持 en-full 模式 (tokcut 移植)', () => {
  const prompt = generateSystemPrompt('en-full');
  assert(prompt.includes('Caveman'), '应包含英文 Caveman 提示');
});

test('支持 wenyan 模式', () => {
  const prompt = generateSystemPrompt('wenyan');
  assert(prompt.includes('文言'), '应包含文言提示');
});

test('短名 full 映射到 cn-full', () => {
  const prompt = generateSystemPrompt('full');
  assert(prompt.includes('原始人模式'), '短名 full 应映射到 cn-full');
});

// =====================
// Summary
// =====================
console.log(chalk.cyan('\n' + '═'.repeat(50)));
console.log(chalk.cyan('  测试结果汇总'));
console.log(chalk.cyan('═'.repeat(50)));
console.log(chalk.green(`  ✅ 通过: ${passed}`));
if (failed > 0) {
  console.log(chalk.red(`  ❌ 失败: ${failed}`));
}
console.log(chalk.cyan('═'.repeat(50) + '\n'));

if (failed > 0) {
  process.exit(1);
}
