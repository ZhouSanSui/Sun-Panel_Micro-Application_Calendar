#!/usr/bin/env node
/**
 * test-lit-commit.mjs v1 — 真 lit + 真浏览器 的提交回归门禁
 *
 * 背景（v3.15 血泪）：本地 preview/audit/test 全部用「字符串拼接」渲染 lit 模板，
 * 天然绕过 lit 的 ElementPart 语义 —— 标签内引号外的插值（<div class="x"${s}>）会被
 * lit 当 ElementPart **静默丢弃**（只认 styleMap/classMap 等 directive）。
 * 结果：拟合根字号从未进过 DOM，真实面板 1×1「十六」被裁成「十」，
 * 而 787 项字符串断言全绿。本脚本用真 lit 在真 Chrome 里 render，
 * 断言插值确实落进 DOM，堵住「脚本全过 ≠ 用户看得到」这类盲区。
 *
 * 断言：
 *   A. 单独模式传了几何 → .pv-single 必须有 inline font-size，且等于公式值
 *   B. 没传几何（样式条小预览）→ 不得有 inline font-size（吃 CSS 兜底）
 *   C. lunarDate 在用户真实卡 113×114 / 小视口 76×76 都不裁切
 *   D. heatYear「今天」格必须有 inline 背景（第二处 ElementPart 陷阱）
 *   E. 源码扫描：不得再出现「引号闭合后紧跟插值」的反模式
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = path.resolve(HERE, '..');
const TMP = path.join(PROJECT, '.tmp');
const PAGE = path.join(TMP, 'lit-commit-test.html');

const CHROME =
  ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
   'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'].find(existsSync) ||
  (process.env.LOCALAPPDATA ? process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe' : null);
if (!CHROME) { console.error('FATAL: chrome.exe not found'); process.exit(1); }

const MIME = {
  '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html',
  '.json': 'application/json', '.css': 'text/css', '.map': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
};

/* ---------------- 静态服务器（项目根） ---------------- */
function startServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      try {
        const urlPath = decodeURIComponent(req.url.split('?')[0]);
        const file = path.join(PROJECT, urlPath);
        if (!file.startsWith(PROJECT) || !existsSync(file) || !statSync(file).isFile()) {
          res.writeHead(404); res.end('404'); return;
        }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
        res.end(readFileSync(file));
      } catch (e) { res.writeHead(500); res.end(String(e)); }
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/* ---------------- CDP 客户端 ---------------- */
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.sessionId = null;
    ws.addEventListener('message', (ev) => {
      let msg; try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject, timer } = this.pending.get(msg.id);
        this.pending.delete(msg.id); clearTimeout(timer);
        msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
      }
    });
  }
  send(method, params = {}, sessionId = this.sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 30000);
      this.pending.set(id, { resolve, reject, timer });
      const payload = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      this.ws.send(JSON.stringify(payload));
    });
  }
  async evaluate(expression, awaitPromise = false) {
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
    if (res.exceptionDetails) {
      throw new Error('eval exception: ' + (res.exceptionDetails.exception?.description || res.exceptionDetails.text));
    }
    return res.result.value;
  }
}

