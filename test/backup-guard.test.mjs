// 备份守卫：只备份"还没被我们改过"的文件；改过的跳过（原文已丢，存下来只会让 revert 变空操作）。
process.env.DSH_SURFACE = 'desktop';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ALL_PATCHES, backupAll, applyPatches, revertAll, targetFiles } from '../lib/core.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(here, '..', 'fixtures', 'dsh-0.2.2-rc.5');

function makeHost() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'purge-bak-'));
  for (const rel of ['dsh-agent-instructions/lib/index.js', 'dsh-web-app/lib/index.js']) {
    const src = path.join(FIXTURE, ...rel.split('/'));
    const dst = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.copyFileSync(src, dst);
  }
  return root;
}

const baksOf = (root) => {
  const files = targetFiles(root, '');
  return [...new Set(Object.values(files).flatMap((v) => (Array.isArray(v) ? v : v ? [v] : [])))]
    .filter((fp) => fp && fs.existsSync(`${fp}.dshpurge.bak`))
    .map((fp) => path.relative(root, fp));
};

test('纯净文件会建备份；已打补丁的文件不再建', async () => {
  const root = makeHost();
  const before = baksOf(root).length;
  assert.equal(before, 0);

  const first = await backupAll(root, ALL_PATCHES);
  assert.ok(first.made.length > 0, '纯净文件应该建出备份');

  const report = await applyPatches(root, ALL_PATCHES);
  assert.ok(report.some((r) => r.status === 'applied'), '至少要有一条补丁生效');

  // 删掉旧备份，再跑一次：文件已是补丁后内容 → 不应该再建
  for (const rel of baksOf(root)) fs.unlinkSync(path.join(root, rel) + '.dshpurge.bak');
  const second = await backupAll(root, ALL_PATCHES);
  assert.equal(second.made.length, 0, '已打补丁的文件不应再生成备份（否则 revert 等于没退）');
});

test('回滚能把内容恢复成原文', async () => {
  const root = makeHost();
  const target = path.join(root, 'dsh-agent-instructions', 'lib', 'index.js');
  const original = fs.readFileSync(target);

  await backupAll(root, ALL_PATCHES);
  await applyPatches(root, ALL_PATCHES);
  assert.ok(!fs.readFileSync(target).equals(original), 'apply 之后内容应变化');

  await revertAll(root);
  assert.ok(fs.readFileSync(target).equals(original), 'revert 之后应回到原文');
});
