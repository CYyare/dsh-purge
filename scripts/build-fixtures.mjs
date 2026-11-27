#!/usr/bin/env node
/**
 * 从一份解包好的宿主里，把"补丁会碰到的文件"抄成测试夹具。
 *
 *   node scripts/build-fixtures.mjs --from "<aiBase>" --out fixtures/dsh-0.2.2-rc.5
 *
 * 只复制 aiBase 之下的目标文件（桌面壳 main.js 这类在 app 根目录的不进夹具），
 * 保留相对路径，这样 `targetFiles(fixtureRoot)` 能解析出同样的键。
 */
import fs from 'node:fs';
import path from 'node:path';
import { targetFiles } from '../lib/core.js';

const arg = (name, fallback = '') => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

const from = arg('from');
const out = arg('out');
if (!from || !out) {
  console.error('用法: node scripts/build-fixtures.mjs --from <aiBase> --out <dir>');
  process.exit(2);
}
if (!fs.existsSync(from)) {
  console.error(`找不到 ${from}`);
  process.exit(2);
}

const files = targetFiles(from, process.env.DSH_HOME || '');
const wanted = new Set();
for (const value of Object.values(files)) {
  for (const fp of Array.isArray(value) ? value : value ? [value] : []) {
    if (!fp) continue;
    const rel = path.relative(from, fp);
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) continue; // 出了 aiBase 的不收
    wanted.add(rel);
  }
}

let bytes = 0;
let copied = 0;
for (const rel of [...wanted].sort()) {
  const src = path.join(from, rel);
  let stat;
  try { stat = fs.statSync(src); } catch { continue; }
  if (!stat.isFile()) continue;
  const dst = path.join(out, rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  bytes += stat.size;
  copied += 1;
}

const manifest = {
  source: from.replace(/\\/g, '/'),
  at: new Date().toISOString(),
  files: copied,
  bytes,
  paths: [...wanted].sort(),
};
fs.writeFileSync(path.join(out, 'fixture.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`fixtures: ${copied} 个文件, ${(bytes / 1024 / 1024).toFixed(2)} MB → ${out}`);
