// doctor 报告：文本与 --json 共用同一份数据，这里锁住归一化规则。
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildDoctorReport, renderDoctorReport } from '../lib/doctor.js';

test('空入参也能给出稳定结构', () => {
  const r = buildDoctorReport({});
  assert.equal(r.plugin.version, '');
  assert.equal(r.plugin.stale, false);
  assert.equal(r.host.surface, 'web');
  assert.equal(r.patches.applied, 0);
  assert.deepEqual(r.patches.drift, []);
  assert.equal(r.guards.state, 'unknown');
});

test('版本不一致时标 stale', () => {
  assert.equal(buildDoctorReport({ pluginVersion: '1.2.3', appliedRev: 'apply:1.2.3' }).plugin.stale, false);
  assert.equal(buildDoctorReport({ pluginVersion: '1.2.4', appliedRev: 'apply:1.2.3' }).plugin.stale, true);
  // 没有记录过 apply 时不算 stale（还没应用过而已）
  assert.equal(buildDoctorReport({ pluginVersion: '1.2.4', appliedRev: '' }).plugin.stale, false);
});

test('漂移 / 缺失会归一化并排序', () => {
  const r = buildDoctorReport({
    patchStatus: { 1: 'applied', 2: 'already', 3: 'pending', 4: 'skipped' },
    patchTotal: 10,
    retired: [80, 32],
    drift: {
      drift: [{ id: 62, name: 'ASK', optional: false, indexes: [0, 2], detail: [{ file: 'pipeline.js' }] }],
      missing: [{ id: 71 }, { id: 28 }],
    },
  });
  assert.equal(r.patches.applied, 2);
  assert.equal(r.patches.pending, 1);
  assert.equal(r.patches.total, 10, '总数以传入的 patchTotal 为准');
  assert.deepEqual(r.patches.retired, [32, 80]);
  assert.deepEqual(r.patches.missing, [28, 71]);
  assert.equal(r.patches.drift[0].id, 62);
  assert.deepEqual(r.patches.drift[0].indexes, [0, 2]);
  assert.deepEqual(r.patches.drift[0].files, ['pipeline.js']);
});

test('文本渲染覆盖关键行，且与 JSON 数据一致', () => {
  const r = buildDoctorReport({
    pluginVersion: '1.1.78',
    appliedRev: 'apply:1.1.75',
    surface: 'desktop',
    home: 'C:\\Users\\x\\.dsh',
    aiBase: 'D:\\app\\@deepseek-ai',
    hostVersion: '0.2.2-rc.5',
    patchStatus: { 1: 'applied' },
    patchTotal: 82,
    guards: { state: 'on', approval: true, fs: 3, at: '2026-11-27T08:50:24' },
    asarSealed: false,
    injectBytes: 25128,
  });
  const text = renderDoctorReport(r);
  assert.match(text, /插件版本\s+1\.1\.78/);
  assert.match(text, /宿主里跑的还是旧的/);
  assert.match(text, /宿主版本\s+0\.2\.2-rc\.5/);
  assert.match(text, /1\/82 生效/);
  assert.match(text, /运行时守卫\s+已启用/);
  assert.match(text, /unpacked/);
  assert.match(text, /25128 bytes/);
});
