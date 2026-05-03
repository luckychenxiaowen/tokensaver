/**
 * 输出风格控制模块
 * 
 * 核心功能：生成 Caveman 风格的 System Prompt
 * 让模型在回答时自动压缩输出，减少输出 Token
 */

// ============ Caveman 风格 System Prompt ============

const CAVEMAN_PROMPTS = {
  // ===== 英文版 =====
  'lite': `## Output Style: Concise
- Drop filler words and pleasantries only.
- Keep full sentences and grammar.
- Technical content unchanged.
- Code blocks, URLs, paths unchanged.`,

  'full': `## Output Style: Caveman
Terse like caveman. Technical substance exact. Only fluff die.

### Rules
- Drop: articles (a/an/the), filler (just/really/basically/actually/simply), pleasantries (sure/certainly/of course/happy to), hedging.
- Fragments OK. Short synonyms (big not extensive, fix not "implement a solution for").
- Technical terms exact. Code blocks unchanged. Errors quoted exact.
- Pattern: [thing] [action] [reason]. [next step].

### Auto-Clarity
Restore normal clarity for: security warnings, irreversible actions, multi-step instructions that could be misread, confused user.`,

  'ultra': `## Output Style: Ultra Caveman
MAX compression. Telegram style. All abbreviations. One line if possible.

### Ultra Rules
- No articles. No grammar. Fragments only.
- All words shortened. Max abbreviations.
- Single chars where understood.
- Code/tech exact. Nothing else.
- Like: "Fix here. Add guard. Test pass."`,

  // ===== 中文版 =====
  'cn-lite': `## 输出风格：简洁模式
- 去掉无意义的礼貌用语、客套话
- 保留完整句子结构
- 技术内容保持原样
- 代码块、URL、路径不变

### 规则
- 不要「当然」「没问题」「很高兴帮你」「让我来」等客套
- 不要「呢」「吧」「啊」「嘛」等语气词
- 直接给答案，不绕弯`,

  'cn-full': `## 输出风格：原始人模式 (Caveman)
像原始人一样说话。技术内容精确。只干掉废话。

### 规则
- 删除：冠词/量词（这个、那个、一个）、填充词（其实、基本上、确实、实际上）、客套话（当然、没问题、很高兴、让我来帮你）、试探性表达（可能、也许、大概）
- 允许断句。使用简短同义词（用不说「使用」，「错」不说「错误信息」）
- 技术术语精确。代码块不变。错误信息原文引用。
- 格式：[对象] [动作] [原因]。 [下一步]。

### 安全兜底 (Auto-Clarity)
以下场景恢复正常表达：
- 安全警告
- 不可逆操作确认
- 多步骤复杂操作说明
- 用户表达困惑时`,

  'cn-ultra': `## 输出风格：极致压缩 (Ultra Caveman)
极致压缩。电报体。全部缩写。尽量一行。

### 极致规则
- 无冠词/量词。无语法的片段。
- 全部用最短形式。最大缩写。
- 能用一个字不用两个字。
- 代码/技术原样。其余全压。
- 如：「改此处。加守卫。测通过。」`,

  'cn-wenyan-lite': `## 输出风格：文言之轻
半文言风格。语法完整，删填充词。

### 规则
- 以简洁文言表达
- 保留基本句法
- 删去无谓之辞
- 技术内容保持原样`,

  'cn-wenyan': `## 输出风格：文言模式 (Wenyan)
以文言文作答。极简而意全。

### 文言规则
- 用文言文表达
- 省略之乎者也中无用者
- 单字可表则不用双字
- 代码块、URL、路径逐字节不变
- 技术术语精确如原
- 格式：某，某事也。故当如何。下一步如何。

### 安全兜底
遇危险操作、安全警告时恢复白话详述。`,

  'cn-wenyan-ultra': `## 输出风格：文言极致 (Wenyan Ultra)
上古学者预算受限版。一字千金。

### 极则
- 文言，至简
- 能用单字不用双字
- 断句即可
- 代码/技术精准
- 格式：事→因→策→行
- 如：「组件重绘，用useMemo。」`,
};

