/**
 * 操作审计：apply / revert / reanchor 谁在什么时候做过。
 *
 * 写 $DSH_HOME/dsh-purge/audit.jsonl，一行一条 JSON。只追加、不阻塞：
 * 审计失败绝不能让主流程失败（try/catch 吞掉所有异常）。
 * 文件超过 1MB 自动滚成 audit.jsonl.1（只留一代，够排查用）。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const AUDIT_FILE = 'audit.jsonl';
const MAX_BYTES = 1 << 20;

function homeOf(explicit) {
  const env = String(explicit || process.env.DSH_HOME || '').trim();
  return env || path.join(os.homedir(), '.dsh');
}

export function auditPath(dshHome) {
  const home = homeOf(dshHome);
  return home ? path.join(home, 'dsh-purge', AUDIT_FILE) : '';
}

function rotate(fp) {
  try {
    if (fs.statSync(fp).size < MAX_BYTES) return;
    fs.renameSync(fp, `${fp}.1`);
  } catch {
    /* 文件不存在 / 被占用：下次再说 */
  }
}

/**
 * 追加一条审计记录。永不抛错。
 * @param {string} dshHome
 * @param {{op: string, ok?: boolean, [key: string]: any}} entry
 * @returns {boolean} 是否写入成功
 */
export function logAudit(dshHome, entry) {
  try {
    const fp = auditPath(dshHome);
    if (!fp) return false;
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    rotate(fp);
    const line = JSON.stringify({ at: new Date().toISOString(), ...entry });
    fs.appendFileSync(fp, `${line}\n`, 'utf8');
    return true;
  } catch {
    return false;
  }
}

/**
 * 读最近 N 条（新的在后）。
 * @param {string} dshHome
 * @param {{limit?: number}} [options]
 * @returns {Array<object>}
 */
export function readAudit(dshHome, options = {}) {
  const limit = Number.isFinite(options.limit) && options.limit > 0 ? options.limit : 20;
  const fp = auditPath(dshHome);
  if (!fp) return [];
  let text = '';
  try {
    text = fs.readFileSync(fp, 'utf8');
  } catch {
    return [];
  }
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      /* 半行/损坏行跳过 */
    }
  }
  return rows.slice(-limit);
}
