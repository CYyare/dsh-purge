# 适配记录（上游 1.1.71 → 本分支 1.1.75）

记录**改了什么、为什么改、怎么验证**。新版本适配时在最后追加一节。

## 1. 基线

| 项 | 值 |
|---|---|
| 上游插件 | `mmparko/dsh-purge` v1.1.71（`YuJunZhiXue/dsh-purge` 已删库，取镜像） |
| 原 `dshTarget` | `0.2.0-rc.2` |
| 本分支 `dshTarget` | `0.2.2-rc.5` |
| 已验证宿主 | 官方桌面 `DeepSeek Harness 0.2.2-rc.5`（`@deepseek-ai/dsh-desktop`，asar 已换包为 `resources/app`） |
| 验证手段 | `npm test`（夹具回归）、`dsh-purge --doctor`（真机自检）、宿主日志 |

补丁状态语义（`lib/core.js`）：

- `applied` —— 已生效（markers 命中，或锚点已被替换）
- `pending` —— 原文锚点命中，尚未应用
- `skipped` —— 文件在，但锚点与 markers 都不命中 → **上游改写了这段，需要重锚**
- `missing_file` —— 目标文件不存在（可选包没装）

「适配」= 把 `skipped` 变成 `pending`/`applied`，或者把它标记成 `retired`（官方已删功能）。

## 2. 第一轮：会话全挂（`{{cwd}}`）

| 现象 | 每回合 `unknown prompt variable "{{cwd}}" in section "deployment:persona-suffix"`，所有会话发不出消息 |
|---|---|
| 根因 | dsh 0.2.1-alpha.1 起不再注册 `cwd` 提示词变量（只剩 `provider`/`model`）；插件仍在 `cordis.patch.yml` 的 `personaSuffix` 与 `CWD_ONLY_SUFFIX` 里写 `{{cwd}}` |
| 处理 | `personaSuffix` 置空；`CWD_ONLY_SUFFIX` 改静态句；`DSH_INTERPOLATE_ALLOWED` 去掉 `cwd`；新增 `resolveCwdTemplate()` 在重写阶段把残留 `{{cwd}}` 落成会话 cwd |
| 验证 | 模拟 assemble 后 `contains {{cwd}} = false`；真机重启后日志无该错误 |

## 3. 第二轮：「清洗没有写进全部宿主」

| 现象 | 应用成功但取消重启，提示"清洗没有写进全部宿主" |
|---|---|
| 根因 | A. 补丁 #40 匹配 0.2.0 的 `assemble()` 返回块，0.2.2 新增 `tools`/`requiredContexts`，锚点全丢 → `[dsh-purge] complete prompt keeps inject` 标记写不进去；B. `hostPromptKeepsInject()` 的兜底启发式把 0.2.2 的 `completeSection === void 0 ? transformed.sections : [completeSection]` 误判成"旧版丢注入" |
| 处理 | #40 增加 0.2.2 锚点（替换后仍保留 `tools` / `requiredContexts`）；`dropsInject` 判定排除新版写法 |
| 验证 | 对真实宿主文件跑 `hostPromptKeepsInject()` = true；`--doctor` 不再报漂移 |

## 4. 第三轮：0.2.2 补丁移植（11 条）

新增 `lib/compat-022.js`：按补丁 id 追加"0.2.2 原文 → 同样的替换"，插在 `replacements` 最前面，**旧 pattern 全部保留**，一份代码同时兼容 0.2.0 与 0.2.2。

