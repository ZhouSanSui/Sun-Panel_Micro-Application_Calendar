/**
 * 单独模式矩阵审计：把「每个单独样式 × 每个卡片尺寸」全渲染一遍，
 * 用无头 Chrome 量出溢出、越界子元素与字号，同时产出可视化图集。
 *
 * 与 audit-matrix.mjs 的区别：CSS 直接引用运行时单一真源 src/core/card-mode-styles.js，
 * 不另抄一份，因此测出来的就是线上真实排版。
 *
 * 用法：node scripts/audit-single.mjs
 * 产物：scripts/audit-single-cases.html（图集，可截图）、scripts/audit-single.json
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { renderInfoBlock } from '../src/core/card-mode-render.js';
import { CARD_MODE_CSS } from '../src/core/card-mode-styles.js';
import { SINGLE_CONTENTS, styleFitsSize } from '../src/core/user-store.js';
import { ensureAppState, getUserStore } from '../src/core/app-state.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

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
  for (const content of SINGLE_CONTENTS) {
    for (const style of content.styles) {
      const gated = !styleFitsSize('single', content.key, style.key, size);
      // v3.3：传真实像素宽高，方向判定与 1×FULL 字号都按实际几何算
      const html = toHTML(renderInfoBlock({ ...base, content: content.key, style: style.key, singleRow: true, size, w, h }));
      cases.push({
        key: `${size}|${content.key}.${style.key}`, size, w, h,
        c: content.key, s: style.key, zh: style.zh, gated, html,
      });
    }
  }
}

const PAGE_CSS = `
  body { margin:0; padding:24px 20px 40px; background:#0d1117; color:#c9d1d9;
         font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','PingFang SC','Microsoft YaHei',sans-serif; }
  h2 { font-size:13px; color:#8b949e; font-weight:600; margin:26px 0 10px; letter-spacing:.04em; }
  .row { display:flex; flex-wrap:wrap; gap:16px; align-items:flex-start; }
  .case { width:max-content; }
  .cap { font-size:10px; line-height:1.5; color:#8b949e; margin-bottom:5px; font-variant-numeric:tabular-nums; }
  .cap b { color:#c9d1d9; font-weight:600; }
  .cap .gate { color:#d29922; }
  /* 宿主盒模型复刻（CDP 实测，见 .tmp/panel-geo.mjs）：
     .item-card-content（无 padding、overflow:hidden、radius 20px）→ :host → .widget
     （padding:12px + 主题玻璃描边 border:1px，见 widget.js 的 _cardBgStyle）→ .card-mode-wrap。
     少了这层 26px chrome，每轴都会凭空多出可用空间 → 「0 裁切」是假象（v3.15 踩坑）。 */
  .card { box-sizing:border-box; border-radius:20px; overflow:hidden; background:#141a22;
          box-shadow:0 2px 12px rgba(0,0,0,.5); display:flex; flex-direction:column; padding:0; }
  .widget { box-sizing:border-box; width:100%; height:100%; padding:12px;
            border:1px solid rgba(255,255,255,0.12); display:flex; flex-direction:column; }
  .card-mode-wrap { flex:1 1 auto; min-height:0; width:100%; overflow:hidden; display:flex; flex-direction:column;
                    align-items:center; justify-content:center; font-size:16px; color:#F5F5F7;
                    text-shadow:0 1px 2px rgba(0,0,0,.35); }
  #out { position:absolute; left:-99999px; top:0; }
