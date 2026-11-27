// 语法自检：补丁把文件改坏时，必须拒绝落盘并保留原文。
process.env.DSH_SURFACE = 'desktop';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { applyPatches, checkPatchedSyntax } from '../lib/core.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(here, '..', 'fixtures', 'dsh-0.2.2-rc.5');

test('checkPatchedSyntax 能区分好坏代码', () => {
  assert.equal(checkPatchedSyntax('export const a = 1;').ok, true);
  const bad = checkPatchedSyntax('export const a = ;');
  assert.equal(bad.ok, false);
  assert.ok(bad.error.length > 0, '应带上错误摘要');
});

test('坏补丁不会写盘，好补丁照常生效', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'purge-syntax-'));
  const pkg = path.join(root, 'dsh-agent-instructions', 'lib');
  fs.mkdirSync(pkg, { recursive: true });
  const target = path.join(pkg, 'index.js');
  const src = path.join(FIXTURE, 'dsh-agent-instructions', 'lib', 'index.js');
  fs.copyFileSync(src, target);
  const original = fs.readFileSync(target, 'utf8');

  // 1) 故意写坏：把 const 变成 const const
  const broken = {
    id: 9991,
    name: 'BROKEN_SYNTAX',
    file: ['agent-instructions'],
    replacements: [{ pattern: 'const ', replace: 'const const ' }],
  };
  const badReport = await applyPatches(root, [broken], { dshHome: root });
  const badRow = badReport.find((r) => r.patch_id === 9991);
  assert.ok(String(badRow.status).startsWith('syntax_error'), `状态应为 syntax_error，实际 ${badRow.status}`);
  assert.equal(fs.readFileSync(target, 'utf8'), original, '原文必须保持不动');

  // 2) 正常替换：能落盘
  const good = {
    id: 9992,
    name: 'GOOD_REPLACE',
    file: ['agent-instructions'],
    replacements: [{ pattern: 'const WORKSPACE_CONTEXT_INTRO =', replace: 'const WORKSPACE_CONTEXT_INTRO =' }],
  };
  // 该 pattern 在 0.2.2 夹具里可能不存在，不存在就换一个必然存在的
  const probe = fs.readFileSync(target, 'utf8');
  if (!probe.includes('const WORKSPACE_CONTEXT_INTRO =')) {
    good.replacements = [{ pattern: 'const ', replace: 'const  ' }];
  }
  const goodReport = await applyPatches(root, [good], { dshHome: root });
  const goodRow = goodReport.find((r) => r.patch_id === 9992);
  assert.ok(['applied', 'already'].includes(goodRow.status), `状态应为 applied，实际 ${goodRow.status}`);
});
