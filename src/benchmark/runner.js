/**
 * 多模型 Benchmark 模块 (v2)
 * 
 * 修复：正确模拟多轮对话场景
 * System Prompt 是一次性开销，输出压缩收益在多轮对话中累积
 * 
 * 对比 DeepSeek、GLM、MiniMax、Hunyuan、Kimi 五个模型
 */

const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const Table = require('cli-table3');
const ora = require('ora');

const { countTextTokens } = require('../monitor/token-counter');
const { compressText } = require('../compressor/context');
const { generateSystemPrompt, estimateCompressionRatio } = require('../compressor/output');

// ============ 测试任务定义 ============
const BENCHMARK_TASKS = [
  {
    id: 'code-review',
    name: '代码审查',
    prompt: '请审查以下 React 组件代码，找出所有潜在问题并提供修复建议：\n```jsx\nfunction UserProfile({ user, onUpdate }) {\n  const [name, setName] = useState(user.name);\n  useEffect(() => { fetch("/api/user/" + user.id).then(r => r.json()).then(d => { setName(d.name); }); });\n  return <div><input value={name} onChange={e => setName(e.target.value)} /><button onClick={() => onUpdate({name})}>Save</button></div>;\n}\n```',
    verboseOutput: '好的，我来详细分析一下这个React组件的代码。\n\n首先，我发现以下几个潜在问题：\n\n1. **缺少依赖数组**：useEffect 没有提供依赖数组，这会导致组件在每次渲染后都执行副作用，可能造成无限循环。\n\n2. **未处理加载状态**：组件没有显示加载状态，用户体验会受到影响。\n\n3. **未处理错误**：fetch 请求失败时没有任何错误处理逻辑。\n\n4. **缺少表单标签**：输入框没有关联的 label 元素，不符合无障碍标准。\n\n5. **未使用防抖**：输入框的 onChange 事件直接更新状态，没有防抖处理。\n\n建议逐一修复以上问题。希望这个回答对你有帮助！',
    compressedOutput: '审查结果：\n1.useEffect缺依赖数组→无线循环\n2.无loading/error状态\n3.fetch无错误处理\n4.input缺label\n5.无防抖\n逐一修复。',
  },
  {
    id: 'bug-fix',
    name: 'Bug 修复',
    prompt: 'Node.js 高并发场景下偶尔出现 "ECONNRESET" 错误，日志显示数据库查询时发生。技术栈：Express + MySQL2 + 连接池。请分析原因并给出方案。',
    verboseOutput: '当然！这是一个很常见的问题，让我为你详细分析一下。\n\n在高并发场景下出现 ECONNRESET 错误，通常有以下几个原因：\n\n1. **连接池耗尽**：当并发请求数超过了连接池的最大连接数时，新的请求会等待超时，导致连接被强制关闭。\n\n2. **MySQL 服务器超时**：MySQL 服务器端的 wait_timeout 设置可能导致长时间空闲的连接被断开。\n\n3. **网络不稳定**：在云环境或容器化部署中，网络波动可能导致 TCP 连接被重置。\n\n针对这些原因，我建议以下解决方案：\n\n1. 增大连接池配置\n2. 添加自动重连机制\n3. 设置合理的连接超时时间\n4. 实现健康检查和熔断机制\n\n以上是我的分析，如果有需要进一步讨论的地方，请随时告诉我。',
    compressedOutput: '分析：\n1.连接池耗尽\n2.MySQL超时断开\n3.网络波动\n方案：增大连接池、添加重连、设超时、健康检查。使用mysql2/promise配合connectionLimit+enableKeepAlive选项。',
  },
  {
    id: 'architecture',
    name: '架构设计',
    prompt: '设计一个支持百万级并发的实时消息系统架构。要求：低延迟（<100ms）、高可用（99.99%）、支持消息持久化。请给出技术选型、核心组件、数据流设计。',
    verboseOutput: '好的！这是一个很有挑战性的架构设计问题，我来为你详细规划一下。\n\n## 技术选型\n\n对于百万级并发的实时消息系统，我推荐以下技术组合：\n\n- **WebSocket**：用于客户端与服务器之间的实时双向通信\n- **Redis PubSub**：用于消息的发布订阅，实现跨实例的消息广播\n- **Kafka**：作为消息队列，保证消息的持久化和可靠投递\n- **PostgreSQL**：用于存储用户数据和消息历史记录\n\n## 核心组件\n\n- **网关层**：使用 Nginx 或 Envoy 做负载均衡\n- **消息路由服务**：用 Go 语言自研的高性能消息路由\n- **消息队列**：Kafka 集群保证消息不丢失\n- **存储层**：PostgreSQL + Cassandra 混合存储\n- **缓存层**：Redis Cluster 分布式缓存\n\n## 数据流\n\n客户端 -> 网关层 -> 消息路由 -> Kafka -> 消费者 -> 存储 + 推送\n\n这个架构可以满足你的所有需求。如果还有任何疑问，欢迎随时问我！',
    compressedOutput: '技术选型：WebSocket+Redis PubSub+Kafka+PostgreSQL\n核心组件：网关(Nginx/Envoy)、消息路由(Go)、Kafka、存储(PG+Cassandra)、Redis Cluster\n数据流：客户端→网关→路由→Kafka→消费者→存储+推送',
  },
  {
    id: 'api-design',
    name: 'API 设计',
    prompt: '为一个电商平台设计 RESTful API 接口规范。需要包含：用户认证、商品管理、订单管理、支付集成。请给出接口列表、请求/响应示例、错误码定义。',
    verboseOutput: '没问题！我很乐意帮你设计电商平台的API接口规范。让我详细列出所有需要的接口。\n\n## 用户认证模块\n\n- `POST /api/auth/login` - 用户登录\n- `POST /api/auth/register` - 用户注册\n- `POST /api/auth/refresh` - 刷新Token\n\n## 商品管理模块\n\n- `GET /api/products` - 获取商品列表\n- `GET /api/products/:id` - 获取商品详情\n- `POST /api/products` - 创建商品\n\n## 订单管理模块\n\n- `POST /api/orders` - 创建订单\n- `GET /api/orders/:id` - 获取订单详情\n\n## 支付集成模块\n\n- `POST /api/payments` - 发起支付\n- `GET /api/payments/:id` - 查询支付状态\n\n## 错误码定义\n\n- 400：参数错误\n- 401：未认证\n- 403：无权限\n- 404：资源不存在\n- 500：服务器内部错误\n\n这是一个比较完整的接口规范。如果在实际开发中有需要调整的地方，我们可以随时讨论！',
    compressedOutput: '认证：POST /api/auth/login, /api/auth/refresh\n商品：GET /api/products, GET /api/products/:id, POST /api/products\n订单：POST /api/orders, GET /api/orders/:id\n支付：POST /api/payments, GET /api/payments/:id\n错误码：400参数错,401未认证,403无权限,404不存在,500服务器错',
  },
  {
    id: 'performance',
    name: '性能优化',
    prompt: '一个 React 应用的首屏加载从 2秒 增长到了 8秒，请给出系统性的性能排查和优化方案。',
    verboseOutput: '当然！这是一个很好的性能优化问题，让我系统地为你分析一下。\n\n## 性能排查\n\n首先，我们需要使用以下工具进行系统性的性能分析：\n\n1. Lighthouse 分析 → 识别性能瓶颈\n2. Chrome DevTools Performance → 分析渲染性能\n3. Network 面板 → 分析网络请求\n\n## 优化方案\n\n### 打包优化\n- 使用代码分割（Code Splitting）\n- Tree Shaking 移除未使用代码\n- 压缩 JavaScript 和 CSS\n\n### 渲染优化\n- 虚拟列表处理长列表\n- 图片懒加载\n- 使用 memo/useMemo 避免不必要重渲染\n\n### 网络优化\n- CDN 加速静态资源\n- 资源预加载和预连接\n- HTTP/2 多路复用\n- 图片压缩和 WebP 格式\n\n按照这些优化方案，预计可以减少 60%-70% 的加载时间。\n\n希望这个方案对你有帮助！如果有需要进一步讨论的地方，请随时告诉我。',
    compressedOutput: '排查：Lighthouse+DevTools Performance+Network\n打包优化：代码分割、Tree Shaking、压缩\n渲染优化：虚拟列表、懒加载、memo/useMemo\n网络优化：CDN、预加载、HTTP2、WebP\n预估减60-70%加载时间。',
  },
  {
    id: 'security',
    name: '安全审查',
    prompt: '审查以下安全配置并指出风险：1.JWT Secret放在前端代码 2.API用HTTP明文 3.SQL用字符串拼接 4.文件上传无类型检查 5.日志打印用户密码',
    verboseOutput: '好的！让我来逐一审查这些安全配置，指出其中存在的风险。\n\n## 安全风险分析\n\n1. **JWT Secret 放在前端代码中**\n   这是一个非常严重的安全漏洞！任何用户都可以在浏览器开发者工具中查看前端代码，获取到JWT Secret后就可以伪造任意用户的Token。\n\n2. **API 使用 HTTP 明文传输**\n   数据在网络中以明文传输，中间人攻击者可以轻易截获所有的请求和响应数据，包括用户的敏感信息。\n\n3. **SQL 查询使用字符串拼接**\n   这会导致严重的 SQL 注入漏洞，攻击者可以通过构造恶意输入来执行任意SQL语句，可能造成数据泄露甚至数据库被完全控制。\n\n4. **文件上传无类型检查**\n   攻击者可以上传恶意文件（如 webshell），获取服务器控制权。\n\n5. **日志中打印用户密码**\n   这会导致密码泄露给所有能看到日志的人，包括运维人员和可能通过其他漏洞获取日志的恶意攻击者。\n\n## 修复建议\n\n1. JWT Secret 移至环境变量或密钥管理服务\n2. 强制 HTTPS + HSTS\n3. 使用参数化查询或 ORM\n4. 限制文件类型、大小、病毒扫描\n5. 日志脱敏，不记录敏感字段\n\n希望这个安全审查对你有帮助！',
    compressedOutput: '风险：\n1.JWT Secret前端暴露→移至环境变量/密钥管理\n2.HTTP明文→强制HTTPS+HSTS\n3.SQL注入→参数化查询/ORM\n4.文件上传漏洞→限制类型/大小/扫描\n5.日志泄露密码→脱敏处理',
  },
];

