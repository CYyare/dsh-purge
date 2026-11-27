#!/usr/bin/env node
/**
 * 本地发布流程：前置检查 → 测试 → 打包 → 校验和 →（可选）打 tag。
 *
 *   node scripts/release.mjs            # 检查 + 测试 + 打包 + sha256
 *   node scripts/release.mjs --tag      # 额外打 v<version>  annotated tag
 *   node scripts/release.mjs --no-test  # 跳过测试（不建议）
 *
 * 不联网、不推送：推 tag / release 仍由人来做，避免 CI 之外的意外发布。
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const wantTag = args.includes('--tag');
const skipTest = args.includes('--no-test');

// Windows 上 npm 是 .cmd 需要 shell；git / node 直接跑可执行文件，
// 否则 shell 拼接会把带空格的参数（例如 tag 消息）拆成两段。
const needsShell = (cmd) => process.platform === 'win32' && /^npm$/i.test(cmd);
const run = (cmd, cmdArgs, opts = {}) =>
  execFileSync(cmd, cmdArgs, { cwd: ROOT, stdio: 'inherit', shell: needsShell(cmd), ...opts });
const capture = (cmd, cmdArgs) =>
  execFileSync(cmd, cmdArgs, { cwd: ROOT, encoding: 'utf8', shell: needsShell(cmd) }).trim();

const fail = (msg) => {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
};

// 1) 前置检查
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const version = String(pkg.version || '');
if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`版本号不合法: ${version}`);

const dirty = capture('git', ['status', '--porcelain']);
if (dirty) fail(`工作区不干净，先提交：\n${dirty}`);

const branch = capture('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch !== 'master') console.warn(`⚠ 当前分支是 ${branch}，不是 master`);

console.log(`\n== dsh-purge ${version} ==`);
console.log(`   分支 ${branch} · 提交 ${capture('git', ['rev-parse', '--short', 'HEAD'])}`);

// 2) 测试
if (skipTest) {
  console.warn('⚠ 跳过测试（--no-test）');
} else {
  console.log('\n[1/4] 跑测试');
  run('npm', ['test']);
}

// 3) 语法门禁（打包前最后一道）
console.log('\n[2/4] 语法检查');
for (const rel of ['lib/index.js', 'lib/core.js', 'lib/anchors.js', 'lib/runtime-guards.js', 'bin/dsh-purge.js']) {
  run(process.execPath, ['--check', rel], { shell: false });
}

// 4) 打包
console.log('\n[3/4] npm pack');
const packOut = capture('npm', ['pack', '--ignore-scripts', '--silent']);
const tarball = packOut.split(/\r?\n/).filter(Boolean).pop();
if (!tarball || !fs.existsSync(path.join(ROOT, tarball))) fail(`打包失败: ${packOut}`);

const buf = fs.readFileSync(path.join(ROOT, tarball));
const digest = crypto.createHash('sha256').update(buf).digest('hex');
const shaFile = `${tarball}.sha256`;
fs.writeFileSync(path.join(ROOT, shaFile), `${digest}  ${tarball}\n`);

// 5) tag（可选）
if (wantTag) {
  const tag = `v${version}`;
  const exists = (() => {
    try { capture('git', ['rev-parse', '--verify', `refs/tags/${tag}`]); return true; } catch { return false; }
  })();
  if (exists) {
    console.warn(`⚠ tag ${tag} 已存在，跳过`);
  } else {
    console.log(`\n[4/4] 打 tag ${tag}`);
    run('git', ['tag', '-a', tag, '-m', `dsh-purge ${version}`]);
  }
} else {
  console.log('\n[4/4] 跳过 tag（需要时加 --tag）');
}

console.log('\n== 产物 ==');
console.log(`  ${path.join(ROOT, tarball)}  (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
console.log(`  sha256 ${digest}`);
console.log(`  ${path.join(ROOT, shaFile)}`);
console.log('\n推送： git push origin master --tags');
