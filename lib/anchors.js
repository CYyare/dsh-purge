/**
 * 锚点重定向（anchor overrides）。
 *
 * 补丁引擎按"宿主原文 → 新文"匹配；官方一升级，锚点就可能挪位置/改写法，
 * 于是那条补丁变成 skipped。这里允许把某条补丁的第 N 个 pattern 换成
 * "从当前宿主里抄下来的真实片段"，存在
 *   $DSH_HOME/dsh-purge/anchor-overrides.json
 * 而不去改插件源码 —— 升级当天就能修，不必等发版。
 *
 * 文件形状：
 *   { "13": { "0": { "pattern": "…", "at": "2026-11-27T…", "host": "0.2.2-rc.5" } } }
 *
 * 覆盖只影响 apply/status 时构造出来的补丁副本，不改 ALL_PATCHES 本体；
 * 删掉这个文件即恢复出厂锚点。
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { logAudit } from "./audit.js";

export const OVERRIDES_FILE = "anchor-overrides.json";

function homeOf(explicit) {
  const env = String(explicit || process.env.DSH_HOME || "").trim();
  if (env) return env;
  return path.join(os.homedir(), ".dsh");
}

/** @returns {string} 覆盖文件的绝对路径；没有 home 时返回空串 */
export function overridesPath(dshHome) {
  const home = homeOf(dshHome);
  return home ? path.join(home, "dsh-purge", OVERRIDES_FILE) : "";
}

/** 读覆盖表；文件不存在/损坏一律当空表，绝不让 apply 因为它挂掉。 */
export function readOverrides(dshHome) {
  const fp = overridesPath(dshHome);
  if (!fp) return {};
  try {
    const data = JSON.parse(fs.readFileSync(fp, "utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    return data;
  } catch {
    return {};
  }
}

/** 写一条覆盖。pattern 必须是非空字符串（就是宿主里的原文片段）。 */
export function writeOverride(dshHome, patchId, index, pattern, extra = {}) {
  const text = typeof pattern === "string" ? pattern : "";
  if (!text.trim()) throw new Error("锚点不能为空");
  const fp = overridesPath(dshHome);
  if (!fp) throw new Error("未定位 DSH 数据目录，无法写锚点覆盖");
  const all = readOverrides(dshHome);
  const key = String(patchId);
  const slot = all[key] && typeof all[key] === "object" ? all[key] : {};
  slot[String(index)] = {
    pattern: text,
    at: new Date().toISOString(),
    ...extra,
  };
  all[key] = slot;
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, `${JSON.stringify(all, null, 2)}\n`, "utf8");
  logAudit(dshHome, { op: "reanchor", action: "set", patchId: Number(patchId), index: Number(index), bytes: text.length });
  return { file: fp, patchId: Number(patchId), index: Number(index) };
}

/** 删一条（index 省略则删整条补丁的覆盖）。返回删掉了几条。 */
export function clearOverride(dshHome, patchId, index) {
  const fp = overridesPath(dshHome);
  if (!fp || !fs.existsSync(fp)) return 0;
  const all = readOverrides(dshHome);
  const key = String(patchId);
  if (!all[key]) return 0;
  let removed = 0;
  if (index === undefined || index === null || index === "") {
    removed = Object.keys(all[key]).length;
    delete all[key];
  } else if (all[key][String(index)]) {
    delete all[key][String(index)];
    removed = 1;
    if (Object.keys(all[key]).length === 0) delete all[key];
  }
  if (removed === 0) return 0;
  if (Object.keys(all).length === 0) {
    try { fs.unlinkSync(fp); } catch { /* ignore */ }
    return removed;
  }
  fs.writeFileSync(fp, `${JSON.stringify(all, null, 2)}\n`, "utf8");
  logAudit(dshHome, { op: "reanchor", action: "clear", patchId: Number(patchId), removed });
  return removed;
}

/** 覆盖表 → 人类可读的行，给 CLI / doctor 用。 */
export function listOverrides(dshHome) {
  const all = readOverrides(dshHome);
  const rows = [];
  for (const [id, slots] of Object.entries(all)) {
    for (const [index, entry] of Object.entries(slots || {})) {
      rows.push({
        patchId: Number(id),
        index: Number(index),
        at: String(entry?.at || ""),
        host: String(entry?.host || ""),
        preview: String(entry?.pattern || "").slice(0, 60).replace(/\s+/g, " "),
      });
    }
  }
  return rows.sort((a, b) => a.patchId - b.patchId || a.index - b.index);
}

/**
 * 把覆盖叠加到补丁表上，返回**新数组**（浅拷贝 + 替换 replacements）。
 * 没有覆盖时原样返回入参，避免多余分配。
 */
export function applyOverrides(patches, overrides) {
  if (!Array.isArray(patches)) return patches;
  const all = overrides && typeof overrides === "object" ? overrides : {};
  const ids = Object.keys(all);
  if (ids.length === 0) return patches;
  return patches.map((p) => {
    const slots = all[String(p.id)];
    if (!slots || typeof slots !== "object") return p;
    const reps = Array.isArray(p.replacements) ? p.replacements : [];
    let touched = false;
    const next = reps.map((r, i) => {
      const entry = slots[String(i)];
      const pattern = entry && typeof entry.pattern === "string" ? entry.pattern : "";
      if (!pattern) return r;
      touched = true;
      return { ...r, pattern };
    });
    return touched ? { ...p, replacements: next, anchored: true } : p;
  });
}

/** 便捷入口：读 home 里的覆盖并叠加。 */
export function withOverrides(patches, dshHome) {
  return applyOverrides(patches, readOverrides(dshHome));
}
