# 🪨 tokensaver v2.0

> **融合 tokcut 代理层** | Caveman 原理 + 语义缓存 + 三层压缩引擎  
> 专为中文 LLM 场景打造的大模型 Token 节省工具  
> 零代码侵入 · 支持 DeepSeek/GLM/Kimi/混元/MiniMax/OpenAI

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](package.json)
[![Version](https://img.shields.io/badge/version-2.0.0-orange.svg)](package.json)
[![Tests](https://img.shields.io/badge/tests-37%20passed-success.svg)](tests/)

---

## 📖 目录

- [效果速览](#-效果速览)
- [快速开始](#-快速开始)
- [架构](#️-架构三层压缩引擎)
- [压缩模式](#-压缩模式)
- [使用指南](#-使用指南)
- [Benchmark 结果](#-benchmark-结果)
- [项目结构](#-项目结构)
- [贡献](#-贡献)

---

## 📊 效果速览

### 🔬 真实 DeepSeek API 测试 (v2.0 代理模式)

| 场景 | Baseline | tokensaver Proxy | 总节省率 | 输出节省率 |
|------|:---:|:---:|:---:|:---:|
| Python 装饰器解释 | 1,042 tokens | **390 tokens** | **62.6%** | **81.1%** |
| Redis 全面介绍 | 1,038 tokens | **354 tokens** | **65.9%** | **84.2%** |
| 缓存命中 (相似问题) | 1,042 tokens | **~0 tokens** | **~100%** | **~100%** |

### 📈 多轮对话累积效果 (Benchmark 模拟)

| 对话轮数 | Full 模式 | Ultra 模式 | Wenyan 模式 |
|---------|:---:|:---:|:---:|
| 1 轮 | 3.4% | 37.4% | 30.5% |
| 5 轮 | **53.4%** | **60.2%** | **58.8%** |
| 10 轮 | **59.7%** | **63.1%** | **62.4%** |
| 20 轮 | **62.8%** | **64.5%** | **64.2%** |

---

## 🚀 快速开始

### 安装

```bash
git clone https://github.com/luckychenxiaowen/tokensaver.git
cd tokensaver
npm install
```

### 代理模式 (推荐 — 零代码侵入)

```bash
# 启动代理
npm run serve

# 然后在你的代码中：
from openai import OpenAI
client = OpenAI(
    base_url="http://localhost:8800/v1",
    api_key="your-key",
    default_headers={"X-Provider-URL": "https://api.deepseek.com/v1/chat/completions"}
)
# 正常调用即可 — 代理自动压缩所有流量！
```

### CLI 模式

```bash
node src/index.js prompt -m cn-full     # 生成 System Prompt
node src/index.js compress ./file.md    # 压缩文件
node src/index.js benchmark             # 多模型对比
```

---

## 🏗️ 架构：三层压缩引擎 (v2.0 tokcut 移植)

```
你的应用 (OpenAI SDK / HTTP)
       │
       ▼ 只需改 base_url → http://localhost:8800/v1
┌──────────────────────────────────────────┐
│         tokensaver Proxy v2.0            │
│                                          │
│  ① 语义缓存  ← Jaccard 相似度            │
│     ├─ 命中 → 直接返回 (1-3ms)           │
│     └─ 未命中 ↓                         │
│  ② 输入压缩  ← safe / aggressive         │
│  ③ 输出压缩  ← Caveman Prompt 注入       │
│  ④ 内容保护  ← 代码/URL/路径逐字节不变     │
│  ⑤ 转发上游  ← fetch                     │
│  ⑥ 后处理    ← 正则清理引导语             │
│  ⑦ 缓存 + 返回 + tokensaver 统计注入      │
└──────────────────────────────────────────┘
       │
       ▼
DeepSeek / GLM / Kimi / 混元 / MiniMax / OpenAI / ...
```

### 动态控制 Headers

| Header | 值 | 默认 | 说明 |
|--------|-----|:---:|------|
| `X-Tokensaver-Compress` | `true/false` | `true` | 输出压缩开关 |
| `X-Tokensaver-Prompt-Compress` | `true/false` | `false` | 输入压缩开关 |
| `X-Tokensaver-Cache` | `true/false` | `true` | 语义缓存开关 |
| `X-Tokensaver-Level` | 见下表 | `cn-full` | 压缩级别 |

---

## 📖 压缩模式

| 模式 | 命令参数 | 输出节省 | 特点 |
|------|---------|:---:|------|
| 🪶 **CN-Lite** | `cn-lite` | ~20% | 仅去填充词，保留完整语法 |
| 🪨 **CN-Full** (默认) | `cn-full` | ~50% | 中文原始人风格，平衡压缩 |
| 🔥 **CN-Ultra** | `cn-ultra` | ~70% | 电报体，极致压缩 |
| 📜 **Wenyan** | `wenyan` | ~60% | 文言文，极简而意全 |
| 📜 **Wenyan-Ultra** | `wenyan-ultra` | ~80% | 上古学者预算受限版 |
| 🇬🇧 **EN-Full** | `en-full` | ~50% | 英文 Caveman (tokcut 移植) |
| 🇬🇧 **EN-Ultra** | `en-ultra` | ~70% | 英文极致 |

---

## 📘 使用指南

### Python SDK 完整示例

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:8800/v1",
    api_key="sk-your-deepseek-key",
    default_headers={
        "X-Provider-URL": "https://api.deepseek.com/v1/chat/completions",
        "X-Tokensaver-Level": "cn-full",
    }
)

response = client.chat.completions.create(
    model="deepseek-chat",
    messages=[{"role": "user", "content": "解释 React useEffect 的用法"}]
)

# 查看节省统计
stats = response.model_extra["tokensaver"]
print(f"原始输入: {stats['input_tokens_before']} tokens")
print(f"压缩后输入: {stats['input_tokens_after']} tokens")
print(f"输入节省: {stats['input_tokens_saved']} tokens")
print(f"输出: {stats['output_tokens']} tokens")
print(f"输出节省: {stats['output_tokens_saved']} tokens")
print(f"缓存命中: {stats['cache_hit']}")
print(f"延迟: {stats['elapsed_ms']}ms")
```

### cURL 示例

```bash
curl -X POST http://localhost:8800/v1/chat/completions \
  -H "Authorization: Bearer sk-xxx" \
  -H "Content-Type: application/json" \
  -H "X-Provider-URL: https://api.deepseek.com/v1/chat/completions" \
  -H "X-Tokensaver-Level: cn-ultra" \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"介绍 Redis"}]}'
```

### Docker 部署

```bash
docker build -t tokensaver .
docker run -p 8800:8800 tokensaver
# 或
docker-compose up -d
```

---

## 📊 Benchmark 结果

### tokcut vs tokensaver 对比 (DeepSeek 真实 API, 5 场景)

| 方案 | Prompt | Output | Total | 总节省率 | 输出节省率 |
|------|:---:|:---:|:---:|:---:|:---:|
| Baseline (无压缩) | 189 | 8,051 | 8,240 | - | - |
| tokcut Full (英文) | 424 | 2,278 | 2,702 | 67.2% | 71.7% |
| **tokensaver CN-Full** | **1,039** | **931** | **1,970** | **76.1%** | **88.4%** |

> 详细对比报告：[COMPARISON_REPORT.md](COMPARISON_REPORT.md)

### 多模型年度节省估算 (Full 模式, 每日100次×10轮)

| 模型 | 单价 (元/百万Token) | 年节省 (元) |
|------|:---:|:---:|
| DeepSeek | ¥1 | ¥122.83 |
| Hunyuan (混元) | ¥2 | ¥245.67 |
| GLM / MiniMax | ¥5 | ¥614.17 |
| Kimi (月之暗面) | ¥12 | **¥1,474.02** |

---

## 📂 项目结构

```
tokensaver/
├── .github/
│   ├── workflows/ci.yml                 # CI 流水线
│   └── ISSUE_TEMPLATE/                  # Issue 模板
├── config/default.json                  # 代理配置
├── src/
│   ├── index.js                         # CLI 入口 (8 命令)
│   ├── server.js                        # 代理服务器 (tokcut 移植)
│   ├── post-processor.js                # 后处理器 (tokcut 移植)
│   ├── compressor/
│   │   ├── output.js                    # System Prompt 生成
│   │   ├── input.js                     # 输入压缩器 (tokcut 移植)
│   │   └── context.js                   # 文件压缩
│   ├── cache/
│   │   └── semantic-cache.js            # 语义缓存 (tokcut 移植)
│   ├── protector/
│   │   └── content-protector.js         # 内容保护器 (tokcut 移植)
│   ├── monitor/token-counter.js         # Token 计数
│   └── benchmark/runner.js              # Benchmark
├── tests/
│   ├── run.js                           # 17 项测试
│   └── run-v2.js                        # 20 项测试 (新增模块)
├── Dockerfile / docker-compose.yml      # Docker 部署
├── USAGE.md / INSTALL.md                # 使用/安装文档
├── CONTRIBUTING.md / SECURITY.md        # 贡献/安全
├── CODE_OF_CONDUCT.md / LICENSE         # 社区/许可证
└── CHANGELOG.md                         # 变更日志
```

## 🆚 v1.0 → v2.0 升级对照

| 能力 | v1.0 | v2.0 |
|------|:---:|:---:|
| 透明代理服务器 | ❌ | ✅ |
| 语义缓存 | ❌ | ✅ |
| 输入压缩 | ❌ | ✅ |
| 内容保护器 | 部分 | ✅ |
| 后处理压缩 | ❌ | ✅ |
| 英文压缩模式 | ❌ | ✅ |
| Header 动态控制 | ❌ | ✅ |
| Token 统计响应 | ❌ | ✅ |
| Docker 支持 | ❌ | ✅ |
| CI/CD | ❌ | ✅ |
| 中文 Caveman | ✅ | ✅ |
| 文言文 | ✅ | ✅ |
| 安全兜底 | ✅ | ✅ |
| 文件压缩 | ✅ | ✅ |
| Benchmark | ✅ | ✅ |

## 🤝 贡献

欢迎贡献！详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 📚 参考

- [Caveman](https://github.com/JuliusBrussee/caveman) — Claude Code Token 节省插件
- [caveman-cn](https://github.com/bbylw/caveman-cn) — 中文汉化版
- [tokcut](https://github.com/luckychenxiaowen/tokcut) — Python 代理层 (同作者)
- [LLMLingua](https://github.com/microsoft/LLMLingua) — Microsoft prompt 压缩

## 📄 许可证

MIT License — 详见 [LICENSE](LICENSE)
