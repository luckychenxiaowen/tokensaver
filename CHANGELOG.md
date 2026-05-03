# Changelog

## [2.0.0] - 2026-05-03

### 🚀 重大更新：融合 tokcut 代理层

将 [tokcut](https://github.com/luckychenxiaowen/tokcut) 项目的核心能力移植到 tokensaver，实现 **CLI + 代理** 双模式。

### ✨ 新增功能

#### 透明代理服务器 (`src/server.js`)
- HTTP 代理层，兼容 OpenAI `/v1/chat/completions` 接口
- 零代码侵入：只需将 `base_url` 指向 `http://localhost:8800/v1`
- 完整流程：缓存检查 → 输入压缩 → 注入压缩 Prompt → 转发 → 后处理 → 返回
- 支持自动模型匹配（deepseek/glm/hunyuan/kimi/minimax/gpt/qwen）
- 动态 Header 控制（X-Tokensaver-Level, X-Tokensaver-Compress 等）
- 响应中注入 `tokensaver` 字段，含详细 Token 统计
- 健康检查端点 `/health`，统计端点 `/stats`

#### 语义缓存 (`src/cache/semantic-cache.js`)
- 基于 Jaccard 相似度的智能缓存
- 支持 memory 和 file 两种后端
- 可配置相似度阈值和 TTL
- 自动过期清理
- 相似问题直接返回，响应仅 1-3ms

#### 输入压缩器 (`src/compressor/input.js`)
- safe 模式：去重行 + 过滤填充词（节省 20-40%）
- aggressive 模式：截断 70% + 过滤填充词（节省 50-75%）
- 仅压缩 user 消息，保持 system/assistant 不变
- 代码块、URL、文件路径在压缩时受保护

#### 内容保护器 (`src/protector/content-protector.js`)
- 占位符机制保护技术内容
- 保护内容：代码块、行内代码、URL、文件路径、版本号
- protect() → 压缩处理 → restore() 完整工作流

#### 后处理器 (`src/post-processor.js`)
- 对 LLM 响应执行规则压缩
- 删除中英文引导语和客套话
- 压缩多余空格
- 作为 Prompt 压缩的兜底

### 🔧 增强

- `output.js` 新增 `en-full`/`en-ultra`/`cn-full` 等扩展模式名
- CLI 新增 `serve` 命令
- `config/default.json` 代理配置文件
- package.json 升级到 v2.0.0

### 🧪 测试

- 新增 `tests/run-v2.js`：20 个针对新模块的测试用例
- 原有 v1 测试 17 个全部保持通过
- DeepSeek 真实 API 代理测试：总节省率 62-66%

### 📊 代理测试结果 (DeepSeek API)

| 场景 | Baseline | Proxy cn-full | 总节省率 | 输出节省率 |
|------|:---:|:---:|:---:|:---:|
| Python 装饰器 | 1,042 | 390 | 62.6% | 81.1% |
| Redis 介绍 | 1,038 | 354 | 65.9% | 84.2% |

---

## [1.0.0] - 2026-05-02

### 初始发布

- Caveman 风格 System Prompt 生成
- 6 种压缩模式（Lite/Full/Ultra + 3 种文言文）
- 上下文文件压缩
- Token 计数
- 多模型 Benchmark
- 安全兜底机制
- 17 个自动化测试
