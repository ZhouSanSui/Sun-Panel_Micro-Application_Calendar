/**
 * 真实尺寸视觉验证：按用户实测的面板像素尺寸渲染指定样式，产出可截图页面。
 *
 * 用途：配置页预览是等比缩略图，尺寸与真实卡片不同；本脚本按真实像素 1:1 渲染，
 * 用来肉眼确认「实际显示」是否被裁/变形。
 *
 * 用法：node scripts/real-preview.mjs [--dims '{"1x1":[346.72,346.72],...}']
 * 产物：scripts/real-preview.html（配合 screenshot.mjs --no-gen 截图）
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderInfoBlock } from '../src/core/card-mode-render.js';
import { CARD_MODE_CSS } from '../src/core/card-mode-styles.js';
import { ensureAppState, getUserStore } from '../src/core/app-state.js';
import { SINGLE_CONTENTS } from '../src/core/user-store.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
await ensureAppState({});
getUserStore().data.schedules = [
  ['饶办办', '2026-10-22', '09:30'],
  ['侄子的生日', '2026-10-26', ''],
  ['表哥-高原', '2026-11-02', '14:00'],
].map(([title, date, time], i) => ({
  id: `a${i}`, type: 'event', title, date, time, lunar: false, note: '', color: 'red', yearly: false,
}));

function toHTML(tpl) {
  if (tpl == null || tpl === true || tpl === false) return '';
  if (typeof tpl === 'string' || typeof tpl === 'number') return String(tpl);
  if (Array.isArray(tpl)) return tpl.map(toHTML).join('');
  const { strings, values } = tpl;
  if (!strings) return '';
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < values.length) out += toHTML(values[i]);
  }
  return out;
}

const visual = {
  bg: 'linear-gradient(140deg,#1c3b6e,#0c1d33)', label: '#F5F5F7', label2: '#C7C7CC',
  label3: '#8E8E93', cartBg: 'rgba(255,255,255,.15)', cardBg: 'rgba(255,255,255,0.15)', textLight: true,
};
const base = {
  visual, theme: '#0A84FF', now: new Date(2026, 9, 21, 14, 5, 9), isZh: true,
  weekStart: 1, hour12: false, t: (k) => ({ MAIN_TODAY: '今天', MAIN_DAYS: '天' }[k] || k),
};

// 用户实测：1×1 的 .item-card-content = 346.72×346.72
const DIMS = {
  '1x1': [346.72, 346.72],
  '1x2': [693.44, 346.72],
  '2x1': [346.72, 693.44],
  '2x2': [693.44, 693.44],
  '2x4': [1386.88, 693.44],
  '4x4': [1386.88, 1386.88],
  '1xfull': [1386.88, 346.72],
};
const argDims = process.argv.indexOf('--dims');
if (argDims >= 0 && process.argv[argDims + 1]) Object.assign(DIMS, JSON.parse(process.argv[argDims + 1]));

// 用户点名「被切割或变形」的组合
const CASES = [
  ['1x1', 'timeDate', 'dualZone'], ['1x1', 'timeDate', 'ringClock'], ['1x1', 'timeDate', 'dotClock'],
  ['1x1', 'timeDate', 'stripeClock'], ['1x1', 'progress', 'yearBars'], ['1x1', 'progress', 'weekGrid'],
  ['1x1', 'progress', 'ringProgress'], ['1x1', 'gauge', 'dial'],
  ['1x2', 'schedule', 'capsule'], ['1x2', 'important', 'festival'],
  ['2x1', 'timeDate', 'dualZone'], ['2x1', 'timeDate', 'ringClock'], ['2x1', 'timeDate', 'dotClock'],
  ['2x1', 'timeDate', 'stripeClock'], ['2x1', 'schedule', 'targetDay'], ['2x1', 'progress', 'yearBars'],
  ['2x1', 'progress', 'weekGrid'], ['2x1', 'important', 'festival'],
  ['1xfull', 'timeDate', 'dualZone'], ['1xfull', 'timeDate', 'dotClock'], ['1xfull', 'schedule', 'capsule'],
  ['1xfull', 'progress', 'multiBars'], ['1xfull', 'important', 'festival'],
];

// --all=1x1,2x1：把该尺寸支持的样式全列出来（用于「哪些样式该淘汰」的整体盘点）
const argAll = process.argv.indexOf('--all');
let CASES2 = CASES;
if (argAll >= 0 && process.argv[argAll + 1]) {
  const want = process.argv[argAll + 1].split(',').map((x) => x.trim()).filter(Boolean);
  const ALL = ['1x1', '1x2', '2x1', '2x2', '2x4', '4x4', '1xfull'];
  CASES2 = [];
  for (const size of want) {
    for (const ct of SINGLE_CONTENTS) {
      for (const st of ct.styles) {
        const sz = st.sizes || ALL;
        if (sz.includes(size)) CASES2.push([size, ct.key, st.key]);
      }
    }
  }
}

const groups = {};
for (const [size, c, s] of CASES2) (groups[size] ||= []).push([c, s]);

const body = Object.entries(groups).map(([size, list]) => {
  const [w, h] = DIMS[size];
  const cells = list.map(([c, s]) => `
    <div class="case">
      <div class="cap">${size} · ${c}.${s} · ${Math.round(w)}×${Math.round(h)}</div>
      <div class="card" style="width:${w}px;height:${h}px">
        <div class="wrap">${toHTML(renderInfoBlock({ ...base, content: c, style: s, singleRow: true, size, w, h }))}</div>
      </div>
    </div>`).join('\n');
  return `<h2>${size} · ${Math.round(DIMS[size][0])}×${Math.round(DIMS[size][1])}px</h2>\n<div class="row">${cells}</div>`;
}).join('\n');

writeFileSync(path.join(HERE, 'real-preview.html'), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>真实尺寸视觉验证</title><style>${CARD_MODE_CSS}</style>
<style>
body{margin:0;padding:20px;background:#0d1117;color:#c9d1d9;font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif}
h2{font-size:13px;color:#8b949e;margin:22px 0 10px;letter-spacing:.04em}
.row{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start}
.case{width:max-content}
.cap{font-size:10px;color:#8b949e;margin-bottom:5px}
.card{box-sizing:border-box;border-radius:20px;overflow:hidden;background:#141a22;display:flex;flex-direction:column;padding:0}
.wrap{flex:1 1 auto;min-height:0;width:100%;display:flex;align-items:center;justify-content:center;font-size:16px;color:#F5F5F7}
</style></head><body>${body}</body></html>`);

console.log('已生成 scripts/real-preview.html');
