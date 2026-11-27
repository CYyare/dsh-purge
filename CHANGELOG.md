# CHANGELOG

本分支的改动分三类记录：**修复**（让它在当前宿主上跑对）、**吸收**（从社区分支引入更好的做法）、**扩展**（新增能力或工程化）。
更早期的逐轮技术细节见 [ADAPTATION-NOTES.md](ADAPTATION-NOTES.md)。

---

## 1.1.91 — 定位改为「长期维护的改进分支」

**其他**
- README（中/英）与 NOTICE 的定位段从"只做修复、不新增能力"改为"适配 / 吸收 / 扩展"三段式；**免责与许可条款一条未改**
- 新增本 CHANGELOG 与 [ROADMAP.md](ROADMAP.md)

## 1.1.90 — 本分支同样禁止商用 + NOTICE

**其他**
- README 第二章改为「使用条件与来源署名（非商业 + 署名）」，新增使用许可表（允许 / 禁止 / 商用授权 / 违约后果）
- 免责第 2、4 条重写：MIT + 原作者非商业条件，本仓库整体不允许任何商业使用；一切后果由使用者承担，维护者不赔偿、不担保
- 新增 `NOTICE`（英文完整条款），并加入 `package.json` 的 `files` 随包发布

## 1.1.89 — 补原作者署名/非商业要求原文

**修复**
- README 增加「来源与署名」章节：原文引用原作者的「非盈利公益项目」与「署名要求」，附来源链表格（YuJunZhiXue → mmparko → 本分支）
- 明确 `LICENSE` 保留 `Copyright (c) 2026 小杨`；仓库名与 1.1.x 版本号沿用上游仅为对比，不代表性背书
- 原 README 的「违规商用公示」点名了具体账号 —— 本分支不复述，只保留存档链接

## 1.1.88 — 主页拆成两部分

**其他**
- README 拆为「第一部分·本分支」与「第二部分·原项目原文（仅作来源说明）」，后者明确标注不作承诺
- 原 README 全文（658/639 行）归档到 `docs/ORIGINAL-README*.md`

## 1.1.87 — 备份补全 + backfill 脚本

**修复**
- 1.1.85 那批补丁有 4 个文件未生成 `.dshpurge.bak`（时序问题，未能复现为代码 bug）
- 新增 `scripts/backfill-backups.mjs`：从 `app.asar` 抽原始文件补成备份并刷新 manifest；写盘前先验证 asar 与解包目录是同一构建
- 实测：59 份备份全部纯净，manifest 57 条校验通过；`revertAll` 可还原

## 1.1.85 — 预设保持 + 原生 system 槽

**吸收**（来源：CallMeGuLab/dsh-purge-safe，Apache-2.0，按本分支锚点重写）
- `#97/#98/#99`：复用空白会话时沿用日志里记下的预设，红队模式不再被 standard 静默覆盖
- `#90/#91`：把挂着的提示词补进原生 system 槽（OpenAI / Anthropic），区分函数/字符串两种取值，且不额外造 `role=system` 消息

## 1.1.84 — README 相关项目清单

**其他**
- 列出 9 个社区分支及各自可参考点；给出 GitHub 搜索入口与"先抄锚点再跑测试"的用法

## 1.1.83 — README 维护章节

**其他**
- 新增「维护与升级」三步走：`--doctor` 体检 → `--reanchor` 重锚 → `npm test` + `npm run release`

## 1.1.82 — 测试隔离

**修复**
- `backupAll(aiBase, patches, { dshHome })` 支持指定 home；备份测试不再往真实 `$DSH_HOME` 写 manifest

## 1.1.81 — 备份只覆盖待改文件

**修复**
- 备份守卫从"看 `[dsh-purge]` 标记"改为"看锚点是否还在"：只备份即将被改的文件，避免给已打补丁的文件存快照（那会让 `--revert` 变成空操作）

## 1.1.80 — 审计 + 备份清单 + 单实例写入

**扩展**
- `lib/audit.js`：`audit.jsonl` 记录 apply / revert / reanchor，>1MB 滚动，写失败静默；CLI `--audit`
- `lib/backup-manifest.js`：每次备份记 sha256 清单；`--revert` 前校验，备份被改过则拒绝
- `currentInstallAppDir()`：默认只写当前运行安装，`DSH_PURGE_ALL_HOSTS=1` 可放开

## 1.1.79 — 找回 #32/#53 锚点

**修复**
- 0.2.2 把 Web 身份句搬进 `dsh-harness-dev-context`、措辞改为 `whose URL the runtime context names`；此前因大小写敏感搜不到而误判 retired
- 撤回误判：retired 从 5 条降到 3 条（#56 #77 #80）

## 1.1.78 — Tier B + doctor --json

**扩展**
- `cordis.patch.yml` 按 id 关闭 `repeat-tool-reminder` / `tool-result-pruner`（#18/#19 的等价做法）
- `lib/doctor.js`：文本与 `--json` 共用同一份 report
- 修 bug：`toList()` 用 `filter(Boolean)` 会把漂移索引 `0` 过滤掉

## 1.1.77 — doctor 守卫状态 + 发布脚本 + CI

**扩展**
- `--doctor` 显示运行时守卫状态；`scripts/release.mjs` 本地发布；CI 改为 tag 触发

## 1.1.76 — doctor 显示版本

**扩展**
- `--doctor` 显示插件版本与上次应用记录（`installed-rev`），能直接看出"宿主里跑的是旧代码"

## 1.1.75 — 备份修复 + 语法自检 + Tier A 守卫

**修复**
- Windows 上 `rename` 不能覆盖已存在文件，导致 58 次 EPERM；改为先 unlink 再 rename
- 落盘前对每个改动的 JS 跑 `node --check`（宿主用 Electron 也能跑通）

**扩展**
- Tier A 运行时守卫：`tools/pre-execute` 恒 allow、`fs/*-intent` 返回 undefined

## 1.1.74 — 抗升级三件套

**扩展**
- `--reanchor` 锚点重定向（宿主里拷一段原文即可自救）+ `anchor-overrides.json`
- `patchDrift()` 漂移诊断；夹具回归（真实宿主源码 + `node:test`）

## 1.1.73 — dsh 0.2.2-rc.5 兼容版

**修复**
- 11 条补丁移植到 rc.5；修复打补丁后会话失效的问题