/* ---------------- 测试页 ---------------- */
const PAGE_HTML = `<!doctype html>
<html><head><meta charset="utf-8">
<script type="importmap">
{"imports": {
  "lit": "/node_modules/lit/index.js",
  "lit-element/lit-element.js": "/node_modules/lit-element/lit-element.js",
  "lit-html": "/node_modules/lit-html/lit-html.js",
  "lit-html/is-server.js": "/node_modules/lit-html/is-server.js",
  "@lit/reactive-element": "/node_modules/@lit/reactive-element/reactive-element.js",
  "chinese-days": "/node_modules/chinese-days/dist/index.es.js"
}}
</script>
</head><body>
<script type="module">
window.__errs = [];
window.addEventListener('error', (e) => window.__errs.push('window.error: ' + (e.message || '')));
try {
  const { render } = await import('lit');
  const { renderInfoBlock } = await import('/src/core/card-mode-render.js');
  const { CARD_MODE_CSS } = await import('/src/core/card-mode-styles.js');
  const st = document.createElement('style');
  st.textContent = CARD_MODE_CSS;
  document.head.appendChild(st);

const base = {
  visual: { bg: '#1c1c1e', label: '#F5F5F7', label2: '#C7C7CC', label3: '#8E8E93', cartBg: 'rgba(255,255,255,.15)', cardBg: 'rgba(255,255,255,0.15)', textLight: true },
  theme: '#0A84FF', now: new Date(2026, 9, 25, 19, 9, 0), isZh: true,
  weekStart: 1, hour12: false, t: (k) => k,
};

// 复刻宿主盒模型：.item-card-content → 自定义元素(:host 100%) → .widget(border 1px + padding 12px)
// → .card-mode-wrap（flex 填满 + 整卡裁切，与 audit-single.mjs 的 PAGE_CSS 同源）
function mount(w, h) {
  const host = document.createElement('div');
  host.style.cssText = 'width:' + w + 'px;height:' + h + 'px;';
  const widget = document.createElement('div');
  widget.className = 'widget';
  widget.style.cssText = 'box-sizing:border-box;width:100%;height:100%;padding:12px;border:1px solid rgba(0,0,0,0.06);overflow:hidden;display:flex;flex-direction:column;';
  const wrap = document.createElement('div');
  wrap.className = 'card-mode-wrap';
  wrap.style.cssText = 'flex:1 1 auto;min-height:0;width:100%;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:16px;color:#F5F5F7;';
  widget.appendChild(wrap);
  host.appendChild(widget);
  document.body.appendChild(host);
  return wrap;
}

const results = [];
function probe(name, w, h, o) {
  const wrap = mount(w, h);
  render(renderInfoBlock({ ...base, singleRow: true, size: o.size, w, h, ...o }), wrap);
  const single = wrap.querySelector('.pv-single');
  const day = wrap.querySelector('.pv-ld-day');
  results.push({
    name,
    inline: single ? single.getAttribute('style') : 'NO .pv-single',
    computed: single ? getComputedStyle(single).fontSize : null,
    dayText: day ? day.textContent : null,
    dayScrollW: day ? day.scrollWidth : null,
    dayClientW: day ? day.clientWidth : null,
    // v3.15：块级溢出（.pv-single overflow:hidden，scroll > client 即被裁）
    blkScrollW: single ? single.scrollWidth : null,
    blkClientW: single ? single.clientWidth : null,
    blkScrollH: single ? single.scrollHeight : null,
    blkClientH: single ? single.clientHeight : null,
  });
}

probe('1x1 lunarDate @113x114（用户真实卡）', 113, 114, { size: '1x1', content: 'timeDate', style: 'lunarDate' });
probe('1x1 lunarDate @76x76（1384px 视口）', 76, 76, { size: '1x1', content: 'timeDate', style: 'lunarDate' });
probe('1x1 lunarDate @120x120（设计基准）', 120, 120, { size: '1x1', content: 'timeDate', style: 'lunarDate' });
probe('1x1 lunarDate @60x60（极限小卡）', 60, 60, { size: '1x1', content: 'timeDate', style: 'lunarDate' });
probe('2x2 lunarDate @252x252（设计基准）', 252, 252, { size: '2x2', content: 'timeDate', style: 'lunarDate' });
// v3.15：CONTENT_FIT 修正的 5 个款式（用户真实面板尺寸 CDP 实测 + 设计基准对照）
probe('1x1 dayStack @113x114（用户真实卡）', 113, 114, { size: '1x1', content: 'timeDate', style: 'dayStack' });
probe('1x1 dayStack @120x120（设计基准）', 120, 120, { size: '1x1', content: 'timeDate', style: 'dayStack' });
probe('1x1 festivalDay @113x114（用户真实卡）', 113, 114, { size: '1x1', content: 'schedule', style: 'festivalDay' });
probe('2x1 stackTime @113x238（用户真实卡）', 113, 238, { size: '2x1', content: 'timeDate', style: 'stackTime' });
probe('2x1 stackTime @120x252（设计基准）', 120, 252, { size: '2x1', content: 'timeDate', style: 'stackTime' });
probe('2x1 tallClock @113x238（用户真实卡）', 113, 238, { size: '2x1', content: 'timeDate', style: 'tallClock' });
probe('2x1 tallClock @120x252（设计基准）', 120, 252, { size: '2x1', content: 'timeDate', style: 'tallClock' });
probe('1x2 ringProgress @238x114（用户真实卡）', 238, 114, { size: '1x2', content: 'progress', style: 'ringProgress' });
probe('1x2 ringProgress @252x120（设计基准）', 252, 120, { size: '1x2', content: 'progress', style: 'ringProgress' });
probe('1xfull lunarDate @1080x120（设计基准）', 1080, 120, { size: '1xfull', content: 'timeDate', style: 'lunarDate' });
// 预览缩放：传同一实测尺寸 + singleScale，字号应为真实值 × scale
probe('1x1 lunarDate @113x114 预览 0.37x', 113, 114, { size: '1x1', content: 'timeDate', style: 'lunarDate', singleScale: 0.37 });

// B：没传几何（样式条小预览）→ 不得有 inline 字号，吃 CSS 兜底
{
  const wrap = mount(200, 200);
  render(renderInfoBlock({ ...base, singleRow: true, size: '1x1', content: 'timeDate', style: 'lunarDate' }), wrap);
  const single = wrap.querySelector('.pv-single');
  results.push({ name: 'no-geo（样式条小预览）', inline: single.getAttribute('style'), computed: getComputedStyle(single).fontSize });
}

// D：heatYear「今天」格 inline 背景（第二处 ElementPart 陷阱）
{
  const wrap = mount(252, 252);
  render(renderInfoBlock({ ...base, singleRow: true, size: '2x2', w: 252, h: 252, content: 'progress', style: 'heatYear' }), wrap);
  const now = wrap.querySelector('i.now');
  results.push({ name: 'heatYear 今天格', nowStyle: now ? now.getAttribute('style') : 'NO i.now', nowCls: now ? now.className : null });
}

window.__results = results;
window.__done = true;
} catch (e) {
  window.__fatal = String((e && e.stack) || e);
  window.__done = true;
}
</script>
</body></html>
`;

