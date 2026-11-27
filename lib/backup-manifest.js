/**
 * 备份清单：`.dshpurge.bak` 只是"旁边那个文件"，时间一长没人知道它是否还有效
 * （宿主升级、手工改动、磁盘损坏都会让它失真）。这里给它配一份 manifest：
 * 每个备份的路径 + sha256 + 大小 + 时间，doctor 可校验，revert 前可核对。
 *
 * 清单放在 $DSH_HOME/dsh-purge/backups/<aiBase 哈希>/manifest.json，
 * 不写进宿主目录（Program Files 里多一个文件就多一份噪音）。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

export const BAK_SUFFIX = '.dshpurge.bak';

function homeOf(explicit) {
  const env = String(explicit || process.env.DSH_HOME || '').trim();
  return env || path.join(os.homedir(), '.dsh');
}

/** @returns {string} 该宿主对应的 manifest 绝对路径 */
export function manifestPath(dshHome, aiBase) {
  const home = homeOf(dshHome);
  if (!home || !aiBase) return '';
  const key = crypto.createHash('sha1').update(path.normalize(aiBase).toLowerCase()).digest('hex').slice(0, 12);
  return path.join(home, 'dsh-purge', 'backups', key, 'manifest.json');
}

export function sha256File(fp) {
  try {
    return crypto.createHash('sha256').update(fs.readFileSync(fp)).digest('hex');
  } catch {
    return '';
  }
}

/** 生成一条清单项；文件读不到时返回 null。 */
export function manifestEntry(file) {
  const bak = file + BAK_SUFFIX;
  const sha = sha256File(bak);
  if (!sha) return null;
  let size = 0;
  try { size = fs.statSync(bak).size; } catch { /* ignore */ }
  return { file: path.normalize(file), bak: path.normalize(bak), sha256: sha, size };
}

/**
 * 写入清单（整份覆盖）。
 * @param {string} dshHome
 * @param {string} aiBase
 * @param {Array<{file: string}>} files 需要记录的目标文件列表
 * @returns {{file: string, entries: number}|null}
 */
export function writeManifest(dshHome, aiBase, files) {
  const fp = manifestPath(dshHome, aiBase);
  if (!fp) return null;
  const entries = [];
  for (const file of files) {
    const entry = manifestEntry(file);
    if (entry) entries.push(entry);
  }
  try {
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(
      fp,
      `${JSON.stringify({ aiBase: path.normalize(aiBase), at: new Date().toISOString(), entries }, null, 2)}\n`,
      'utf8',
    );
    return { file: fp, entries: entries.length };
  } catch {
    return null;
  }
}

/** @returns {{aiBase: string, at: string, entries: Array}|null} */
export function readManifest(dshHome, aiBase) {
  const fp = manifestPath(dshHome, aiBase);
  if (!fp) return null;
  try {
    const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
    if (!data || !Array.isArray(data.entries)) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * 校验清单：备份还在不在、内容还是不是当初那份。
 * @returns {{checked: number, ok: number, missing: string[], stale: string[]}}
 */
export function verifyManifest(manifest) {
  const out = { checked: 0, ok: 0, missing: [], stale: [] };
  const entries = manifest && Array.isArray(manifest.entries) ? manifest.entries : [];
  for (const entry of entries) {
    out.checked += 1;
    if (!entry || !entry.bak) continue;
    if (!fs.existsSync(entry.bak)) {
      out.missing.push(entry.file || entry.bak);
      continue;
    }
    if (sha256File(entry.bak) !== entry.sha256) {
      out.stale.push(entry.file || entry.bak);
      continue;
    }
    out.ok += 1;
  }
  return out;
}
