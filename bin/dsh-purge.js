#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as core from "../lib/core.js";
import * as rules from "../lib/rules.js";
import * as anchors from "../lib/anchors.js";

const args = process.argv.slice(2);

function printStatus(state) {
  const out = [];
  out.push("dsh-purge 状态 / Status");
  out.push("  宿主 / surface " + (state.surface || "web"));
  out.push("  DSH_HOME      " + state.dsh_home);
  if (state.desktop_install) out.push("  桌面安装       " + state.desktop_install);
  if (state.ai_base) {
    out.push("  插件根 / root  " + state.ai_base);
    for (const [key, fp] of Object.entries(state.files)) {
      out.push(`    ${key.padEnd(22)} ${fp}`);
    }
  } else {
    out.push("  插件根 / root  " + core.missingAiBaseMessage());
  }
  out.push(`  shim 目录      ${state.shim_dir || "未定位 / not found"}`);
  out.push(`  备份 / backup  ${state.has_backup ? "有 / yes" : "无 / no"}`);
  out.push(`  注入文件       ${state.override_path}`);
  out.push(`  注入状态       ${state.override_status}`);
  out.push("");
  out.push(`  补丁 ${state.patches_applied}/${core.ALL_PATCHES.length} 已清洗, ${state.patches_pending} 待清洗`);
  for (const p of core.ALL_PATCHES) {
    const s = state.patch_status[p.id];
    const mark = s === "applied" ? "✓" : s === "pending" ? "✗" : "·";
    out.push(`    ${mark} [#${String(p.id).padEnd(2)}] ${p.name.padEnd(30)} ${p.layer}/${p.layer_en} — ${s}`);
  }
  out.push("");
  out.push(`  shim: dsh.cmd=${state.shim_cmd}  dsh.ps1=${state.shim_ps1}  dsh=${state.shim_bin}`);
  return out.join("\n");
}

async function main() {
  const mode = args.find((a) => ["--apply", "--revert", "--uninstall", "--status", "--edit", "--doctor", "--reanchor", "--help"].includes(a));

  if (mode === "--help" || args.includes("-h")) {
    console.log(`dsh-purge 用法:
  dsh-purge --status     显示状态
  dsh-purge --apply      应用全部清洗（提示词+代码+shim+override）
  dsh-purge --revert     回滚还原
  dsh-purge --uninstall  卸载插件（已应用则先还原）
  dsh-purge --edit       编辑注入文件 prompt-inject.md
  dsh-purge --doctor     自检：宿主版本 / 漂移 / 备份 / asar / 注入体积
  dsh-purge --reanchor list                    查看锚点覆盖
  dsh-purge --reanchor set <id> <index> <原文>  用宿主里的真实片段重锚一条补丁
  dsh-purge --reanchor clear <id> [index]      删除覆盖（恢复出厂锚点）
  dsh-purge --help       帮助`);
    return;
  }


const PLUGIN_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** 磁盘上这份插件自己的版本（不是宿主加载的那份）。 */
function pluginVersion() {
  try {
    return String(JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, "package.json"), "utf8")).version || "");
  } catch {
    return "";
  }
}

/** 上一次「应用」写下的版本，用来对比磁盘代码是否已经打进宿主。 */
function lastAppliedRev(home) {
  try {
    return String(fs.readFileSync(path.join(home || "", "dsh-purge", "installed-rev"), "utf8")).trim();
  } catch {
    return "";
  }
}

function readHostVersion(aiBase) {
  if (!aiBase) return "";
  for (const rel of [["dsh", "package.json"], ["package.json"]]) {
    try {
      const fp = path.join(aiBase, ...rel);
      const raw = JSON.parse(fs.readFileSync(fp, "utf8"));
      if (raw && raw.version) return String(raw.version);
    } catch { /* 下一个 */ }
  }
  return "";
}

