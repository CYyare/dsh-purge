/**
 * doctor 报告：把散落在各处的诊断数据归一成一个对象。
 *
 * 目的有两个：
 *   1. 文本输出和 --json 输出共用同一份数据，不会两边漂移；
 *   2. 纯函数（只吃入参、不读磁盘），方便单测，也方便以后喂给 UI。
 */

// 注意：indexes 里的 0 是合法值，不能用 filter(Boolean) 过滤掉。
const toList = (v) => (Array.isArray(v) ? v.filter((x) => x !== undefined && x !== null && x !== false && x !== '') : []);

/**
 * @param {object} raw
 * @param {string} [raw.pluginVersion] 磁盘上的插件版本
 * @param {string} [raw.appliedRev]    installed-rev 内容（apply:x.y.z）
 * @param {string} [raw.surface]
 * @param {string} [raw.home]
 * @param {string} [raw.aiBase]
 * @param {string} [raw.hostVersion]
 * @param {object} [raw.patchStatus]   { [id]: status }
 * @param {number} [raw.patchTotal]
 * @param {Array}  [raw.retired]
 * @param {object} [raw.drift]         patchDrift() 的返回值
 * @param {Array}  [raw.overrides]
 * @param {object} [raw.guards]        summarizeRuntimeGuards() 的返回值
 * @param {boolean}[raw.asarSealed]
 * @param {number} [raw.injectBytes]
 * @param {boolean}[raw.settleGuard]
 * @returns {object}
 */
export function buildDoctorReport(raw = {}) {
  const status = raw.patchStatus && typeof raw.patchStatus === 'object' ? raw.patchStatus : {};
  const values = Object.values(status);
  const applied = values.filter((v) => v === 'applied' || v === 'already').length;
  const pending = values.filter((v) => v === 'pending').length;
  const drift = raw.drift && typeof raw.drift === 'object' ? raw.drift : {};
  const pluginVersion = String(raw.pluginVersion || '');
  const appliedRev = String(raw.appliedRev || '');

  return {
    plugin: {
      version: pluginVersion,
      appliedRev,
      // 磁盘代码和"上次应用"不一致 → 宿主里跑的还是旧代码
      stale: Boolean(appliedRev) && Boolean(pluginVersion) && appliedRev !== `apply:${pluginVersion}`,
    },
    host: {
      surface: String(raw.surface || 'web'),
      home: String(raw.home || ''),
      aiBase: String(raw.aiBase || ''),
      version: String(raw.hostVersion || ''),
      asarSealed: raw.asarSealed === true,
    },
    patches: {
      total: Number(raw.patchTotal || 0) || Object.keys(status).length,
      applied,
      pending,
      retired: toList(raw.retired).map((p) => (typeof p === 'number' ? p : p && p.id)).filter(Boolean).sort((a, b) => a - b),
      missing: toList(drift.missing).map((r) => r && r.id).filter(Boolean).sort((a, b) => a - b),
      drift: toList(drift.drift).map((r) => ({
        id: r.id,
        name: r.name || '',
        optional: r.optional === true,
        indexes: toList(r.indexes),
        files: toList(r.detail).map((d) => d && d.file).filter(Boolean),
      })),
    },
    guards: {
      state: String(raw.guards?.state || 'unknown'),
      approval: raw.guards?.approval === true,
      fs: Number(raw.guards?.fs || 0),
      errors: String(raw.guards?.errors || ''),
      at: String(raw.guards?.at || ''),
      detail: String(raw.guards?.detail || ''),
    },
    overrides: toList(raw.overrides).map((o) => ({
      patchId: o.patchId,
      index: o.index,
      at: o.at || '',
      host: o.host || '',
    })),
    backups: {
      checked: Number(raw.backups?.checked || 0),
      ok: Number(raw.backups?.ok || 0),
      missing: toList(raw.backups?.missing).length,
      stale: toList(raw.backups?.stale).length,
      at: String(raw.backups?.at || ''),
    },
    inject: {
      bytes: Number(raw.injectBytes || 0),
    },
    settleGuard: raw.settleGuard === true,
  };
}

/** 文本渲染：和 --json 用的是同一份 report。 */
export function renderDoctorReport(report) {
  const lines = [];
  const r = report || buildDoctorReport({});
  lines.push('dsh-purge doctor');
  lines.push(`  插件版本         ${r.plugin.version || '(未知)'}  ← 磁盘上这份代码`);
  lines.push(
    `  上次应用         ${r.plugin.appliedRev || '(未记录)'}${r.plugin.stale ? '  ← 与磁盘版本不一致，宿主里跑的还是旧的' : ''}`,
  );
  lines.push(`  宿主 surface     ${r.host.surface}`);
  lines.push(`  DSH_HOME         ${r.host.home || '(未定位)'}`);
  lines.push(`  插件根 aiBase    ${r.host.aiBase || '(未定位)'}`);
  if (r.host.version) lines.push(`  宿主版本         ${r.host.version}`);
  lines.push(`  补丁             ${r.patches.applied}/${r.patches.total} 生效，${r.patches.pending} 待应用`);
  if (r.patches.retired.length) lines.push(`  已删功能 retired  ${r.patches.retired.map((id) => '#' + id).join(' ')}`);
  if (r.patches.drift.length) {
    lines.push(`  漂移 drift       ${r.patches.drift.length} 条（需要重锚）`);
    for (const row of r.patches.drift) {
      const idx = row.indexes.length ? row.indexes[0] : 0;
      lines.push(`    #${String(row.id).padEnd(3)} ${String(row.name).padEnd(34)} ${row.files[0] || ''}`);
      lines.push(`         重锚: dsh-purge --reanchor set ${row.id} ${idx} "<从宿主里拷的原文>"`);
    }
  } else {
    lines.push('  漂移 drift       0 条');
  }
  if (r.patches.missing.length) lines.push(`  未装可选包       ${r.patches.missing.map((id) => '#' + id).join(' ')}`);
  lines.push(
    `  锚点覆盖         ${r.overrides.length} 条${r.overrides.length ? '（' + r.overrides.map((o) => `#${o.patchId}[${o.index}]`).join(' ') + '）' : ''}`,
  );
  const g = r.guards;
  const guardText =
    g.state === 'on'
      ? `已启用（审批=${g.approval ? 'allow' : '原样'}, fs×${g.fs}${g.errors ? ', 报错:' + g.errors : ''}${g.at ? ', ' + g.at : ''}）`
      : g.state === 'off'
        ? '已关闭（runtimeGuards=false）'
        : `未启用（${g.detail || '未知'}）`;
  lines.push(`  运行时守卫       ${guardText}`);
  lines.push(`  asar 状态        ${r.host.asarSealed ? 'sealed（补丁还没进内存，需要换包重启）' : 'unpacked（已从解包目录启动）'}`);
  const b = r.backups;
  const backupText =
    b.checked === 0
      ? '(无清单：未备份，或宿主已打过补丁)'
      : `${b.ok}/${b.checked} 校验通过${b.missing ? `，缺失 ${b.missing}` : ''}${b.stale ? `，失效 ${b.stale}` : ''}`;
  lines.push(`  备份             ${backupText}`);
  lines.push(`  注入体积         ${r.inject.bytes ? r.inject.bytes + ' bytes' : '(未找到 prompt-inject.md)'}`);
  lines.push(`  待重启 guard     ${r.settleGuard ? '存在（自动结算会冷却 180s）' : '无'}`);
  return lines.join('\n');
}
