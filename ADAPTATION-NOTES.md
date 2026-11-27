# 适配记录（上游 1.1.71 → 本分支 1.1.74）

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
