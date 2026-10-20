#!/usr/bin/env node
// CSS 镜像一致性守卫。
//
// 背景：AGENTS.md 明确「一套渲染、五处 CSS 镜像」（实际是 7 个文件），
// 但没有任何自动化检查。加样式时漏同步某一处，预览和线上就会不一致，
// 而 test-render 只测量几何、看不出样式缺失。
//
// 判定口径：
//   · 基准 = 三个运行时组件 CSS 选择器的并集（它们是线上真实渲染的依据）
//   · 预览/测量类文件缺少基准中的选择器 → 漂移（预览失真）
//   · 组件专属类（只该在一个组件里存在）列在 ALLOW，不参与比对
//
// 用法：
//   node scripts/check-css-mirror.mjs             # 报告；有漂移时退出码 1
//   node scripts/check-css-mirror.mjs --warn      # 只报告，恒退出 0
//   node scripts/check-css-mirror.mjs --verbose   # 额外打印选择器出现位置
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/chrome.mjs';

// 共享样式单一真源：三处运行时与预览生成器都以插值方式引用它，
// 因此比对时把它并进每个文件的集合，否则会误报「所有规则都缺」。
const SHARED = 'src/core/card-mode-styles.js';

const RUNTIME = [
  'src/components/widget.js',
  'src/components/mainPage.js',
  'src/components/widgetConfig.js',
];
const MIRRORS = [
  ['预览', 'scripts/make-preview.mjs'],
  // measure.html 是「字号标定」专用页：只复刻文字相关规则，按 getBoundingClientRect
  // 量每 100px 的字符宽度，结构性规则（网格/进度条/翻页）本就用不到。
  // 因此它的差异只提示、不计入失败，除非显式 --strict。
  ['测量', 'scripts/measure.html', { info: true }],
  ['预览', 'scripts/preview-single.html'],
  ['预览', 'scripts/preview.html'],
];

// 组件专属：不在所有镜像里都应存在，比对时忽略
const ALLOW = new Set([
  '.pv-inner',      // 主页面宿主内层容器
  '.pv-size-box',   // 配置页尺寸选择格
  '.pv-blank',      // 预览占位
]);

const argv = process.argv.slice(2);
const warnOnly = argv.includes('--warn');
const verbose = argv.includes('--verbose');

// 只取「选择器位置」的类名：.pv-xxx 之后（中间不含花括号）紧跟 {
const SELECTOR_RE = /\.pv-[a-z0-9-]+(?=[^{}]*\{)/g;

function selectorsOf(rel) {
  const src = readFileSync(path.join(ROOT, rel), 'utf8');
  return new Set(src.match(SELECTOR_RE) || []);
}

const sharedSet = selectorsOf(SHARED);

// 有效集合 = 文件自身规则 ∪ 共享真源（插值引用，物理上不在同文件）
const withShared = (rel) => new Set([...selectorsOf(rel), ...sharedSet]);

const runtime = RUNTIME.map((rel) => ({ rel, set: withShared(rel) }));
const canonical = new Set();
for (const f of runtime) for (const s of f.set) if (!ALLOW.has(s)) canonical.add(s);

const strict = argv.includes('--strict');
const mirror = MIRRORS.map(([role, rel, opt]) => ({ role, rel, info: !!(opt && opt.info), set: withShared(rel) }));

console.log('CSS 镜像检查（.pv-* 选择器集合）\n');
console.log(`共享真源 ${SHARED} 提供 ${sharedSet.size} 个选择器，已并入以下每个文件的集合。\n`);
console.log(`${'类型'.padEnd(6)}${'数量'.padEnd(6)}路径`);
for (const f of runtime) console.log(`${'运行时'.padEnd(6)}${String(f.set.size).padStart(4)}  ${f.rel}`);
for (const f of mirror) console.log(`${f.role.padEnd(6)}${String(f.set.size).padStart(4)}  ${f.rel}`);
console.log(`\n基准（运行时并集，去除组件专属）共 ${canonical.size} 个选择器。`);

// 运行时三处互相比对：任何一处缺少并集里的类，说明组件间漂移
const runtimeGap = runtime.filter((f) => [...f.set].some(() => false) || [...canonical].some((s) => !f.set.has(s)));

let bad = 0;
const report = [];
for (const f of mirror) {
  const missing = [...canonical].filter((s) => !f.set.has(s));
  if (missing.length) {
    if (!f.info || strict) bad += 1;
    report.push({ f, missing });
  }
}

if (runtimeGap.length) {
  console.log('\n运行时组件之间不一致（并集里有的类，某个组件没有）：');
  for (const f of runtimeGap) {
    const miss = [...canonical].filter((s) => !f.set.has(s));
    console.log(`  ${f.rel} 缺少 ${miss.length}：${miss.join(' ')}`);
  }
  console.log('  （若属于组件专属类，请加入本脚本 ALLOW）');
}

if (!report.length && !runtimeGap.length) {
  console.log('\n✓ 镜像选择器集合一致。');
  process.exit(0);
}

for (const { f, missing } of report) {
  console.log(`\n  ${f.rel} 缺少 ${missing.length} 个：`);
  console.log(`    ${missing.join(' ')}`);
}

if (verbose) {
  console.log('\n各选择器出现的文件：');
  for (const s of [...canonical].sort()) {
    const where = [...runtime, ...mirror].filter((f) => f.set.has(s)).map((f) => path.basename(f.rel));
    console.log(`  ${s.padEnd(22)} ${where.join(', ')}`);
  }
}

const drift = bad + runtimeGap.length;
if (drift) console.log(`\n共 ${drift} 处漂移。预览类文件缺样式 → 预览失真；运行时缺 → 线上渲染异常。`);
if (drift && !warnOnly) process.exit(1);
process.exit(0);
