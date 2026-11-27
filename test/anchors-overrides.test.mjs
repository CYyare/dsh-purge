// 锚点覆盖（anchor overrides）：宿主升级改坏锚点时的自救通道。
// 纯单元测试，不需要真实宿主。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { readOverrides, writeOverride, clearOverride, listOverrides, applyOverrides } from '../lib/anchors.js';

const tmpHome = () => fs.mkdtempSync(path.join(os.tmpdir(), 'purge-anchor-'));

test('往返读写：写入 / 读取 / 清理', () => {
  const home = tmpHome();
  assert.deepEqual(readOverrides(home), {});

  writeOverride(home, 13, 0, 'new anchor line', { host: '0.2.2-rc.5' });
  const all = readOverrides(home);
  assert.equal(all['13']['0'].pattern, 'new anchor line');
  assert.equal(all['13']['0'].host, '0.2.2-rc.5');

  assert.equal(clearOverride(home, 13, 0), 1);
  assert.deepEqual(readOverrides(home), {});
});

test('applyOverrides 只替换指定 index，不改原补丁对象', () => {
  const patch = {
    id: 42,
    replacements: [{ pattern: 'old-0', replace: 'A' }, { pattern: 'old-1', replace: 'B' }],
  };
  const out = applyOverrides([patch], { 42: { 1: { pattern: 'new-1' } } });
  assert.notEqual(out[0], patch, '必须返回新对象');
  assert.equal(patch.replacements[1].pattern, 'old-1', '原补丁不能被改');
  assert.equal(out[0].replacements[0].pattern, 'old-0');
  assert.equal(out[0].replacements[1].pattern, 'new-1');
  assert.equal(out[0].replacements[1].replace, 'B', 'replace 要保持原样');
});

test('没有覆盖时原样返回（不加分配、不加标记）', () => {
  const patches = [{ id: 1, replacements: [] }];
  assert.equal(applyOverrides(patches, {}), patches);
});

test('空 pattern 拒绝写入，损坏的覆盖文件当空表', () => {
  const home = tmpHome();
  assert.throws(() => writeOverride(home, 1, 0, '   '), /锚点不能为空/);
  const fp = path.join(home, 'dsh-purge', 'anchor-overrides.json');
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, '{ not json', 'utf8');
  assert.deepEqual(readOverrides(home), {});
});

test('listOverrides 输出可读行', () => {
  const home = tmpHome();
  writeOverride(home, 62, 3, 'line a\nline b', { host: '0.2.2-rc.5' });
  const rows = listOverrides(home);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].patchId, 62);
  assert.equal(rows[0].index, 3);
  assert.ok(rows[0].preview.startsWith('line a'));
});