/* ---------------- 断言 ---------------- */
let pass = 0, fail = 0;
const ok = (cond, label, extra = '') => {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fail++; console.log('  ✗ ' + label + (extra ? '  [' + extra + ']' : '')); }
};

async function main() {
  writeFileSync(PAGE, PAGE_HTML);
  const server = await startServer();
  const port = server.address().port;
  const profile = path.join(TMP, 'chrome-lit-commit');
  const child = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=9226',
    '--user-data-dir=' + profile,
    '--window-size=1400,900', '--hide-scrollbars', '--disable-gpu', 'about:blank',
  ], { stdio: 'ignore' });
  child.on('error', (e) => { console.error('chrome spawn error', e); });

  let version = null;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch('http://127.0.0.1:9226/json/version');
      if (r.ok) { version = await r.json(); break; }
    } catch { /* retry */ }
    await sleep(500);
  }
  if (!version) { try { child.kill(); } catch {} server.close(); throw new Error('CDP endpoint not up in 30s'); }

  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', () => rej(new Error('ws connect failed')), { once: true });
  });
  const cdp = new CDP(ws);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  cdp.sessionId = sessionId;
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  const pageErrors = [];
  cdp.on && cdp.on((msg) => {
    if (msg.method === 'Runtime.exceptionThrown' && msg.params) {
      pageErrors.push((msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text || '').slice(0, 300));
    }
  });

  console.log('== 真 lit 提交回归（test-lit-commit） ==');
  await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/.tmp/lit-commit-test.html` });
  const t0 = Date.now();
  let done = false;
  while (Date.now() - t0 < 30000) {
    done = await cdp.evaluate('!!window.__done');
    if (done) break;
    await sleep(300);
  }
  if (!done) {
    const fatal = await cdp.evaluate('window.__fatal || "(无 __fatal，模块未执行)"');
    const errs = await cdp.evaluate('window.__errs || []');
    console.error('页面 30s 未跑完。__fatal = ' + fatal);
    if (errs.length) console.error('页面错误:\n' + errs.join('\n'));
    try { await cdp.send('Browser.close', {}, null); } catch { /* ignore */ }
    try { child.kill(); } catch { /* ignore */ }
    server.close();
    process.exit(1);
  }
  const fatal = await cdp.evaluate('window.__fatal || null');
  if (fatal) {
    console.error('页面模块致命错误:\n' + fatal);
    try { await cdp.send('Browser.close', {}, null); } catch { /* ignore */ }
    try { child.kill(); } catch { /* ignore */ }
    server.close();
    process.exit(1);
  }
  const results = await cdp.evaluate('window.__results');
  const byName = Object.fromEntries(results.map((r) => [r.name, r]));

  if (pageErrors.length) {
    console.log('页面异常:'); pageErrors.forEach((e) => console.log('  ' + e));
  }

  // A + C：几何传入 → inline 字号必须在，且 lunarDate 不裁切
  // v3.15 字号模型：u = min(SINGLE_BASE_PX[size], fitFontU(w-26, h-26, fitFor(...), [0.35×base, 4×base]))
  // （宿主 chrome = 26px：.widget padding 12×2 + 玻璃描边 1×2，CDP 实测）
  const expectPx = {
    '1x1 lunarDate @113x114（用户真实卡）': '13.65',   // min(16, 87/6.375)
    '1x1 lunarDate @76x76（1384px 视口）': '7.84',     // min(16, 50/6.375)
    '1x1 lunarDate @120x120（设计基准）': '14.75',     // min(16, 94/6.375)
    '1x1 lunarDate @60x60（极限小卡）': '5.60',        // 34/6.375=5.33 → 夹到 clamp 下限 0.35×16
    '2x2 lunarDate @252x252（设计基准）': '22.00',
    '1xfull lunarDate @1080x120（设计基准）': '17.91',
    '1x1 lunarDate @113x114 预览 0.37x': '5.05',       // 13.65×0.37
    // v3.15 CONTENT_FIT 修正 5 款（.tmp/measure-fit315.mjs 实测回写）
    '1x1 dayStack @113x114（用户真实卡）': '15.61',    // min(16, 87/5.575)
    '1x1 dayStack @120x120（设计基准）': '16.00',      // min(16, 94/5.575)=16.86 → 封顶
    '1x1 festivalDay @113x114（用户真实卡）': '16.00', // min(16, 87/5.375)=16.19 → 封顶
    '2x1 stackTime @113x238（用户真实卡）': '17.00',   // min(17, 87/3.975)=21.9 → 封顶（修复前回落 __default 8.3 → 10px）
    '2x1 stackTime @120x252（设计基准）': '17.00',
    '2x1 tallClock @113x238（用户真实卡）': '13.44',   // min(17, 87/6.475)
    '2x1 tallClock @120x252（设计基准）': '14.52',     // min(17, 94/6.475)
    '1x2 ringProgress @238x114（用户真实卡）': '17.00',// min(17, 212/9.975)=21.3 → 封顶（修复前 h 6.8 过期代理值 → 12.3px）
    '1x2 ringProgress @252x120（设计基准）': '17.00',
  };
  for (const [name, px] of Object.entries(expectPx)) {
    const r = byName[name];
    ok(!!r && r.inline && r.inline.includes(`font-size:${px}px`),
      `${name} → inline font-size:${px}px`, r ? `实际 inline=${r.inline}` : '缺用例');
  }
  for (const name of Object.keys(expectPx)) {
    const r = byName[name];
    if (!r || r.dayScrollW == null) continue;
    ok(r.dayScrollW <= r.dayClientW + 0.5,
      `${name} 「${r.dayText}」不裁切（scrollW=${r.dayScrollW} ≤ clientW=${r.dayClientW}）`);
  }

  // v3.15：所有探针用例的块级溢出断言（.pv-single overflow:hidden，scroll > client 即被裁）
  for (const r of results) {
    if (r.blkScrollW == null) continue;
    ok(r.blkScrollW <= r.blkClientW + 1 && r.blkScrollH <= r.blkClientH + 1,
      `${r.name} 块级不裁切（${r.blkScrollW}×${r.blkScrollH} ≤ ${r.blkClientW}×${r.blkClientH}）`);
  }

  // B：无几何 → 无 inline 字号（CSS 兜底 16px）
  {
    const r = byName['no-geo（样式条小预览）'];
    ok(!!r && r.inline === '' , 'no-geo 不得有 inline font-size', r ? `实际 inline=${JSON.stringify(r.inline)}` : '缺用例');
    ok(!!r && r.computed === '16px', 'no-geo 应吃 CSS 兜底 16px', r ? `实际 computed=${r.computed}` : '缺用例');
  }

  // D：heatYear 今天格
  {
    const r = byName['heatYear 今天格'];
    ok(!!r && !!r.nowStyle && /background:/.test(r.nowStyle),
      'heatYear 今天格必须有 inline 背景', r ? `实际 style=${JSON.stringify(r.nowStyle)} cls=${r.nowCls}` : '缺用例');
  }

  // E：源码扫描 —— 不得再出现「引号闭合后紧跟插值」
  {
    const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    const files = [];
    const walk = (d) => {
      for (const f of readdirSync(d)) {
        const p = path.join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.js$/.test(f)) files.push(p);
      }
    };
    walk(path.join(PROJECT, 'src'));
    const hits = [];
    for (const f of files) {
      readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
        if (/[^=]"\s*\$\{/.test(strip(line))) hits.push(path.relative(PROJECT, f) + ':' + (i + 1) + '  ' + line.trim().slice(0, 100));
      });
    }
    ok(hits.length === 0, '源码不得出现「引号闭合后紧跟插值」（lit ElementPart 静默丢弃）', hits.join(' | '));
  }

  console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
  try { await cdp.send('Browser.close', {}, null); } catch { /* ignore */ }
  try { child.kill(); } catch { /* ignore */ }
  try { ws.close(); } catch { /* ignore */ }
  server.close();
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('FATAL: ' + (e && e.stack || e)); process.exit(1); });
