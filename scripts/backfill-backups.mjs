#!/usr/bin/env node
/**
 * 从宿主的 app.asar(.bak) 里把**原始版本**抽出来，补成 `<文件>.dshpurge.bak`。
 *
 * 什么时候需要它：
 *   某次 apply 已经把补丁写进宿主，但备份没建成功（老版本守卫、时序问题、写盘失败），
 *   于是单文件 `--revert` 对那几个文件失效。整包回滚（app.asar.bak）还能用，但太粗。
 *   这个脚本只读 asar，把"干净的原文"落成备份，再刷新 manifest。
 *
 * 用法（在仓库根目录）：
 *   node scripts/backfill-backups.mjs [--app <resources/app>] [--asar <app.asar>] [--dry-run]
 *
 * 默认路径是 Windows 官方桌面安装：
 *   app  : D:/Program Files/DeepSeek Harness/resources/app
 *   asar : D:/Program Files/DeepSeek Harness/resources/app.asar.bak
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { targetFiles } from '../lib/core.js';
import { writeManifest } from '../lib/backup-manifest.js';

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const DRY = args.includes('--dry-run');
const APP = argOf('--app', 'D:/Program Files/DeepSeek Harness/resources/app');
const ASAR = argOf('--asar', 'D:/Program Files/DeepSeek Harness/resources/app.asar.bak');
const HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const AI = path.join(APP, 'dsh', 'node_modules', '@deepseek-ai');

/** asar 头部：8 字节前缀 + pickle（[total][len][json]）。 */
function readIndex(asarPath) {
  const fd = fs.openSync(asarPath, 'r');
  const head = Buffer.alloc(16);
  fs.readSync(fd, head, 0, 16, 0);
  const pickleSize = head.readUInt32LE(4);
  const hb = Buffer.alloc(pickleSize);
  fs.readSync(fd, hb, 0, pickleSize, 8);
  fs.closeSync(fd);
  const jsonLen = hb.readUInt32LE(4);
  return { json: JSON.parse(hb.toString('utf8', 8, 8 + jsonLen)), dataOffset: 8 + pickleSize };
}

function entryOf(json, rel) {
  let node = json;
  for (const seg of rel.split('/').filter(Boolean)) {
    node = node.files?.[seg];
    if (!node) return null;
  }
  // 文件条目有 offset；目录只有 files（早先误判成 node.file 是错的）
  return typeof node.offset === 'undefined' ? null : node;
}

function main() {
  if (!fs.existsSync(ASAR)) {
    console.error(`找不到 asar: ${ASAR}`);
    process.exit(1);
  }
  const { json, dataOffset } = readIndex(ASAR);
  const fd = fs.openSync(ASAR, 'r');

  // 只看补丁真正会碰的文件，别把整棵 node_modules 都备份一遍
  const resolved = targetFiles(AI, HOME);
  const targets = [
    ...new Set(Object.values(resolved).flatMap((v) => (Array.isArray(v) ? v : v ? [v] : []))),
  ].filter((p) => p && fs.existsSync(p));

  let made = 0;
  let skipped = 0;
  for (const live of targets) {
    const rel = path.relative(APP, live).split(path.sep).join('/');
    const bak = `${live}.dshpurge.bak`;
    if (fs.existsSync(bak)) { skipped += 1; continue; }
    const entry = entryOf(json, rel);
    if (!entry) { skipped += 1; continue; }
    const buf = Buffer.alloc(entry.size);
    fs.readSync(fd, buf, 0, entry.size, dataOffset + Number(entry.offset));
    const text = buf.toString('utf8');
    if (text.includes('dsh-purge')) { skipped += 1; continue; } // 已是补丁后内容
    if (DRY) {
      console.log(`[dry] 会补: ${rel} ${buf.length} bytes`);
    } else {
      fs.writeFileSync(bak, buf);
      console.log(`已补: ${rel} ${buf.length} bytes`);
    }
    made += 1;
  }
  fs.closeSync(fd);

  if (!DRY && made > 0) {
    const all = [...new Set(Object.values(resolved).flatMap((v) => (Array.isArray(v) ? v : v ? [v] : [])))];
    const written = writeManifest(HOME, AI, all.filter(Boolean));
    console.log(`manifest 已刷新：${written ? written.entries : 0} 条`);
  }
  console.log(`\n补 ${made} 份，跳过 ${skipped} 份（已有备份 / asar 无此文件 / 内容已打过补丁）`);
  console.log('提醒：跑完执行 dsh-purge --doctor，确认「备份 N/N 校验通过」。');
}

main();