`;

const rowsHTML = SIZES.map((size) => {
  const [w, h] = DIMS[size];
  const cell = cases.filter((c) => c.size === size).map((c) => `
    <div class="case" data-case="${c.key}" data-size="${c.size}" data-c="${c.c}" data-s="${c.s}">
      <div class="cap"><b>${c.c}.${c.s}</b> ${c.zh}${c.gated ? ' <span class="gate">·此尺寸未启用</span>' : ''}<br>${size} ${w}×${h}</div>
      <div class="card" style="width:${w}px;height:${h}px">
        <div class="widget"><div class="card-mode-wrap">${c.html}</div></div>
      </div>
    </div>`).join('\n');
  return `<h2>${size} · ${w}×${h}px</h2>\n<div class="row">${cell}</div>`;
}).join('\n');

const MEASURE = `
<script>
  (() => {
    const rows = [];
    document.querySelectorAll('.case').forEach((el) => {
      const block = el.querySelector('.pv-single');
      const card = el.querySelector('.card');
      if (!block || !card) { rows.push({ case: el.dataset.case, missing: 1 }); return; }
      const br = block.getBoundingClientRect();
      const cr = card.getBoundingClientRect();
      const ox = block.scrollWidth - block.clientWidth;
      const oy = block.scrollHeight - block.clientHeight;
      let clipped = 0; let minPrimary = 999; let minSecondary = 999; let outTag = ''; let svgOut = 0;
      let squeezed = 0; let sqTag = '';
      const PRIMARY = /(^|\\s)(pv-big|pv-mid|pv-vbig|pv-vline|pv-wd-sm|pv-rc-time|pv-dc-time|pv-bc-nums|pv-tg-days|pv-yb-v|pv-mb-v|pv-gl-val|pv-wc-main)(\\s|$)/;
      block.querySelectorAll('*').forEach((n) => {
        const r = n.getBoundingClientRect();
        const isSvgPrim = !!n.closest('svg');
        // v3.10：容器内文字挤压检测 —— 只查块级越界抓不到「格子里的数字互相叠」（weekGrid 每列
        // 只有约 1.1 个字宽，两位数字直接压在一起，但格子本身没越出 .pv-single）。这里对「有文本
        // 且不裁剪」的叶子元素比 scrollWidth 与 clientWidth，超了算挤压。
        // 内联元素的 clientWidth 恒为 0，所以不能用 scrollWidth，改比「子/父矩形」：
        // 子元素横向溢出父元素、且父元素不裁剪 = 文字被挤出自己的格子（视觉上就是叠字）。
        {
          const p = n.parentElement;
          if (!isSvgPrim && p && p !== block && r.width > 0) {
            const pr = p.getBoundingClientRect();
            const pcs = getComputedStyle(p);
            const clips = pcs.overflowX !== 'visible';
            if (!clips && pr.width > 0 && (r.right > pr.right + 1 || r.left < pr.left - 1)) {
              squeezed += 1;
              if (!sqTag) sqTag = n.tagName.toLowerCase() + '.' + (n.getAttribute('class') || '') + '「' + (n.textContent || '').trim().slice(0, 8) + '」溢出 ' + p.tagName.toLowerCase() + '.' + (p.getAttribute('class') || '') + ' +' + Math.round(Math.max(r.right - pr.right, pr.left - r.left)) + 'px';
            }
          }
        }
        if (r.width > 0 && (r.right > br.right + 1.5 || r.bottom > br.bottom + 1.5
          || r.left < br.left - 1.5 || r.top < br.top - 1.5)) {
          if (isSvgPrim) { svgOut += 1; } else { clipped += 1; } if (!outTag) outTag = n.tagName.toLowerCase() + '.' + (n.getAttribute('class') || '') + '[p=' + (n.parentElement && (n.parentElement.getAttribute('class') || n.parentElement.tagName)) + ' r=' + n.getAttribute('r') + ' cx=' + n.getAttribute('cx') + ' cy=' + n.getAttribute('cy') + '] L' + Math.round(r.left - br.left) + ' T' + Math.round(r.top - br.top) + ' R' + Math.round(r.right - br.right) + ' B' + Math.round(r.bottom - br.bottom); }
        const txt = (n.textContent || '').trim();
        if (!txt) return;
        // v3.15：display:none / visibility:hidden 的元素不参与字号判定 ——
        // dayStack@1×1 左列被 .pv-single-1x1 .pv-ds-left{display:none} 整体隐藏，
        // 其 0.36em 行若计入会把「根本没渲染」的文字判成 SUB（假阳性）。
        // （越界/挤压判定有 r.width>0 兜底，天然不受影响。）
        const ncs = getComputedStyle(n);
        if (ncs.display === 'none' || ncs.visibility === 'hidden') return;
        const fs = parseFloat(ncs.fontSize);
        if (!fs) return;
        if (PRIMARY.test(n.className || '')) { if (fs < minPrimary) minPrimary = fs; }
        else if (fs < minSecondary) minSecondary = fs;
      });
      const u = parseFloat(getComputedStyle(block).fontSize) || 0;
      rows.push({
        case: el.dataset.case, size: el.dataset.size, c: el.dataset.c, s: el.dataset.s,
        cardW: Math.round(cr.width), cardH: Math.round(cr.height),
        blockW: Math.round(br.width), blockH: Math.round(br.height),
        rootPx: Math.round(u * 10) / 10,
        minPrimary: Math.round((minPrimary === 999 ? 0 : minPrimary) * 10) / 10,
        minSecondary: Math.round((minSecondary === 999 ? 0 : minSecondary) * 10) / 10,
        overflowX: ox, overflowY: oy, clipped, svgOut, outTag, squeezed, sqTag,
      });
    });
    const pre = document.createElement('pre');
    pre.id = 'out';
    pre.textContent = JSON.stringify(rows);
    document.body.appendChild(pre);
  })();
