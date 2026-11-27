// 夹具回归：拿一份真实的 0.2.2-rc.5 宿主源码，逐条确认"我们发布的补丁还能对齐"。
//
// 判定直接用引擎自己的 patchStatus()，所以和运行时看到的状态一致：
//   applied / already  —— 已生效（很多"还原官方措辞"类补丁在纯净宿主上本来就成立）
//   pending            —— 锚点还在，可打
//   missing_file / na  —— 目标文件不存在（可选包没装）
//   skipped / pattern_not_found —— 锚点全丢，这才是回归失败
// retired（官方已删功能）允许 skipped。
//
// 价值：以后任何人改 compat-022 / core.js 的锚点，只要把某条打穿，测试立刻红。
process.env.DSH_SURFACE = 'desktop';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ALL_PATCHES, patchStatus } from '../lib/core.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(here, '..', 'fixtures', 'dsh-0.2.2-rc.5');

const OK = new Set(['applied', 'already', 'pending', 'na', 'missing_file', 'not_needed']);

test('夹具存在（否则这条回归等于没跑）', () => {
  assert.ok(fs.existsSync(FIXTURE), `缺少夹具目录 ${FIXTURE}，先跑 scripts/build-fixtures.mjs`);
  const manifest = path.join(FIXTURE, 'fixture.json');
  assert.ok(fs.existsSync(manifest), '夹具缺 fixture.json');
  const meta = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  assert.ok(meta.files >= 40, `夹具只有 ${meta.files} 个文件，疑似不完整`);
});

test('0.2.2-rc.5 夹具上没有"锚点全丢"的补丁', async () => {
  const status = await patchStatus(FIXTURE);
  const failed = [];
  let checked = 0;
  for (const patch of ALL_PATCHES) {
    const st = status[patch.id];
    if (patch.retired) continue;
    // 级联补丁的锚点由前一条补丁写入，纯净夹具上本来就不存在。
    if (patch.chainedAfter) continue;
    if (st === undefined) continue;
    if (st === 'skipped' || st === 'pattern_not_found') {
      failed.push(`#${patch.id} ${patch.name} → ${st}`);
      continue;
    }
    if (st === 'pending' || st === 'applied' || st === 'already') checked += 1;
  }
  assert.deepEqual(failed, [], `以下补丁在 0.2.2-rc.5 上锚点全丢（需要重锚或标记 retired）：\n${failed.join('\n')}`);
  assert.ok(checked >= 45, `实际对齐的补丁只有 ${checked} 条，夹具可能缺文件`);
});

test('retired 的补丁不再要求命中', async () => {
  const retired = ALL_PATCHES.filter((p) => p.retired);
  assert.ok(retired.length >= 3, 'retired 列表不应为空');
  const status = await patchStatus(FIXTURE);
  for (const patch of retired) {
    const st = status[patch.id];
    assert.ok(
      st === undefined || st === 'skipped' || st === 'pattern_not_found' || st === 'applied' || st === 'already' || st === 'missing_file',
      `#${patch.id} 标了 retired，状态却是 ${st}`,
    );
  }
});
