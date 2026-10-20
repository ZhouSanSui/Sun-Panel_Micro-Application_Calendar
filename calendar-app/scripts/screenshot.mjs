#!/usr/bin/env node
// 预览图生成：重新生成预览 HTML 后，用无头 Chrome 截成 PNG。
//
// 用法：
//   node scripts/screenshot.mjs                     # 重建预览并输出两张全页图
//   node scripts/screenshot.mjs --tile 2400         # 超长图按 2400px 竖切（推荐看拼图时用）
//   node scripts/screenshot.mjs --no-gen            # 不重建，直接截现有 HTML
//   node scripts/screenshot.mjs --html scripts/preview-single.html --width 1400 --out scripts/a.png
//
// 产物（均被 .gitignore 的 scripts/preview*.png 覆盖，不入库）
//   scripts/preview-single.png         单独模式（按尺寸版式）
//   scripts/preview.png                卡片模式拼图（很长，14380px）
//   scripts/preview.part-01.png …      仅在 --tile 时生成的分片
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { ROOT, shotFullPage, shotSlices } from './lib/chrome.mjs';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const width = Number(val('--width', 1600));
const dpr = Number(val('--dpr', 2));
const out = val('--out', null);
const onlyHtml = val('--html', null);
const tile = has('--tile') ? Number(val('--tile', 2400)) : 0;

function kb(p) {
  return `${(statSync(p).size / 1024).toFixed(1)} KB`;
}

if (!has('--no-gen') && !onlyHtml) {
  process.stdout.write('重置预览 HTML … ');
  execFileSync(process.execPath, ['scripts/make-preview.mjs'], { cwd: ROOT, stdio: 'ignore' });
  console.log('ok');
}

const targets = onlyHtml
  ? [{ html: path.resolve(ROOT, onlyHtml), png: path.resolve(ROOT, out || onlyHtml.replace(/\.html?$/, '.png')) }]
  : [
      { html: path.join(ROOT, 'scripts/preview-single.html'), png: path.join(ROOT, 'scripts/preview-single.png') },
      { html: path.join(ROOT, 'scripts/preview.html'), png: path.join(ROOT, 'scripts/preview.png') },
    ];

let failed = 0;
for (const t of targets) {
  if (!existsSync(t.html)) {
    console.error(`跳过（HTML 不存在）：${path.relative(ROOT, t.html)}`);
    failed += 1;
    continue;
  }
  const label = path.relative(ROOT, t.png);
  try {
    if (tile > 0) {
      const tiles = shotSlices({ htmlPath: t.html, width, out: t.png, sliceH: tile, dpr });
      if (!tiles.length) throw new Error('没有生成任何分片');
      for (const s of tiles) {
        console.log(`✓ ${path.relative(ROOT, s.out)}  ${s.pixelW}×${s.pixelH}px  (y ${s.from}-${s.to})  ${kb(s.out)}`);
      }
      console.log(`  ${label} 共 ${tiles.length} 片（每片 ${tile}px 高）`);
    } else {
      const r = shotFullPage({ htmlPath: t.html, width, out: t.png, dpr });
      console.log(`✓ ${label}  ${r.pixelW}×${r.pixelH}px (${width}×${r.height} @${dpr}x)  ${kb(t.png)}`);
    }
  } catch (e) {
    failed += 1;
    console.error(`✗ ${label}  ${e.message}`);
  }
}

process.exit(failed > 0 ? 1 : 0);