| # | 补丁 | 0.2.2 的变化 |
|---|---|---|
| 13 | ESCALATION_WIDENING_EXEMPT | `throw new Error(msg)` → `SandboxEscalationError(msg, CODE)` |
| 14 | ESCALATION_GRANT_UNCONDITIONAL | `displayReason` 收敛为 `escalationDisplayReason()` |
| 17 | FS_OBSERVATION_INTENT_FREE | `editIntent` 收成 `requirePresent(target, actor, "edit")` |
| 18 | REPEAT_TOOL_REMINDER_DISABLED | 删掉 `downstream.kind === "block"` 分支 |
| 35 | ESCALATION_NEVER_REJECT | rejected/cancelled 分支改写，`cancelled` 多一行 `throwIfAborted()` |
| 54 | DELIVERABLE_DO_NOT | 提示词搬到 `dsh-deliverable-file-references`（`FILE_REFERENCE_PROMPT`） |
| 60 | OFFICIAL_RUN_CODE_APPROVAL_NEUTRAL | run_code 执行器拆成 `dsh-tool-executor-ptc` |
| 62 | OFFICIAL_TOOL_ASK_FAILOPEN | 审批管线拆到 `dsh-tools/lib/pipeline.js`，deny 包成 `approvalDenial()`，新增 agent-less 分支 |
| 67 | AGENT_LOOP_MESSAGES_GUARD | 外层多包一层 `try`，缩进 4 → 5 tab |
| 74 | ASSEMBLE_BEFORE_PRESTEP | assemble 改传对象（多 `modelSelection` / `toolSet`） |
| 82 | DESKTOP_SHELL_PROFILE_FALLBACK | import 后跟的 region 从 home-paths 变成 mime，改为只锚 import 行 |

`targetFiles()` 同步新增映射：

- `deliverables-prompt` → `dsh-deliverable-file-references/lib/index.js`
- `dsh-tools-ptc` → `dsh-tool-executor-ptc/lib/index.js` + `lib/types/ptc.js`
- `dsh-tools-pipeline` → `dsh-tools/lib/pipeline.js`（#62 目标补上该键）

## 5. 其它修复

| 项 | 处理 |
|---|---|
| 红队预设 `toolFilter`（issue #7） | 0.2.2 的 `dsh-tool-subagent` 直接拒绝该键，删除后叶子约束交给 `maxDepth: 1` |
| 预设 `list-agents` 子路径 | 0.2.2 的 `dsh-tool-subagent-control` 不再导出 `./list-agents`，删掉该条目；否则整份预设 `registered-broken` |
| `hide-console` EPERM | Program Files 下写 sidecar 抛 EPERM，`ensureHiddenConsole` 包 try/catch 降级成状态 |
| 自更新指向 | 仍指向上游仓库（默认 `autoUpdateOnStart: false`）；**待办**：改成本分支仓库，避免覆盖 |
| settle 冷却挡住换包 | 现象：应用成功后 180s 内不再自动换包重启；临时处理是再点一次「应用」；**待办**：换包不吃 settle 冷却 |

## 6. 新增能力（本轮）

| 能力 | 入口 | 说明 |
|---|---|---|
| 锚点重定向 | `dsh-purge --reanchor list/set/clear` | `$DSH_HOME/dsh-purge/anchor-overrides.json` 里换掉某条补丁第 N 个 pattern，**不改源码**即可适配新宿主 |
| 漂移诊断 | `dsh-purge --doctor`、`core.patchDrift()` | 把没生效的补丁分成 `drift / missing / pending`，drift 直接给出重锚命令 |
| 夹具回归 | `npm test` | `fixtures/dsh-0.2.2-rc.5/`（55 个真实文件，2.5MB）+ `test/anchors.test.mjs`；任何锚点被改坏立刻红 |
| 夹具生成 | `npm run fixtures -- --from <aiBase> --out fixtures/<ver>` | 换了宿主版本重新生成一份，追加到夹具矩阵 |
| 兼容扫描 | `node scripts/compat-scan.mjs --asar <app.asar>` | 直接对着 asar 统计哪几条对不上（不需要装） |


## 6.5 备份与落盘自检（1.1.75）

| 问题 | 根因 | 处理 |
|---|---|---|
| `resources/app` 下 0 个 `.dshpurge.bak`，`--revert` 实际是空操作 | `atomicCopyFile` 用 `rename(tmp, dst)` 落盘，而 `backupAll` 先 `open(bak,"wx")` 建了占位文件；**Windows 的 rename 不能覆盖已存在目标**，58 条全部 EPERM，占位随后被删 → 一条备份都没留下 | rename 前先删目标；`backupAll` 跳过"已经带 `[dsh-purge]` 标记"的文件（此时原文已丢，存下来只会让 revert 把补丁写回去）；`revertAll` 顺手删掉"目标与备份一致"的孤儿 bak |
| 一条 replace 写错就能让宿主起不来 | 落盘前没有任何校验 | 新增 `checkPatchedSyntax()`：`.js/.mjs/.cjs` 写入前用 `node --check` 校验替换后全文，失败则**不写**该文件、把该条标成 `syntax_error`，其余补丁照常 |