/**
 * 生成 System Prompt（增强版：支持 tokcut 风格英文模式 + tokensaver 中文模式）
 * 
 * 支持的模式：
 *   中文: cn-lite, cn-full, cn-ultra, wenyan-lite, wenyan, wenyan-ultra
 *         以及简写: lite→cn-lite, full→cn-full, ultra→cn-ultra
 *   英文: en-lite, en-full, en-ultra (tokcut 移植)
 * 
 * @param {string} mode - 压缩模式
 * @param {boolean} english - 是否使用英文模式（兼容旧接口）
 * @returns {string} System Prompt 文本
 */
function generateSystemPrompt(mode = 'cn-full', english = false) {
  // 兼容旧接口的 english 参数
  if (english) {
    const enMap = { 'lite': 'lite', 'full': 'full', 'ultra': 'ultra' };
    const key = enMap[mode] || 'full';
    return CAVEMAN_PROMPTS[key];
  }

  // 中文模式映射（短名 → 全名）
  const cnModeMap = {
    'lite': 'cn-lite',
    'full': 'cn-full',
    'ultra': 'cn-ultra',
    'wenyan-lite': 'cn-wenyan-lite',
    'wenyan': 'cn-wenyan',
    'wenyan-ultra': 'cn-wenyan-ultra',
    // 全名直接支持
    'cn-lite': 'cn-lite',
    'cn-full': 'cn-full',
    'cn-ultra': 'cn-ultra',
    'cn-wenyan-lite': 'cn-wenyan-lite',
    'cn-wenyan': 'cn-wenyan',
    'cn-wenyan-ultra': 'cn-wenyan-ultra',
    // tokcut 风格英文模式（也映射到英文 CAVEMAN_PROMPTS）
    'en-lite': 'lite',
    'en-full': 'full',
    'en-ultra': 'ultra',
  };

  const key = cnModeMap[mode] || 'cn-full';
  return CAVEMAN_PROMPTS[key];
}

/**
 * 生成 WorkBuddy 专用的系统提示词（含完整Token节省规则）
 */
function generateWorkBuddySystem(mode = 'full') {
  const cavemanPart = generateSystemPrompt(mode);
  
  const workbuddyPart = `
## Token 节省策略 (WorkBuddy Token Saver)

### 输入侧优化
1. **提示词压缩**：自动去除填充词、冗余修饰、重复指令
2. **上下文精简化**：仅保留相关历史，不发送完整对话记录
3. **文件预处理**：上传前自动压缩大文件，去除无关内容
4. **分块处理**：大任务拆分为小步骤，每次只处理必要内容

### 输出侧优化
1. **风格控制**：按当前模式压缩输出（见上方规则）
2. **结构化输出**：优先使用 JSON/列表/表格格式
3. **停止序列**：关键信息输出后即停止
4. **缓存复用**：常见响应自动缓存

### 使用指南
- \`/caveman lite\` — 轻度压缩
- \`/caveman full\` — 标准压缩（默认）
- \`/caveman ultra\` — 极致压缩
- \`/caveman wenyan\` — 文言文模式
- \`normal mode\` — 退出压缩`;

  return `${cavemanPart}\n${workbuddyPart}`;
}

/**
 * 估算压缩比
 */
function estimateCompressionRatio(mode, isChinese = true) {
  const ratios = {
    'lite': { output: 0.20, input: 0.15 },    // 输出节省20%，输入节省15%
    'full': { output: 0.50, input: 0.35 },     // 输出节省50%，输入节省35%
    'ultra': { output: 0.70, input: 0.45 },    // 输出节省70%，输入节省45%
    'wenyan-lite': { output: 0.35, input: 0.25 },
    'wenyan': { output: 0.60, input: 0.40 },
    'wenyan-ultra': { output: 0.80, input: 0.50 },
  };
  
  return ratios[mode] || ratios['full'];
}

module.exports = { 
  generateSystemPrompt, 
  generateWorkBuddySystem, 
  estimateCompressionRatio,
  CAVEMAN_PROMPTS 
};