</script>`;

const pagePath = path.join(HERE, 'audit-single-cases.html');
writeFileSync(pagePath,
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>单独模式矩阵图集</title>
<style>${CARD_MODE_CSS}</style><style>${PAGE_CSS}</style></head>
<body>${rowsHTML}${MEASURE}</body></html>`);

console.log(`用例数：${cases.length}，正在无头渲染测量…`);
const dom = execFileSync(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  `--user-data-dir=${path.join(os.tmpdir(), 'chrome-audit')}`,
  '--virtual-time-budget=8000', '--window-size=1400,900', '--dump-dom',
  `file:///${pagePath.replace(/\\/g, '/')}`,
], { encoding: 'utf8', maxBuffer: 200 * 1024 * 1024 });

const m = dom.match(/<pre id="out">([\s\S]*?)<\/pre>/);
if (!m) { console.error('未取到测量结果（页面脚本可能未执行）'); process.exit(1); }
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const rows = JSON.parse(decode(m[1]));

const verdict = (r) => {
  if (r.missing) return 'MISS';
  if (r.overflowX > 1 || r.overflowY > 1 || r.clipped > 0 || r.squeezed > 0) return 'CLIP';
  if (r.minPrimary > 0 && r.minPrimary < 9) return 'TINY';
  if (r.minSecondary > 0 && r.minSecondary < 5.5) return 'SUB';
  return 'OK';
};
// 被 `sizes` 门控的组合（用户在 UI 里选不到）不计入判定，避免用不可达组合干扰结论
const gatedKeys = new Set(cases.filter((c) => c.gated).map((c) => c.key));
rows.forEach((r) => { r.verdict = gatedKeys.has(r.case) ? 'GATED' : verdict(r); });
writeFileSync(path.join(HERE, 'audit-single.json'), JSON.stringify(rows, null, 2));

const stat = { OK: 0, TINY: 0, SUB: 0, CLIP: 0, MISS: 0, GATED: 0 };
rows.forEach((r) => { stat[r.verdict] += 1; });
const bad = rows.filter((r) => r.verdict === 'CLIP' || r.verdict === 'TINY' || r.verdict === 'MISS');
console.log(`\n正常 ${stat.OK} · 主文字过小 ${stat.TINY} · 次要注意 ${stat.SUB} · 裁切 ${stat.CLIP} · 缺失 ${stat.MISS} · 该尺寸不提供 ${stat.GATED}`);
if (bad.length) {
  console.log('\n需要处理：');
  for (const r of bad) {
    console.log(`  ${r.verdict.padEnd(4)} ${String(r.size).padEnd(6)} ${(r.c + '.' + r.s).padEnd(24)} `
      + `块${r.blockW}×${r.blockH} 根${r.rootPx} 主${r.minPrimary} 次${r.minSecondary} `
      + `溢出${r.overflowX}/${r.overflowY} 越界${r.clipped} 挤压${r.squeezed} ${r.outTag || r.sqTag || ""}`);
  }
}
console.log(`\n图集：scripts/audit-single-cases.html（截图：node scripts/screenshot.mjs --html scripts/audit-single-cases.html --no-gen --width 1400 --dpr 1 --out .tmp/audit-single.png）`);
