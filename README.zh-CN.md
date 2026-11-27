<p align="center">
  <img src="docs/banner.svg" alt="dsh-purge" width="720">
</p>

<h1 align="center">⚔️ dsh-purge 个人修复版</h1>

<p align="center"><strong>Version 1.1.88 · 适配 dsh 0.2.2-rc.5</strong></p>

<p align="center">
  <em>社区镜像的<b>个人自用修复分支</b>：只做新版本适配、补丁锚点维护与工程化加固，不改变原项目定位、不新增能力、不承诺任何效果。</em>
</p>

<p align="center">
  <a href="https://github.com/CYyare/dsh-purge"><img src="https://img.shields.io/badge/repo-CYyare%2Fdsh--purge-1a73e8" alt="repo"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-65a30d" alt="MIT license"></a>
  <a href="https://www.deepseek.com/harness/"><img src="https://img.shields.io/badge/dsh-0.2.2--rc.5-blue" alt="DSH"></a>
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=fff" alt="Node.js">
</p>

<p align="center">
  <a href="README.md">English</a> | <a href="README.zh-CN.md">中文</a>
</p>

---

# 第一部分 · 关于这个仓库

## 一、这是什么

本仓库是 [mmparko/dsh-purge](https://github.com/mmparko/dsh-purge)（上游 `YuJunZhiXue/dsh-purge` 已删库）的**个人修复分支**。

- 由个人维护，**不是官方项目，也不是原项目**；
- 与原作者、镜像维护者、DeepSeek 官方**均无隶属、合作、雇佣或背书关系**；
- 上游已宣布暂停更新；本分支的任何表述都不代表上游立场。

**它做的事情只有一件**：让这套插件在新版 DeepSeek Harness 上继续跑得起来，并把过程中踩到的坑记录下来。

## 二、声明与免责（使用前必读）

**1. 非官方来源**
本仓库为个人维护的第三方分支，未获原作者或 DeepSeek 官方授权、审核或推荐。仓库名称、徽章、描述中的任何措辞均不构成官方认可。

**2. 著作权与署名**
本分支沿用原项目的 `LICENSE`（MIT），并保留原 README 的署名要求。二次分发、二次开发请一并保留原作者信息与本文件的来源说明。原项目作者的"禁止商业售卖/付费倒卖"要求，本分支同样遵守并转达。

**3. 范围限定**
本分支只做：补丁锚点适配、Windows 平台兼容修复、诊断与审计工具、回归测试、发布流水线。**不新增攻击能力，不改进提示词效果，不承诺任何使用结果。**

**4. 技术风险自负**
本项目会**修改宿主程序文件**、**关闭审批与沙箱限制**、**向模型注入自定义提示词**。已知可能导致：宿主无法启动或损坏、会话/配置/数据丢失或被改写、模型输出不可控、Token 消耗异常、更新失败、需重装宿主。请先做好整机备份，并优先在可丢弃的环境里试用。

**5. 合法使用**
不得用于未授权的渗透测试、入侵、诈骗、侵犯隐私，或其他违反所在地法律与目标服务条款的行为。**是否存在授权、由谁授权、范围多大，由使用者自行确认并承担全部责任**；本分支不提供任何法律意见。

**6. 无担保**
按 MIT 协议"AS IS"提供，不对可用性、正确性、安全性、合规性、适销性作任何明示或默示担保。作者与贡献者不对任何直接、间接、附带或后果性损失负责，包括但不限于数据丢失、业务中断、账号封禁、法律责任。

**7. 数据处理**
插件不联网上报任何数据。审计日志、补丁备份、注入提示词全部留在本机 `$DSH_HOME` 下，由使用者自行保管与删除。

**8. 第三方内容与商标**
文中引用的项目名称、仓库链接、徽章、商标归各自权利人所有，仅用于说明来源与出处，不表示任何关联或认可。若权利人认为本仓库内容不当，请通过仓库 Issues 联系，我们会及时调整或删除。

**9. 条款变更**
本声明可能随仓库更新而调整，不另行通知；继续使用即视为接受当时版本。

> 安装、应用或使用本项目，即表示你已阅读并接受以上全部条款。不接受请立即停止使用并删除相关文件。

## 三、本分支实际改了什么

| 方向 | 内容 |
|---|---|
| 宿主适配 | 0.2.2-rc.5 下 **77/87** 补丁生效；#32/#53（Web 身份）、#40（完整提示词）、#13/#14/#35/#54/#60/#62/#67/#74 等补上 rc.5 锚点 |
| 抗升级 | 锚点重定向 `--reanchor`（宿主里拷一段原文即可自救，不必改代码）、`patchDrift()` 漂移诊断、`retired` 分类 |
| 回归 | 58 个真实宿主文件的夹具 + 25 项 `node:test`；落盘前 `node --check` 语法门禁 |
| 可观测 | `--doctor`（文本 + `--json`）、`--audit` 审计日志（apply / revert / reanchor） |
| 回滚 | 每个被改文件旁 `.dshpurge.bak` + sha256 清单；`--revert` 前校验，备份被改过就拒绝；`scripts/backfill-backups.mjs` 可从 `app.asar` 找回原始文件 |
| 运行时 | Tier A 守卫（审批放行 / fs 放行）；Tier B 按 id 关插件（重复提醒、结果剪枝） |
| 其他 | Windows 备份 EPERM、rename 覆盖、单实例写入（不误伤其它安装）等平台问题 |
| 发布 | tag 触发 CI（版本一致性 → 语法 → 测试 → 打包 → sha256 → Release） |

细节与逐轮记录见 [ADAPTATION-NOTES.md](ADAPTATION-NOTES.md) 与 [COMPAT.md](COMPAT.md)。

## 四、参考项目（社区分支）

修复新版本时先看这些仓库，能少走弯路（都非本仓库维护）：

| 仓库 | 适合参考什么 |
|---|---|
| [mmparko/dsh-purge](https://github.com/mmparko/dsh-purge) | 上游全量镜像，本分支的 1.1.71 基线 |
| [kingcharleslzy-ai/dsh-purge](https://github.com/kingcharleslzy-ai/dsh-purge) | 锚点重定向、漂移诊断、上百条测试、发布纪律 |
| [ZXEB/dsh-purge](https://github.com/ZXEB/dsh-purge) | 0.2.2-rc.5 适配记录、版本矩阵 |
| [CallMeGuLab/dsh-purge-safe](https://github.com/CallMeGuLab/dsh-purge-safe) | 同版本（0.2.2-rc.5）的另一套实现，锚点可交叉核对 |
| [realMisakaMikoto/dsh-purge](https://github.com/realMisakaMikoto/dsh-purge) | `#40` 的另一种修法 |
| [NANA7MI0/dsh-purge-go](https://github.com/NANA7MI0/dsh-purge-go) | 最小实现（只留提示词注入 + 引擎补丁） |
| [c3cvld7aag/fujiang-dsh](https://github.com/c3cvld7aag/fujiang-dsh) | 完全不改宿主时的纯提示词方案 |

更多分支：[GitHub 搜索 `dsh-purge`](https://github.com/search?q=dsh-purge&type=repositories)。

## 五、安装与维护（本分支）

npm 上的 `dsh-purge` 是**空壳占位包**（`0.0.0-stage`，331 字节），装它不是本插件。本分支请从本仓库安装：

```sh
cd /path/to/dsh-purge
# 1) profile/package.json 的 dependencies 加 "dsh-purge": "link:<本仓库绝对路径>"
# 2) 在 node_modules 下建同名 junction/symlink 指向本仓库
# 3) dsh.profile.bundles 末尾追加 "dsh-purge"
# 4) 重启宿主 → 点会话标题旁的 dsh-purge → 清洗 → 应用
```

升级宿主后按三步走：

```bash
node bin/dsh-purge.js --doctor     # 体检：版本 / 覆盖 / 漂移 / 守卫 / 备份
node bin/dsh-purge.js --reanchor set <补丁号> <索引> "<宿主原文>"   # 有漂移就重锚
npm test && npm run release        # 回归 + 出包
```

判断标准：漂移 0、备份 N/N 校验通过、运行时守卫已启用。任一项掉了就是该看一眼的信号。

---

# 第二部分 · 原项目介绍（原文，仅作来源说明）

> 以下内容摘自上游项目的原始 README，**保留原样仅用于说明本仓库的来源与它原本的定位**。
>
> **本分支不对下述内容作任何承诺、担保或背书**：其中描述的一切能力、效果、适用范围与支持情况均属原作者的表述，不代表本分支已验证或认可。完整原文见 [docs/ORIGINAL-README.zh-CN.md](docs/ORIGINAL-README.zh-CN.md)。

**dsh-purge** 是装在本机官方 [DeepSeek Harness](https://www.deepseek.com/harness/) 上的网络安全红队评测插件。官方 **Web**（`dsh web`）和官方 **桌面端**（EXE）都支持，两边分开装、分开应用。

Harness 不只是把问题交给模型。它还会在运行时改提示词、审批门、沙箱和会话格式。只看「模型答不答」，会把宿主拦截误当成模型拒绝。这个插件在你自己的安装里把这两层分开，用来做受控评测，也用来看默认策略该不该收紧。

| 你会用到 | 它做什么（原文表述） |
|---|---|
| **dsh-purge 侧栏** | 会话标题旁的按钮打开右侧栏。里面两页：清洗、演练台 |
| **清洗** | 分组查看补丁，应用、还原、卸载；编辑提示词和多套规则 |
| **演练台** | 正式版内置。授权后查看资产、技能和本机环境。只用于你有权管理的本机、离线靶标或已书面授权的演练 |
| **宿主策略** | 调整默认文案、权限策略和工具上限。官方能力保留，不另写一套身份 |

原项目的署名要求、赞助、违规商用公示、界面预览、目录结构等完整章节，见 [docs/ORIGINAL-README.zh-CN.md](docs/ORIGINAL-README.zh-CN.md)。