端到端验证（在纯净解包副本上跑）：

```
targets=58  backupAll: made=58 errors=0  bak 与原文一致: true
applyPatches: applied=58 changed=48
revertAll: reverted=48 errors=0 还原一致=58/58 剩余bak=0
```

## 6.6 Tier A 运行时守卫（1.1.75）

审批、fs 观察门不再只靠改宿主源码，改为在 Cordis waterfall 上拦截（`lib/runtime-guards.js`）：

| 事件 | 做法 | 替代的补丁 |
|---|---|---|
| `tools/pre-execute` | 先 `next()` 让下游判定照常执行，再强制返回 `{kind:"allow"}` | #5 #8 #12 #33 #48 #58 #59 #61 #62 #63 |
| `fs/write-intent` / `fs/edit-intent` / `fs/delete-intent` | 先 `next()`，再丢弃 intent（返回 `undefined`）→ 不做读前校验 | #16 #17 |

- 开关：`runtimeGuards: false` 或环境变量 `DSH_PURGE_RUNTIME_GUARDS=0`；
- 失败安全：每个事件单独 try/catch，装不上只记 `runtime.guards` 日志，不影响其它功能；
- 「先 next 再覆盖」而不是直接短路：不依赖宿主 waterfall 的短路语义，宿主换实现也仍然成立。
- 这层是**叠加**在文件补丁之上的双保险：运行时守卫生效时文件补丁照样在，反之亦然。

重启宿主后生效（插件从 profile 重新加载）。`purgeLog` 里会有一行 `[runtime.guards] approval=true fs=3`。

## 6.7 Tier B：按 id 关插件 + doctor --json（1.1.78）

- **#18 / #19**：这两条补丁的目的就是"别注入提醒 / 别剪枝"。直接在 `cordis.patch.yml` 里按 id 写 `disabled: true`（`repeat-tool-reminder`、`tool-result-pruner`）比改被打包的源码稳——id 对不上时 loader 只警告一句，不会报错；文件补丁仍作为兜底保留。
- **`--doctor --json`**：新增 `lib/doctor.js`，`buildDoctorReport()` 归一化数据，文本与 JSON 共用同一份；单测锁住版本 stale、漂移索引、retired/missing 排序。
- 顺带修掉一个真 bug：`toList()` 原来用 `filter(Boolean)`，会把漂移索引 `0` 过滤掉——写测试才发现。

## 6.8 审计 / 备份清单 / 单实例写入（1.1.80）

| 项 | 做法 | 解决的问题 |
| --- | --- | --- |
| 审计日志 | `lib/audit.js` → `$DSH_HOME/dsh-purge/audit.jsonl`，追加 `{at, op, ok, ...}`；apply / revert / reanchor 都记；超过 1MB 滚成 `.1`；写入失败静默 | 出问题时能回答「谁在什么时候动过宿主」 |
| 备份清单 | `lib/backup-manifest.js`：每次 backupAll 记 `{file, bak, sha256, size}` 到 `dsh-purge/backups/<aiBase 哈希>/manifest.json`；`verifyBackups()` 校验；`revertAll` 恢复前核对 sha，备份被篡改就报 `bak_corrupt` 并跳过 | `.dshpurge.bak` 只是「旁边那个文件」，时间一长没人知道它还有效 |
| 单实例写入 | 新增 `currentInstallAppDir()`；`enumeratePatchAiBases()` 默认只保留**当前运行安装**下的 aiBase，其它安装只上报不落盘；`DSH_PURGE_ALL_HOSTS=1` 放开 | 机器上装了两份 DSH 时，避免顺手把另一份也改了 |
| CLI | `dsh-purge --audit [N]`；`--doctor` 增加「备份 N/M 校验通过」 | 排查与巡检 |

