# 🪨 WorkBuddy Token Saver

> 基于 [Caveman](https://github.com/JuliusBrussee/caveman) 原理 + TOP10 Token 优化策略  
> 专为 WorkBuddy 中文 LLM 场景打造的大模型 Token 节省工具  
> GitHub: [luckychenxiaowen/tokensaver](https://github.com/luckychenxiaowen/tokensaver)

## 📊 效果速览

| 对话轮数 | Full 模式节省率 | Ultra 模式节省率 |
|---------|----------------|-----------------|
| 1 轮 | 3.4% | 37.4% |
| 5 轮 | **53.4%** | **60.2%** |
| 10 轮 | **59.7%** | **63.1%** |
| 20 轮 | **62.8%** | **64.5%** |

> 💡 System Prompt 是一次性开销，输出压缩收益在多轮对话中累积。对话越长，节省越显著。

## 🚀 快速开始

### 安装

```bash
cd workbuddy-token-saver
npm install
```

### 基本使用

```bash
# 1. 生成 system prompt（注入到 WorkBuddy 中）
node src/index.js prompt -m full

# 2. 压缩上下文文件
node src/index.js compress ./my-rules.md -m full

# 3. 统计 Token 数量
node src/index.js count ./my-file.txt

# 4. 运行多模型对比测试
node src/index.js benchmark -m deepseek,glm,minimax,hunyuan,kimi

# 5. 对比压缩效果
node src/index.js compare ./my-prompt.txt -m full
```

## 📖 压缩模式

| 模式 | 命令 | 特点 |
|------|------|------|
| 🪶 **Lite** | `-m lite` | 仅去除填充词，保留完整语法 |
| 🪨 **Full** | `-m full` | 默认模式。省略冠词/量词，使用片段句 |
| 🔥 **Ultra** | `-m ultra` | 极致压缩，电报体，全部缩写 |
| 📜 **Wenyan-Lite** | `-m wenyan-lite` | 半文言，语法完整 |
| 📜 **Wenyan** | `-m wenyan` | 全文言，极简 |
| 📜 **Wenyan-Ultra** | `-m wenyan-ultra` | 上古学者预算受限版 |

## 🔧 在 WorkBuddy 中使用

将工具生成的 system prompt 添加到你的 WorkBuddy 配置中：

```bash
# 生成 WorkBuddy 专用的完整 system prompt
node src/index.js generate-system -m full -o system-prompt.md
```

然后将 `system-prompt.md` 的内容添加到 WorkBuddy 的系统提示词中。

## 🔬 核心技术原理

### 1. 输出风格压缩 (Caveman 原理)
通过 System Prompt 工程改变模型输出风格，让模型从源头少生成低信息密度的自然语言。

### 2. 输入上下文压缩
自动压缩规则文件、记忆文件等上下文，去除冗余描述，保留代码/URL/路径不变。

### 3. 多级压缩策略
- **Lite**：仅去除填充词
- **Full**：全面压缩短语、删除冠词/量词
- **Ultra**：极致电报体
- **Wenyan**：利用文言文天然高信息密度

### 4. 安全兜底 (Auto-Clarity)
在安全警告、不可逆操作、用户困惑等场景自动恢复清晰表达。

## 📈 多模型对比

| 模型 | 单价(元/M) | 10轮节省Token | 年节省(元)* |
|------|-----------|--------------|------------|
| DeepSeek | ¥1 | 20,192 | ¥122.83 |
| GLM (智谱) | ¥5 | 20,192 | ¥614.17 |
| MiniMax | ¥5 | 20,192 | ¥614.17 |
| Hunyuan (混元) | ¥2 | 20,192 | ¥245.67 |
| Kimi (月之暗面) | ¥12 | 20,192 | ¥1,474.02 |

*假设每日100次×10轮对话

## 📚 参考来源

- [Caveman 项目](https://github.com/JuliusBrussee/caveman) — Claude Code Token 节省插件
- [caveman-cn](https://github.com/bbylw/caveman-cn) — 中文汉化版（含文言文模式）
- [10 Ways to Cut Token Usage](https://blog.logrocket.com/stop-wasting-ai-tokens-10-ways-to-reduce-usage/) — LogRocket
- [25 Ways to Reduce LLM Token Costs](https://www.c-sharpcorner.com/article/stop-burning-your-ai-tokens-top-25-ways-to-reduce-llm-token-costs/) — C# Corner
- [10 Tips to Optimize LLM Token Usage](https://www.token-calculator.com/blog/10-tips-optimize-llm-token-usage) — Token Calculator
- [Brevity Constraints Paper](https://arxiv.org/abs/2604.00025) — arXiv 2026

## 📄 许可证

MIT License
