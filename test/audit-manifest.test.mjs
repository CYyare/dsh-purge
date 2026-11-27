// 审计日志 + 备份清单：两个都是"出错不致命"的辅助设施，这里锁住基本契约。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { logAudit, readAudit, auditPath } from '../lib/audit.js';
import { writeManifest, readManifest, verifyManifest, manifestPath } from '../lib/backup-manifest.js';

const tmpHome = () => fs.mkdtempSync(path.join(os.tmpdir(), 'purge-audit-'));

test('audit：写入 / 读取 / limit / 损坏行跳过', () => {
  const home = tmpHome();
  assert.deepEqual(readAudit(home), []);

  logAudit(home, { op: 'apply', ok: true, applied: 70 });
  logAudit(home, { op: 'revert', ok: false, errors: 1 });
  logAudit(home, { op: 'reanchor', action: 'set', patchId: 62 });

  const all = readAudit(home);
  assert.equal(all.length, 3);
  assert.equal(all[2].op, 'reanchor');
  assert.ok(all[0].at, '每条都带时间戳');

  assert.equal(readAudit(home, { limit: 2 }).length, 2);

  // 塞一行坏数据，读取时跳过而不是抛错
  fs.appendFileSync(auditPath(home), '{ broken json\n', 'utf8');
  assert.equal(readAudit(home).length, 3);
});

test('audit：目标路径不可写时不抛错', () => {
  const home = tmpHome();
  const blocker = path.join(home, 'blocker');
  fs.writeFileSync(blocker, 'x', 'utf8'); // 普通文件，下面要在它下面建目录
  assert.equal(logAudit(blocker, { op: 'apply' }), false);
  assert.deepEqual(readAudit(blocker), []);
});

test('manifest：写入后校验通过，篡改/删除能被发现', () => {
  const home = tmpHome();
  const aiBase = path.join(home, 'fake-ai');
  const target = path.join(aiBase, 'dsh-x', 'lib', 'index.js');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, 'export const a = 1;\n', 'utf8');
  fs.copyFileSync(target, `${target}.dshpurge.bak`);

  const written = writeManifest(home, aiBase, [target, path.join(aiBase, 'missing.js')]);
  assert.equal(written.entries, 1, '只记录真实存在的备份');

  const manifest = readManifest(home, aiBase);
  assert.equal(manifest.entries.length, 1);
  assert.equal(verifyManifest(manifest).ok, 1);

  // 篡改备份
  fs.writeFileSync(`${target}.dshpurge.bak`, 'changed\n', 'utf8');
  const stale = verifyManifest(readManifest(home, aiBase));
  assert.equal(stale.ok, 0);
  assert.equal(stale.stale.length, 1);

  // 删除备份
  fs.unlinkSync(`${target}.dshpurge.bak`);
  const missing = verifyManifest(readManifest(home, aiBase));
  assert.equal(missing.missing.length, 1);

  assert.ok(manifestPath(home, aiBase));
});

test('manifest：没有清单时返回 null / 空校验', () => {
  const home = tmpHome();
  assert.equal(readManifest(home, path.join(home, 'none')), null);
  assert.deepEqual(verifyManifest(null), { checked: 0, ok: 0, missing: [], stale: [] });
});
