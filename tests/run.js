/**
 * 自动化测试脚本
 * 
 * 验证 Token Saver 工具的各项功能：
 * 1. System Prompt 生成
 * 2. 文本压缩
 * 3. Token 计数
 * 4. 多模型 Benchmark
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

const { countTextTokens } = require('../src/monitor/token-counter');
const { compressText } = require('../src/compressor/context');
const { generateSystemPrompt, generateWorkBuddySystem } = require('../src/compressor/output');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(chalk.green(`  ✅ ${name}`));
    passed++;
  } catch (e) {
    console.log(chalk.red(`  ❌ ${name}: ${e.message}`));
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

console.log(chalk.blue.bold('\n🧪 WorkBuddy Token Saver 自动化测试\n'));

// ============ 1. System Prompt 测试 ============
console.log(chalk.yellow('📋 1. System Prompt 生成测试'));

test('Full 模式生成中文 prompt', () => {
  const prompt = generateSystemPrompt('full');
  assert(prompt.includes('输出风格'), '应包含输出风格');
  assert(prompt.includes('原始人模式'), '应包含原始人模式');
  assert(prompt.includes('代码块不变'), '应包含代码块不变');
});

test('Ultra 模式生成中文 prompt', () => {
  const prompt = generateSystemPrompt('ultra');
  assert(prompt.includes('极致压缩'), '应包含极致压缩');
  assert(prompt.includes('电报体'), '应包含电报体');
});

test('Wenyan 模式生成中文 prompt', () => {
  const prompt = generateSystemPrompt('wenyan');
  assert(prompt.includes('文言'), '应包含文言');
});

test('生成 WorkBuddy 完整 System Prompt', () => {
  const sys = generateWorkBuddySystem('full');
  assert(sys.includes('Token 节省策略'), '应包含Token节省策略');
  assert(sys.includes('输入侧优化'), '应包含输入侧优化');
  assert(sys.includes('输出侧优化'), '应包含输出侧优化');
});

// ============ 2. 文本压缩测试 ============
console.log(chalk.yellow('\n📋 2. 文本压缩测试'));

test('Lite 模式压缩去除填充词', () => {
  const input = '当然没问题！让我来帮你看看这个问题吧。';
  const output = compressText(input, 'lite');
  assert(output.length < input.length, '压缩后应更短');
  assert(!output.includes('当然'), '应去除"当然"');
  assert(!output.includes('没问题'), '应去除"没问题"');
});

test('Full 模式压缩中文短语', () => {
  const input = '因为这个组件使用了useEffect，所以需要添加依赖数组，但是目前没有添加，因此会出现无限循环的问题。';
  const output = compressText(input, 'full');
  assert(output.length < input.length, '压缩后应更短');
  assert(output.includes('因'), '应将"因为"缩为"因"');
  assert(!output.includes('因为'), '不应保留"因为"');
});

test('Ultra 模式极致压缩', () => {
  const input = '使用useMemo来优化这个组件的性能问题，解决重复渲染的情况。';
  const output = compressText(input, 'ultra');
  assert(output.includes('用'), '应将"使用"缩为"用"');
  assert(output.includes('解'), '应将"解决"缩为"解"');
});

test('压缩保护代码块', () => {
  const input = '当然，这是代码：\n```js\nconst x = 1;\n```\n很高兴帮你！';
  const output = compressText(input, 'full');
  assert(output.includes('```js'), '应保留代码块起始标记');
  assert(output.includes('const x = 1'), '应保留代码内容');
  assert(output.includes('```'), '应保留代码块结束标记');
});

test('压缩保护 URL', () => {
  const input = '请参考 https://github.com/example/repo 这个地址，谢谢！';
  const output = compressText(input, 'full');
  assert(output.includes('https://github.com/example/repo'), '应保留URL');
});

// ============ 3. Token 计数测试 ============
console.log(chalk.yellow('\n📋 3. Token 计数测试'));

test('英文 Token 计数', () => {
  const tokens = countTextTokens('Hello world', 'gpt-4');
  assert(tokens >= 2 && tokens <= 4, `英文"Hello world"应为2-4个token，实际: ${tokens}`);
});

test('中文 Token 计数', () => {
  const tokens = countTextTokens('你好世界', 'gpt-4');
  assert(tokens > 0, '中文应产生正数token');
});

test('混合中英文 Token 计数', () => {
  const tokens = countTextTokens('使用 React 的 useState Hook', 'gpt-4');
  assert(tokens > 0, '混合文本应产生正数token');
});

test('DeepSeek 模型调整系数', () => {
  const text = '这是一个中文测试句子';
  const baseTokens = countTextTokens(text, 'gpt-4');
  const deepseekTokens = countTextTokens(text, 'deepseek');
  assert(deepseekTokens <= baseTokens, 'DeepSeek中文token应少于等于gpt-4');
});

// ============ 4. 压缩效果验证 ============
console.log(chalk.yellow('\n📋 4. 压缩效果验证'));

test('Full 模式输出压缩率 > 15%', () => {
  const verbose = '好的！当然没问题！让我来非常详细地分析一下这个问题。首先呢，我们来看一下这个情况。这是一个非常严重的问题。另外，也没有处理各种状态。最后，也缺少了必要的配置。希望这个分析可以帮助到你，如果还有疑问可以随时问我哦。';
  const compressed = compressText(verbose, 'full');
  const ratio = 1 - (compressed.length / verbose.length);
  assert(ratio > 0.15, `压缩率应为>15%，实际: ${(ratio*100).toFixed(1)}%`);
});

test('Ultra 模式输出压缩率 > 25%', () => {
  const verbose = '好的！当然没问题！让我来非常非常详细地分析一下这个问题。首先呢，我们来看一下这个情况。这是一个非常严重的问题呢。另外，也没有处理各种状态。最后，也缺少了必要的配置。希望这个分析可以帮助到你，如果还有疑问可以随时问我哦。';
  const compressed = compressText(verbose, 'ultra');
  const ratio = 1 - (compressed.length / verbose.length);
  assert(ratio > 0.25, `压缩率应为>25%，实际: ${(ratio*100).toFixed(1)}%`);
});

// ============ 5. 安全兜底测试 ============
console.log(chalk.yellow('\n📋 5. 安全兜底测试'));

test('Full 模式 System Prompt 包含安全兜底', () => {
  const prompt = generateSystemPrompt('full');
  assert(prompt.includes('安全'), '应包含安全相关提示');
  assert(prompt.includes('不可逆'), '应包含不可逆操作提示');
});

test('Ultra 模式 System Prompt 包含完整规则', () => {
  const prompt = generateSystemPrompt('ultra');
  assert(prompt.includes('极致压缩'), '应包含极致压缩');
  assert(prompt.includes('电报体'), '应包含电报体');
  assert(prompt.includes('代码'), '应提到代码保护');
});

// ============ 结果汇总 ============
console.log(chalk.blue.bold('\n═══════════════════════════════════'));
console.log(chalk.blue.bold('  测试结果汇总'));
console.log(chalk.blue.bold('═══════════════════════════════════'));
console.log(chalk.green(`  ✅ 通过: ${passed}`));
if (failed > 0) {
  console.log(chalk.red(`  ❌ 失败: ${failed}`));
}
console.log(chalk.blue.bold('═══════════════════════════════════\n'));

if (failed > 0) {
  process.exit(1);
}