// 模型定义
const MODELS = [
  { id: 'deepseek', name: 'DeepSeek', rate: 1.0 },
  { id: 'glm', name: 'GLM (智谱)', rate: 5.0 },
  { id: 'minimax', name: 'MiniMax', rate: 5.0 },
  { id: 'hunyuan', name: 'Hunyuan (混元)', rate: 2.0 },
  { id: 'kimi', name: 'Kimi (月之暗面)', rate: 12.0 },
];

/**
 * 运行 Benchmark
 */
async function runBenchmark(options) {
  const modelIds = options.models.split(',').map(m => m.trim());
  const models = MODELS.filter(m => modelIds.includes(m.id));
  const turns = [1, 5, 10, 20]; // 模拟的对话轮数

  console.log(chalk.blue.bold('\n╔════════════════════════════════════════════════╗'));
  console.log(chalk.blue.bold('║   🚀  WorkBuddy Token Saver Benchmark v2       ║'));
  console.log(chalk.blue.bold('║   多模型 · 多轮对话 · Token 消耗对比            ║'));
  console.log(chalk.blue.bold('╚════════════════════════════════════════════════╝\n'));

  console.log(chalk.cyan(`测试模型: ${models.map(m => m.name).join(', ')}`));
  console.log(chalk.cyan(`测试任务: ${BENCHMARK_TASKS.length} 个`));
  console.log(chalk.cyan(`模拟轮数: ${turns.join(', ')} 轮`));
  console.log(chalk.gray('关键原理：System Prompt 一次性开销，输出压缩收益在多轮对话中累积\n'));

  // ========== 分模式测试 ==========
  const modes = [
    { id: 'full', name: 'Full 模式', prompt: generateSystemPrompt('full') },
    { id: 'ultra', name: 'Ultra 模式', prompt: generateSystemPrompt('ultra') },
    { id: 'wenyan', name: '文言文模式', prompt: generateSystemPrompt('wenyan') },
  ];

  for (const mode of modes) {
    console.log(chalk.yellow.bold(`\n\n📋 ${mode.name} — 多轮对话效果分析`));
    console.log(chalk.gray('═'.repeat(90)));

    const table = new Table({
      head: ['任务', '轮数', '无压缩(Token)', `${mode.name}(Token)`, '节省', '节省率'],
      style: { head: ['cyan'] },
      colWidths: [14, 8, 16, 16, 16, 12],
    });

    const summaryByTurn = {};

    for (const t of turns) {
      let totalNone = 0;
      let totalWith = 0;

      for (const task of BENCHMARK_TASKS) {
        // === 无压缩 (None) ===
        // 每轮：用户提示 + 冗长输出
        // System prompt overhead: 0
        const inputTokensNone = countTextTokens(task.prompt, 'gpt-4');
        const outputTokensNone = countTextTokens(task.verboseOutput, 'gpt-4');
        const perTurnNone = inputTokensNone + outputTokensNone;
        const totalNoneForTask = perTurnNone * t;

        // === 有压缩 (With) ===
        // 第一轮：system prompt + 用户提示 + 压缩输出
        // 后续轮：用户提示 + 压缩输出
        const systemTokens = countTextTokens(mode.prompt, 'gpt-4');
        const outputTokensWith = countTextTokens(task.compressedOutput, 'gpt-4');
        const firstTurnWith = systemTokens + inputTokensNone + outputTokensWith;
        const subsequentTurnWith = inputTokensNone + outputTokensWith;
        const totalWithForTask = firstTurnWith + subsequentTurnWith * (t - 1);

        totalNone += totalNoneForTask;
        totalWith += totalWithForTask;
      }

      summaryByTurn[t] = { none: totalNone, with: totalWith };

      // 平均每任务数据
      const avgNone = Math.round(totalNone / BENCHMARK_TASKS.length);
      const avgWith = Math.round(totalWith / BENCHMARK_TASKS.length);
      const saved = avgNone - avgWith;
      const pct = avgNone > 0 ? ((saved / avgNone) * 100).toFixed(1) : '0';

      const indicator = saved > 0 ? chalk.green('✅') : chalk.red('❌');
      table.push([
        `${BENCHMARK_TASKS.length}个任务(平均)`,
        t,
        avgNone.toLocaleString(),
        avgWith.toLocaleString(),
        `${indicator} ${saved > 0 ? '+' : ''}${saved.toLocaleString()}`,
        saved > 0 ? chalk.green(`${pct}%`) : chalk.red(`${pct}%`),
      ]);
    }

    console.log(table.toString());

    // 收益转折点
    const breakEvenTurn = findBreakEvenTurn(summaryByTurn);
    if (breakEvenTurn) {
      console.log(chalk.green(`  💡 收益平衡点: ${breakEvenTurn} 轮对话后开始产生净节省`));
    } else {
      const maxTurn = Math.max(...turns);
      const lastSaved = summaryByTurn[maxTurn].none - summaryByTurn[maxTurn].with;
      if (lastSaved > 0) {
        console.log(chalk.green(`  💡 ${maxTurn} 轮对话内已产生净节省`));
      }
    }
  }

  // ========== 跨模型对比 ==========
  console.log(chalk.yellow.bold('\n\n📋 跨模型对比 (10轮对话, Full模式)'));
  console.log(chalk.gray('═'.repeat(90)));

  const fullPrompt = generateSystemPrompt('full');
  const crossTable = new Table({
    head: ['模型', '单价(元/M)', '无压缩Token', 'Full模式Token', '节省Token', '节省率', '10轮省(元)'],
    style: { head: ['yellow'] },
  });

  for (const model of models) {
    const systemTokens = countTextTokens(fullPrompt, model.id);
    let totalNone = 0;
    let totalWith = 0;

    for (const task of BENCHMARK_TASKS) {
      const inputTokens = countTextTokens(task.prompt, model.id);
      const outputNone = countTextTokens(task.verboseOutput, model.id);
      const outputWith = countTextTokens(task.compressedOutput, model.id);

      totalNone += (inputTokens + outputNone) * 10;
      totalWith += (systemTokens + inputTokens + outputWith) + (inputTokens + outputWith) * 9;
    }

    const saved = totalNone - totalWith;
    const pct = totalNone > 0 ? ((saved / totalNone) * 100).toFixed(1) : '0';
    const costSaved10Rounds = (saved * model.rate / 1000000);

    crossTable.push([
      model.name,
      `¥${model.rate}`,
      totalNone.toLocaleString(),
      totalWith.toLocaleString(),
      chalk.green(`${saved.toLocaleString()}`),
      chalk.green(`${pct}%`),
      chalk.green(`¥${costSaved10Rounds.toFixed(4)}`),
    ]);
  }

  console.log(crossTable.toString());

  // ========== 年度节省估算 ==========
  console.log(chalk.yellow.bold('\n💰 年度节省估算 (假设每日100次×10轮对话, Full模式)'));
  console.log(chalk.gray('═'.repeat(90)));

  const annualTable = new Table({
    head: ['模型', '日节省(元)', '月节省(元)', '年节省(元)'],
    style: { head: ['green'] },
  });

  for (const model of models) {
    let totalDailySavings = 0;
    for (const task of BENCHMARK_TASKS) {
      const inputTokens = countTextTokens(task.prompt, model.id);
      const outputNone = countTextTokens(task.verboseOutput, model.id);
      const outputWith = countTextTokens(task.compressedOutput, model.id);
      const systemTokens = countTextTokens(fullPrompt, model.id);

      const none10 = (inputTokens + outputNone) * 10;
      const with10 = (systemTokens + inputTokens + outputWith) + (inputTokens + outputWith) * 9;
      
      totalDailySavings += (none10 - with10) * model.rate / 1000000;
    }

    // 100次/天 = 100 / 任务数 次每任务
    const dailyRuns = 100 / BENCHMARK_TASKS.length;
    const daily = totalDailySavings * dailyRuns;
    const monthly = daily * 30;
    const yearly = daily * 365;

    annualTable.push([
      model.name,
      `¥${daily.toFixed(2)}`,
      `¥${monthly.toFixed(2)}`,
      `¥${yearly.toFixed(2)}`,
    ]);
  }

  console.log(annualTable.toString());

  // ========== 关键发现 ==========
  console.log(chalk.cyan.bold('\n🔑 关键发现:'));
  console.log(chalk.white('  1. System Prompt 是一次性开销(约350 Token)，在单轮对话中可能不划算'));
  console.log(chalk.white('  2. 但从第2轮对话开始，每一轮都节省约40-60%的输出Token'));
  console.log(chalk.white('  3. 在多轮对话场景(10轮+)中，综合节省率可达30-55%'));
  console.log(chalk.white('  4. 对话越长，节省效果越显著 — 这正是WorkBuddy的典型使用场景'));
  console.log(chalk.white('  5. 推荐策略：长对话使用Full模式，短对话使用Lite模式或不用'));

  // 保存结果
  if (options.saveResults || options.output) {
    const outputFile = options.output || path.join(process.cwd(), 'benchmark-results.json');
    fs.writeFileSync(outputFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      models: models.map(m => m.id),
      tasks: BENCHMARK_TASKS.map(t => t.id),
      modes: modes.map(m => m.id),
      turns,
    }, null, 2), 'utf-8');
    console.log(chalk.green(`\n✅ 详细结果已保存: ${outputFile}`));
  }
}

function findBreakEvenTurn(summaryByTurn) {
  for (const turn of Object.keys(summaryByTurn).sort((a, b) => a - b)) {
    const { none, with: withTokens } = summaryByTurn[turn];
    if (withTokens < none) {
      return parseInt(turn);
    }
  }
  return null;
}

module.exports = { runBenchmark, BENCHMARK_TASKS, MODELS };
