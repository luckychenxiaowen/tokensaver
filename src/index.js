#!/usr/bin/env node

/**
 * WorkBuddy Token Saver — 大模型Token节省工具
 * 
 * 结合了 Caveman 输出压缩 + 10大Token优化策略
 * 专为 WorkBuddy 中文LLM场景打造
 */

const { Command } = require('commander');
const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');

const program = new Command();

program
  .name('token-saver')
  .description('🚀 WorkBuddy Token 节省工具 — 让你的大模型调用更省钱')
  .version('1.0.0');

// ============ compress 命令 ============
program
  .command('compress')
  .description('压缩提示词或文件，减少输入 Token')
  .argument('<file>', '要压缩的文件路径')
  .option('-m, --mode <mode>', '压缩模式: lite|full|ultra|wenyan', 'full')
  .option('-o, --output <file>', '输出文件路径')
  .option('--dry-run', '仅预览，不写入文件')
  .action(async (file, options) => {
    const { compressFile } = require('./compressor/context');
    await compressFile(file, options);
  });

// ============ prompt 命令 ============
program
  .command('prompt')
  .description('生成 caveman 风格的 system prompt 注入指令')
  .option('-m, --mode <mode>', '压缩模式: lite|full|ultra|wenyan-lite|wenyan|wenyan-ultra', 'full')
  .option('--english', '输出英文版本')
  .action(async (options) => {
    const { generateSystemPrompt } = require('./compressor/output');
    const prompt = generateSystemPrompt(options.mode, options.english);
    console.log(prompt);
  });

// ============ benchmark 命令 ============
program
  .command('benchmark')
  .description('多模型 Token 消耗对比测试')
  .option('-m, --models <models>', '要测试的模型，逗号分隔', 'deepseek,glm,minimax,hunyuan,kimi')
  .option('-t, --tasks <tasks>', '测试任务文件路径 (JSON)')
  .option('-o, --output <file>', '输出报告文件路径')
  .option('--save-results', '保存详细结果到文件')
  .action(async (options) => {
    const { runBenchmark } = require('./benchmark/runner');
    await runBenchmark(options);
  });

// ============ count 命令 ============
program
  .command('count')
  .description('统计文本的 Token 数量')
  .argument('<file>', '要统计的文件路径')
  .option('-m, --model <model>', '模型名称 (用于选择tokenizer)', 'gpt-4')
  .option('--encoding <name>', '直接指定 encoding 名称', 'cl100k_base')
  .action(async (file, options) => {
    const { countTokens } = require('./monitor/token-counter');
    await countTokens(file, options);
  });

// ============ compare 命令 ============
program
  .command('compare')
  .description('对比压缩前后效果')
  .argument('<file>', '要对比的文件路径')
  .option('-m, --mode <mode>', '压缩模式', 'full')
  .option('--models <models>', '模型列表', 'deepseek,glm,minimax,hunyuan,kimi')
  .action(async (file, options) => {
    const { compareCompression } = require('./monitor/token-counter');
    await compareCompression(file, options);
  });

// ============ generate-system 命令 ============
program
  .command('generate-system')
  .description('生成完整的 WorkBuddy 系统提示词（含Token节省规则）')
  .option('-m, --mode <mode>', '模式', 'full')
  .option('-o, --output <file>', '输出到文件')
  .action(async (options) => {
    const { generateWorkBuddySystem } = require('./compressor/output');
    const sys = generateWorkBuddySystem(options.mode);
    if (options.output) {
      fs.writeFileSync(options.output, sys, 'utf-8');
      console.log(chalk.green(`✅ 系统提示词已写入: ${options.output}`));
    } else {
      console.log(sys);
    }
  });

program.parse();