async function runDoctor() {
  const state = await core.gatherState();
  const aiBase = state.ai_base;
  const home = state.dsh_home;
  console.log("dsh-purge doctor");
  console.log(`  插件版本         ${pluginVersion() || "(未知)"}  ← 磁盘上这份代码`);
  const lastApply = lastAppliedRev(home);
  console.log(`  上次应用         ${lastApply || "(未记录)"}${lastApply && lastApply !== `apply:${pluginVersion()}` ? "  ← 与磁盘版本不一致，宿主里跑的还是旧的" : ""}`);
  console.log(`  宿主 surface     ${state.surface || "web"}`);
  console.log(`  DSH_HOME         ${home || "(未定位)"}`);
  console.log(`  插件根 aiBase    ${aiBase || core.missingAiBaseMessage()}`);
  if (aiBase) console.log(`  宿主版本         ${readHostVersion(aiBase) || "未知"}`);
  const total = core.ALL_PATCHES.length;
  const applied = Object.values(state.patch_status || {}).filter((v) => v === "applied" || v === "already").length;
  const pending = Object.values(state.patch_status || {}).filter((v) => v === "pending").length;
  console.log(`  补丁             ${applied}/${total} 生效，${pending} 待应用`);
  const retired = core.ALL_PATCHES.filter((p) => p.retired);
  if (retired.length) console.log(`  已删功能 retired  ${retired.map((p) => "#" + p.id).join(" ")}`);
  let drift = { drift: [], missing: [], pending: [] };
  if (aiBase) {
    try { drift = await core.patchDrift(aiBase); } catch (e) { console.log(`  ⚠ 漂移诊断失败 ${e && e.message ? e.message : e}`); }
  }
  if (drift.drift.length) {
    console.log(`  漂移 drift       ${drift.drift.length} 条（需要重锚）`);
    for (const row of drift.drift) {
      const idx = row.indexes && row.indexes.length ? row.indexes[0] : 0;
      const f = (row.detail && row.detail[0] && row.detail[0].file) || "";
      console.log(`    #${String(row.id).padEnd(3)} ${String(row.name).padEnd(34)} ${f}`);
      console.log(`         重锚: dsh-purge --reanchor set ${row.id} ${idx} "<从宿主里拷的原文>"`);
    }
  } else if (aiBase) {
    console.log("  漂移 drift       0 条");
  }
  if (drift.missing.length) console.log(`  未装可选包       ${drift.missing.map((r) => "#" + r.id).join(" ")}`);
  const ov = anchors.listOverrides(home);
  console.log(`  锚点覆盖         ${ov.length} 条${ov.length ? "（" + ov.map((r) => "#" + r.patchId + "[" + r.index + "]").join(" ") + "）" : ""}`);
  let asar = "unpacked";
  try { asar = core.desktopAsarStillSealed() ? "sealed（补丁还没进内存，需要换包重启）" : "unpacked（已从解包目录启动）"; } catch { /* ignore */ }
  console.log(`  asar 状态        ${asar}`);
  const injectPath = path.join(home || "", "prompt-inject.md");
  try { console.log(`  注入体积         ${fs.statSync(injectPath).size} bytes`); } catch { console.log("  注入体积         (未找到 prompt-inject.md)"); }
  const guard = path.join(home || "", "dsh-purge", "settle-restart.guard");
  console.log(`  待重启 guard     ${fs.existsSync(guard) ? "存在（自动结算会冷却 180s）" : "无"}`);
}

