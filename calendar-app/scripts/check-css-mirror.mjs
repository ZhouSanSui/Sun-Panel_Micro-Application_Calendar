#!/usr/bin/env node
// CSS 镜像一致性守卫（规则体级）。
//
// 背景：AGENTS.md「一套渲染、多处 CSS 镜像」。共享真源 src/core/card-mode-styles.js
// 收编 .pv-* 规则后，运行时三组件与预览生成器都以插值方式引用它。本脚本的早期版本
// 只比对「选择器名集合」，导致「选择器还在、声明块丢了/被改旧」这类缺陷检不出——
// P0 的单独模式按尺寸字号规则失效正是这个形态。现升级为规则体比对：
//   选择器(规范化) → 声明块(规范化)，既报缺失选择器，也报声明体不一致/为空。
//
// 判定口径：
//   · 基准 = 共享真源中的 .pv-* 规则 ∪ 运行时组件专属规则（非共享且未被 ALLOW 豁免者）
//   · 文件有效集合 = 自身解析出的规则 ∪（文件引用了 CARD_MODE_CSS 时）共享规则；
//     自身规则优先——与层叠一致：插值段在前，文件内后写的规则覆盖它
//   · measure.html 是「字号标定」专用页：只复刻文字相关规则、不插值真源，
//     结构性规则（网格/进度条/翻页）本就用不到。它的差异只提示、不计失败，除非 --strict
//   · 生成器（make-defaults-preview.mjs / audit-matrix.mjs）必须插值真源，
//     且自身不得再含任何手工 .pv-* 规则（否则等于又养一份会漂移的拷贝）
//   · 不存在的文件（如尚未生成的 preview.html，见 .gitignore）跳过并提示，不算失败
//
// 用法：
//   node scripts/check-css-mirror.mjs             # 报告；有漂移时退出码 1
//   node scripts/check-css-mirror.mjs --warn      # 只报告，恒退出 0
//   node scripts/check-css-mirror.mjs --verbose   # 额外打印声明体差异明细与选择器位置
//   node scripts/check-css-mirror.mjs --strict    # measure.html 的差异也计入失败
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/chrome.mjs';

// 共享样式单一真源；引用它的文件才把真源规则并进有效集合
const SHARED = 'src/core/card-mode-styles.js';
const SHARED_TOKEN = 'CARD_MODE_CSS';

const RUNTIME = [
  'src/components/widget.js',
  'src/components/mainPage.js',
  'src/components/widgetConfig.js',
];
const MIRRORS = [
  ['预览', 'scripts/make-preview.mjs'],
  ['测量', 'scripts/measure.html', { info: true }],
  ['预览', 'scripts/preview.html', { gen: 'node scripts/make-preview.mjs' }],
  ['预览', 'scripts/preview-single.html', { gen: 'node scripts/make-preview.mjs' }],
];
// 生成器：必须插值共享真源，自身不得含手工 .pv-* 规则
const GENERATORS = [
  'scripts/make-defaults-preview.mjs',
  'scripts/audit-matrix.mjs',
];

// 组件/预览专属：不在所有镜像里都应存在，比对时忽略。
// 前缀匹配，覆盖 .pv-size-box.text-light / .pv-size-box .card-mode-wrap 等复合选择器。
const ALLOW = new Set([
  '.pv-inner',      // 主页面宿主内层容器
  '.pv-size-box',   // 配置页尺寸选择格
  '.pv-blank',      // 预览占位
]);
// 声明体豁免：预览页给 .pv-block 叠加虚线边界（make-preview.mjs 及其生成物），
// 与真源的 safe center / 无 outline 属于有意差异，不参与声明体比对
const BODY_OK = new Set(['.pv-block']);

const argv = process.argv.slice(2);
const warnOnly = argv.includes('--warn');
const verbose = argv.includes('--verbose');
const strict = argv.includes('--strict');

