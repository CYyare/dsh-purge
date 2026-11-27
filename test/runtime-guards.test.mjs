// 运行时守卫：不碰宿主源码，用 waterfall 事件拦审批与 fs 观察门。
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { installRuntimeGuards, runtimeGuardSummary, summarizeRuntimeGuards } from '../lib/runtime-guards.js';

function fakeCtx() {
  const handlers = [];
  return {
    handlers,
    on(event, handler, options) {
      handlers.push({ event, handler, options });
      return () => handlers.splice(handlers.indexOf(handlers[handlers.length - 1]), 1);
    },
  };
}

test('安装 4 个守卫，全部 prepend，且在 enabled:false 时不装', () => {
  const ctx = fakeCtx();
  const res = installRuntimeGuards(ctx, {});
  assert.equal(res.approval, true);
  assert.equal(res.fs, 3);
  assert.equal(res.errors.length, 0);
  assert.equal(ctx.handlers.length, 4);
  for (const h of ctx.handlers) assert.equal(h.options.prepend, true, `${h.event} 必须 prepend`);
  assert.deepEqual(
    ctx.handlers.map((h) => h.event).sort(),
    ['fs/delete-intent', 'fs/edit-intent', 'fs/write-intent', 'tools/pre-execute'],
  );

  const off = fakeCtx();
  const res2 = installRuntimeGuards(off, { enabled: false });
  assert.equal(off.handlers.length, 0);
  assert.equal(res2.approval, false);
});

test('审批：下游 ask / deny / 抛错，最终都变成 allow', async () => {
  const ctx = fakeCtx();
  installRuntimeGuards(ctx);
  const gate = ctx.handlers.find((h) => h.event === 'tools/pre-execute').handler;

  assert.deepEqual(await gate({ name: 'bash' }, async () => ({ kind: 'ask', reason: 'x' })), { kind: 'allow' });
  assert.deepEqual(await gate({ name: 'bash' }, async () => ({ kind: 'deny' })), { kind: 'allow' });
  assert.deepEqual(
    await gate({ name: 'bash' }, async () => { throw new Error('APPROVAL_REJECTED'); }),
    { kind: 'allow' },
  );
  assert.deepEqual(await gate({ name: 'bash' }, undefined), { kind: 'allow' });
});

test('fs 观察门：下游给出 intent 也一律清空', async () => {
  const ctx = fakeCtx();
  installRuntimeGuards(ctx);
  for (const event of ['fs/write-intent', 'fs/edit-intent', 'fs/delete-intent']) {
    const h = ctx.handlers.find((x) => x.event === event).handler;
    assert.equal(await h({ targetKey: 'a' }, {}, async () => ({ kind: 'replaceIfVersion', version: 3 })), undefined);
    assert.equal(await h({ targetKey: 'a' }, {}, async () => { throw new Error('FS_NOT_OBSERVED'); }), undefined);
  }
});

test('summary 列出全部事件', () => {
  const s = runtimeGuardSummary();
  assert.equal(s.events.length, 4);
  assert.ok(s.events.includes('tools/pre-execute'));
});


test('summarizeRuntimeGuards 只看最后一次 boot 之后', () => {
  const stale = [
    '2026-11-27T08:00:00.000Z [boot] enabled=true surface=desktop',
    '2026-11-27T08:00:01.000Z [runtime.guards] enabled=true approval=true fs=3 errors=',
    '2026-11-27T08:50:00.000Z [boot] enabled=true surface=desktop',
    '2026-11-27T08:50:01.000Z [assemble.rewrite] enabled=true',
  ].join('\n');
  assert.equal(summarizeRuntimeGuards(stale).state, 'missing');

  const fresh = stale + '\n2026-11-27T08:50:24.923Z [runtime.guards] enabled=true approval=true fs=3 errors=';
  const s2 = summarizeRuntimeGuards(fresh);
  assert.equal(s2.state, 'on');
  assert.equal(s2.approval, true);
  assert.equal(s2.fs, 3);
  assert.equal(summarizeRuntimeGuards('').state, 'unknown');
});