function runReanchor(rawArgs) {
  const sub = String(rawArgs[1] || "list").toLowerCase();
  const home = core.findDshHome();
  if (sub === "list") {
    const rows = anchors.listOverrides(home);
    if (!rows.length) return console.log("没有锚点覆盖（出厂锚点）");
    for (const r of rows) console.log(`#${r.patchId}[${r.index}]  ${r.at}  ${r.host}  ${r.preview}`);
    return;
  }
  if (sub === "set") {
    const id = Number(rawArgs[2]);
    const index = Number(rawArgs[3]);
    const pattern = rawArgs[4];
    if (!Number.isFinite(id) || !Number.isFinite(index) || !pattern) {
      return console.log("用法: dsh-purge --reanchor set <patchId> <index> \"<原文片段>\"");
    }
    const out = anchors.writeOverride(home, id, index, pattern, { host: readHostVersion(core.findAiBase()) });
    console.log(`已写入 ${out.file}：#${out.patchId}[${out.index}]`);
    console.log("下次 --apply / 面板应用时生效；status 也会跟着变。");
    return;
  }
  if (sub === "clear") {
    const id = Number(rawArgs[2]);
    const index = rawArgs[3];
    const n = anchors.clearOverride(home, id, index);
    console.log(n ? `已删除 ${n} 条覆盖` : "没有匹配的覆盖");
    return;
  }
  console.log("用法: dsh-purge --reanchor list | set <id> <index> <pattern> | clear <id> [index]");
}
  if (mode === "--doctor") { await runDoctor(); return; }
  if (mode === "--reanchor") { runReanchor(args); return; }
  const state = await core.gatherState();
  console.log(printStatus(state));
  console.log("");

  if (mode === "--apply") {
    if (!state.ai_base) {
      console.log("[ERROR] " + core.missingAiBaseMessage());
      console.log("  fix: 把 DSH_BASE 指到含 dsh-agent-instructions/lib 的 @deepseek-ai 目录");
      process.exit(1);
    }
    const inject = rules.resolveInjectText(state.dsh_home);
    if (!inject.text) {
      console.log("[ERROR] 提示词和规则集都是空的，必须先添加提示词");
      process.exit(1);
    }
    const { hosts, report } = await core.applyPatchesAllHosts(core.ALL_PATCHES, {
      preserveClientBundles: false,
      forApply: true,
    });
    for (const h of hosts) console.log(`  宿主 / host → ${h.aiBase}`);
    for (const r of report) {
      const m = r.status === "applied" ? "✓ 已清洗" : r.status === "already" ? "- 已是最新" : r.status === "missing_file" ? "⚠ 文件缺失" : `✗ ${r.status}`;
      console.log(`  ${m} patch #${String(r.patch_id).padEnd(2)} ${r.name}`);
    }
    const flashHost = hosts[0]?.aiBase || state.ai_base;
    const flash = core.silenceCmdFlash(flashHost);
    console.log(`  cmd-flash=${flash.entry} phase-1=${flash.phase1} ok=${flash.ok}`);
    if (hosts.length > 1) {
      console.log(`  多宿主 / multi-host: ${hosts.length} 份 @deepseek-ai 已清洗`);
    }
    console.log(inject.source === "rule"
      ? "  - 使用当前规则集，不改写提示词文件"
      : "  - 使用已有提示词文件");
    if (state.shim_dir) {
      const r = await core.patchShim(state.shim_dir);
      for (const [fname, st] of Object.entries(r)) {
        if (st === "patched") console.log(`  ✓ shim ${fname} 注入 / injected`);
        else if (st === "already_patched") console.log(`  - shim ${fname} 已注入 / already injected`);
        else if (st === "missing") console.log(`  - shim ${fname} 不存在 / missing`);
        else console.log(`  ⚠ shim ${fname}: ${st}`);
      }
    } else {
      console.log("  ⚠ 未定位 shim 目录，跳过注入");
    }
    console.log("");
    console.log("全部完成 / All done。重启 dsh 生效 / Restart dsh to take effect.");
  } else if (mode === "--revert") {
    if (state.ai_base || core.enumeratePatchAiBases().length) {
      const { reverted, errors } = await core.revertAllHosts();
      for (const p of reverted) console.log(`  ✓ 已还原 / Reverted ${p}`);
      for (const [p, e] of errors) console.log(`  ⚠ 还原失败 ${p}: ${e}`);
      if (reverted.length === 0) console.log("  - 没有补丁备份可还原 / no patch backup");
    }
    if (state.shim_dir) {
      const r = await core.revertShim(state.shim_dir);
      for (const [fname, st] of Object.entries(r)) {
        if (st === "reverted" || st === "stripped_inject") console.log(`  ✓ shim ${fname}: ${st}`);
        else console.log(`  - shim ${fname}: ${st}`);
      }
    }
    console.log("");
    console.log("回滚完成 / Revert done。重启 dsh 后恢复 / restart to restore.");
    console.log("注: prompt-inject.md 保留（用户文件）/ prompt-inject.md kept (user file)");
  } else if (mode === "--uninstall") {
    const { uninstallPurge } = await import("../lib/uninstall.js");
    const result = await uninstallPurge();
    if (result.applied) console.log("  已检测到补丁，已还原回原版。");
    else console.log("  未检测到已应用补丁，仍会清除插件文件。");
    if (result.override?.removed) console.log(`  已删除 ${result.override.path}`);
    if (result.stripped?.length) console.log(`  已从 profile 移除: ${result.stripped.join(", ")}`);
    for (const e of result.errors || []) console.log(`  ⚠ ${e}`);
    if (!result.ok) {
      console.log("  卸载中止：还原失败，插件文件未删除。");
      process.exit(1);
    }
    console.log("");
    console.log("卸载完成。请重启 dsh。");
  } else if (mode === "--edit") {
    const r = core.editOverride(state.dsh_home);
    if (!r.ok && r.needCreate) {
      await core.installOverride(state.dsh_home, true);
      console.log(`  ✓ 已创建默认注入文件：${state.override_path}`);
      core.editOverride(state.dsh_home);
    } else {
      console.log(`  → 已打开 ${r.editor} 编辑注入文件：${r.path}`);
    }
    console.log("  编辑完成后重启 dsh 生效。");
  } else {
    console.log("默认不清洗，使用 --apply 应用清洗。");
  }
}

main().catch((e) => {
  console.error("[dsh-purge] error:", e);
  process.exit(1);
});
