// 无头 Chrome 小工具：测量渲染高度 + 按精确尺寸截图。
// 项目不引入 puppeteer/playwright（体积大、装不动），统一走本地 Chrome + file:// 。
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '../..');
export const TMP = path.join(ROOT, '.tmp');

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

/** 定位 Chrome 可执行文件；CHROME_PATH 环境变量优先。 */
export function chromePath() {
  for (const p of CANDIDATES) if (p && existsSync(p)) return p;
  throw new Error('找不到 Chrome。请设置 CHROME_PATH 环境变量指向 chrome 可执行文件。');
}

function tmpFile(name) {
  mkdirSync(TMP, { recursive: true });
  return path.join(TMP, name);
}

const BASE_ARGS = [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  '--disable-extensions',
  '--force-color-profile=srgb',
];

/**
 * 测量页面在给定视口宽度下的完整内容高度。
 * 做法：把目标 HTML 复制到 .tmp/ 并注入一段脚本，把 scrollHeight 写进
 * <pre id="__M">__MH__123__</pre>，再用 --dump-dom 取回。
 */
export function measureHeight(htmlPath, width, { dpr = 1 } = {}) {
  const src = readFileSync(htmlPath, 'utf8');
  const probe = `<pre id="__M" style="position:fixed;left:-9999px;top:0"></pre>
<script>
  addEventListener('load', () => {
    const h = Math.ceil(document.documentElement.scrollHeight || document.body.scrollHeight || 0);
    document.getElementById('__M').textContent = '__MH__' + h + '__';
  });
</script>`;
  const injected = src.includes('</body>')
    ? src.replace('</body>', `${probe}\n</body>`)
    : src + probe;
  const tmp = tmpFile('measure.html');
  writeFileSync(tmp, injected, 'utf8');

  const dom = execFileSync(chromePath(), [
    ...BASE_ARGS,
    `--window-size=${width},1200`,
    `--force-device-scale-factor=${dpr}`,
    '--virtual-time-budget=2000',
    '--dump-dom',
    pathToFileURL(tmp).href,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });

  const m = dom.match(/__MH__(\d+)__/);
  if (!m) throw new Error(`测量高度失败：${path.basename(htmlPath)} 未返回高度标记`);
  return Number(m[1]);
}

/**
 * 按精确尺寸截图（DPR 2 时输出像素为 2 倍）。
 * @param {{htmlPath:string,width:number,height:number,out:string,dpr?:number,virtualTimeMs?:number}} o
 */
export function shot({ htmlPath, width, height, out, dpr = 2, virtualTimeMs = 2000 }) {
  mkdirSync(path.dirname(out), { recursive: true });
  execFileSync(chromePath(), [
    ...BASE_ARGS,
    `--window-size=${width},${height}`,
    `--force-device-scale-factor=${dpr}`,
    `--virtual-time-budget=${virtualTimeMs}`,
    `--default-background-color=00000000`,
    `--screenshot=${out}`,
    pathToFileURL(htmlPath).href,
  ], { stdio: 'ignore' });

  if (!existsSync(out)) throw new Error(`截图未生成：${out}`);
  return out;
}

/** 一次性交付：测量 + 截图，返回 {out,width,height,pixelW,pixelH}。 */
export function shotFullPage({ htmlPath, width, out, dpr = 2, pad = 0 }) {
  const h = measureHeight(htmlPath, width, { dpr: 1 });
  const height = Math.max(1, h + pad);
  shot({ htmlPath, width, height, out, dpr });
  return { out, width, height, pixelW: width * dpr, pixelH: height * dpr };
}

/**
 * 把超长预览按竖向切片输出（一张 14000px 的图在聊天窗口里根本看不清，也无法定位）。
 * 每片高 sliceH（CSS px），最后一片按剩余高度截断。
 * 做法：注入 `html{margin-top:-Npx}` 把内容整体上移，再按片高截图。
 * @returns {{out:string,from:number,to:number,width:number,height:number,pixelW:number,pixelH:number}[]}
 */
export function shotSlices({ htmlPath, width, out, sliceH = 2400, dpr = 2, pad = 0 }) {
  if (!(sliceH > 0)) throw new Error('sliceH 必须为正数');
  const total = Math.max(1, measureHeight(htmlPath, width, { dpr: 1 }) + pad);
  const src = readFileSync(htmlPath, 'utf8');
  const ext = path.extname(out);
  const base = out.slice(0, out.length - ext.length);
  const total_ = Math.ceil(total / sliceH);
  const tiles = [];

  for (let i = 0; i < total_; i++) {
    const from = i * sliceH;
    const height = Math.min(sliceH, total - from);
    if (height <= 1) break;
    const shifted = from === 0
      ? src
      : (src.includes('</head>')
        ? src.replace('</head>', `<style>html{margin-top:-${from}px}</style></head>`)
        : `<style>html{margin-top:-${from}px}</style>` + src);
    const tmp = tmpFile('slice.html');
    writeFileSync(tmp, shifted, 'utf8');

    const tileOut = `${base}.part-${String(i + 1).padStart(2, '0')}${ext}`;
    shot({ htmlPath: tmp, width, height, out: tileOut, dpr });
    tiles.push({ out: tileOut, from, to: from + height, width, height, pixelW: width * dpr, pixelH: height * dpr });
  }
  return tiles;
}

