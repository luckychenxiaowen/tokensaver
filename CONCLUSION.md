# tokcut + tokensaver 合并项目 — 最终结论

> 日期: 2026-05-03  
> 目标: 对比两个项目的 Token 节省能力 → 融合 tokcut 优势到 tokensaver → 打造成更强的产品

---

## 一、做了什么

| 阶段 | 内容 | 产出 |
|------|------|------|
| ① 下载项目 | 从 GitHub 克隆 tokcut 和 tokensaver | 两个完整项目 |
| ② 对比测试 | DeepSeek 真实 API，5场景×7方案=35次调用 | [BENCHMARK_REPORT.md](../BENCHMARK_REPORT.md) |
| ③ 融合开发 | 把 tokcut 5大能力移植到 tokensaver | tokensaver v2.0 |
| ④ 验证测试 | 37个单元测试 + 真实 API 代理测试 | 100% 通过 |

---

## 二、对比测试结论

### DeepSeek API 真实对比 (Full 级别)

```
┌──────────────────┬────────────┬──────────────┬──────────────┐
│ 方案             │ 总 Token   │ 总节省率     │ 输出节省率   │
├──────────────────┼────────────┼──────────────┼──────────────┤
│ Baseline (裸调)  │    8,240   │      -       │      -       │
│ tokcut Full      │    2,702   │    67.2%     │    71.7%     │
│ tokensaver Full  │    1,970   │    76.1%     │    88.4%     │
└──────────────────┴────────────┴──────────────┴──────────────┘
```

**tokensaver 节省能力领先 tokcut 约 9 个百分点**，原因：中文 Caveman 提示词对 DeepSeek 更有效。

但 tokcut 有 tokensaver 没有的能力：**代理层、语义缓存、输入压缩、后处理、内容保护**。

---

## 三、融合方案

把 tokcut 的 5 大能力移植到 tokensaver，所有新代码用 Node.js 重写：

| 移植模块 | 来源 | 文件 | 行数 |
|---------|------|------|:---:|
| 透明代理服务器 | tokcut server.py | `src/server.js` | ~370 |
| 语义缓存 | tokcut cache.py | `src/cache/semantic-cache.js` | ~230 |
| 输入压缩器 | tokcut prompt_compressor.py | `src/compressor/input.js` | ~150 |
| 内容保护器 | tokcut protector.py | `src/protector/content-protector.js` | ~95 |
| 后处理器 | tokcut compressor.py | `src/post-processor.js` | ~85 |

### 架构变化

```
v1.0 (纯 CLI)                    v2.0 (CLI + 代理)
─────────────                    ─────────────────
  CLI 命令                          CLI 命令 (7→8 个)
  手动注入 Prompt              ┌─ 透明代理服务器 ← tokcut 移植
  仅输出压缩                   │  语义缓存        ← tokcut 移植
  文件压缩                     │  输入压缩        ← tokcut 移植
  Benchmark                    │  内容保护        ← tokcut 移植
                               │  后处理          ← tokcut 移植
                               └─ 动态 Header 控制
```

---

## 四、最终产品 tokensaver v2.0

### 功能全貌

```
 你的应用 (OpenAI SDK)
        │
        ▼  只需改 base_url 到 localhost:8800/v1
 ┌─────────────────────────────────────┐
 │       tokensaver Proxy v2.0         │
 │                                     │
 │  ① 语义缓存 ── 相似问题秒回 (1-3ms)  │
 │  ② 输入压缩 ── 去重/去填充/截断     │
 │  ③ 输出压缩 ── Caveman Prompt 注入  │
 │  ④ 内容保护 ── 代码/URL 逐字节不变  │
 │  ⑤ 后处理   ── 兜底清理引导语       │
 │  ⑥ 统计注入 ── 响应含 tokensaver 字段│
 └─────────────────────────────────────┘
        │
        ▼
   DeepSeek / GLM / Kimi / 混元 / ...
```

### 真实代理测试

```
┌──────────────┬──────────┬────────────┬──────────┬──────────┐
│ 场景         │ Baseline │ Proxy代理  │ 总节省率 │ 输出节省 │
├──────────────┼──────────┼────────────┼──────────┼──────────┤
│ 装饰器解释   │ 1,042 tk │   390 tk   │  62.6%   │  81.1%   │
│ Redis 介绍   │ 1,038 tk │   354 tk   │  65.9%   │  84.2%   │
│ 缓存命中     │ 1,042 tk │    ~0 tk   │ ~100%    │ ~100%    │
└──────────────┴──────────┴────────────┴──────────┴──────────┘
```

### 测试验证

```
v1 测试 (原有):  17/17 ✅
v2 测试 (新增):  20/20 ✅
总计:            37/37 ✅ 100% 通过
```

---

## 五、两个项目现状

| | tokcut (Python) | tokensaver (Node.js) |
|---|:---:|:---:|
| 版本 | 0.1.0 | **2.0.0** |
| 代理服务器 | ✅ FastAPI | ✅ Node.js HTTP |
| 语义缓存 | ✅ sentence-transformers | ✅ Jaccard 相似度 |
| 输入压缩 | ✅ | ✅ |
| 输出压缩 | ✅ 英文 | ✅ 中文 + 文言文 + 英文 |
| 后处理 | ✅ | ✅ |
| 内容保护 | ✅ | ✅ |
| 文件压缩 | ❌ | ✅ |
| Benchmark | ❌ | ✅ |
| 安全兜底 | ❌ | ✅ |
| Header 控制 | ✅ | ✅ |
| 安装方式 | pip | npm |

**结论：tokensaver v2.0 已全面超越两个原项目，成为功能最完整的版本。**

---

## 六、使用方式

```bash
# 安装
cd tokensaver && npm install

# 启动代理 (零代码侵入)
npm run serve

# Python SDK 使用示例
from openai import OpenAI
client = OpenAI(
    base_url="http://localhost:8800/v1",
    api_key="your-key",
    default_headers={"X-Provider-URL": "https://api.deepseek.com/v1/chat/completions"}
)
resp = client.chat.completions.create(model="deepseek-chat", messages=[...])
print(resp.model_extra["tokensaver"])  # 查看节省统计
```

---

## 七、相关文件

| 文件 | 说明 |
|------|------|
| `BENCHMARK_REPORT.md` | tokcut vs tokensaver 对比测试报告 |
| `CHANGELOG.md` | tokensaver 版本变更日志 |
| `README.md` | tokensaver v2.0 完整文档 |
| `config/default.json` | 代理服务器配置 |
| `tests/run-v2.js` | 新增模块 20 项测试 |
