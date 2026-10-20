#!/usr/bin/env node
// 版本号一致性检查。
//
// 版本有三个落点，历史上出现过「只改一处」：
//   1. config/app.config.js  ← 唯一真源，scripts/release.mjs 写这里
//   2. package.json          ← release.mjs 同步写
//   3. app.json              ← 由 build/build.js 在 vite build 时生成（间接落点）
// 只改 1+2 而不跑 build，pack.js 会拿旧 app.json 打出旧版本号的包。
//
// 用法：node scripts/check-version.mjs [--warn]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/chrome.mjs';

const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');

const configSrc = read('config/app.config.js');
const cfgMatch = configSrc.match(/version:\s*['"]([^'"]+)['"]/);
const pkg = JSON.parse(read('package.json'));
const appJson = JSON.parse(read('app.json'));

const cfg = cfgMatch ? cfgMatch[1] : null;
const rows = [
  ['config/app.config.js', cfg],
  ['package.json', pkg.version],
  ['app.json', appJson.version],
];

console.log('版本号一致性检查\n');
for (const [file, v] of rows) console.log(`  ${file.padEnd(24)} ${v}`);
console.log(`  ${'app.json microAppId'.padEnd(24)} ${appJson.microAppId}（package.json name: ${pkg.name}）`);

const problems = [];

if (!cfg) problems.push('config/app.config.js 里找不到 version 字段');
const versions = new Set(rows.map(([, v]) => v));
if (versions.size > 1) {
  problems.push(`三处版本号不一致：${[...versions].join(' / ')}`);
}
if (appJson.microAppId !== pkg.name) {
  problems.push(`产物名不一致：app.json microAppId=${appJson.microAppId}，package.json name=${pkg.name}`);
}
if (!/^\d+\.\d+\.\d{6}(-beta)?$/.test(cfg || '')) {
  problems.push(`版本格式不符合 主.次.YYMMDD[-beta]：${cfg}`);
}

// 已打包产物里是否有比当前版本更新的 zip（说明本地状态落后于交付）
const pkgDir = path.join(ROOT, 'packages');
if (existsSync(pkgDir)) {
  const zips = readdirSync(pkgDir).filter((f) => f.endsWith('.zip'));
  const latest = zips
    .map((f) => f.replace(/^.*?-(\d+\.\d+\.\d{6}(?:-beta)?)\.zip$/, '$1'))
    .filter((v) => /^\d+\.\d+\.\d{6}(-beta)?$/.test(v))
    .sort((a, b) => {
      const [an, ad] = [a.split('-')[0], (a.match(/-beta/) ? 1 : 0)];
      const [bn, bd] = [b.split('-')[0], (b.match(/-beta/) ? 1 : 0)];
      return an.localeCompare(bn, undefined, { numeric: true }) || ad - bd;
    })
    .pop();
  if (latest) {
    console.log(`  ${'packages/ 最新 zip'.padEnd(24)} ${latest}`);
    if (latest !== cfg) problems.push(`当前版本 ${cfg} 与最新打包产物 ${latest} 不一致`);
  }
}

if (!problems.length) {
  console.log('\n✓ 版本号一致。');
  process.exit(0);
}

console.log('');
for (const p of problems) console.log(`✗ ${p}`);
if (process.argv.includes('--warn')) process.exit(0);
process.exit(1);
