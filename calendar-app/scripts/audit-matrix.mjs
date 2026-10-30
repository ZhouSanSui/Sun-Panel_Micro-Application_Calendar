/**
 * 显示能力矩阵审计：把「每个样式 × 每个尺寸 × 推荐/最小占格」全渲染一遍，
 * 用无头 Chrome 量出溢出与字号，输出红黄绿矩阵报告。
 *
 * 用法：node scripts/audit-matrix.mjs
 * 产物：scripts/audit-cases.html（渲染用例页）、scripts/audit-matrix.html（报告）、
 *       scripts/audit-result.json（原始数据）
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { renderBlocksHTML } from '../src/core/card-mode-render.js';
import { CARD_MODE_CSS } from '../src/core/card-mode-styles.js';
import {
  COMBO_CONTENTS, displayContents, comboGridFor, layoutBlocks, prefSpan, spanBounds,
} from '../src/core/user-store.js';
import { ensureAppState, getUserStore } from '../src/core/app-state.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// 注入日程，保证 schedule.* 有内容可渲染
await ensureAppState({});
getUserStore().data.schedules = [
  ['饶办办', '2026-10-22', '09:30'],
  ['辜云皓', '2026-10-26', ''],
  ['表妹-高娜', '2026-11-02', '14:00'],
  ['刘小梅', '2026-11-05', ''],
  ['王贤菊', '2026-11-09', '18:30'],
  ['邓文林', '2026-11-13', '08:00'],
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

const visual = { bg: 'linear-gradient(140deg,#1c3b6e,#0c1d33)', label: '#F5F5F7', label2: '#C7C7CC', label3: '#8E8E93', cartBg: 'rgba(255,255,255,.15)', cardBg: 'rgba(255,255,255,0.15)', textLight: true };
const base = {
  visual,
  theme: '#0A84FF',
  now: new Date(2026, 9, 21, 14, 5, 9),
  isZh: true,
  weekStart: 1,
  hour12: false,
  t: (k) => ({ MAIN_TODAY: '今天', MAIN_DAYS: '天' }[k] || k),
};

const DIMS = {
  '1x1': [120, 120], '1x2': [252, 120], '2x1': [120, 252], '2x2': [252, 252],
  '2x4': [516, 252], '4x4': [516, 516], '1xfull': [1080, 120],
};
// 尺寸覆盖：AUDIT_DIMS='{"1x1":[96,90],...}'（用于按真实面板尺寸复测）
if (process.env.AUDIT_DIMS) {
  try { Object.assign(DIMS, JSON.parse(process.env.AUDIT_DIMS)); } catch (e) { console.error('AUDIT_DIMS 解析失败：', e.message); process.exit(1); }
}

const SIZES = Object.keys(DIMS);

const cases = [];
for (const size of SIZES) {
  const [w, h] = DIMS[size];
  const grid = comboGridFor(size, w, h);
  const cellW = (w - 24) / grid.cols;
  const cellH = (h - 24) / grid.rows;

  for (const content of displayContents('combo')) {
    if (content.key === 'blank') continue;
    for (const style of content.styles) {
      const d = { c: content.key, s: style.key };
      const pref = prefSpan('combo', size, d);
      const bounds = spanBounds('combo', size, { c: d.c, s: d.s });
      // 「最小占格」必须遵守 minArea：面积下限生效时，1×1 已非法，改测 2×1 / 1×2 降级候选
      const minArea = bounds.minArea || 0;
      let min = bounds.min || pref;
      if (minArea > 0 && min.cols * min.rows < minArea) {
        const cand = [{ cols: 2, rows: 1 }, { cols: 1, rows: 2 }]
          .filter((x) => x.cols * x.rows >= minArea
            && x.cols <= grid.cols && x.rows <= grid.rows
            && !(x.cols === pref.cols && x.rows === pref.rows));
        if (cand.length) min = cand[0];
      }
      const variants = [
        ['pref', pref],
        ['min', min],
      ].filter((v, i, arr) => arr.findIndex((x) => x[1].cols === v[1].cols && x[1].rows === v[1].rows) === i);

      for (const [variant, sp] of variants) {
        const span = { cols: Math.min(sp.cols, grid.cols), rows: Math.min(sp.rows, grid.rows) };
        if (span.cols < 1 || span.rows < 1) continue;
        const laid = layoutBlocks([{ c: d.c, s: d.s, span }], 'combo', size, grid);
        if (!laid.length) continue;
        const key = `${size}|${variant}|${d.c}.${d.s}`;
        cases.push({
          key, size, variant, w, h, grid, cellW, cellH, ...d, span,
          html: toHTML(renderBlocksHTML({ ...base, blocks: laid, grid, cellW, cellH, size })),
        });
      }
    }
  }
}

// ---------- 用例页 ----------
const CASES_CSS = `
  body { margin:0; padding:20px; background:#0d1117; color:#c9d1d9;
         font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','PingFang SC','Microsoft YaHei',sans-serif; }
  .case { display:inline-block; vertical-align:top; margin:0 18px 18px 0; }
  .cap { font-size:10px; color:#8b949e; margin-bottom:4px; font-variant-numeric:tabular-nums; }
  .card { padding:12px; box-sizing:border-box; border-radius:20px; overflow:hidden;
          box-shadow:0 2px 10px rgba(0,0,0,.45); display:flex; flex-direction:column;
          background:#141a22; }
  .card-mode-wrap { flex:1; min-height:0; width:100%; display:flex; flex-direction:column;
                    align-items:center; justify-content:center; font-size:16px; }
  .text-light { color:#F5F5F7; text-shadow:0 1px 2px rgba(0,0,0,.35); }
${CARD_MODE_CSS}
  #out { position:absolute; left:-99999px; top:0; }
`;

const caseHTML = cases.map((c) => `
  <div class="case" data-case="${c.key}" data-size="${c.size}" data-variant="${c.variant}" data-c="${c.c}" data-s="${c.s}">
    <div class="cap">${c.size} · ${c.w}×${c.h} · ${c.variant} ${c.span.cols}×${c.span.rows} · ${c.c}.${c.s}</div>
    <div class="card item-card-content" style="width:${c.w}px;height:${c.h}px">
      <div class="card-mode-wrap text-light">${c.html}</div>
    </div>
  </div>`).join('\n');

const MEASURE = `
<script>
  (() => {
    const rows = [];
    document.querySelectorAll('.case').forEach((el) => {
      const block = el.querySelector('.pv-block');
      if (!block) return;
      const br = block.getBoundingClientRect();
      const ox = block.scrollWidth - block.clientWidth;
      const oy = block.scrollHeight - block.clientHeight;
      let clipped = 0;
      let minPrimary = 999;
      let minSecondary = 999;
      const PRIMARY = /(^|\\s)(pv-big|pv-mid|pv-vbig|pv-vline|pv-wd-sm|pv-sch-name|pv-flip-box|pv-big)(\\s|$)/;
      block.querySelectorAll('*').forEach((n) => {
        const r = n.getBoundingClientRect();
        if (r.width > 0 && (r.right > br.right + 1 || r.bottom > br.bottom + 1 || r.left < br.left - 1 || r.top < br.top - 1)) clipped += 1;
        const txt = (n.textContent || '').trim();
        if (!txt) return;
        const fs = parseFloat(getComputedStyle(n).fontSize);
        if (!fs) return;
        if (PRIMARY.test(n.className || '')) { if (fs < minPrimary) minPrimary = fs; }
        else if (fs < minSecondary) minSecondary = fs;
      });
      const u = parseFloat(block.style.fontSize) || 0;
      rows.push({
        case: el.dataset.case, size: el.dataset.size, variant: el.dataset.variant,
        c: el.dataset.c, s: el.dataset.s,
        blockW: Math.round(br.width), blockH: Math.round(br.height),
        u: Math.round(u * 10) / 10,
        minPrimary: Math.round((minPrimary === 999 ? 0 : minPrimary) * 10) / 10,
        minSecondary: Math.round((minSecondary === 999 ? 0 : minSecondary) * 10) / 10,
        overflowX: ox, overflowY: oy, clipped,
      });
    });
    const pre = document.createElement('pre');
    pre.id = 'out';
    pre.textContent = JSON.stringify(rows);
    document.body.appendChild(pre);
  })();
</script>`;

writeFileSync(path.join(HERE, 'audit-cases.html'),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>矩阵审计用例</title><style>${CASES_CSS}</style></head>
<body>${caseHTML}${MEASURE}</body></html>`);

// ---------- 无头 Chrome 测量 ----------
console.log(`用例数：${cases.length}，正在无头渲染测量…`);
const dom = execFileSync(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  `--user-data-dir=${path.join(os.tmpdir(), 'chrome-audit')}`,
  '--virtual-time-budget=8000',
  '--window-size=1400,900',
  '--dump-dom',
  `file:///${path.join(HERE, 'audit-cases.html').replace(/\\/g, '/')}`,
], { encoding: 'utf8', maxBuffer: 200 * 1024 * 1024 });

const m = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/);
if (!m) {
  console.error('未取到测量结果（页面脚本可能未执行）');
  process.exit(1);
}
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const rows = JSON.parse(decode(m[1]));

const verdict = (r) => {
  if (r.overflowX > 1 || r.overflowY > 1 || r.clipped > 0) return 'CLIP';
  if (r.minPrimary > 0 && r.minPrimary < 9) return 'TINY';
  if (r.minSecondary > 0 && r.minSecondary < 5.5) {
    // v3.80：月历格阵是「7 列 × 6 行」的信息密集排布，小块上必然出现 <5.5px 的小字
    // （日格数字 + 星期表头）。这是内容形态决定的、不可避免的密度，不是排版缺陷 ——
    // 用户明确要求忽略该类告警。裁切（CLIP）仍然照常判定，不受此豁免影响。
    if (r.c === 'calendar' && r.s === 'month') return 'OK';
    return 'SUB';
  }
  return 'OK';
};
rows.forEach((r) => { r.verdict = verdict(r); });

writeFileSync(path.join(HERE, 'audit-result.json'), JSON.stringify(rows, null, 2));

// ---------- 报告 ----------
const group = new Map();
for (const r of rows) {
  const key = `${r.c}.${r.s}`;
  if (!group.has(key)) group.set(key, { c: r.c, s: r.s, cells: {} });
  group.get(key).cells[`${r.size}|${r.variant}`] = r;
}

const COLOR = { OK: '#3fb950', TINY: '#d29922', SUB: '#58a6ff', CLIP: '#f85149' };
const ICON = { OK: '●', TINY: '◐', SUB: '·', CLIP: '✕' };
const VARIANT_LABEL = { pref: '推荐', min: '最小' };

const head = `<tr><th style="text-align:left">样式</th>${SIZES.map((s) => `<th>${s}</th>`).join('')}</tr>`;
const body = [...group.values()].map((g) => {
  const tds = SIZES.map((size) => {
    const parts = ['pref', 'min'].map((v) => {
      const r = g.cells[`${size}|${v}`];
      if (!r) return '';
      const title = `${size} (${VARIANT_LABEL[v]}) ${r.blockW}×${r.blockH}px\\nu=${r.u} 最小字号=${r.minFont}\\n溢出 x=${r.overflowX} y=${r.overflowY} 越界子元素=${r.clipped}\\n占格 ${r.c}.${r.s}`;
      return `<span title="${title}" style="color:${COLOR[r.verdict]}">${ICON[r.verdict]}</span>`;
    }).join('');
    return `<td style="text-align:center;white-space:nowrap;font-size:12px">${parts}</td>`;
  }).join('');
  return `<tr><td style="font-family:ui-monospace,monospace;font-size:12px">${g.c}.${g.s}</td>${tds}</tr>`;
}).join('\n');

const stat = { OK: 0, TINY: 0, SUB: 0, CLIP: 0 };
rows.forEach((r) => { stat[r.verdict] += 1; });

writeFileSync(path.join(HERE, 'audit-matrix.html'),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>显示能力矩阵审计</title>
<style>
 body{margin:0;padding:24px;background:#0d1117;color:#c9d1d9;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif}
 h1{font-size:16px;margin:0 0 6px;color:#e6edf3} p{font-size:12px;color:#8b949e;margin:4px 0}
 table{border-collapse:collapse;margin-top:14px;font-size:13px}
 th,td{border:1px solid #30363d;padding:4px 8px}
 th{background:#161b22;color:#8b949e;font-weight:600;font-size:12px}
 tr:nth-child(even) td{background:#11161d}
 .legend span{margin-right:14px;font-size:12px}
 .sum b{font-size:15px}
</style></head><body>
<h1>显示能力矩阵审计 · v1.0.261020 基线</h1>
<p>每格两个符号：左=推荐占格，右=最小允许占格。悬停看尺寸/字号/溢出数值。</p>
<p class="legend"><span style="color:#3fb950">● 正常</span><span style="color:#d29922">◐ 主文字&lt;9px</span><span style="color:#58a6ff">· 次要文字&lt;5.5px</span><span style="color:#f85149">✕ 被裁切</span></p>
<p class="sum">共 <b>${rows.length}</b> 个组合：正常 <b style="color:#3fb950">${stat.OK}</b> · 主文字过小 <b style="color:#d29922">${stat.TINY}</b> · 次要注意 <b style="color:#58a6ff">${stat.SUB}</b> · 裁切 <b style="color:#f85149">${stat.CLIP}</b></p>
<table><thead>${head}</thead><tbody>${body}</tbody></table>
</body></html>`);

console.log(`\n=== 汇总（${rows.length} 组合）===`);
console.log(`正常 ${stat.OK} · 主文字过小 ${stat.TINY} · 次要注意 ${stat.SUB} · 裁切 ${stat.CLIP}`);
const ORDER = { CLIP: 0, TINY: 1, SUB: 2 };
const bad = rows.filter((r) => r.verdict !== 'OK')
  .sort((a, b) => ORDER[a.verdict] - ORDER[b.verdict]);
console.log('\n需要处理的组合（前 40）：');
bad.slice(0, 40).forEach((r) => {
  console.log(`  ${r.verdict.padEnd(5)} ${r.size.padEnd(7)} ${r.variant.padEnd(4)} ${r.c}.${r.s}`.padEnd(56)
    + ` 块${r.blockW}×${r.blockH} u=${r.u} 主=${r.minPrimary} 次=${r.minSecondary} 溢出${r.overflowX}/${r.overflowY} 越界${r.clipped}`);
});
console.log('\n报告：scripts/audit-matrix.html');
