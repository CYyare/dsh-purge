<p align="center">
  <img src="docs/banner.svg" alt="dsh-purge" width="720">
</p>

<h1 align="center">⚔️ dsh-purge — personal fix fork</h1>

<p align="center"><strong>Version 1.1.89 · targets dsh 0.2.2-rc.5</strong></p>

<p align="center">
  <em>A <b>personal maintenance fork</b> of the community mirror: version adaptation, patch-anchor upkeep and engineering hardening only. No change of purpose, no new capability, no promises about results.</em>
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

# Part 1 · About this repository

## 1. What this is

A **personal fix fork** derived from the original `YuJunZhiXue/dsh-purge` project (**now deleted**), via the community mirror [mmparko/dsh-purge](https://github.com/mmparko/dsh-purge).

- Maintained by an individual — **not an official project, not the original project**;
- **No affiliation, partnership, employment or endorsement** from the original author, the mirror maintainer, or DeepSeek;
- Upstream has stopped maintaining it; nothing here speaks for upstream;
- **The repository name and the version series (1.1.x) continue upstream's numbering for compatibility and comparison only — this does not imply upstream published, approved or endorsed this fork.**

**The only goal**: keep this plugin running on newer DeepSeek Harness builds, and document the obstacles met on the way.

## 2. Provenance and attribution (following the original author's terms)

The original README states the following conditions. They are quoted verbatim and honoured here:

> **非盈利公益项目，严禁任何主体用于商业售卖、付费倒卖或黑灰产牟利，仅供技术参考。**
> *(A non-profit public-interest project. Commercial sale, paid resale, or profit from illegal or grey-market activity is strictly forbidden; provided for technical reference only.)*
>
> **署名要求**：借用本项目的名称、思路、代码或提示词，必须署名，并写明来源仓库：`YuJunZhiXue/dsh-purge`。
> 不署名、隐瞒来源、改头换面据为己有，作者将依法追究责任。
> *(Attribution required: if you borrow the name, ideas, code or prompts, you must credit the author and name the source repository `YuJunZhiXue/dsh-purge`. Hiding the source or passing it off as your own will be pursued by the author.)*

(Quoted from the original README sections "非盈利公益项目" and "署名要求"; archived verbatim in [docs/ORIGINAL-README.zh-CN.md](docs/ORIGINAL-README.zh-CN.md).)

**Provenance chain**:

| Layer | Repository | Note |
|---|---|---|
| Original project | `YuJunZhiXue/dsh-purge` | Author: 小杨 (the copyright holder in `LICENSE`). **Repository deleted by the author** |
| Community mirror | [mmparko/dsh-purge](https://github.com/mmparko/dsh-purge) | Full dump taken before deletion; this fork's code baseline is 1.1.71 |
| This fork | [CYyare/dsh-purge](https://github.com/CYyare/dsh-purge) | Personal fix fork, currently 1.1.89 |

**What this fork commits to**:

1. **Keep the original copyright notice**: `LICENSE` retains `Copyright (c) 2026 小杨` unchanged; modifications here are released under the same MIT terms without claiming extra rights.
2. **Strictly non-commercial**: no sales, no fees, no paywalls, no sponsorship, no advertising, no lead generation. Any paid offering made under this repository's name is unauthorised and unrelated to this fork.
3. **No hidden provenance**: README, `package.json`, CLI help and `ADAPTATION-NOTES.md` all name the original project and the mirror; file and directory names from the original are kept so everything stays comparable.
4. **Third-party code credited too**: patches `#90 #91 #97 #98 #99` come from [CallMeGuLab/dsh-purge-safe](https://github.com/CallMeGuLab/dsh-purge-safe) (Apache-2.0); they are re-implemented here against this fork's anchors — see `ADAPTATION-NOTES.md` §6.9.
5. **No repetition of named accusations**: the original README contains a "违规商用公示" section naming a specific third-party account. This fork **does not reproduce any of those names**; it keeps only a link to the archived original, so unverified allegations are not propagated.

> If you build on or redistribute this fork, keep at minimum: the original author's credit, the source repository `YuJunZhiXue/dsh-purge`, this repository's URL, and items 1–2 above.

## 3. Notice and disclaimer (read before use)

**1. Unofficial.** A third-party fork with no authorisation, review or recommendation from the original author, the mirror maintainer, or DeepSeek. Names, badges and wording do not imply endorsement.

**2. Copyright and liability boundary.** The code is MIT-licensed, but the original author's **non-commercial and attribution conditions** (previous section) are conditions of use; this fork complies with and relays them. Commercial use that violates them is the user's own responsibility and unrelated to this fork.

**3. Scope.** Anchors, Windows compatibility, diagnostics/audit tooling, regression tests, release pipeline. **No new offensive capability, no prompt engineering, no promised outcome.**

**4. Technical risk is yours.** This project **modifies host program files**, **disables approval and sandbox restrictions**, and **injects custom prompts**. Known consequences include: an unbootable or corrupted host, lost or rewritten sessions/settings/data, uncontrolled model output, unexpected token spend, failed updates, and a host reinstall. Back up the machine first and prefer a disposable environment.

**5. Lawful use only.** Not for unauthorized penetration testing, intrusion, fraud, privacy violations, or anything violating your jurisdiction's law or a target's terms of service. **Whether authorization exists, who granted it, and how far it reaches are yours to determine and defend.** Nothing here is legal advice.

**6. No warranty.** Provided "AS IS" under MIT, without express or implied warranty of fitness, correctness, safety, compliance or merchantability. The author and contributors are not liable for direct, indirect, incidental or consequential damages, including data loss, business interruption, account bans or legal liability.

**7. Data handling.** No telemetry, no network reporting. Audit logs, patch backups and injected prompts stay on your machine under `$DSH_HOME`.

**8. Third-party content and trademarks.** Project names, links, badges and trademarks belong to their owners and are used only to describe provenance — no affiliation or endorsement is implied. Rights holders who object to any content here may open an issue and it will be adjusted or removed.

**9. Changes.** This notice may change with the repository without further announcement; continued use means acceptance of the version in force.

> Installing, applying or using this project means you have read and accepted all of the above. If not, stop and delete it.

## 4. What this fork actually changed

| Area | Detail |
|---|---|
| Host adaptation | **77/87** patches applied on 0.2.2-rc.5; new rc.5 anchors for #32/#53, #40, #13/#14/#35/#54/#60/#62/#67/#74 |
| Upgrade resilience | `--reanchor` (copy a snippet from the host, no code change), `patchDrift()`, `retired` classification |
| Regression | 58 real host files as fixtures + 25 `node:test` cases; `node --check` gate before writing |
| Observability | `--doctor` (text + `--json`), `--audit` log for apply/revert/reanchor |
| Rollback | `.dshpurge.bak` next to every patched file + sha256 manifest; `--revert` refuses a tampered backup; `scripts/backfill-backups.mjs` recovers originals from `app.asar` |
| Runtime | Tier A guards (approval allow / fs allow); Tier B config disables (repeat reminders, result pruning) |
| Platform | Windows backup EPERM, rename-overwrite, single-instance writes |
| Release | Tag-triggered CI: version check → syntax → tests → pack → sha256 → Release |

Per-release detail lives in [ADAPTATION-NOTES.md](ADAPTATION-NOTES.md) and [COMPAT.md](COMPAT.md).

## 5. Related projects (community forks)

| Repository | Worth reading for |
|---|---|
| [mmparko/dsh-purge](https://github.com/mmparko/dsh-purge) | Full mirror; this fork's 1.1.71 baseline |
| [kingcharleslzy-ai/dsh-purge](https://github.com/kingcharleslzy-ai/dsh-purge) | Re-anchoring, drift diagnosis, extensive tests, release discipline |
| [ZXEB/dsh-purge](https://github.com/ZXEB/dsh-purge) | 0.2.2-rc.5 adaptation notes and version matrix |
| [CallMeGuLab/dsh-purge-safe](https://github.com/CallMeGuLab/dsh-purge-safe) | Second implementation on the same host version; source of the ideas behind #90/#91/#97/#98/#99 |
| [realMisakaMikoto/dsh-purge](https://github.com/realMisakaMikoto/dsh-purge) | An alternative `#40` fix |
| [NANA7MI0/dsh-purge-go](https://github.com/NANA7MI0/dsh-purge-go) | Minimal implementation (prompt injection + engine patches only) |
| [c3cvld7aag/fujiang-dsh](https://github.com/c3cvld7aag/fujiang-dsh) | Prompt-only approach that never touches host files |

## 6. Install and maintain (this fork)

The npm package `dsh-purge` is a **placeholder stub** (`0.0.0-stage`, 331 bytes) — that is not this plugin. Install from this repository:

```sh
cd /path/to/dsh-purge
# 1) add "dsh-purge": "link:<absolute path>" under dependencies in profile/package.json
# 2) create node_modules/dsh-purge as a junction/symlink to this checkout
# 3) append "dsh-purge" to dsh.profile.bundles
# 4) restart the host → click dsh-purge beside the session title → Clean → Apply
```

After a host upgrade:

```bash
node bin/dsh-purge.js --doctor     # host version / coverage / drift / guards / backups
node bin/dsh-purge.js --reanchor set <patchId> <index> "<verbatim from host>"   # if something drifted
npm test && npm run release        # regression + package
```

Green means: drift 0, backups N/N verified, runtime guards enabled.

---

# Part 2 · The original project's description (verbatim, provenance only)

> Excerpted from the upstream README and reproduced **only to document where this fork comes from and what the plugin was originally meant to be**.
>
> **This fork makes no promise, warranty or endorsement regarding it**: every capability, effect, scope and support statement below is the original author's wording, not something this fork has verified or endorses. The complete original (including attribution requirements, sponsorship, commercial-use notice, screenshots and layout) is archived at [docs/ORIGINAL-README.md](docs/ORIGINAL-README.md).

**dsh-purge** is a cybersecurity red-team evaluation plugin for the local official [DeepSeek Harness](https://www.deepseek.com/harness/). Both the official **Web** (`dsh web`) and the official **desktop** EXE are supported; install and apply them separately.

Harness does more than hand questions to a model: it rewrites prompts, approval gates, sandboxes and session formats at runtime. Judging only "did the model answer" mistakes host interception for model refusal. This plugin separates those two layers inside your own installation, for controlled evaluation and for judging whether default policy should be tightened.

| What you use | What it does (original wording) |
|---|---|
| **dsh-purge sidebar** | The button beside the session title opens a right-hand panel with two pages: Clean and Drill |
| **Clean** | Browse patches by group; apply, revert, uninstall; edit prompts and rule sets |
| **Drill** | Built into the release. After authorization, inspect assets, skills and the local environment. Only for machines you administer, offline targets, or engagements with written authorization |
| **Host policy** | Adjust default wording, permission policy and tool limits. Official behaviour is preserved; no second identity is invented |

All other original sections (adaptation scope, install, screenshots, layout, usage, local checks, how it works, restore, path detection, releases, notes) are archived at [docs/ORIGINAL-README.md](docs/ORIGINAL-README.md).
