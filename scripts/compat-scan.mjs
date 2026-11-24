#!/usr/bin/env node
/**
 * 兼容性扫描：把 ALL_PATCHES 逐条对到某一版已解包的 `@deepseek-ai` 目录上，
 * 报告每条清洗补丁在新版里还有没有可命中的原文。
 *
 * 为什么要单独一个脚本：官方升级后源码字符串会变，`apply` 时会显示
 * “待清洗/跳过”，但只有跑一遍才知道到底哪几条真的对不上。
 *
 * 用法（先解包；desktop 的 app.asar 不能直接当目录扫）：
 *   node scripts/compat-scan.mjs --asar "D:/.../resources/app.asar" --extract ".compat/app"
 *   node scripts/compat-scan.mjs --ai-base "C:/.../.compat/app/dsh/node_modules/@deepseek-ai"
 *
 * 输出：一行汇总 + 每条对不上的补丁 id/名字/目标文件，并写出 compat-report.json。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(here);

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : '';
}

const asarPath = arg('asar');
const extractDir = arg('extract');
let aiBase = arg('ai-base');

if (!aiBase && asarPath) {
  const dest = path.resolve(extractDir || path.join(root, '.compat', 'app'));
  const { extractAsar } = await import(new URL('../lib/extract-asar.js', import.meta.url).href);
  const t0 = Date.now();
  const count = extractAsar(asarPath, dest);
  console.log(`解包 ${count} 个文件 → ${dest}（${((Date.now() - t0) / 1000).toFixed(1)}s）`);
  aiBase = path.join(dest, 'dsh', 'node_modules', '@deepseek-ai');
  if (!fs.existsSync(aiBase)) aiBase = path.join(dest, 'node_modules', '@deepseek-ai');
}

if (!aiBase || !fs.existsSync(aiBase)) {
  console.error('需要 --ai-base <@deepseek-ai 目录>，或 --asar <app.asar> [--extract <目录>]');
  process.exit(2);
}

const { ALL_PATCHES, targetFiles } = await import(new URL('../lib/core.js', import.meta.url).href);
const files = targetFiles(aiBase, process.env.DSH_HOME || '');
const asPaths = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

const hitOf = (p, text) => {
  const markers = p.markers || [];
  if (markers.length && markers.some((m) => text.includes(m))) return 'applied';
  const reps = p.replacements || [];
  const found = reps.some((r) =>
    r.pattern instanceof RegExp ? r.pattern.test(text) : typeof r.pattern === 'string' && text.includes(r.pattern));
  return found ? 'match' : 'miss';
};

const rows = [];
for (const p of ALL_PATCHES) {
  const keys = Array.isArray(p.file) ? p.file : [p.file];
  const per = [];
  for (const k of keys) {
    const fps = asPaths(files[k]);
    if (fps.length === 0) { per.push('nofile'); continue; }
    let text;
    try { text = fs.readFileSync(fps[0], 'utf8'); } catch { per.push('nofile'); continue; }
    per.push(hitOf(p, text));
  }
  const rank = (s) => (s === 'match' ? 3 : s === 'applied' ? 2 : s === 'miss' ? 1 : 0);
  const best = per.sort((a, b) => rank(b) - rank(a))[0] || 'nofile';
  rows.push({
    id: p.id, name: p.name, layer: p.layer_en || p.layer, status: best,
    file: keys.join('+'), detail: per.join(','),
  });
}

const count = (s) => rows.filter((r) => r.status === s).length;
console.log(`\n共 ${rows.length} 条：可命中 ${count('match')} · 已应用 ${count('applied')} · 对不上 ${count('miss')} · 文件缺失 ${count('nofile')}`);
for (const r of rows.filter((x) => x.status === 'miss' || x.status === 'nofile')) {
  console.log(`${String(r.id).padStart(3)}  ${r.status.padEnd(7)} ${r.name.padEnd(38)} ${r.file}`);
}

const out = path.join(root, 'compat-report.json');
fs.writeFileSync(out, JSON.stringify({ aiBase, at: new Date().toISOString(), rows }, null, 1));
console.log(`\n明细 → ${out}`);
