# 0.2.2 兼容状态（我们的分支）

目标宿主：**官方桌面 DeepSeek Harness 0.2.2-rc.5**（`resources/app`，dsh 0.2.2-rc.5）。
上游 1.1.71 的 `dshTarget` 是 `0.2.0-rc.2`，本分支把它做到 0.2.2 可用，旧 0.2.0 的 pattern 全部保留。

## 已修（社区 issue / PR 对应项）

| 问题 | 现象 | 修法 |
|---|---|---|
| `{{cwd}}` 变量（#12 / #4 / PR #10、#13） | 每回合 `unknown prompt variable "{{cwd}}" in section "deployment:persona-suffix"`，所有会话发不出消息 | `cordis.patch.yml` 的 `personaSuffix` 置空；`CWD_ONLY_SUFFIX` 改静态句；`DSH_INTERPOLATE_ALLOWED` 去掉 `cwd`；`identity.js` 新增 `resolveCwdTemplate()`，在重写阶段把残留 `{{cwd}}` 直接落成会话 cwd |
| `toolFilter`（#7） | 红队预设 `registered-broken: toolFilter is no longer supported` | 从 `presets/redteam/agent.cordis.yml` 删掉 `toolFilter`，叶子约束交给 `maxDepth: 1` |
| `list-agents` 子路径 | `dsh-tool-subagent-control/list-agents` 在 0.2.2 已不导出，预设仍判 broken | 删掉 `tool-subagent-list-agents` 条目 |
| `hide-console` EPERM（PR #1） | Program Files 下写 sidecar 抛 EPERM，apply 链断 | `ensureHiddenConsole` 包 try/catch，降级成状态字符串 |
| “清洗没有写进全部宿主”（自研） | apply 成功但取消重启 | #40 补 0.2.2 pattern（保住 `tools` / `requiredContexts`）；`hostPromptKeepsInject` 的 `dropsInject` 判定不再误伤新版写法 |

## 0.2.2 补丁移植

新增 `lib/compat-022.js`：按 patch id 追加“0.2.2 原文 → 同样的替换”，插在 `replacements` 最前面，旧 pattern 保留。
`core.js` 里 `augmentPatches(ALL_PATCHES)` 挂载。

已移植（每条都用真实 0.2.2 源码验证过命中 + 产物 `node --check` 通过）：

| # | 补丁 | 0.2.2 的变化 |
|---|---|---|
| 13 | ESCALATION_WIDENING_EXEMPT | `throw new Error` → `SandboxEscalationError(msg, code)` |
| 14 | ESCALATION_GRANT_UNCONDITIONAL | `displayReason` 改用 `escalationDisplayReason()` |
| 17 | FS_OBSERVATION_INTENT_FREE | `editIntent` 收成 `requirePresent()` 调用 |
| 18 | REPEAT_TOOL_REMINDER_DISABLED | 删掉 `downstream.kind === "block"` 分支 |
| 35 | ESCALATION_NEVER_REJECT | rejected/cancelled 分支改写 |
| 54 | DELIVERABLE_DO_NOT | 提示词搬到 `dsh-deliverable-file-references`（`FILE_REFERENCE_PROMPT`） |
| 60 | OFFICIAL_RUN_CODE_APPROVAL_NEUTRAL | run_code 拆到 `dsh-tool-executor-ptc` |
| 62 | OFFICIAL_TOOL_ASK_FAILOPEN | 审批管线拆到 `dsh-tools/lib/pipeline.js`，deny 包成 `approvalDenial()`，新增 `exec.agent === void 0` 分支 |
| 67 | AGENT_LOOP_MESSAGES_GUARD | 外层多包一层 `try`，缩进 4 → 5 tab |
| 74 | ASSEMBLE_BEFORE_PRESTEP | assemble 改传对象（多 `modelSelection` / `toolSet`） |
| 82 | DESKTOP_SHELL_PROFILE_FALLBACK | import 后跟的 region 从 home-paths 变成 mime，改为只锚 import 行 |

`targetFiles()` 同步新增映射：

- `deliverables-prompt` → `dsh-deliverable-file-references/lib/index.js`
- `dsh-tools-ptc` → `dsh-tool-executor-ptc/lib/index.js` + `lib/types/ptc.js`
- `dsh-tools-pipeline` → `dsh-tools/lib/pipeline.js`（#62 的目标补上这个键）

## 不再适用（官方已删功能）

| # | 补丁 | 原因 |
|---|---|---|
| 32 / 53 | Web 身份中立化 / 禁止语 | 0.2.2 整段 Web 引导文案已移除，源码里搜不到目标句 |
| 56 / 77 | rewind 相关 | 官方删掉了 rewind（`dsh-client-ui-conversation` 里 "rewind" 出现 0 次） |
| 80 | MINIMAL_OFFICIAL_TOOLSET | 官方 `minimal.patch.yml` 已自带 `tool-fs` |
| 71 / 28 | 梁神相关 | 本机未安装该插件，属正常缺失 |

## 复验

```bash
# 1) 逐条检查 0.2.2 命中情况（先解包，或直接指向已解包目录）
node scripts/compat-scan.mjs --asar "D:/Program Files/DeepSeek Harness/resources/app.asar" --extract .compat/app
node scripts/compat-scan.mjs --ai-base "<解包目录>/dsh/node_modules/@deepseek-ai"

# 2) 宿主内看真实状态
#    dsh-purge 侧栏 → 状态；或聊天里 /purge status
```

注意：`compat-scan.mjs` 只认 `replacements` 字段，少数用其它结构的补丁会显示 miss —— 以宿主里 `/purge status` 的结果为准。

## 锚点重定向（升级当天自救）

宿主升级把某条补丁的锚点改掉时，不必改源码、不必等发版：

```sh
dsh-purge --doctor                                    # 看哪几条漂移，会直接给出重锚命令
dsh-purge --doctor --json                             # 同一份数据的结构化输出（贴 issue / 给脚本用）
dsh-purge --reanchor set 62 2 "<从宿主里拷的原文片段>"   # 只换这条补丁的第 3 个 pattern
dsh-purge --reanchor list                             # 查看现有覆盖
dsh-purge --reanchor clear 62                         # 删除覆盖，恢复出厂锚点
```

覆盖写在 `$DSH_HOME/dsh-purge/anchor-overrides.json`，只影响 apply/status 时构造出的补丁副本，不改 `ALL_PATCHES` 本体。确认稳定后再把新锚点写进 `lib/compat-022.js` 发版。

## 回归测试与夹具

```sh
npm test                                                          # 用真实 0.2.2-rc.5 源码跑锚点回归
npm run fixtures -- --from <aiBase> --out fixtures/dsh-<ver>      # 换宿主版本时生成新夹具
```

夹具只收"补丁会碰到的文件"（当前 55 个、2.5MB），逐条确认每条补丁要么能命中、要么有 `retired` / `missing` 的正当理由。

## 日常维护三步

1. `dsh-purge --doctor`：版本、覆盖度、漂移、asar 状态、注入体积；
2. 有漂移就用 `--reanchor set` 先自救，稳定后写进 `lib/compat-022.js`；
3. `npm test` 全绿再打 tag 发版。
