/**
 * 生成静态预览页：7 种卡片规格的「推荐默认样式」布局。
 * 复用 renderBlocksHTML 真实渲染 + 与组件一致的 em/网格 CSS。
 */
import { writeFileSync } from 'node:fs';
import { renderBlocksHTML } from '../src/core/card-mode-render.js';
import { layoutBlocks, gridForSize, sanitizeBlocks } from '../src/core/user-store.js';
import { ensureAppState, getUserStore } from '../src/core/app-state.js';

// 注入一批临近日程（供 schedule 用例渲染真实数据；now=2026-10-18）
await ensureAppState({});
getUserStore().data.schedules = [
  ['饶办办', '2026-10-22', '09:30'],
  ['辜云皓', '2026-10-26', ''],
  ['表妹-高娜', '2026-11-02', '14:00'],
  ['刘小梅', '2026-11-05', ''],
  ['王贤菊', '2026-11-09', '18:30'],
  ['邓文林', '2026-11-13', '08:00'],
  ['谢永才', '2026-11-27', ''],
  ['颜华', '2026-12-05', '12:15'],
].map(([title, date, time], i) => ({
  id: `pv${i}`, type: 'event', title, date, time, lunar: false, note: '', color: 'red', yearly: false,
}));

/** lit TemplateResult → HTML 字符串（递归展平 strings/values） */
function toHTML(tpl) {
  if (tpl == null || tpl === false || tpl === true) return '';
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

const visual = { bg: 'linear-gradient(140deg,#1c3b6e,#0c1d33)', label: '#F5F5F7', label2: '#C7C7CC', label3: '#8E8E93', cartBg: 'rgba(255,255,255,.15)', cardBg: 'rgba(255,255,255,0.15)', textLight: true };
const base = {
  visual,
  theme: '#0A84FF',
  now: new Date(2026, 9, 18, 14, 5, 9),
  isZh: true,
  weekStart: 1,
  hour12: false,
  t: (k) => ({ MAIN_TODAY: '今天', MAIN_DAYS: '天' }[k] || k),
};

// 推荐默认样式直接复用应用常量（DEFAULT_CARD_BLOCKS），保证预览与线上默认一致
const NOTES = {
  '1x1': '整卡「日」数字（2×2）',
  '1x2': '日期 + 最近日程',
  '2x1': '竖向四段：日期/节日/节气/最近日程',
  '2x2': '2×2：日期/节日/节气/最近日程',
  '2x4': '周历条 + 时钟 + 最近日程',
  '4x4': '月历 + 四样式（节日/节气/距放假/最近日程）',
  '1xfull': '整条月历（2×8，运行时拉伸铺满）',
};
const SIZES = ['1x1', '1x2', '2x1', '2x2', '2x4', '4x4', '1xfull'];
const DIMS = { '1x1': [120, 120], '1x2': [252, 120], '2x1': [120, 252], '2x2': [252, 252], '2x4': [516, 252], '4x4': [516, 516], '1xfull': [1080, 120] };
const DEFAULTS = SIZES.map((size) => [
  size, DIMS[size][0], DIMS[size][1],
  sanitizeBlocks(null, 'combo', size).map((b) => [b.c, b.s, b.span ? { span: b.span } : undefined]),
  null, NOTES[size],
]);

const cards = DEFAULTS.map(([size, w, h, list, cardCenter, note]) => {
  const g = gridForSize(size);
  let cols = g.cols;
  if (size === '1xfull') cols = Math.max(4, Math.min(10, Math.round((w - 24) / 90)));
  const grid = { cols, rows: g.rows };
  const cellW = (w - 24) / grid.cols;
  const cellH = (h - 24) / grid.rows;
  const blocks = list.map(([c, s, extra]) => ({ c, s, ...(extra || {}) }));
  const laid = layoutBlocks(blocks, 'combo', size, grid, cardCenter);
  const nt = note ? ` <i style="color:#7ee787">${note}</i>` : '';
  const html = toHTML(renderBlocksHTML({ ...base, blocks: laid, grid, cellW, cellH, size }));
  return `
  <figure>
    <figcaption>${size} · ${w}×${h}px · 网格 ${grid.cols}×${grid.rows} · ${laid.length}/${list.length} 块${nt}</figcaption>
    <div class="card item-card-content" style="width:${w}px;height:${h}px">
      <div class="card-mode-wrap text-light">${html}</div>
    </div>
  </figure>`;
}).join('\n');

const CSS = `
  body { margin:0; padding:28px; background:#0d1117; color:#c9d1d9;
         font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','PingFang SC','Microsoft YaHei',sans-serif; }
  h1 { font-size:15px; font-weight:600; color:#8b949e; margin:0 0 20px; }
  .grid-wrap { display:flex; flex-wrap:wrap; gap:26px; align-items:flex-start; }
  figure { margin:0; }
  figcaption { font-size:11px; color:#8b949e; margin-bottom:7px; font-variant-numeric:tabular-nums; }
  .card { padding:12px; box-sizing:border-box; border-radius:20px; overflow:hidden;
          box-shadow:0 2px 10px rgba(0,0,0,.45); display:flex; flex-direction:column; }
  .card-mode-wrap { flex:1; min-height:0; width:100%; display:flex; flex-direction:column;
                    align-items:center; justify-content:center; font-size:16px; }
  .text-light { color:#F5F5F7; text-shadow:0 1px 2px rgba(0,0,0,.35); }
  .pv-center { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.375em; width:100%; text-align:center; }
  .pv-center.pv-flat { flex-direction:row; align-items:center; justify-content:center; gap:.5em; }
  .pv-fnum { display:flex; flex-direction:column; align-items:center; justify-content:center; flex:0 1 auto; }
  .pv-ftext { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.1875em; flex:0 1 auto; min-width:0; text-align:center; }
  .pv-col { display:flex; flex-direction:column; gap:.3125em; width:100%; }
  .pv-gap { height:.5em; }
  .pv-big { font-size:1.875em; font-weight:800; line-height:1.1; font-variant-numeric:tabular-nums; }
  .pv-mid { font-size:1em; font-weight:700; line-height:1.25; }
  .pv-dot { display:inline-block; width:.28em; height:.28em; border-radius:50%; background:currentColor; margin:0 .28em; vertical-align:.21em; }
  .text-light .pv-dot { box-shadow: 0 1px 2px rgba(0,0,0,.35); }
  .pv-row2 { font-size:.75em; font-weight:600; }
  .pv-sch-row { display: flex; align-items: center; justify-content: space-between; gap: .5em; width: 100%; }
  .pv-sch-name { font-size: .75em; font-weight: 600; flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pv-sch-meta { display: flex; flex-direction: column; align-items: flex-end; flex: 0 0 auto; font-size: .5em; line-height: 1.25; white-space: nowrap; }
  .pv-sch-date { opacity: .95; }
  .pv-sch-time { opacity: .8; }
  .pv-sub { font-size:.5625em; line-height:1.3; }
  .pv-bar { height:.25em; border-radius:.125em; overflow:hidden; }
  .pv-fill { height:100%; border-radius:.125em; }
  .pv-chip2 { font-size:.6875em; padding:.25em .625em; border-radius:.5em; font-weight:600; display:inline-flex; gap:.375em; align-items:center; }
  .pv-flip { display:inline-flex; gap:.25em; align-items:center; }
  .pv-flip-box { font-size:1.375em; font-weight:800; padding:.25em .5em; border-radius:.375em; font-variant-numeric:tabular-nums; }
  .pv-ap { font-size:.6875em; font-weight:600; }
  .pv-wk { display:grid; grid-template-columns:repeat(7,1fr); gap:.125em; }
  .pv-wk-cell { display:flex; flex-direction:column; align-items:center; border-radius:.375em; padding:.1875em 0; }
  .pv-wk-d { font-size:.75em; font-weight:600; }
  .pv-wk-w { font-size:.5em; }
  .pv-mini-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:.125em; margin-top:0; }
  .pv-vstack { display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; gap:.1875em; }
  .pv-vstack.t { gap:.125em; }
  .pv-vline { font-size:1.25em; font-weight:700; line-height:1.15; white-space:nowrap; font-variant-numeric:tabular-nums; }
  .pv-vline.wk { font-size:.7em; }
  .pv-vbig { font-size:1.875em; font-weight:800; line-height:1.1; white-space:nowrap; font-variant-numeric:tabular-nums; }
  .pv-vrow { display:flex; align-items:baseline; justify-content:center; gap:.25em; width:100%; }
  .pv-cal-head { text-align:center; color:inherit; line-height:1.2; }
  .pv-cal-wd { font-size:.5625em; font-weight:600; margin-left:.3125em; }
  .pv-wkv { display:grid; grid-template-rows:repeat(7,1fr); grid-template-columns:1fr; gap:.0625em; width:100%; }
  .pv-wkv-cell { display:flex; align-items:center; justify-content:space-between; padding:.125em .375em; border-radius:.375em; }
  .pv-wkv-d { font-size:.75em; font-weight:600; line-height:1.2; font-variant-numeric:tabular-nums; }
  .pv-wkv-w { font-size:.5625em; line-height:1.3; text-align:right; }
  .pv-wd-sm { font-size:0.9375em; font-weight:700; line-height:1.1; }
  .pv-sub-sm { font-size:0.5em; }
  .pv-c { aspect-ratio:1; border-radius:.25em; display:flex; align-items:center; justify-content:center; font-size:.5625em; font-weight:500; }
  .pv-c.out { opacity:.35; }
  .pv-yearcal { display:grid; grid-template-columns:repeat(3,1fr); gap:.3125em; }
  .pv-block > .pv-col { align-self:stretch; flex:1 1 auto; min-height:0; }
  .pv-block > .pv-col > .pv-mini-grid { flex:1 1 auto; min-height:0; grid-auto-rows:1fr; }
  .pv-mini-grid > .pv-c { aspect-ratio:auto; min-height:0; line-height:1; }
  .pv-blank { width:100%; height:100%; }
  .pv-block.blank { outline-color:rgba(255,120,120,.35); }
  .pv-blocks { position:relative; flex:1; min-height:0; width:100%; }
  .pv-block { position:absolute; box-sizing:border-box; padding:.1875em; display:flex;
              flex-direction:column; align-items:center; justify-content:center; overflow:hidden;
              outline:1px dashed rgba(255,255,255,.10); }
`;

writeFileSync(new URL('./defaults-preview.html', import.meta.url),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>7 种卡片规格 · 推荐默认样式预览</title><style>${CSS}</style></head>
<body><h1>拼接模式 · 7 种卡片规格推荐默认样式（虚线为块边界）</h1>
<div class="grid-wrap">${cards}</div></body></html>`);
console.log('✅ scripts/defaults-preview.html 已生成');