// ---------- CSS 规则解析 ----------
const RULE_RE = /([^{}]+)\{([^{}]*)\}/g;
const COMMENT_RE = /\/\*[\s\S]*?\*\//g;
// 前导小数点补零：.75em → 0.75em、rgba(…,.10) → rgba(…,0.10)，抹平手抄本的书写差
const LEAD_DOT_RE = /(^|[\s(,:,-])\.(\d)/g;
// JS 味儿的选择器（DOM API 调用等）不是 CSS 规则，生成器检查时排除
const JSISM_RE = /[()'"`]|=>/;

const normSelector = (s) => s.replace(/\s+/g, ' ').replace(/\s*,\s*/g, ',').trim();
const normDecl = (d) => d
  .replace(/\s+/g, ' ')
  .replace(/\s*,\s*/g, ',')
  .replace(/\s*:\s*/g, ':')
  .replace(LEAD_DOT_RE, '$10.$2')
  .trim();

/** HTML 只取 <style> 块：避免把 <script> 里的 DOM 操作误判成规则 */
const cssTextOf = (rel, src) => (rel.endsWith('.html')
  ? [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
  : src);

/** 声明块 → 按属性去重（同块内后写覆盖）、排序后的声明数组 */
const declsOf = (body) => {
  const byProp = new Map();
  for (const raw of body.split(';')) {
    const d = normDecl(raw);
    const i = d.indexOf(':');
    if (i > 0) byProp.set(d.slice(0, i), d);
  }
  return [...byProp.values()].sort();
};

/**
 * 解析「选择器 → 声明块」映射。
 * 同一选择器多条规则（含 @media 内的）按属性合并，后写覆盖——与层叠一致。
 * JS 文件里 css`` 模板之前的代码会粘到首条规则的选择器上，
 * 只取最后一个反引号/分号之后的片段（CSS 选择器不会含这两种字符）。
 */
function parseRules(text) {
  const clean = text.replace(COMMENT_RE, '');
  const map = new Map();
  let m;
  RULE_RE.lastIndex = 0;
  while ((m = RULE_RE.exec(clean))) {
    const sel = normSelector(m[1].split(/[`;]/).pop() || '');
    if (!sel) continue;
    const decls = declsOf(m[2]);
    const prev = map.get(sel);
    if (!prev) { map.set(sel, decls); continue; }
    const byProp = new Map(prev.map((d) => [d.slice(0, d.indexOf(':')), d]));
    for (const d of decls) byProp.set(d.slice(0, d.indexOf(':')), d);
    map.set(sel, [...byProp.values()].sort());
  }
  return map;
}

const readSrc = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
const isAllowed = (sel) => [...ALLOW].some(
  (a) => sel === a || sel.startsWith(`${a}.`) || sel.startsWith(`${a} `) || sel.startsWith(`${a}:`),
);
const isPv = (sel) => /\.pv-/.test(sel);
const pvCount = (map) => [...map.keys()].filter(isPv).length;

const sharedMap = parseRules(readSrc(SHARED));

// 基准 = 共享真源的 .pv-* 规则 ∪ 运行时组件专属（非共享、未被 ALLOW 豁免）规则
const canonical = new Map();
for (const [sel, decls] of sharedMap) if (isPv(sel) && !isAllowed(sel)) canonical.set(sel, decls);
for (const rel of RUNTIME) {
  for (const [sel, decls] of parseRules(readSrc(rel))) {
    if (!isPv(sel) || sharedMap.has(sel) || isAllowed(sel) || canonical.has(sel)) continue;
    canonical.set(sel, decls);
  }
}

/** 有效集合：自身规则 ∪（引用了 CARD_MODE_CSS 才并入）共享规则；自身优先 */
function effectiveOf(rel) {
  const src = readSrc(rel);
  const own = parseRules(cssTextOf(rel, src));
  if (!src.includes(SHARED_TOKEN)) return own;
  const merged = new Map(sharedMap);
  for (const [sel, decls] of own) {
    const base = merged.get(sel);
    if (!base) { merged.set(sel, decls); continue; }
    const byProp = new Map(base.map((d) => [d.slice(0, d.indexOf(':')), d]));
    for (const d of decls) byProp.set(d.slice(0, d.indexOf(':')), d);
    merged.set(sel, [...byProp.values()].sort());
  }
  return merged;
}

// ---------- 汇总输出 ----------
console.log('CSS 镜像检查（选择器 + 声明块）\n');
console.log(`共享真源 ${SHARED} 提供 ${sharedMap.size} 条规则；引用 ${SHARED_TOKEN} 的文件已把它并入有效集合。`);
console.log(`生成器（必须插值真源、不得含手工 .pv-* 规则）：${GENERATORS.join('、')}`);
console.log(`声明体豁免：${[...BODY_OK].join(' ')}（预览页虚线边界可视化）\n`);

console.log(`${'类型'.padEnd(6)}${'规则数'.padStart(6)}  路径`);
const runtime = RUNTIME.map((rel) => ({ rel, eff: effectiveOf(rel) }));
for (const f of runtime) console.log(`${'运行时'.padEnd(6)}${String(pvCount(f.eff)).padStart(6)}  ${f.rel}`);

const mirror = MIRRORS.map(([role, rel, opt]) => ({
  role, rel, info: !!(opt && opt.info), gen: opt && opt.gen, eff: null,
}));
const skipped = [];
for (const f of mirror) {
  if (!existsSync(path.join(ROOT, f.rel))) {
    skipped.push(f);
    console.log(`${f.role.padEnd(6)}${'跳过'.padStart(6)}  ${f.rel}（未生成${f.gen ? `；${f.gen} 后可参与校验` : ''}）`);
    continue;
  }
  f.eff = effectiveOf(f.rel);
  console.log(`${f.role.padEnd(6)}${String(pvCount(f.eff)).padStart(6)}  ${f.rel}${f.info ? '（信息级：字号标定页，只复刻文字相关规则）' : ''}`);
}
for (const rel of GENERATORS) {
  const ok = existsSync(path.join(ROOT, rel));
  console.log(`${'生成器'.padEnd(6)}${ok ? String(pvCount(parseRules(cssTextOf(rel, readSrc(rel))))).padStart(6) : '跳过'.padStart(6)}  ${rel}`);
}

console.log(`\n基准（运行时并集，去除组件专属）共 ${canonical.size} 条规则。`);

// 运行时三处互查选择器：任何一处缺少基准里的类，说明组件间漂移
const runtimeGap = runtime.filter((f) => [...canonical.keys()].some((s) => !f.eff.has(s)));

// 生成器检查：必须引用真源，且不得含手工 .pv-* 规则
const genBad = [];
for (const rel of GENERATORS) {
  if (!existsSync(path.join(ROOT, rel))) continue;
  const src = readSrc(rel);
  const own = parseRules(cssTextOf(rel, src));
  const manual = [...own.keys()].filter((s) => isPv(s) && !JSISM_RE.test(s));
  const problems = [];
  if (!src.includes(SHARED_TOKEN)) problems.push('未插值共享真源 CARD_MODE_CSS');
  if (manual.length) problems.push(`含 ${manual.length} 条手工 .pv-* 规则：${manual.join(' ')}`);
  if (problems.length) genBad.push({ rel, problems });
}

// ---------- 镜像比对 ----------
let bad = 0; // 计入失败的漂移数
const infoDiffs = []; // 信息级差异（measure.html）
const diffs = []; // 声明体差异明细（--verbose 用）
const report = [];

for (const f of mirror) {
  if (!f.eff) continue;
  const missing = [];
  const mismatch = [];
  const empty = [];
  for (const [sel, want] of canonical) {
    if (!f.eff.has(sel)) { missing.push(sel); continue; }
    if (BODY_OK.has(sel)) continue;
    const got = f.eff.get(sel);
    if (!got.length) { empty.push(sel); continue; }
    if (got.join('|') !== want.join('|')) {
      mismatch.push(sel);
      diffs.push({ rel: f.rel, sel, want, got });
    }
  }
  if (!missing.length && !mismatch.length && !empty.length) continue;
  const entry = { f, missing, mismatch, empty };
  report.push(entry);
  if (f.info && !strict) infoDiffs.push(entry); else bad += 1;
}

if (runtimeGap.length) {
  console.log('\n运行时组件之间不一致（基准里有的类，某个组件没有）：');
  for (const f of runtimeGap) {
    const miss = [...canonical.keys()].filter((s) => !f.eff.has(s));
    console.log(`  ${f.rel} 缺少 ${miss.length}：${miss.join(' ')}`);
  }
  console.log('  （若属于组件专属类，请加入本脚本 ALLOW）');
}

if (genBad.length) {
  console.log('\n生成器校验未通过（应插值 CARD_MODE_CSS，不得保留手工 .pv-* 规则）：');
  for (const g of genBad) console.log(`  ${g.rel}：${g.problems.join('；')}`);
} else {
  console.log('\n生成器校验：通过（均插值真源，无手工 .pv-* 规则）。');
}

if (!report.length && !runtimeGap.length && !genBad.length) {
  console.log('\n✓ 镜像一致（选择器集合与声明块均与运行时并集一致）。');
  process.exit(0);
}

for (const { f, missing, mismatch, empty } of report) {
  const tag = f.info && !strict ? '（信息级）' : '';
  console.log(`\n  ${f.rel} ${tag}`);
  if (missing.length) console.log(`    缺少 ${missing.length} 个：${missing.join(' ')}`);
  if (mismatch.length) console.log(`    声明体不一致 ${mismatch.length} 个：${mismatch.join(' ')}`);
  if (empty.length) console.log(`    声明块为空 ${empty.length} 个：${empty.join(' ')}`);
}

if (verbose) {
  if (diffs.length) {
    console.log('\n声明体差异明细（基准 → 实际）：');
    for (const d of diffs) {
      console.log(`  ${d.rel} ${d.sel}`);
      console.log(`    基准: ${d.want.join('; ')}`);
      console.log(`    实际: ${d.got.join('; ')}`);
    }
  }
  console.log('\n各选择器出现的文件：');
  for (const s of [...canonical.keys()].sort()) {
    const where = [...runtime, ...mirror.filter((f) => f.eff)].filter((f) => f.eff.has(s)).map((f) => path.basename(f.rel));
    console.log(`  ${s.padEnd(46)} ${where.join(', ')}`);
  }
}

const drift = bad + runtimeGap.length + genBad.length;
if (drift) {
  console.log(`\n共 ${drift} 处漂移。预览类文件缺样式 → 预览失真；运行时缺 → 线上渲染异常。`);
  if (!warnOnly) process.exit(1);
} else {
  console.log(`\n✓ 镜像一致（强制项全部通过；信息级差异 ${infoDiffs.reduce((n, e) => n + e.missing.length + e.mismatch.length + e.empty.length, 0)} 处，见上，--strict 计入失败）。`);
}
process.exit(0);