测试：`test/audit-manifest.test.mjs`（审计读写 / 损坏行 / 不可写；清单写入 / 篡改 / 删除 / 缺失）。

已验证：假宿主上 backupAll → manifest 1 条 → verify 1/1 通过 → 篡改后 stale=1。

## 6.9 从社区分支移植：预设保持 + 原生 system 槽（1.1.85）

来源：[CallMeGuLab/dsh-purge-safe](https://github.com/CallMeGuLab/dsh-purge-safe) v2.0.2（Apache-2.0）。
按本分支的锚点与标记重写，编号沿用他们的 90/91/97/98/99 便于交叉对照；实现与他们的差异见下。

| # | 补丁 | 做什么 | 与他们的差异 |
|---|---|---|---|
| 97 | BLANK_REUSE_KEEPS_RECORDED_PRESET | 冷路径：请求没点名预设、会话日志里已记了预设 → 沿用记下的那个 | 无 |
| 98 | LIVE_BLANK_REUSE_KEEPS_RECORDED_PRESET | 活着的空白会话同样沿用已记的预设，堵住 `reuseLive()` 把红队写回 standard | 无 |
| 99 | TYPES_AGENT_CLAIM_KEEPS_RECORDED_PRESET | `lib/types/agent.js` 是独立入口（16 空格缩进），同一份 `claim()` 也要修 | 无 |
| 90 | OPENAI_NATIVE_SYSTEM_ROLE | openai-completions：把挂着的提示词补进 `context.systemPrompt`，保证进原生 system 槽 | ① 我们的 `__dshPurgeHungPrompt` 是**函数**，取值统一走「函数/字符串都认」；② **不额外造 `role=system` 消息**——宿主自己会把 systemPrompt 写进原生槽，多造一条会变成两条 system |
| 91 | ANTHROPIC_NATIVE_PARAMS_SYSTEM | anthropic-messages：同上，进 `params.system` | 同上 |

**为什么 97/98/99 值得修**：DSH 0.2 里「在空白会话下拉选红队 → 发一句 → 变回标准模式」是真实故障链——
`claim()` 在请求没带 `agentPreset` 时按部署默认（standard）compose，`reuseLive()` 再补一条
`agent-preset/selected: standard`，用户刚选的意图被静默抹掉。会话日志里那条 redteam 是**已记下的意图**，
请求没点名时不该覆盖。

**验证**：
- 逐条对真实宿主文件验证：5 条全部命中，替换后 `node --check` 通过；
- 干跑（宿主镜像）：`applied=3`（正是 97/98/99；90/91 的目标在 `@earendil-works/pi-ai`，不在 aiBase 之下，夹具覆盖不到，靠上一条验证）；
- `npm test` 25 项全绿，夹具 58 个文件（新增 `dsh-api-session-controller` 两个文件）。

**署名**：思路来自上述 Apache-2.0 仓库，代码按本分支重写；如二次分发，请一并保留对方 NOTICE 与本文件的来源说明。

## 7. 已知边界

- **retired（官方已删功能）**：#32 #53（Web 文案）、#56 #77（rewind）、#80（official minimal 自带 `tool-fs`）。不计入漂移。
- **missing（本机未装可选包）**：#76 用户预设、#71/#28 梁神、#30/#31/#64/#65 hooks。
- **asar 交接**：官方桌面必须把 `app.asar` 改名成 `app.asar.bak` 才能让 `resources/app` 生效；官方升级会重新生成 `app.asar`，届时需重新应用。
- **`--reanchor` 的 pattern 必须逐字节等于宿主原文**（含 tab/换行）；只有一个 pattern 的补丁 index 为 `0`。

## 8. 下一版适配怎么做（照着走）

1. `dsh-purge --doctor` 或 `node scripts/compat-scan.mjs --asar <新 app.asar>` 看哪些变成 `drift`；
2. 对每一条 `drift`：从宿主里拷出改写后的片段 → `--reanchor set <id> <index> "<片段>"` 先自救；确认稳定后再写进 `lib/compat-022.js` 发版；
3. 新增/失效的补丁同步更新 `RETIRED` / `CHAINED` 与夹具；
4. `npm test` 全绿后发 tag。
