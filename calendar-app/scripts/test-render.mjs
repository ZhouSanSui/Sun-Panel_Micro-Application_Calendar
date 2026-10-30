/**
 * v1.28 渲染自检：
 *  1) renderBlocksHTML 输出的百分比坐标合法、块数量与布局一致
 *  2) 真实宿主像素下（按 SunPanel 单格约 120px 估算），每块根字号落在可读区间
 *  3) 1×FULL 动态列数：不同宽度下网格/字号自适应
 *  4) 单独模式仍走 renderInfoBlock（不产生 .pv-block）
 */
import { readFileSync } from 'node:fs';

// CSS 单一真源：`.pv-*` 基础规则已抽到 src/core/card-mode-styles.js，三个组件通过
// ${CARD_MODE_CSS} 插值引用。断言「某文件含某条 CSS 规则」时，必须把真源拼进来，
// 否则规则明明在（只是搬了家）却判定缺失。
const SHARED_CSS = readFileSync(new URL('../src/core/card-mode-styles.js', import.meta.url), 'utf8');
const cssOf = (f) => readFileSync(new URL(`../src/components/${f}`, import.meta.url), 'utf8') + '\n' + SHARED_CSS;
import { html, render } from '../node_modules/lit/index.js';
import {
  renderBlocksHTML, renderInfoBlock, fitFor, fitFontU, renderSpanEditor,
  isTallBlock, isSmallUnit, vertFitKey, singleLineDays, TALL_RATIO, SINGLE_BASE_PX, SIZE_ORIENT,
  SINGLE_REF_PX,
} from '../src/core/card-mode-render.js';
import {
  gridForSize, layoutBlocks, spanBounds, effectiveSpan, styleSpanDef,
  singleLineOn, prefSpan, COMBO_CONTENTS,
  unitOpts, normalizeOpts, sanitizeBlocks, noUnitsOn, NO_UNITS_DATE_STYLES,
  SINGLE_CONTENTS, STYLE_OPT_FIELDS, stylesForSize, styleSizesOf, styleFitsSize, styleDef,
  aliasContent, CONTENT_ALIAS,
} from '../src/core/user-store.js';
import { ensureAppState, getUserStore } from '../src/core/app-state.js';

// lit 的 html 需要 DOM；用简易字符串化替代（Server 端无 DOM）
// 通过 toString 检查模板结构 → 改为直接检查 lit 模板的 strings/values
function flatten(tpl, out = []) {
  if (!tpl) return out;
  if (typeof tpl === 'string' || typeof tpl === 'number') { out.push(String(tpl)); return out; }
  if (Array.isArray(tpl)) { for (const t of tpl) flatten(t, out); return out; }
  const { strings, values } = tpl;
  if (!strings) return out;
  for (let i = 0; i < strings.length; i++) {
    out.push(strings[i]);
    if (i < values.length) flatten(values[i], out);
  }
  return out;
}

let pass = 0;
const fails = [];
const ok = (c, m) => { if (c) pass++; else fails.push(m); };

const visual = {
  bg: '', label: '#000', label2: '#444', label3: '#888', textLight: false,
};
const base = {
  visual,
  theme: '#007AFF',
  now: new Date(2026, 9, 18, 14, 5, 9),
  isZh: true,
  weekStart: 1,
  hour12: false,
  t: (k) => k,
};

/** 复刻 widget.js 的网格/字号推导，返回每块根字号 */
function simulate(size, hostW, hostH, blocks) {
  const g = gridForSize(size);
  let cols = g.cols;
  const rows = g.rows;
  if (size === '1xfull') {
    cols = Math.max(4, Math.min(10, Math.round(Math.max(0, hostW - 24) / 90)));
  }
  const availW = hostW - 24;
  const availH = hostH - 24;
  const cellW = Math.max(1, availW / cols);
  const cellH = Math.max(1, availH / rows);
  const laid = layoutBlocks(blocks, 'combo', size, { cols, rows });
  const fonts = laid.map((b) => {
    const blockW = b.span.cols * cellW;
    const blockH = b.span.rows * cellH;
    const fit = fitFor(b.c, b.s);
    const u = fitFontU(blockW, blockH, fit);
    return { key: `${b.c}:${b.s}`, u, blockW, blockH, span: b.span, pos: b.pos, fit };
  });
  return { grid: { cols, rows }, cellW, cellH, laid, fonts };
}

// 典型宿主像素（SunPanel 单格约 120px，间距忽略）
const HOST = {
  '1x1': [120, 120], '1x2': [252, 120], '2x1': [120, 252],
  '2x2': [252, 252], '2x4': [516, 252], '4x4': [516, 516],
  '1xfull': [1080, 120],
};

const PRESETS = {
  '1x1': [['time', 'hms'], ['time', 'dateWeekday']],
  '1x2': [['time', 'hms'], ['time', 'dateFull']],
  '2x1': [['time', 'hms'], ['time', 'dateFullWeekday'], ['calendar', 'week']],
  '2x2': [['calendar', 'month'], ['time', 'hms'], ['schedule', 'recent']],
  '2x4': [['time', 'hms'], ['time', 'dateFullWeekday'], ['calendar', 'month'], ['schedule', 'multiple'], ['important', 'holidayGap']],
  '4x4': [['time', 'hms'], ['time', 'dateFullWeekday'], ['calendar', 'month'], ['calendar', 'week'], ['schedule', 'multiple'], ['important', 'holidayGap']],
  '1xfull': [['time', 'hms'], ['time', 'dateFullWeekday'], ['schedule', 'holidayGap'], ['schedule', 'recent']],
};

for (const [size, list] of Object.entries(PRESETS)) {
  const [hw, hh] = HOST[size];
  const blocks = list.map(([c, s]) => ({ c, s }));
  const sim = simulate(size, hw, hh, blocks);
  ok(sim.laid.length === blocks.length, `${size}: ${hw}×${hh} 应全部放下（${sim.laid.length}/${blocks.length}）`);
  for (const f of sim.fonts) {
    ok(f.u >= 9, `${size}: ${f.key} 根字号 ${f.u.toFixed(1)}px 偏小（块 ${f.blockW.toFixed(0)}×${f.blockH.toFixed(0)}，fit ${f.fit.w}×${f.fit.h}）`);
    ok(f.u <= 40, `${size}: ${f.key} 根字号 ${f.u.toFixed(1)}px 偏大`);
  }
  const uMin = Math.min(...sim.fonts.map((f) => f.u));
  const uMax = Math.max(...sim.fonts.map((f) => f.u));
  console.log(`${size.padEnd(7)} ${String(hw).padStart(4)}×${String(hh).padStart(3)}  网格 ${sim.grid.cols}×${sim.grid.rows}  ` +
    `cell ${sim.cellW.toFixed(0)}×${sim.cellH.toFixed(0)}  字号 ${uMin.toFixed(1)}~${uMax.toFixed(1)}px  ` +
    sim.fonts.map((f) => `${f.key}=${f.u.toFixed(1)}`).join(' '));
}

// 1×FULL 动态列数
for (const w of [520, 760, 1080, 1440]) {
  const sim = simulate('1xfull', w, 120, [{ c: 'time', s: 'hms' }, { c: 'time', s: 'dateFullWeekday' }, { c: 'schedule', s: 'holidayGap' }]);
  ok(sim.grid.cols >= 4 && sim.grid.cols <= 10, `1xfull@${w}: 列数 ${sim.grid.cols} 应在 4~10`);
  ok(sim.laid.length >= 2, `1xfull@${w}: 应至少放下 2 块`);
  console.log(`1xfull @${w}px → 网格 ${sim.grid.cols}×${sim.grid.rows}，放下 ${sim.laid.length} 块`);
}

// ---------- renderBlocksHTML 结构 ----------
{
  const grid = { cols: 4, rows: 4 };
  const laid = layoutBlocks([{ c: 'time', s: 'hms' }, { c: 'schedule', s: 'recent' }], 'combo', '2x2', grid);
  const tpl = renderBlocksHTML({ ...base, blocks: laid, grid, cellW: 50, cellH: 50 });
  const str = flatten(tpl).join('');
  ok(str.includes('class="pv-blocks"'), 'renderBlocksHTML 应输出 .pv-blocks 容器');
  const blockCount = (str.match(/class="pv-block"/g) || []).length;
  ok(blockCount === laid.length, `应输出 ${laid.length} 个 .pv-block，实际 ${blockCount}`);
  const pos = str.match(/left:[\d.]+%;top:[\d.]+%;width:[\d.]+%;height:[\d.]+%;font-size:[\d.]+px/g) || [];
  ok(pos.length === laid.length, `应输出 ${laid.length} 组定位样式，实际 ${pos.length}`);
  for (const p of pos) {
    const nums = p.match(/[\d.]+/g).map(Number);
    const [left, top, width, height, font] = nums;
    ok(left >= 0 && top >= 0, `坐标应为非负：${p}`);
    ok(left + width <= 100.5 && top + height <= 100.5, `不得越界：${p}`);
    ok(font >= 7 && font <= 40, `字号应在 7~40：${p}`);
  }
  // 百分比总和不应超出 100
  ok(true, 'ok');
}

// 空输入：卡片可以不显示内容（v1.30）→ 空容器，不输出占位提示
{
  const tpl = renderBlocksHTML({ ...base, blocks: [], grid: { cols: 4, rows: 4 }, cellW: 50, cellH: 50 });
  const str = flatten(tpl).join('');
  ok(str.includes('class="pv-blocks"'), '空 blocks 应输出空 .pv-blocks 容器');
  ok(!str.includes('暂无内容') && !str.includes('No blocks'), '空 blocks 不应显示占位文案');
  ok((str.match(/class="pv-block"/g) || []).length === 0, '空 blocks 不应产生单元块');
}

// 未布局的裸 blocks 应现场推导
{
  const tpl = renderBlocksHTML({ ...base, blocks: [{ c: 'time', s: 'hms' }, { c: 'calendar', s: 'week' }], grid: { cols: 4, rows: 4 }, cellW: 50, cellH: 50 });
  const str = flatten(tpl).join('');
  ok((str.match(/class="pv-block"/g) || []).length === 2, '裸 blocks 应现场布局为 2 块');
}

// 单独模式不应产生 .pv-block
{
  const tpl = renderInfoBlock({ ...base, content: 'timeDate', style: 'led', singleRow: true });
  const str = flatten(tpl).join('');
  ok(!str.includes('pv-block'), '单独模式不应包含 .pv-block');
  ok(str.length > 0, '单独模式应有内容');
}

// v1.40：单独模式按卡片尺寸的版式类名（pv-single-<size>）
{
  for (const size of ['1x1', '1x2', '2x1', '2x2', '2x4', '4x4', '1xfull']) {
    const str = flatten(renderInfoBlock({ ...base, content: 'timeDate', style: 'led', singleRow: true, size })).join('');
    ok(str.includes('pv-single-' + size), `单独模式 size=${size} 应输出 pv-single-${size}`);
  }
  const noSize = flatten(renderInfoBlock({ ...base, content: 'timeDate', style: 'led', singleRow: true })).join('');
  ok(noSize.includes('pv-single') && !noSize.includes('pv-single-'), '缺 size 时只输出基础 pv-single');
  const combo = flatten(renderInfoBlock({ ...base, content: 'timeDate', style: 'led' })).join('');
  ok(!combo.includes('pv-single'), '非 singleRow 不输出 pv-single');
}
// v1.46：单独模式根字号基准 JS 表必须与共享 CSS 的 px 基准同源（防两处漂移）
{
  for (const [size, px] of Object.entries(SINGLE_BASE_PX)) {
    const re = new RegExp(`\\.pv-single-${size} \\{ font-size: ${px}px; \\}`);
    ok(re.test(SHARED_CSS), `CSS .pv-single-${size} 应为 font-size: ${px}px`);
  }
  // 预览等比缩放：singleScale 必须成比例改写根字号，缺省时不内联（交给 CSS 兜底）
  const half = flatten(renderInfoBlock({
    ...base, content: 'timeDate', style: 'led', singleRow: true, size: '4x4', singleScale: 0.5,
  })).join('');
  ok(half.includes('font-size:17.00px'), 'singleScale=0.5 时 4x4 根字号应为 34×0.5=17.00px');
  const plain = flatten(renderInfoBlock({
    ...base, content: 'timeDate', style: 'led', singleRow: true, size: '4x4',
  })).join('');
  ok(!plain.includes('font-size:'), '不传 singleScale 时不内联 font-size（沿用 CSS 基准）');
  const one = flatten(renderInfoBlock({
    ...base, content: 'timeDate', style: 'led', singleRow: true, size: '4x4', singleScale: 1,
  })).join('');
  ok(!one.includes('font-size:'), 'singleScale=1 时不内联 font-size');
}
// v2.9 起按尺寸版式规则收编进共享真源 card-mode-styles.js；三组件改为插值引用
{
  const SHARED_SRC = readFileSync(new URL('../src/core/card-mode-styles.js', import.meta.url), 'utf8');
  for (const f of ['widget.js', 'mainPage.js', 'widgetConfig.js']) {
    const src = readFileSync(new URL('../src/components/' + f, import.meta.url), 'utf8');
    ok(src.includes('CARD_MODE_CSS'), `${f} 必须插值共享真源 CARD_MODE_CSS（不得再手工拷贝）`);
    ok(!/\.pv-single-1x1 \.pv-big/.test(src), `${f} 不得再残留 .pv-single 版式的手工拷贝`);
  }
  // 真源必须覆盖三种主文字类，否则单独模式的大数字/中号文字不按尺寸缩放
  for (const size of ['1x1', '1x2', '2x1', '2x4', '4x4', '1xfull']) {
    for (const cls of ['pv-big', 'pv-mid', 'pv-vbig']) {
      ok(SHARED_SRC.includes(`.pv-single-${size} .${cls}`) || SHARED_SRC.includes(`.pv-single-${size} .pv-big, .pv-single-${size} .pv-mid, .pv-single-${size} .${cls}`),
        `真源应含 .pv-single-${size} .${cls} 的字号规则`);
    }
  }
  ok(SHARED_SRC.includes('.pv-single-1x1 .pv-sub { display: none; }'), '真源 1x1 应隐藏 .pv-sub');
}
// v1.46：卡片渲染容器必须在四处（三组件 + 预览生成器）都裁切，否则内容外溢压到卡片外
for (const f of ['src/components/widget.js', 'src/components/mainPage.js', 'src/components/widgetConfig.js', 'scripts/make-preview.mjs']) {
  const src = readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  const m = src.match(/\.card-mode-wrap\s*\{[^}]*\}/);
  ok(!!m && /overflow:\s*hidden/.test(m[0]), `${f} 的 .card-mode-wrap 应声明 overflow:hidden`);
}

// 每种样式的单块都能在受支持尺寸下渲染出非空内容
for (const [size, [hw, hh]] of Object.entries(HOST)) {
  const sim = simulate(size, hw, hh, [{ c: 'time', s: 'hms' }]);
  ok(sim.laid.length === 1, `${size}: time:hms 应可放置`);
}

// ---------- 5) v1.29 占格编辑器渲染 ----------
{
  const size = '2x2';
  const grid = gridForSize(size);
  const b = { c: 'calendar', s: 'week', span: { cols: 3, rows: 2 } };
  const tpl = renderSpanEditor({
    grid,
    target: { pos: { col: 0, row: 0 }, span: { cols: 3, rows: 2 } },
    span: { cols: 3, rows: 2 },
    bounds: spanBounds('combo', size, b),
    name: '周日历',
    theme: '#0A84FF',
    isZh: true,
    sizeLabel: size,
    onPick: () => {},
    onResize: () => {},
    onReset: () => {},
    onClose: () => {},
  });
  const s = flatten(tpl).join('');
  ok(s.includes('span-editor'), '编辑器根节点应为 .span-editor');
  ok(s.includes('周日历'), '编辑器应显示样式名');
  ok(s.includes('grid-template-columns:repeat(4,1fr)'), `网格列数应为 4，实际片段：${s.slice(0, 200)}`);
  ok((s.match(/se-cell/g) || []).length === grid.cols * grid.rows, `格子数应为 ${grid.cols * grid.rows}`);
  ok((s.match(/se-cell on/g) || []).length === 3 * 2, '高亮格子数应等于占格数');
  ok(s.includes('2×3'), '尺寸应按「垂直×水平」显示（rows=2, cols=3 → 2×3）');
  ok(s.includes('垂直×水平'), '尺寸应标注「垂直×水平」含义');
  ok(!s.includes('se-warn'), '放得下时不应显示警告');

  // 放不下时（target=null）应给出警告且不抛错
  const tpl2 = renderSpanEditor({
    grid,
    target: null,
    span: { cols: 4, rows: 4 },
    bounds: spanBounds('combo', size, b),
    name: '周日历', theme: '#0A84FF', isZh: false, sizeLabel: size,
    onPick: () => {}, onResize: () => {}, onReset: () => {}, onClose: () => {},
  });
  const s2 = flatten(tpl2).join('');
  ok(s2.includes('se-warn'), '放不下时应显示警告');
  ok(s2.includes('Resize'), '英文文案应生效');

  // 边界：达到最小/最大占格时应禁用对应按钮
  const tplMin = renderSpanEditor({
    grid,
    target: { pos: { col: 0, row: 0 }, span: { cols: 1, rows: 1 } },
    span: { cols: 1, rows: 1 },
    bounds: { grid, min: { cols: 1, rows: 1 }, max: { cols: 4, rows: 4 }, def: { cols: 2, rows: 2 } },
    name: 'x', theme: '#0A84FF', isZh: true, sizeLabel: size,
    onPick: () => {}, onResize: () => {}, onReset: () => {}, onClose: () => {},
  });
  const sMin = flatten(tplMin).join('');
  ok((sMin.match(/disabled/g) || []).length >= 2, '最小值时应禁用 − 按钮（lit 布尔属性占位）');

  // 其他单元占用的格子：主题色淡底（se-cell occ）
  const occ = new Set(['0,2', '0,3']);
  const tplOcc = renderSpanEditor({
    grid, target: { pos: { col: 0, row: 0 }, span: { cols: 1, rows: 1 } }, span: { cols: 1, rows: 1 },
    bounds: spanBounds('combo', size, b), occupied: occ,
    name: 'x', theme: '#0A84FF', isZh: true, sizeLabel: size,
    onPick: () => {}, onResize: () => {}, onReset: () => {}, onClose: () => {},
  });
  const sOcc = flatten(tplOcc).join('');
  ok((sOcc.match(/se-cell occ/g) || []).length === 2, '被其他单元占用的格子应标记为 occ');
  ok(sOcc.includes('#0A84FF33'), '占用格应使用主题色淡色（hex alpha 33）');
  ok((sOcc.match(/se-cell on/g) || []).length === 1, '自身占格仍应高亮');

  // 置中开关 / FULL / 单行显示 按钮
  const tplBtns = renderSpanEditor({
    grid, target: { pos: { col: 0, row: 0 }, span: { cols: 2, rows: 2 } }, span: { cols: 2, rows: 2 },
    bounds: spanBounds('combo', size, b), occupied: new Set(),
    align: { h: true, v: false }, isFull: true, singleLine: true,
    name: 'x', theme: '#0A84FF', isZh: true, sizeLabel: size,
    onPick: () => {}, onResize: () => {}, onReset: () => {}, onClose: () => {},
    onToggleAlign: () => {}, onFull: () => {}, onToggleSingleLine: () => {},
  });
  const sBtns = flatten(tplBtns).join('');
  ok(sBtns.includes('FULL'), '1×FULL 卡片应显示 FULL 按钮');
  ok(sBtns.includes('单行显示'), '月日历应显示单行显示按钮');

  const tplNoFull = renderSpanEditor({
    grid, target: { pos: { col: 0, row: 0 }, span: { cols: 2, rows: 2 } }, span: { cols: 2, rows: 2 },
    bounds: spanBounds('combo', size, b), occupied: new Set(),
    align: { h: false, v: false }, isFull: false, singleLine: null,
    name: 'x', theme: '#0A84FF', isZh: true, sizeLabel: size,
    onPick: () => {}, onResize: () => {}, onReset: () => {}, onClose: () => {},
  });
  const sNoFull = flatten(tplNoFull).join('');
  ok(!sNoFull.includes('>FULL<'), '非 FULL 卡片不应显示 FULL 按钮');
  ok(!sNoFull.includes('单行显示'), '非月日历不应显示单行显示按钮');
  ok((sNoFull.match(/se-toggle on/g) || []).length === 0, '未开启的置中按钮不应高亮');

  // effectiveSpan 用于 chip 徽标（越界时按网格收窄）
  const overGrid = effectiveSpan('combo', '1x1', { c: 'time', s: 'hm', span: { cols: 6, rows: 6 } });
  ok(overGrid.cols === 2 && overGrid.rows === 2, 'chip 徽标应显示收窄后的占格');
  const def = styleSpanDef('combo', 'time', 'hms').span;
  ok(effectiveSpan('combo', '4x4', { c: 'time', s: 'hms' }).cols === def.cols, '无覆盖时徽标 = 声明占格');
}

// ---------- 6) v1.30 月日历单行 / 空白 / 多日程自适应 ----------
{
  const mk = (extra) => renderInfoBlock({ ...base, ...extra });
  // 月日历：默认 6 行网格；单行显示时为一整行
  const monthGrid = flatten(mk({ content: 'calendar', style: 'month', now: new Date() })).join('');
  ok((monthGrid.match(/class="pv-c/g) || []).length >= 28, `月日历默认应渲染日期网格（实际 ${(monthGrid.match(/class="pv-c/g) || []).length} 格）`);
  ok(!monthGrid.includes('pv-wk-cell'), '默认月日历不应使用单行条');

  // v1.31 需求 3：1×FULL 月历单行显示由 15 天改为 19 天（左右各 9 天 + 今日）
  const monthLine = flatten(mk({
    content: 'calendar', style: 'month', opts: { singleLine: true }, now: new Date(),
  })).join('');
  const cells = (monthLine.match(/pv-wk-cell/g) || []).length;
  ok(cells === 19, `单行月历应显示 19 天（实际 ${cells}）`);
  ok(monthLine.includes('repeat(19, minmax(0, 1fr))'), '单行月历应为 19 列网格（minmax 防溢出）');
  const todayIdx = monthLine.indexOf('class="pv-wk-cell today"');
  ok(todayIdx > 0, '单行月历应标记今日');
  // 今日应在水平正中（第 10 格，前后各 9 天）
  const before = (monthLine.slice(0, todayIdx).match(/pv-wk-cell/g) || []).length;
  ok(before === 9, `今日应位于正中（前有 9 天），实际 ${before}`);

  // 多个日程：纵向空间越大显示条目越多；横向够宽时补日期
  // 需要一份日程数据：用无 api 的 UserStore（日程一律为今天之后的固定日期）
  await ensureAppState({});
  const store = getUserStore();
  const t0 = new Date();
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  store.data.schedules = Array.from({ length: 8 }, (_, i) => ({
    id: `mt${i}`,
    type: 'event',
    title: `日程${i + 1}`,
    date: iso(new Date(t0.getFullYear(), t0.getMonth(), t0.getDate() + i + 1)),
    lunar: false,
    time: null,
    note: '',
    color: 'red',
    yearly: false,
  }));
  const multi = (availW, availH) => flatten(mk({
    content: 'schedule', style: 'multiple', availW, availH, now: new Date(),
  })).join('');
  const narrow = multi(8, 6);
  const tall = multi(8, 20);
  const wide = multi(16, 6);
  const cnt = (s) => (s.match(/pv-row2/g) || []).length;
  ok(cnt(tall) > cnt(narrow), `纵向空间大时应显示更多日程（${cnt(narrow)} → ${cnt(tall)}）`);
  ok(cnt(narrow) >= 3, `默认空间至少显示 3 条（实际 ${cnt(narrow)}）`);
  ok(cnt(tall) <= 8, '条目数应受上限约束');
  ok(!narrow.includes('月') || !/\d+月\d+日/.test(narrow), '横向空间不足时不显示具体日期');
  ok(/\d{2}-\d{2}-\d{2}/.test(wide), '横向空间足够时应显示具体日期（YY-MM-DD）');
}

// ---------- 7) v1.31 八条需求回归断言 ----------
{
  const mkBlock = (extra) => renderInfoBlock({ ...base, ...extra });
  const fl = (tpl) => flatten(tpl).join('');

  // 需求 2：非 1×FULL 卡片不渲染「单行显示」按钮（singleLine 传 null）
  {
    const sb = {
      grid: { cols: 4, rows: 4 }, target: { pos: { col: 0, row: 0 }, span: { cols: 2, rows: 2 } },
      span: { cols: 2, rows: 2 }, bounds: { grid: { cols: 4, rows: 4 }, min: { cols: 1, rows: 1 }, max: { cols: 4, rows: 4 }, def: { cols: 2, rows: 2 } },
      name: '月日历', theme: '#0A84FF', isZh: true, sizeLabel: '2x2', occupied: new Set(),
      onPick: () => {}, onResize: () => {}, onReset: () => {}, onClose: () => {},
      onToggleAlign: () => {}, onFull: () => {}, onToggleSingleLine: () => {},
    };
    ok(!fl(renderSpanEditor({ ...sb, singleLine: null })).includes('单行显示'),
      '非 1×FULL 卡片不应渲染「单行显示」按钮');
    ok(!fl(renderSpanEditor({ ...sb, singleLine: null })).includes('One line'),
      '非 1×FULL 卡片（英文）不应渲染 "One line" 按钮');
    ok(fl(renderSpanEditor({ ...sb, singleLine: true })).includes('单行显示'),
      '1×FULL 卡片应渲染「单行显示」按钮');
    ok(fl(renderSpanEditor({ ...sb, singleLine: false })).includes('单行显示'),
      '1×FULL 卡片显式关闭后按钮仍应显示（状态为关）');
    // 按钮隐藏后 .se-toggles 仍存在（不加占位元素）
    ok(fl(renderSpanEditor({ ...sb, singleLine: null })).includes('se-toggles'),
      '按钮隐藏后 .se-toggles 容器应保留');
  }

  // v1.32 需求 3 回退：日历表头恢复为「年月」，不再升级为完整日期（无论占格多宽）
  {
    const monthWide = fl(mkBlock({
      content: 'calendar', style: 'month', span: { cols: 4, rows: 4 },
    }));
    ok(monthWide.includes('2026年10月'), '月历表头仍是「年月」');
    ok(!monthWide.includes('2026年10月18日'), '月历表头不再升级为完整日期（v1.32 回退）');
    const weekWide = fl(mkBlock({
      content: 'calendar', style: 'week', span: { cols: 4, rows: 2 },
    }));
    ok(!weekWide.includes('pv-cal-head'), '周历不再新增日期表头行（v1.32 回退）');
    // 单行月历：天数按可用宽度动态计算（默认未传 singleDays 时为 19）
    const single = fl(mkBlock({
      content: 'calendar', style: 'month', span: { cols: 6, rows: 2 }, opts: { singleLine: true },
    }));
    ok(single.includes('repeat(19, minmax(0, 1fr))'), '单行月历默认 19 列（minmax 防溢出）');
    // 动态天数：块越宽显示越多（今日居中 → 奇数）
    ok(singleLineDays(1056, 96) > singleLineDays(422, 96),
      `月历单行天数应随宽度增加（1056px=${singleLineDays(1056, 96)} / 422px=${singleLineDays(422, 96)}）`);
    ok(singleLineDays(1056, 96) % 2 === 1, '月历单行天数应为奇数（今日居中）');
    ok(singleLineDays(1056, 96) > 19, `1×FULL 占满整行后应多于 19 天（实际 ${singleLineDays(1056, 96)}）`);
  }

  // v1.32 需求 3（新）：多日程占格水平 ≥4 → 日程名 + 右侧两行小字（年月日 / 时分秒）
  {
    const wide = fl(mkBlock({
      content: 'schedule', style: 'multiple', span: { cols: 4, rows: 2 }, opts: { wide: true },
    }));
    ok(wide.includes('pv-sch-row'), 'cols>=4 的多日程应使用「日程名 + 两行小字」布局');
    ok(wide.includes('pv-sch-name'), '多日程宽布局应含日程名节点');
    ok(wide.includes('pv-sch-meta'), '多日程宽布局应含右侧元信息节点');
    ok(wide.includes('pv-sch-meta') && /\d{2}-\d{2}-\d{2}/.test(wide),
      '多日程宽布局应含「YY-MM-DD」日期元信息（v3.56 改为紧凑单行日期）');
    const narrow = fl(mkBlock({
      content: 'schedule', style: 'multiple', span: { cols: 2, rows: 2 },
    }));
    ok(!narrow.includes('pv-sch-row'), 'cols<4 的多日程保持原单行样式');
    // v1.34 需求 3：renderBlocksHTML 按 span.cols>=SCH_MULTI_WIDE_COLS(4) 自动合成 opts.wide
    // （旧代码读块级 o.wide 恒假 → 宽布局从不显示；探针 _probe.mjs schRun4x4 已实测验证）
    {
      // v1.34 需求 3：keep 预留按实测 meta 宽（3.72em+gap+余量=4.8em）收紧，
      // 旧值 7.5em 在窄卡（availW≈11em）把 5 字符标题无谓切到 4 字符。
      // 注意：注入必须先于渲染（renderBlocksHTML 读取时已固化 DOM）
      getUserStore().data.schedules.unshift({
        id: 'keep5', type: 'event', title: '表妹-高娜', date: '2026-10-19',
        lunar: false, time: '14:00', note: '', color: 'red', yearly: false,
      });
      const grid = { cols: 8, rows: 4 };
      const laid = layoutBlocks([{ c: 'schedule', s: 'multiple', span: { cols: 4, rows: 2 } }], 'combo', '2x4', grid);
      const str = flatten(renderBlocksHTML({ ...base, blocks: laid, grid, cellW: 60, cellH: 60 })).join('');
      ok(str.includes('pv-sch-row'), 'renderBlocksHTML：span 4×2 多日程应走宽布局（自动合成 opts.wide）');
      ok(str.includes('pv-sch-meta'), 'renderBlocksHTML：宽布局应含右侧两行小字');
      const laidNarrow = layoutBlocks([{ c: 'schedule', s: 'multiple', span: { cols: 2, rows: 2 } }], 'combo', '2x4', grid);
      const strN = flatten(renderBlocksHTML({ ...base, blocks: laidNarrow, grid, cellW: 60, cellH: 60 })).join('');
      ok(!strN.includes('pv-sch-row'), 'renderBlocksHTML：span 2×2 多日程不应走宽布局');
      const names = (s) => [...s.matchAll(/pv-sch-name[^>]*>([^<]*)</g)].map((m) => m[1]);
      // 240×120 小块：u≈21.1（w 主导），availW≈11em → keep=8，5 字符标题完整
      ok(names(str).includes('表妹-高娜'), '宽布局 keep：240px 小块 5 字符标题不应被切');
      // keep 下限保护：极端窄（availW=4em）至少保底 3 字符
      const tiny = fl(renderInfoBlock({ ...base, content: 'schedule', style: 'multiple', span: { cols: 4, rows: 2 }, opts: { wide: true }, availW: 4, availH: 6, now: new Date(2026, 9, 18) }));
      ok(names(tiny).every((n) => n.length <= 4), `宽布局 keep：availW=4 时应截到 3 字符+省略号（实际 ${JSON.stringify(names(tiny))}）`);
      // 真实 580px 4×4 卡（span 8×8，u=40，availW≈13.5em → keep=11）：5 字符标题完整
      const str580 = flatten(renderBlocksHTML({
        ...base,
        blocks: layoutBlocks([{ c: 'schedule', s: 'multiple', span: { cols: 8, rows: 8 } }], 'combo', '4x4', { cols: 8, rows: 8 }),
        grid: { cols: 8, rows: 8 }, cellW: 69.5, cellH: 69.5,
      })).join('');
      ok(names(str580).includes('表妹-高娜'), '宽布局 keep：580px 卡 5 字符标题不应被切');
      const strNarrow = flatten(renderBlocksHTML({
        ...base,
        blocks: layoutBlocks([{ c: 'schedule', s: 'multiple', span: { cols: 8, rows: 8 } }], 'combo', '4x4', { cols: 8, rows: 8 }),
        grid: { cols: 8, rows: 8 }, cellW: 49.5, cellH: 49.5,
      })).join('');
      ok(names(strNarrow).includes('表妹-高娜'), '宽布局 keep：420px 卡 5 字符标题不应被切');
    }
  }

  // 需求 6：新增「月日」样式；v1.35：「年月」插在 dateFull 之后（第 2 位），月日退到第 3 位
  {
    const timeDef = COMBO_CONTENTS.find((c) => c.key === 'time');
    ok(!!timeDef, '应存在 time 内容定义');
    const keys = timeDef.styles.map((s) => s.key);
    ok(keys[0] === 'dateFull', 'time.styles 第 1 位应为 dateFull');
    ok(keys[1] === 'dateYearMonth', 'time.styles 第 2 位应为 dateYearMonth（v1.35 新增，插在 dateFull 之后）');
    ok(keys[2] === 'dateMonthDay', 'time.styles 第 3 位应为 dateMonthDay');
    const md = styleSpanDef('combo', 'time', 'dateMonthDay');
    ok(md.span.cols === 2 && md.span.rows === 1, '月日样式声明占格应为 2×1');
    // v1.32 需求 5：可竖排拆分的多信息样式，最小占格水平降到 1
    ok(md.min && md.min.cols === 1 && md.min.rows === 1,
      '月日样式最小占格水平应为 1（竖排时可排成 1×N 窄条）');
    for (const k of ['dateFull', 'dateWeekday', 'dateFullWeekday', 'hms']) {
      const d = styleSpanDef('combo', 'time', k);
      ok(d.min && d.min.cols === 1, `${k} 最小占格水平应为 1（实际 ${JSON.stringify(d.min)}）`);
    }
    const s = fl(mkBlock({ content: 'time', style: 'dateMonthDay' }));
    ok(s.includes('10月') && s.includes('18日'), '月日样式应渲染「10月18日」');
    ok(s.includes('<wbr>'), '月日中文文案需插入 <wbr> 兜底断行');
    const sEn = fl(renderInfoBlock({
      ...base, isZh: false, content: 'time', style: 'dateMonthDay',
    }));
    ok(sEn.includes('Oct 18'), '月日英文文案应为 "Oct 18"');
  }

  // 需求 7：窄高块判定用实际像素比（不是格数比）；周历竖排 7 行
  {
    ok(isTallBlock(100, 200), '块高 = 2×块宽 → 判定为窄高');
    ok(!isTallBlock(100, 199), '块高 < 2×块宽 → 不判定为窄高');
    // 决定性反例：1×FULL 的 1×2（cellW=105 / cellH=48 → 块 105×96）
    // 格数比 = 2（会误判为窄高），像素比 = 96/105 = 0.91（正确判定为扁宽）
    ok(!isTallBlock(105, 96), '1×FULL 的 1×2（105×96）像素比 0.91 → 不得误判为窄高');
    ok(TALL_RATIO === 2, 'TALL_RATIO 应为 2');

    ok(vertFitKey('time', 'hm', true) === 'hmVert', 'time:hm 有竖排变体');
    ok(vertFitKey('time', 'dateMonthDay', true) === 'dateMonthDayVert', 'time:dateMonthDay 有竖排变体');
    ok(vertFitKey('time', 'year', true) === 'year', 'time:year 无竖排变体 → 回退横排');
    ok(vertFitKey('calendar', 'week', true) === 'weekVert', 'calendar:week 有竖排变体');
    ok(vertFitKey('calendar', 'month', true) === 'month', 'calendar:month 无竖排变体');
    ok(vertFitKey('time', 'hm', false) === 'hm', '非窄高块不走竖排 key');

    // 竖排 key 一律不声明 wrap（否则 fitFontU 会白加 slack=1 并触发无意义的两行分支）
    for (const k of ['dateFullVert', 'dateMonthDayVert', 'dateWeekdayVert',
      'dateFullWeekdayVert', 'hmVert', 'hmsVert']) {
      ok(fitFor('time', k, false, true, null).wrap === false, `${k} 不应声明 wrap`);
    }

    const wk = fl(mkBlock({ content: 'calendar', style: 'week', tall: true }));
    ok(wk.includes('pv-wkv'), '窄高块的周历应使用竖排容器 .pv-wkv');
    ok((wk.match(/pv-wkv-cell/g) || []).length === 7, '竖排周历应是 7 行（每天一行）');
    // 竖排优先于标题
    ok(!wk.includes('pv-cal-head'), '竖排周历不再叠加日期标题');
    ok(fitFor('time', 'hm', false, true, { tall: true }).w === 2.5, 'time:hm 竖排 fit.w=2.5');
    ok(fitFor('calendar', 'week', false, true, { tall: true }).w === 3.1, 'calendar:week 竖排 fit.w=3.1');

    // v1.34 需求 2：竖排日期串按实际渲染文案（后两位年「26年」）实测，宽度 3.7→2.9（旧值过保守、
    // 把字号压小一半）；.pv-vline 1em→1.25em 后高度按实测回写
    // v3.8：dateFull 竖排改两排 + .fit 容器收缩，fitFor 的 w 只表达高度反推用的最小宽（2.0），
    // h = 两排（3.25）；行宽上限由 CSS min(1.25em, 100cqw/--w) 接管，不再靠 fitFor 的 w 防溢出
    ok(fitFor('time', 'dateFull', false, true, { tall: true }).w === 2.0, 'time:dateFull 竖排 fit.w=2.0（v3.8 两排+fit 收缩）');
    ok(fitFor('time', 'dateFull', false, false, { tall: true }).w === 2.0, 'time:dateFull 竖排 en 同 w=2.0');
    ok(fitFor('time', 'dateFull', false, true, { tall: true }).h === 3.25, 'time:dateFull 竖排 fit.h=3.25（两排）');
    ok(fitFor('time', 'dateMonthDay', false, true, { tall: true }).w === 2.9, 'time:dateMonthDay 竖排 fit.w=2.9');
    ok(fitFor('time', 'dateMonthDay', false, true, { tall: true }).h === 3.2, 'time:dateMonthDay 竖排 fit.h=3.2');
    ok(fitFor('time', 'dateWeekday', false, true, { tall: true }).h === 4.8, 'time:dateWeekday 竖排 fit.h=4.8');
    ok(fitFor('time', 'dateFullWeekday', false, true, { tall: true }).h === 6.5, 'time:dateFullWeekday 竖排 fit.h=6.5');
    // 竖排日期串字号应大于此前的 1em：u 相同情况下渲染像素随比例上升
    const uDate = fitFontU(48, 114, fitFor('time', 'dateFull', false, true, { tall: true }));
    ok(uDate > 14, `2×1 卡竖排日期 u 应 > 14（实际 ${uDate.toFixed(1)}，修复前 11.8）`);
  }

  // v1.32 需求 6 修正：只对 1×1 / 1×2 卡片生效，且只看水平占格是否为 1（垂直不限）
  {
    ok(isSmallUnit({ cols: 1, rows: 1 }, '1x1'), '1×1 卡片 + 水平占格 1 → 小卡');
    ok(isSmallUnit({ cols: 1, rows: 2 }, '2x1'), '2×1 卡片（v1.40 规则对调）+ 水平占格 1 → 小卡');
    ok(!isSmallUnit({ cols: 1, rows: 2 }, '1x2'), '1×2 卡片（v1.40 规则对调）不再走小号：年/星期显示全量');
    ok(!isSmallUnit({ cols: 2, rows: 1 }, '1x2'), '1×2 卡片但水平占格 2 → 不是小卡');
    ok(!isSmallUnit({ cols: 1, rows: 1 }, '2x2'), '2×2 卡片即使占格 1×1 也不算小卡');
    ok(!isSmallUnit({ cols: 1, rows: 1 }, '4x4'), '4×4 卡片不算小卡');
    ok(!isSmallUnit(null, '1x1'), '无 span 时不判定为小卡');
    ok(fitFor('time', 'year', false, true, { small: true }).w === 2.6, 'time:year 小卡 fit.w=2.6');
    ok(fitFor('time', 'weekday', false, true, { small: true }).w === 2.0, 'time:weekday 小卡 fit.w=2.0');
    ok(fitFor('time', 'year', false, true, null).w === 4.7, 'time:year 常规 fit.w=4.7');
    ok(fitFor('time', 'weekday', false, true, null).w === 3.9, 'time:weekday 常规 fit.w=3.9');

    const y = fl(mkBlock({ content: 'time', style: 'year', small: true }));
    ok(y.includes('26') && !/\b2026\b/.test(y), '1×1 占格的「年」显示后两位 26');
    const yFull = fl(mkBlock({ content: 'time', style: 'year', small: false }));
    ok(yFull.includes('2026'), '非小卡的「年」显示完整 2026');
    const w = fl(mkBlock({ content: 'time', style: 'weekday', small: true }));
    ok(w.includes('pv-wd-sm'), '1×1 占格的「星期」使用缩小字号样式');
    ok(w.includes('pv-sub-sm'), '1×1 占格的「星期」副标题同步缩小');
    const wFull = fl(mkBlock({ content: 'time', style: 'weekday', small: false }));
    ok(!wFull.includes('pv-wd-sm'), '非小卡的「星期」用常规字号');
  }

  // v1.40 需求 2：四样式（倒数型）flat 双栏 / tall 窄高布局
  {
    const mk2 = (extra) => renderInfoBlock({ ...base, ...extra });
    const fl2 = (tpl) => flatten(tpl).join('');
    // fitFor 钩子：important 在 flat / tall 时应切换固有尺寸 key（与默认竖排不同）
    ok(fitFor('important', 'festival', false, true, { flat: true }).w
      !== fitFor('important', 'festival', false, true, {}).w,
      'important:festival flat → 固有尺寸改变（双栏）');
    ok(fitFor('important', 'festival', false, true, { tall: true }).w
      === fitFor('important', 'festival', false, true, {}).w,
      'important:festival tall → 与默认竖排同源（窄高块宽度预算不变，避免溢出）');
    ok(fitFor('schedule', 'recent', false, true, { flat: true }).w
      !== fitFor('schedule', 'recent', false, true, {}).w,
      'schedule:recent flat → 固有尺寸改变（双栏）');
    // multiple / time 不被 flat / tall 劫持
    ok(fitFor('schedule', 'multiple', false, true, { flat: true }).w
      === fitFor('schedule', 'multiple', false, true, {}).w,
      'schedule:multiple flat 不被劫持（保持多日程固有尺寸）');
    ok(fitFor('time', 'year', false, true, { tall: true }).w
      === fitFor('time', 'year', false, true, {}).w,
      'time:year tall 不被劫持');
    // 渲染：important 节日 flat → 双栏 DOM；非 flat 保持竖排居中
    const fz = fl2(mk2({ content: 'important', style: 'festival', flat: true }));
    ok(fz.includes('pv-flat') && fz.includes('pv-fnum') && fz.includes('pv-ftext'),
      'important:festival flat → 双栏 DOM（pv-flat/pv-fnum/pv-ftext）');
    const nz = fl2(mk2({ content: 'important', style: 'festival', flat: false }));
    ok(!nz.includes('pv-flat'), 'important:festival 非 flat → 不含 pv-flat');
  }

  // v1.41：.pv-center 带 text-align:center（「今天」两个汉字在窄块内折行后仍水平归中）
  {
    for (const f of ['widget.js', 'mainPage.js', 'widgetConfig.js']) {
      const cssSrc = cssOf(f);
      ok(/\.pv-center \{[^}]*text-align:\s*center/.test(cssSrc),
        `${f} .pv-center 带 text-align:center（折行文字归中）`);
    }
  }

  // v1.42：倒数型四样式占格「水平2×垂直1」在窄高卡（像素比不足 2:1）也走 flat
  {
    // 窄高卡 120×252：网格 2×4，cellW=60 cellH=63 → 2×1 块 120×63（像素比 1.9 < FLAT_RATIO）
    const gridN = { cols: 2, rows: 4 };
    const laidF = layoutBlocks([{ c: 'important', s: 'festival', span: { cols: 2, rows: 1 } }], 'combo', '2x1', gridN);
    const strF = flatten(renderBlocksHTML({ ...base, blocks: laidF, grid: gridN, cellW: 60, cellH: 63 })).join('');
    ok(strF.includes('pv-flat'), 'renderBlocksHTML：窄高卡 2×1 倒数块仍走 flat（占格横向意图）');
    // 对照：非倒数内容（time）同占格不被劫持
    const laidT = layoutBlocks([{ c: 'time', s: 'hms', span: { cols: 2, rows: 1 } }], 'combo', '2x1', gridN);
    const strT = flatten(renderBlocksHTML({ ...base, blocks: laidT, grid: gridN, cellW: 60, cellH: 63 })).join('');
    ok(!strT.includes('pv-flat'), 'renderBlocksHTML：time 同占格不劫持 flat');
    // 对照：倒数内容 2×2（近方形）不触发
    const laidSq = layoutBlocks([{ c: 'important', s: 'festival', span: { cols: 2, rows: 2 } }], 'combo', '2x1', gridN);
    const strSq = flatten(renderBlocksHTML({ ...base, blocks: laidSq, grid: gridN, cellW: 60, cellH: 63 })).join('');
    ok(!strSq.includes('pv-flat'), 'renderBlocksHTML：2×2 近方形占格不触发 flat');
  }

  // v1.43：块根字号 <10px 时附加 pv-tight（隐藏 5px 级不可读副标题）
  {
    const gridT = { cols: 2, rows: 2 };
    const laidSmall = layoutBlocks([{ c: 'time', s: 'day', span: { cols: 1, rows: 1 } }], 'combo', '1x1', gridT);
    const strSmall = flatten(renderBlocksHTML({ ...base, blocks: laidSmall, grid: gridT, cellW: 48, cellH: 48 })).join('');
    ok(strSmall.includes('pv-tight'), '48px 小块（根字号 <10px）应附加 pv-tight');
    const laidBig = layoutBlocks([{ c: 'time', s: 'day', span: { cols: 2, rows: 2 } }], 'combo', '1x1', gridT);
    const strBig = flatten(renderBlocksHTML({ ...base, blocks: laidBig, grid: gridT, cellW: 48, cellH: 48 })).join('');
    ok(!strBig.includes('pv-tight'), '全卡大块不应附加 pv-tight');
    for (const f of ['widget.js', 'mainPage.js', 'widgetConfig.js']) {
      const cssSrc = cssOf(f);
      ok(/\.pv-tight \.pv-sub \{ display:\s*none; \}/.test(cssSrc), `${f} 含 .pv-tight 隐藏副标题规则`);
    }
  }

  // v2.9：横排日期段放不下时丢弃末段（星期），避免换行成 3 行撑爆块高
  {
    const mk = (extra) => flatten(renderInfoBlock({ ...base, ...extra })).join('');
    const roomy = mk({ content: 'time', style: 'dateWeekday', availW: 8, availH: 8 });
    ok(roomy.includes('pv-seg') && /周[一二三四五六日天]/.test(roomy), '空间充足时保留星期段');
    const tight = mk({ content: 'time', style: 'dateWeekday', availW: 3.9, availH: 3.3 });
    ok(!/周[一二三四五六日天]/.test(tight), '窄块（1x2 最小占格量级）应丢弃星期段');
    ok((tight.match(/pv-seg/g) || []).length === 2, '丢弃后应剩 2 个段（月/日）');
    const tightFull = mk({ content: 'time', style: 'dateFullWeekday', availW: 4.0, availH: 3.3 });
    ok(!/周[一二三四五六日天]/.test(tightFull), 'dateFullWeekday 窄块同样丢弃星期段');
    ok((tightFull.match(/pv-seg/g) || []).length >= 3, 'dateFullWeekday 至少保留年/月/日三段');
  }

  // v3.9：缩放预览必须与真实卡片同源（avail 计入 singleScale；无实测尺寸用设计基准尺寸）
  {
    ok(SINGLE_REF_PX && SINGLE_REF_PX['1x1'][0] === 120 && SINGLE_REF_PX['1x1'][1] === 120,
      'SINGLE_REF_PX 提供设计基准尺寸（1x1=120x120）');
    const rows = (str) => (str.match(/pv-mb-row/g) || []).length;
    // 真实卡片 252×252（2×2）与等比缩小一半的预览 126×126 应得到同样的行数
    const real = flatten(renderInfoBlock({
      ...base, content: 'progress', style: 'multiBars', opts: { bars: 'y,m,w,d' },
      singleRow: true, size: '2x2', w: 252, h: 252,
    })).join('');
    // v3.10 契约：预览传「未缩放实测尺寸 + singleScale」（基准字号由真实尺寸解算，avail 用缩放后盒子）
    const scaled = flatten(renderInfoBlock({
      ...base, content: 'progress', style: 'multiBars', opts: { bars: 'y,m,w,d' },
      singleRow: true, size: '2x2', w: 252, h: 252, singleScale: 0.5,
    })).join('');
    ok(rows(real) === 4, `真实卡片 multiBars 应显示 4 行（实际 ${rows(real)}）`);
    ok(rows(scaled) === rows(real),
      `等比缩放预览的 multiBars 行数必须与真实卡片一致（实际 ${rows(scaled)} vs ${rows(real)}）`);
    // 预览容器必须内联等比缩小后的根字号（= 未缩放字号 × singleScale）
    const px = (str) => Number((str.match(/font-size:([0-9.]+)px/) || [])[1]);
    ok(Math.abs(px(scaled) - px(real) * 0.5) < 0.05,
      `singleScale=0.5 时预览根字号应为未缩放的 0.5 倍（${px(real)} → ${px(scaled)}）`);
    // v3.10 关键不变量：预览(真实尺寸+singleScale) 与 真实卡片(singleScale=1) 必须同构 ——
    // 基准字号线性缩放、avail 用「缩放后盒子 / 缩放后基准」相除，两者商恒等。
    // 任何一边走另一条分支，就会出现用户报的「预览正常、实际被切」。
    const layoutSig = (str) => [
      (str.match(/pv-mb-row/g) || []).length,
      (str.match(/pv-yg-grid/g) || []).length,
      (str.match(/pv-rp-legend/g) || []).length,
      (str.match(/pv-wg2-cell/g) || []).length,
    ].join('|');
    for (const [c, s, size, w, h] of [
      ['progress', 'multiBars', '2x2', 693.44, 693.44],
      ['progress', 'yearGrid', '2x2', 693.44, 693.44],
      ['progress', 'weekGrid', '2x1', 346.72, 693.44],
    ]) {
      const f = (sc) => flatten(renderInfoBlock({
        ...base, content: c, style: s, singleRow: true, size, w, h, ...(sc ? { singleScale: sc } : {}),
      })).join('');
      const a = f(0); const b = f(0.37); const d = f(1);
      ok(layoutSig(a) === layoutSig(b) && layoutSig(b) === layoutSig(d),
        `${c}.${s}@${size} 预览(0.37×)/真实(1×) 排版签名必须一致：${layoutSig(a)} vs ${layoutSig(b)} vs ${layoutSig(d)}`);
      const px = (str) => Number((str.match(/font-size:([0-9.]+)px/) || [])[1]);
      ok(Math.abs(px(b) - px(a) * 0.37) < 0.05,
        `${c}.${s}@${size} 预览基准字号应严格等于真实字号×0.37（${px(a)} → ${px(b)}）`);
    }
    // 小卡（宿主给的布局尺寸小于设计基准）基准字号必须同比缩小，内容才不会溢出。
    // v3.15：改为 fitFontU 原理公式（与拼接模式同源）—— 由「内容盒像素 ÷ 固有尺寸」解算，
    // 「availW ≥ fit.w」成为结构性不变式；宿主 chrome = .widget padding 12×2 + border 1×2 = 26px。
    // 60×60：解 34/6.375 = 5.33 < clamp 下限 0.35×17 = 5.95 → 夹到 5.95px
    const small = flatten(renderInfoBlock({
      ...base, content: 'timeDate', style: 'lunarDate', singleRow: true, size: '1x1', w: 60, h: 60,
    })).join('');
    ok(/font-size:5\.95px/.test(small), '1x1 卡片实测 60x60 时基准字号应夹到 clamp 下限 5.95px');
    // 公式锚点（手算核对，防公式被改坏）：lunarDate fit 6.0×4.2，宽度约束恒为盒宽/6.375
    // 120×120 → 94/6.375 = 14.75；113×114 → 87/6.375 = 13.65；76×76 → 50/6.375 = 7.84
    const pxOf = (str) => Number((str.match(/font-size:([0-9.]+)px/) || [])[1]);
    const fAt = (w, h) => pxOf(flatten(renderInfoBlock({
      ...base, content: 'timeDate', style: 'lunarDate', singleRow: true, size: '1x1', w, h,
    })).join(''));
    const CHROME = 26; // .widget padding 12×2 + 玻璃描边 1×2
    ok(Math.abs(fAt(120, 120) - 14.75) < 0.02, `120x120 基准字号应为公式解算值 14.75px，实际 ${fAt(120, 120).toFixed(2)}`);
    ok(Math.abs(fAt(113, 114) - 13.65) < 0.02, `113x114 基准字号应为公式解算值 13.65px，实际 ${fAt(113, 114).toFixed(2)}`);
    ok(Math.abs(fAt(76, 76) - 7.84) < 0.02, `76x76 基准字号应为公式解算值 7.84px，实际 ${fAt(76, 76).toFixed(2)}`);
    // 不变式：宽度约束下字号与内容盒严格同比 —— 任意真实尺寸都不裁
    // （用户真实面板 1×1 = 113×114；headless 1384px 视口下 = 76×76）
    ok(Math.abs(fAt(113, 114) / fAt(120, 120) - (113 - CHROME) / (120 - CHROME)) < 0.01,
      `113x114 字号应与内容盒同比（${fAt(120, 120).toFixed(2)} → ${fAt(113, 114).toFixed(2)}，期望 ${(fAt(120, 120) * (113 - CHROME) / (120 - CHROME)).toFixed(2)}）`);
    ok(Math.abs(fAt(76, 76) / fAt(120, 120) - (76 - CHROME) / (120 - CHROME)) < 0.01,
      `76x76 字号应与内容盒同比（${fAt(120, 120).toFixed(2)} → ${fAt(76, 76).toFixed(2)}，期望 ${(fAt(120, 120) * (76 - CHROME) / (120 - CHROME)).toFixed(2)}）`);
    // SVG 环形容器尺寸纪律：弹性占满剩余高度（flex:1 1 auto + min-height:0），
    // 不许再写 aspect-ratio:1 —— 宽扁卡上「高=宽」会顶出卡片，窄高卡上会把图例挤出内容盒。
    for (const sel of ['.pv-rc-ring', '.pv-rp-ring', '.pv-gl-dial']) {
      const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rule = SHARED_CSS.match(new RegExp(esc + ' \\{[^}]*\\}'));
      ok(rule && /flex: 1 1 auto/.test(rule[0]) && /min-height: 0/.test(rule[0]) && /width: 100%/.test(rule[0])
        && !/aspect-ratio/.test(rule[0]),
        `真源 ${sel} 应弹性占满剩余高度且不带 aspect-ratio（实际：${rule ? rule[0].slice(0, 90) : '未找到'}）`);
      // SVG 绝对铺满容器，靠 viewBox + 默认 preserveAspectRatio 自动居正方
      const svgRule = SHARED_CSS.match(new RegExp(esc + ' svg \\{[^}]*\\}'));
      ok(svgRule && /position: absolute/.test(svgRule[0]) && /width: 100%/.test(svgRule[0]) && /height: 100%/.test(svgRule[0]),
        `真源 ${sel} svg 应绝对铺满容器让 viewBox 自动居正方`);
    }
    // 环形刻度钟必须有指针（用户实测「环形刻度钟没有显示指针」）
    {
      const rc = flatten(renderInfoBlock({ ...base, content: 'timeDate', style: 'ringClock', singleRow: true, size: '2x2', w: 252, h: 252 })).join('');
      const hands = rc.match(/<line x1="50" y1="50"[^>]*stroke-width="(3\.4|2)"[^>]*>/g) || [];
      ok(hands.length === 2, `ringClock 应渲染时针+分针两根指针（实际 ${hands.length} 根）`);
      ok(/<circle cx="50" cy="50" r="3\.2" fill="[^"]+"\s*\/>/.test(rc), 'ringClock 应渲染中心轴帽');
    }
    // 回写链路：store 就绪后必须补一次测量（否则 previewSize 永不写入）
    const wjs = readFileSync(new URL('../src/components/widget.js', import.meta.url), 'utf8');
    ok(/ensureAppState\(this\.spCtx\?\.api\)\.then\(\(\) => \{[\s\S]{0,200}this\._measure\(\)/.test(wjs),
      'widget 必须在 store 就绪后补一次 _measure()，确保 previewSize 被写回');
  }

  // v1.45：配置页预览复现 widget 实测尺寸与运行时网格
  {
    const mp = readFileSync(new URL('../src/components/mainPage.js', import.meta.url), 'utf8');
    ok(/previewSize/.test(mp) && /comboGridFor\(size, pvReal\.w, pvReal\.h\)/.test(mp),
      'mainPage 预览使用实测尺寸 + 运行时网格');
    const wc = readFileSync(new URL('../src/components/widgetConfig.js', import.meta.url), 'utf8');
    ok(/previewSize/.test(wc) && /comboGridFor\(this\._size, pvReal\.w, pvReal\.h\)/.test(wc),
      'widgetConfig 预览使用实测尺寸 + 运行时网格');
    const w = readFileSync(new URL('../src/components/widget.js', import.meta.url), 'utf8');
    ok(/previewSize: \{ size: this\._cardSize/.test(w), 'widget 回写实测尺寸到设置');
  }

  // v1.44：日期「数值+单位」不可断行（.pv-seg），只允许段间换行；窄块年份降两位
  {
    const mk = (extra) => flatten(renderInfoBlock({ ...base, ...extra })).join('');
    const wide = mk({ content: 'time', style: 'dateFull', shortYear: false });
    ok(wide.includes('pv-seg') && wide.includes('2026年'), 'dateFull 宽块：段包裹 + 四位年');
    ok(/pv-seg[^>]*>2026年<\/span><wbr>/.test(wide), 'dateFull 段间用 <wbr> 分隔（仅段边界可换行）');
    const narrow = mk({ content: 'time', style: 'dateFull', shortYear: true });
    ok(narrow.includes('26年') && !narrow.includes('2026年'), 'dateFull 窄块：年份降为两位');
    const wd = mk({ content: 'time', style: 'dateFullWeekday', shortYear: true });
    const segs = (wd.match(/pv-seg/g) || []).length;
    ok(segs === 4, `dateFullWeekday 应为 4 个不可断段（实际 ${segs}）`);
    const md = mk({ content: 'time', style: 'dateMonthDay', shortYear: false });
    ok((md.match(/pv-seg/g) || []).length === 2, 'dateMonthDay 应为 2 个不可断段');
    for (const f of ['widget.js', 'mainPage.js', 'widgetConfig.js']) {
      const cssSrc = cssOf(f);
      ok(/\.pv-seg \{ white-space: nowrap; \}/.test(cssSrc), `${f} 含 .pv-seg nowrap 规则`);
    }
  }

  // v1.43：置中不再「接管即禁用」——单元级控件始终可点，点击即把该轴移交给单元
  {
    const mp = readFileSync(new URL('../src/components/mainPage.js', import.meta.url), 'utf8');
    ok(!/alignLocked: \{ h: this\._alignGov\.h === 'card'/.test(mp),
      'mainPage 不再按接管态锁定单元级开关');
    ok(!/onUnlock:/.test(mp), 'mainPage 占格编辑器不再提供「解锁」入口（点击即移交）');
    ok(/CARD_ALIGN_SWITCHED/.test(mp), 'mainPage 使用「已切换为单元级控制」提示');
    ok(/report\.clamped\[axis\]/.test(mp), 'mainPage 使用 clamped 判定给出「空间不足」提示');
    const wc = readFileSync(new URL('../src/components/widgetConfig.js', import.meta.url), 'utf8');
    ok(!/alignLocked: \{ h: this\._alignGov\.h === 'card'/.test(wc), 'widgetConfig 同样不再锁定单元级开关');
    for (const f of ['widget.js', 'mainPage.js', 'widgetConfig.js']) {
      const cssSrc = cssOf(f);
      ok(/@media \(prefers-reduced-motion: no-preference\) \{ \.pv-block \{ transition: left 0\.16s ease, top 0\.16s ease; \} \}/.test(cssSrc),
        `${f} 仅在允许动效时给 .pv-block 加位移过渡`);
      ok(!/@media \(prefers-reduced-motion: reduce\)[^}]*\.pv-block/.test(cssSrc),
        `${f} reduce 媒体查询不涉及 .pv-block（不干扰既有动效规则）`);
    }
  }

  // v1.40 需求 1：年/星期小卡规则对调验证（2×1 小卡、1×2 全量）
  {
    const mk2 = (extra) => renderInfoBlock({ ...base, ...extra });
    const fl2 = (tpl) => flatten(tpl).join('');
    // 2×1 卡片 + 水平占格 1 → 小卡：年取后两位、星期缩小
    const ySm = fl2(mk2({ content: 'time', style: 'year', small: true }));
    ok(ySm.includes('26') && !/\b2026\b/.test(ySm), '2×1 小卡「年」显示后两位 26');
    const wSm = fl2(mk2({ content: 'time', style: 'weekday', small: true }));
    ok(wSm.includes('pv-wd-sm'), '2×1 小卡「星期」使用缩小字号样式');
    // 1×2 卡片（规则对调后）不触发小卡：用 isSmallUnit 验证 + 渲染全量
    ok(!isSmallUnit({ cols: 1, rows: 2 }, '1x2'), '1×2 卡片不再走小卡渲染');
  }

  // 需求 5：悬浮确认栏 —— 结构 / 定位 / 降级 / a11y
  {
    const src = readFileSync(new URL('../src/components/mainPage.js', import.meta.url), 'utf8');
    // (a) 全局禁用 position: fixed（微应用内会被 backdrop-filter/transform 祖先劫持、且不受 .root 裁剪）
    const files = ['widget.js', 'mainPage.js', 'widgetConfig.js'].map(
      (f) => readFileSync(new URL(`../src/components/${f}`, import.meta.url), 'utf8'),
    );
    for (let i = 0; i < files.length; i++) {
      const name = ['widget.js', 'mainPage.js', 'widgetConfig.js'][i];
      ok(!/position:\s*fixed/.test(files[i]), `${name} 不得出现 position: fixed`);
    }
    // (b) 确认栏是 .fullscreen 的直接子节点（在 .fs-body 之外 → 不随列表滚动）
    const mgrSrc = src.slice(src.indexOf('_renderScheduleMgr()'), src.indexOf('_renderIO()'));
    ok(/<\/div>\s*\n?\s*\$\{this\._renderMgrConfirm\(selCount\)\}/.test(mgrSrc),
      '确认栏应渲染在 .fs-body 关闭标签之后（.fullscreen 直接子节点）');
    ok(mgrSrc.indexOf('_renderMgrConfirm(selCount)') > mgrSrc.indexOf('class="fs-body"'),
      '确认栏必须位于 .fs-body 之后');
    // (c) 遮罩与容器定位
    ok(/\.mgr-scrim\s*\{[^}]*position:\s*absolute/.test(src), '.mgr-scrim 应使用 position: absolute');
    ok(/\.mgr-confirm\s*\{[^}]*position:\s*absolute/.test(src), '.mgr-confirm 应使用 position: absolute');
    ok(/\.mgr-confirm\s*\{[^}]*z-index:\s*140/.test(src), '.mgr-confirm z-index 应为 140');
    ok(/\.mgr-scrim\s*\{[^}]*z-index:\s*130/.test(src), '.mgr-scrim z-index 应为 130');
    ok(/\.mgr-confirm\s*\{[^}]*bottom:\s*calc\(12px \+ env\(safe-area-inset-bottom/.test(src),
      '.mgr-confirm 应保留 safe-area 安全距离');
    ok(/\.mgr-confirm\s*\{[^}]*border-radius:\s*14px/.test(src), '.mgr-confirm 圆角应为 14px');
    ok(/\.cf-btn\s*\{[^}]*border-radius:\s*10px/.test(src), '.cf-btn 圆角应为 10px（与容器同心）');
    ok(/\.cf-btn\s*\{[^}]*min-height:\s*44px/.test(src), '.cf-btn 触摸目标应 ≥44px');
    // (d) 深色遮罩分档 + 不用 backdrop-filter
    ok(/\.fullscreen\.dark\s+\.mgr-scrim\s*\{[^}]*rgba\(0,\s*0,\s*0,\s*0?\.55\)/.test(src),
      '深色模式遮罩应为 rgba(0,0,0,.55)');
    ok(!/\.mgr-scrim\s*\{[^}]*backdrop-filter/.test(src), '遮罩不得使用 backdrop-filter');
    // (e) 导航栏层级高于遮罩与确认栏
    ok(/\.fs-nav\s*\{[^}]*z-index:\s*150/.test(src), '.fs-nav z-index 应为 150（高于遮罩 130 / 确认栏 140）');
    // (f) reduced-motion 只关两个容器，且显式放开按钮点击
    const rm = src.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\s*\}\s*\n?\s*\/\*/);
    ok(!!rm, '应存在 prefers-reduced-motion 分支');
    if (rm) {
      const body = rm[1];
      ok(/\.mgr-confirm,\s*\.mgr-scrim\s*\{\s*animation:\s*none/.test(body),
        'reduced-motion 只关闭 .mgr-confirm / .mgr-scrim 两个容器的动画');
      ok(!/\*/.test(body.replace(/\/\*[\s\S]*?\*\//g, '')), 'reduced-motion 分支不得使用通配符选择器');
      ok(/\.mgr-confirm\s+\.cf-btn\s*\{\s*pointer-events:\s*auto/.test(body),
        'reduced-motion 下必须显式放开 .cf-btn 的点击');
    }
    // (g) a11y：alertdialog + aria-modal + 取消默认聚焦
    ok(/class="mgr-confirm"[^>]*role="alertdialog"/.test(src), '确认栏应有 role="alertdialog"');
    ok(/aria-modal="true"/.test(src), '确认栏应有 aria-modal="true"');
    ok(/class="cf-btn cancel"/.test(src), '确认栏应有「取消」按钮');
    ok(/data-mgr-id="\$\{item\.id\}"/.test(src), '列表行应带 data-mgr-id（供滚动定位）');
    // (h) 用 .fs-body.scrollTop 手动滚动，不用 scrollIntoView
    ok(/_revealArmedRow\(/.test(src), '应实现 _revealArmedRow');
    ok(/body\.scrollTop \+ delta/.test(src), '滚动应手动计算 .fs-body.scrollTop（不用 scrollIntoView）');
    ok(/matchMedia\('\(prefers-reduced-motion:\s*reduce\)'\)\.matches/.test(src),
      '平滑滚动需在 reduced-motion 下降级为 auto');
    ok(/\.mgr-list\.pad-confirm\s*\{\s*padding-bottom:\s*92px/.test(src), '悬浮条显示时列表补白应为 92px');
    ok(/\.mgr-row\.armed\s*\{[^}]*inset\s+0\s+0\s+0\s+1\.5px/.test(src), '待删除行高亮应使用 inset shadow');
  }
}

console.log('');


  // v1.32 需求 5：竖排时年份只显示后两位
  {
    const v1 = flatten(renderInfoBlock({ ...base, content: 'time', style: 'dateFull', tall: true })).join('');
    ok(v1.includes('26年') && !v1.includes('2026年'),
      `竖排「年月日」年份应为两位 26（实际含 2026年: ${v1.includes('2026年')}）`);
    const v2 = flatten(renderInfoBlock({ ...base, content: 'time', style: 'dateFullWeekday', tall: true })).join('');
    ok(v2.includes('26年') && !v2.includes('2026年'), '竖排「年月日星期」年份应为两位');
    const vEn = flatten(renderInfoBlock({ ...base, isZh: false, content: 'time', style: 'dateFull', tall: true })).join('');
    ok(vEn.includes('>26<') || /\b26\b/.test(vEn), '竖排英文年份也应为两位');
    // 非竖排（横排）仍显示完整年份
    const hz = flatten(renderInfoBlock({ ...base, content: 'time', style: 'dateFull', tall: false })).join('');
    ok(hz.includes('2026年'), '横排「年月日」仍显示完整年份');
  }

// ---------- v1.32 回归：html`` 模板内的注释不能含反引号 ----------
// 背景：v1.31 在 render 的 <style> 注释里写了 `.mgr-confirm *`（反引号），
// 模板字符串在那里提前闭合，render() 返回异常值，整个应用页白屏只剩 "NaN"。
{
  const files = ['widget.js', 'mainPage.js', 'widgetConfig.js'];
  for (const f of files) {
    const src = readFileSync(new URL(`../src/components/${f}`, import.meta.url), 'utf8');
    const bad = [];
    let inTpl = false;
    let inLine = false;
    let line = 1;
    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      const nx = src[i + 1];
      if (ch === '\n') { line++; inLine = false; continue; }
      if (inLine) continue;
      if (ch === '/' && nx === '/') { inLine = true; i++; continue; }
      if (!inTpl) {
        if (ch === '`') inTpl = true;
        continue;
      }
      if (ch === '\\') { i++; continue; }
      if (ch === '`') { inTpl = false; continue; }
      if (ch === '/' && nx === '*') {
        const end = src.indexOf('*/', i + 2);
        if (end < 0) break;
        const body = src.slice(i + 2, end);
        if (body.includes('`')) bad.push(line);
        line += (body.match(/\n/g) || []).length;
        i = end + 1;
      }
    }
    ok(bad.length === 0,
      `${f}: html 模板内的注释不应含反引号（会提前闭合模板导致白屏），行号 ${bad.join(',')}`);
  }
}

// ---------- v1.35：简约显示（noUnits）+ 新增「年月」样式 ----------
{
  const mk = (extra) => renderInfoBlock({ ...base, ...extra });
  // aria-label 是属性值、会出现在扁平串里；查「视觉串」前先剥掉，避免误判
  const stripAria = (s) => s.replace(/aria-label="[^"]*"/g, '');

  // (1) normalizeOpts：空对象 → null；存量 singleLine 行为不变；noUnits 被认下
  ok(normalizeOpts({}) === null, 'normalizeOpts({}) 应为 null');
  ok(normalizeOpts(undefined) === null, 'normalizeOpts(undefined) 应为 null');
  ok(JSON.stringify(normalizeOpts({ singleLine: true })) === '{"singleLine":true}',
    '存量 singleLine 归一化行为不变');
  ok(JSON.stringify(normalizeOpts({ noUnits: true })) === '{"noUnits":true}',
    'noUnits 应被 normalizeOpts 认下');
  // (2) 无尺寸感知默认值：6 种尺寸缺省即关
  for (const size of Object.keys(HOST)) {
    ok(unitOpts('combo', size, { c: 'time', s: 'dateFull' }).noUnits === false,
      `${size}: noUnits 缺省应为 false（无尺寸感知默认值）`);
  }
  // (3) 显式开启在任意尺寸（含 1×1 与 1×FULL）返回 true
  for (const size of ['1x1', '2x2', '1xfull']) {
    ok(unitOpts('combo', size, { c: 'time', s: 'dateFull', opts: { noUnits: true } }).noUnits === true,
      `${size}: 显式 opts.noUnits=true 应返回 true`);
  }
  // (4) noUnitsOn「生效」门控：白名单样式 + 显式开启才生效；不支持样式即便保留 opts 也不生效
  for (const s of NO_UNITS_DATE_STYLES) {
    ok(noUnitsOn('combo', '2x2', { c: 'time', s, opts: { noUnits: true } }) === true,
      `${s} 显式开启后应生效`);
    ok(noUnitsOn('combo', '2x2', { c: 'time', s }) === false,
      `${s} 缺省（未开启）不应生效`);
  }
  for (const [c, s] of [['time', 'hms'], ['time', 'hm'], ['time', 'year'], ['time', 'month'],
    ['time', 'weekday'], ['time', 'day'], ['time', 'weekOfYear'], ['calendar', 'month'],
    ['schedule', 'recent'], ['important', 'holidayGap']]) {
    ok(noUnitsOn('combo', '2x2', { c, s, opts: { noUnits: true } }) === false,
      `${c}:${s} 即便保留 opts.noUnits 也不生效（白名单外恒 false）`);
  }
  // (5)(6)(7) 占格编辑器按钮：null 不渲染 / false 不高亮 / true 高亮 +1 / 与单行显示互斥
  const sb = {
    grid: gridForSize('2x2'),
    target: { pos: { col: 0, row: 0 }, span: { cols: 2, rows: 2 } },
    span: { cols: 2, rows: 2 },
    bounds: spanBounds('combo', '2x2', { c: 'time', s: 'dateFull' }),
    name: 'x', theme: '#0A84FF', isZh: true, sizeLabel: '2x2',
    onPick: () => {}, onResize: () => {}, onReset: () => {}, onClose: () => {},
    onToggleAlign: () => {}, onToggleNoUnits: () => {},
  };
  const edNull = flatten(renderSpanEditor({ ...sb, noUnits: null })).join('');
  ok(!edNull.includes('简约显示'), 'noUnits=null 时不应渲染「简约显示」按钮');
  const edNullEn = flatten(renderSpanEditor({ ...sb, isZh: false, noUnits: null })).join('');
  ok(!edNullEn.includes('Compact'), 'en: noUnits=null 时不应渲染 Compact 按钮');
  const edOff = flatten(renderSpanEditor({ ...sb, noUnits: false })).join('');
  ok(edOff.includes('简约显示'), 'noUnits=false 时应渲染「简约显示」按钮');
  ok((edOff.match(/se-toggle on/g) || []).length === 0, 'noUnits=false 时简约按钮不应高亮');
  const edOn = flatten(renderSpanEditor({ ...sb, noUnits: true })).join('');
  ok((edOn.match(/se-toggle on/g) || []).length === 1, 'noUnits=true 时 .se-toggle on 计数应 +1');
  ok(edOn.includes('role="switch"') && edOn.includes('aria-checked="true"'),
    '简约按钮应为 role=switch + aria-checked');
  ok(edOn.includes('简约显示，隐藏年/月/日单位'), '简约按钮应带行为描述 title');
  const edMonth = flatten(renderSpanEditor({
    ...sb, bounds: spanBounds('combo', '1xfull', { c: 'calendar', s: 'month' }),
    sizeLabel: '1xfull', isFull: true, singleLine: true, noUnits: null,
  })).join('');
  ok(edMonth.includes('单行显示') && !edMonth.includes('简约显示'),
    '互斥：月历 1×FULL 应含「单行显示」、不含「简约显示」');
  const edDate = flatten(renderSpanEditor({ ...sb, noUnits: false })).join('');
  ok(edDate.includes('简约显示') && !edDate.includes('单行显示'),
    '互斥：time:dateFull 应含「简约显示」、不含「单行显示」');
  // (8)(9) 合并写 + 往返保留（组件层静态断言 + store 层行为断言）
  for (const f of ['widgetConfig.js', 'mainPage.js']) {
    const src = readFileSync(new URL(`../src/components/${f}`, import.meta.url), 'utf8');
    ok(src.includes('{ ...(info.b.opts || {}), noUnits: next }'),
      `${f}: noUnits 写入应合并 opts（防抹掉 singleLine）`);
    ok(src.includes('{ ...(info.b.opts || {}), singleLine: next }'),
      `${f}: singleLine 写入应合并 opts（防抹掉 noUnits）`);
    ok(!/\{ opts: \{ singleLine: next \} \}/.test(src) && !/_setCardBlockField\(\{ singleLine: next \}/.test(src),
      `${f}: 不得再整对象覆盖 opts`);
  }
  const rt = sanitizeBlocks([{ c: 'time', s: 'dateFull', opts: { noUnits: true } }], 'combo', '2x2');
  ok(rt[0].opts && rt[0].opts.noUnits === true, 'sanitizeBlocks 往返应保留 opts.noUnits');
  // (10) 渲染：横排去单位且含圆点；竖排去单位；dateWeekday 仍含星期
  const h = flatten(mk({ content: 'time', style: 'dateFull', opts: { noUnits: true } })).join('');
  ok(!stripAria(h).includes('年') && !stripAria(h).includes('月') && !stripAria(h).includes('日'),
    '横排简约视觉串不应含 年/月/日 单位');
  ok(h.includes('pv-dot'), '横排简约应含自绘圆点 .pv-dot');
  ok(h.includes('pv-dot') && (h.match(/pv-dot/g) || []).length === 2, '横排「年月日」简约应含 2 个圆点');
  const v = flatten(mk({ content: 'time', style: 'dateFull', tall: true, opts: { noUnits: true } })).join('');
  ok(!stripAria(v).includes('年') && !stripAria(v).includes('月') && !stripAria(v).includes('日'),
    '竖排简约视觉串不应含单位字符');
  ok(!v.includes('pv-dot'), '竖排简约不应出现圆点（只显示数字）');
  const wd = flatten(mk({ content: 'time', style: 'dateWeekday', opts: { noUnits: true } })).join('');
  ok(stripAria(wd).includes('周日'), 'dateWeekday 简约仍应含星期（与数字间用字面空格）');
  // (15) v1.35 反馈 1：竖排简约的星期行降 .7em → 带星期与不带星期样式数字字号相等
  for (const s of ['dateWeekday', 'dateFullWeekday']) {
    ok(fitFor('time', s, false, true, { tall: true, noUnits: true }).w === 1.7,
      `${s} 竖排简约 fit.w 应为 1.7（与无星期样式同声明；星期行降 .7em 后不再是宽度瓶颈）`);
    ok(fitFor('time', s, false, false, { tall: true, noUnits: true }).w === 1.7,
      `${s} 竖排简约 en 同样取 w=1.7（.7em 下 Mon 1.63em ≤ 1.7em 预算，无需 wEn）`);
  }
  ok(fitFor('time', 'dateWeekday', false, true, { tall: true, noUnits: true }).h
    === fitFor('time', 'dateFull', false, true, { tall: true, noUnits: true }).h,
    'dateWeekday 与 dateFull 竖排简约同 h=4.8（三行结构一致）');
  // 用户场景实锤：2×2 卡 1×3 块（57×171）下，月日星期与年月日简约字号严格相等
  const uWdEq = fitFontU(57, 171, fitFor('time', 'dateWeekday', false, true, { tall: true, noUnits: true }));
  const uFullEq = fitFontU(57, 171, fitFor('time', 'dateFull', false, true, { tall: true, noUnits: true }));
  ok(uWdEq === uFullEq, `2×2 卡 1×3：月日星期与年月日简约字号应相等（${uWdEq.toFixed(1)} vs ${uFullEq.toFixed(1)}，修复前 19.2 vs 27.5）`);
  // 4 行样式在其自然 4 行占格（宽度约束）下也相等
  ok(fitFontU(57, 228, fitFor('time', 'dateFullWeekday', false, true, { tall: true, noUnits: true })) === uFullEq,
    '2×2 卡 1×4：年月日星期与年月日（1×3）简约字号应相等');
  const wdV = flatten(mk({ content: 'time', style: 'dateWeekday', tall: true, opts: { noUnits: true } })).join('');
  ok((wdV.match(/pv-vline wk/g) || []).length === 1, '竖排简约 dateWeekday 应恰有 1 行 .pv-vline.wk（星期行）');
  ok(wdV.includes('周日'), '竖排简约 dateWeekday 的星期行仍渲染星期（只降字号不删信息）');
  const fwV = flatten(mk({ content: 'time', style: 'dateFullWeekday', tall: true, opts: { noUnits: true } })).join('');
  ok((fwV.match(/pv-vline wk/g) || []).length === 1, '竖排简约 dateFullWeekday 应恰有 1 行 .pv-vline.wk');
  const vNoWk = flatten(mk({ content: 'time', style: 'dateFull', tall: true, opts: { noUnits: true } })).join('');
  ok(!vNoWk.includes('pv-vline wk'), '竖排简约 dateFull（无星期）不应出现 .pv-vline.wk');
  ok(!wd.includes('pv-vline wk'), '横排简约 dateWeekday 的星期不降级（.wk 仅竖排）');
  // (16) v1.35 反馈 2：dateWeekdayVert 的 en 宽度按 Mon 2.917em 回写（两份规格修复清单漏列项）
  ok(fitFor('time', 'dateWeekday', false, false, { tall: true }).w === 3.1,
    'time:dateWeekday 竖排 en 取 max(w,wEn)=3.1（原 wEn 2.5 覆盖不到 Mon 2.917em）');
  ok(fitFor('time', 'dateWeekday', false, true, { tall: true }).w === 2.9,
    'time:dateWeekday 竖排 zh 仍取 w=2.9（中文侧零影响）');
  // (11) en：视觉串无长月名 / 无 en-US 逗号；竖排无 Oct
  const hEn = flatten(mk({ isZh: false, content: 'time', style: 'dateFull', opts: { noUnits: true } })).join('');
  ok(!stripAria(hEn).includes('October'), 'en 横排简约视觉串不应含长月名');
  ok(!stripAria(hEn).includes(','), 'en 横排简约视觉串不应含 en-US 长格式逗号');
  const vEn = flatten(mk({ isZh: false, content: 'time', style: 'dateFull', tall: true, opts: { noUnits: true } })).join('');
  ok(!stripAria(vEn).includes('Oct'), 'en 竖排简约视觉串不应含短月名 Oct');
  const wdEn = flatten(mk({ isZh: false, content: 'time', style: 'dateWeekday', opts: { noUnits: true } })).join('');
  ok(stripAria(wdEn).includes('Sun') && !stripAria(wdEn).includes('Sunday'),
    'en dateWeekday 简约视觉串应用短星期 Sun');
  // (13) a11y：role=img + aria-label = 同一样式「横排 + 未开启」原串（横竖同一句）
  ok(h.includes('role="img"') && h.includes('aria-label="2026年10月18日"'),
    'dateFull 简约应有 role=img + 横排原串 aria-label');
  ok(v.includes('role="img"') && v.includes('aria-label="2026年10月18日"'),
    '竖排简约 aria-label 同样取横排原串（恒 4 位年）');
  ok(hEn.includes('aria-label="October 18, 2026"'),
    'en dateFull 简约 aria-label 应为 "October 18, 2026"');
  const ym = flatten(mk({ content: 'time', style: 'dateYearMonth', opts: { noUnits: true } })).join('');
  ok(ym.includes('aria-label="2026年10月"') && stripAria(ym).includes('2026'),
    'dateYearMonth 简约 aria-label 应为「2026年10月」');
  const md = flatten(mk({ content: 'time', style: 'dateMonthDay', opts: { noUnits: true } })).join('');
  ok(md.includes('aria-label="10月18日"'), 'dateMonthDay 简约 aria-label 应为「10月18日」');
  const fw = flatten(mk({ content: 'time', style: 'dateFullWeekday', opts: { noUnits: true } })).join('');
  ok(fw.includes('aria-label="2026年10月18日 周日"'), 'dateFullWeekday 简约 aria-label 应为「2026年10月18日 周日」');
  ok(wd.includes('aria-label="10月18日 周日"'), 'dateWeekday 简约 aria-label 应为「10月18日 周日」');
  // (14) 新样式 dateYearMonth：span/minSpan 2×1 / 1×1；渲染含 <wbr>；en 为 Oct 2026
  const ymSpan = styleSpanDef('combo', 'time', 'dateYearMonth');
  ok(ymSpan.span.cols === 2 && ymSpan.span.rows === 1, '年月样式声明占格应为 2×1');
  ok(ymSpan.min && ymSpan.min.cols === 1 && ymSpan.min.rows === 1, '年月样式最小占格应为 1×1');
  const ymPlain = flatten(mk({ content: 'time', style: 'dateYearMonth' })).join('');
  ok(ymPlain.includes('2026年') && ymPlain.includes('10月'), '年月样式应渲染「2026年10月」');
  ok(ymPlain.includes('<wbr>'), '年月中文文案需插入 <wbr> 兜底断行');
  const ymEn = flatten(mk({ isZh: false, content: 'time', style: 'dateYearMonth' })).join('');
  ok(ymEn.includes('Oct 2026'), '年月英文文案应为 "Oct 2026"');
  // (12) 空 opts 不写字段（避免持久化膨胀）
  const bare = sanitizeBlocks([{ c: 'time', s: 'dateFull' }], 'combo', '2x2');
  ok(bare[0].opts === undefined, '无 opts 时 sanitizeBlocks 不应写空 opts 字段');
}

// v2.7：单独模式新增「显示样式」—— 渲染标记与格数守卫
{
  const cases = [
    ['progress', 'yearGrid', 'pv-yg-grid'],
    ['progress', 'yearBars', 'pv-yb-bars'],
    ['progress', 'weekGrid', 'pv-wg2-row'],
    ['timeDate', 'dualZone', 'pv-dz-time'],
  ];
  for (const [content, style, needle] of cases) {
    const h = flatten(renderInfoBlock({ ...base, content, style, singleRow: true, size: '2x2' })).join('');
    ok(h.includes(needle), `单独 ${content}:${style} 应渲染 .${needle}`);
    ok(h.includes('pv-single-2x2'), `单独 ${content}:${style} 应带尺寸类名 pv-single-2x2`);
  }
  // 年进度格阵：格数=当年天数（2026 平年 365），且只有 1 格 today 标记
  const gridHTML = flatten(renderInfoBlock({ ...base, content: 'progress', style: 'yearGrid', singleRow: true, size: '2x2' })).join('');
  ok((gridHTML.match(/<i /g) || []).length === 365, `年进度格阵应有 365 格，实际 ${(gridHTML.match(/<i /g) || []).length}`);
  ok((gridHTML.match(/class="now"/g) || []).length === 1, '年进度格阵应有且仅有 1 个 today 格');
  // 年月条阵：12 根条
  const barsHTML = flatten(renderInfoBlock({ ...base, content: 'progress', style: 'yearBars', singleRow: true, size: '2x2' })).join('');
  ok((barsHTML.match(/<b class="/g) || []).length === 12, `年月条阵应有 12 根条，实际 ${(barsHTML.match(/<b class="/g) || []).length}`);
}

// v2.9：单独模式 6 款图像化样式 + 样式设置（颜色/文案/目标日）+ 尺寸门控
{
  const cases = [
    ['timeDate', 'ringClock', 'pv-rc-ring', '2x4'],
    ['timeDate', 'dotClock', 'pv-dc-time', '2x4'],
    ['timeDate', 'boldClock', 'pv-bc-nums', '2x2'],
    ['schedule', 'capsule', 'pv-cp-pill', '2x4'],
    // v3.12：targetDay 的 DOM 拆成 left（天数组）/ right（标题 + 目标日），
    // 未设置目标日时走空态（不渲染标题）→ 这条要带一个目标日才看得到 .pv-tg-title
    ['schedule', 'targetDay', 'pv-tg-title', '2x2', { date: '2026-12-31' }],
    ['progress', 'multiBars', 'pv-mb-row', '2x4'],
  ];
  for (const [content, style, needle, size, extraOpts] of cases) {
    const h = flatten(renderInfoBlock({ ...base, content, style, singleRow: true, size, ...(extraOpts ? { opts: extraOpts } : {}) })).join('');
    ok(h.includes(needle), `单独 ${content}:${style} 应渲染 .${needle}`);
  }
  // 环形刻度钟：60 根刻度（stroke=currentColor）+ 时针/分针（stroke=主色）
  const ringHTML = flatten(renderInfoBlock({ ...base, content: 'timeDate', style: 'ringClock', singleRow: true, size: '2x4' })).join('');
  const tickN = (ringHTML.match(/<line [^>]*stroke="currentColor"/g) || []).length;
  ok(tickN === 60, `环形钟应有 60 根刻度，实际 ${tickN}`);
  const handN = (ringHTML.match(/<line x1="50" y1="50"/g) || []).length;
  ok(handN === 2, `环形钟应有 2 根指针（时针+分针），实际 ${handN}`);
  ok(ringHTML.includes('stroke-dasharray'), '环形钟应有进度弧 stroke-dasharray');
  // 多进度条：v3.12 起默认 5 行（年/月/周/日/生命，生命按 age/life 默认 18/120）
  const mbHTML = flatten(renderInfoBlock({ ...base, content: 'progress', style: 'multiBars', singleRow: true, size: '2x4' })).join('');
  ok((mbHTML.match(/pv-mb-row/g) || []).length === 5, `多进度条应有 5 行（含生命），实际 ${(mbHTML.match(/pv-mb-row/g) || []).length}`);
  // 胶囊倒计时：天/时/分/秒 4 个数值格
  const cpHTML = flatten(renderInfoBlock({ ...base, content: 'schedule', style: 'capsule', singleRow: true, size: '2x4' })).join('');
  ok((cpHTML.match(/pv-cp-cell/g) || []).length === 4, `胶囊倒计时应有 4 个数值格，实际 ${(cpHTML.match(/pv-cp-cell/g) || []).length}`);

  // 样式设置：颜色 / 文案 / 目标日
  const tinted = flatten(renderInfoBlock({ ...base, content: 'timeDate', style: 'ringClock', singleRow: true, size: '2x4', opts: { color: '#FF9F0A' } })).join('');
  ok(tinted.includes('#FF9F0A'), '样式设置 color 应作用到渲染（主色）');
  const titled = flatten(renderInfoBlock({ ...base, content: 'schedule', style: 'targetDay', singleRow: true, size: '2x2', opts: { text: '项目上线', date: '2026-11-11' } })).join('');
  ok(titled.includes('项目上线'), '样式设置 text 应作为标题渲染');
  ok(titled.includes('2026-11-11'), '样式设置 date 应渲染目标日期');

  // 尺寸门控：不同样式只对部分卡片尺寸开放
  const bold2x2 = stylesForSize('single', 'timeDate', '2x2').map((s) => s.key);
  const bold1xfull = stylesForSize('single', 'timeDate', '1xfull').map((s) => s.key);
  ok(bold2x2.includes('boldClock'), '2x2 时间应可用 boldClock');
  ok(!bold1xfull.includes('boldClock'), '1xfull 时间不应开放 boldClock（尺寸门控）');
  ok(styleFitsSize('single', 'timeDate', 'boldClock', '1xfull') === false, 'styleFitsSize 应对未开放尺寸返回 false');
  ok(styleSizesOf('single', 'schedule', 'capsule').includes('2x4'), 'capsule 应声明 2x4 尺寸');
  // 只声明了部分尺寸的样式，不应出现在其它尺寸里
  for (const [content, style] of [['schedule', 'capsule'], ['timeDate', 'boldClock']]) {
    for (const size of ['1x1', '1x2', '2x1', '2x2', '2x4', '4x4', '1xfull']) {
      const has = stylesForSize('single', content, size).some((s) => s.key === style);
      const fits = styleFitsSize('single', content, style, size);
      ok(has === fits, `${content}:${style} 在 ${size} 的 chip 可见性与 styleFitsSize 必须一致`);
    }
  }
  // 样式设置字段表：6 款新样式都要声明可用字段，且 normalizeOpts 会保留/过滤
  for (const [content, style] of [['timeDate', 'ringClock'], ['timeDate', 'dotClock'], ['timeDate', 'boldClock'], ['schedule', 'capsule'], ['schedule', 'targetDay'], ['progress', 'multiBars']]) {
    const def = styleDef('single', content, style);
    ok(def && Array.isArray(def.opts) && def.opts.every((k) => STYLE_OPT_FIELDS[k]),
      `${content}:${style} 必须声明样式设置字段，且字段须已在 STYLE_OPT_FIELDS 注册`);
  }
  const norm = normalizeOpts({ color: '#ff9f0a', text: '  项目上线  ', date: '2026-11-11', bogus: 'x' });
  ok(norm.color === '#ff9f0a', 'normalizeOpts 应保留合法 color');
  ok(norm.text === '项目上线', 'normalizeOpts 应 trim text');
  ok(norm.date === '2026-11-11', 'normalizeOpts 应保留合法 date');
  ok(norm.bogus === undefined, 'normalizeOpts 应丢弃白名单外字段');
  ok((normalizeOpts({ color: 'red' }) || {}).color === undefined, 'normalizeOpts 应丢弃非法 color');
  ok((normalizeOpts({ date: '2026-13-99' }) || {}).date === undefined, 'normalizeOpts 应丢弃非法 date');
  ok(((normalizeOpts({ text: 'x'.repeat(40) }) || {}).text || '').length <= 24, 'normalizeOpts 应截断过长 text');
  // 单独模式的日程样式不能被拼接模式的分支吞掉（回归守卫）
  ok(SINGLE_CONTENTS.some((c) => c.key === 'schedule' && c.styles.some((s) => s.key === 'capsule')),
    'SINGLE_CONTENTS 的 schedule 应含 capsule 样式');
}

// v2.10：移除旧文字样式 + 新增 5 款（极简条钟 / 文字时钟 / 巨型天数 / 四环进度 / 年热力图）
{
  const REMOVED = ['led', 'analog', 'flip', 'yearCal', 'weekCal', 'flipMonthDay',
    'holidayCountdown', 'recentEvent', 'year', 'month', 'week', 'day', 'recentSchedule'];
  const allKeys = SINGLE_CONTENTS.flatMap((c) => c.styles.map((x) => x.key));
  for (const k of REMOVED) {
    ok(!allKeys.includes(k), `单独模式不应再提供旧样式 ${k}（需求：只保留今天新增的图形化样式）`);
  }
  ok(SINGLE_CONTENTS.every((c) => c.styles.length > 0), '每个单独内容都必须至少剩 1 个可用样式');

  const cases = [
    ['timeDate', 'stripeClock', 'pv-st-time', '2x2'],
    ['timeDate', 'wordClock', 'pv-wc-main', '2x4'],
    ['progress', 'ringProgress', 'pv-rp-ring', '2x4'],
    ['progress', 'heatYear', 'pv-hy', '2x4'],
  ];
  for (const [content, style, needle, size] of cases) {
    const h = flatten(renderInfoBlock({ ...base, content, style, singleRow: true, size })).join('');
    ok(h.includes(needle), `单独 ${content}:${style} 应渲染 .${needle}`);
  }
  // 四环进度：4 条弧
  const rpHtml = flatten(renderInfoBlock({ ...base, content: 'progress', style: 'ringProgress', singleRow: true, size: '2x4' })).join('');
  ok((rpHtml.match(/stroke-dasharray/g) || []).length === 4, `四环进度应有 4 条弧，实际 ${(rpHtml.match(/stroke-dasharray/g) || []).length}`);
  // 年热力图：格数 = 当年天数
  const hyHtml = flatten(renderInfoBlock({ ...base, content: 'progress', style: 'heatYear', singleRow: true, size: '2x4' })).join('');
  ok((hyHtml.match(/<i /g) || []).length === 365, `年热力图应有 365 格，实际 ${(hyHtml.match(/<i /g) || []).length}`);
  ok((hyHtml.match(/class="[^"]*now/g) || []).length === 1, '年热力图应有且仅有 1 个今天格');
  // 文字时钟：中文数字时间 + 年份数字转换
  const wcHtml = flatten(renderInfoBlock({ ...base, content: 'timeDate', style: 'wordClock', singleRow: true, size: '2x4' })).join('');
  ok(/[〇一二三四五六七八九十]+时/.test(wcHtml), '文字时钟中文模式应输出「…时」的中文数字时间');
  ok(wcHtml.includes('二〇二六年'), '文字时钟年份应逐位转中文数字（二〇二六年）');
  // v3.13：bigDays 已全尺寸移除（与 targetDay 重复）—— 渲染分支删除，旧配置走尺寸门禁
  {
    const bdGone = flatten(renderInfoBlock({ ...base, content: 'schedule', style: 'bigDays', singleRow: true, size: '2x2' })).join('');
    ok(!bdGone.includes('pv-bd-num'), 'bigDays 已移除：不应再渲染 .pv-bd-num');
    ok(bdGone.includes('不适用于此卡片尺寸') || bdGone.includes('not available'), 'bigDays 旧配置应提示重新选择样式');
    for (const size of ['1x1', '1x2', '2x1', '2x2', '2x4', '4x4', '1xfull']) {
      ok(styleFitsSize('single', 'schedule', 'bigDays', size) === false, `bigDays 在 ${size} 应已下线`);
    }
  }

  // 迁移：历史配置里被移除的样式应自动落到现存样式，不产生空白卡
  const mig = sanitizeBlocks([{ c: 'timeDate', s: 'led' }], 'single', '2x2');
  ok(mig.length === 1 && mig[0].c === 'timeDate', '历史 led 配置应保留 timeDate 内容');
  ok(SINGLE_CONTENTS.find((x) => x.key === 'timeDate').styles.some((x) => x.key === mig[0].s),
    `历史 led 配置应迁移到现存样式，实际 ${mig[0].s}`);

  // 新样式的尺寸门控声明必须与 stylesForSize 一致
  for (const [content, style] of [['timeDate', 'wordClock'], ['progress', 'heatYear']]) {
    for (const size of ['1x1', '1x2', '2x1', '2x2', '2x4', '4x4', '1xfull']) {
      const has = stylesForSize('single', content, size).some((x) => x.key === style);
      ok(has === styleFitsSize('single', content, style, size), `${content}:${style} 在 ${size} 的可见性须与 styleFitsSize 一致`);
    }
  }
}


// ---------- v2.11：仪图 / 时光倒计时 / 格阵粒度与形状 / 生命周期进度 ----------
{
  const b0 = { ...base, singleRow: true, singleScale: 1, availW: 99, availH: 99 };
  const dial = flatten(renderInfoBlock({ ...b0, content: 'gauge', style: 'dial', size: '2x2' })).join('');
  ok(dial.includes('pv-gl-dial'), '仪图:dial 应渲染 .pv-gl-dial');
  ok(/今年已过|Year/.test(dial), '仪图:dial 应带底部说明');
  const semi = flatten(renderInfoBlock({ ...b0, content: 'gauge', style: 'semiGauge', size: '1x2' })).join('');
  ok(semi.includes('pv-sg-wrap'), '仪图:semiGauge 应渲染 .pv-sg-wrap');

  const ygW = flatten(renderInfoBlock({ ...b0, content: 'progress', style: 'yearGrid', size: '2x2', opts: { unit: 'week' } })).join('');
  ok((ygW.match(/<i /g) || []).length === 7, `格阵 unit=week 应 7 格，实际 ${(ygW.match(/<i /g) || []).length}`);
  const ygD = flatten(renderInfoBlock({ ...b0, content: 'progress', style: 'yearGrid', size: '2x4', opts: { unit: 'day' } })).join('');
  ok((ygD.match(/<i /g) || []).length === 24, `格阵 unit=day 应 24 格，实际 ${(ygD.match(/<i /g) || []).length}`);
  const ygDot = flatten(renderInfoBlock({ ...b0, content: 'progress', style: 'yearGrid', size: '4x4', opts: { shape: 'dot' } })).join('');
  ok(ygDot.includes('pv-yg-grid dot'), '格阵 shape=dot 应加 dot 类');

  const mbLife = flatten(renderInfoBlock({ ...b0, content: 'progress', style: 'multiBars', size: '2x2', opts: { bars: 'life', age: 30, life: 85 } })).join('');
  ok(mbLife.includes('生命') || mbLife.includes('Life'), 'multiBars 勾选 life 时应出现生命进度');
  ok((mbLife.match(/pv-mb-row/g) || []).length === 1, `multiBars 只勾 life 时应仅 1 行，实际 ${(mbLife.match(/pv-mb-row/g) || []).length}`);
  // v3.12：未显式配置 age/life 时，按 STYLE_OPT_FIELDS 默认值（18/120）渲染生命行；
  // 只有 age/life 显式填成非法值（如 0 或空）时才不出现。
  const mbNoAge = flatten(renderInfoBlock({ ...b0, content: 'progress', style: 'multiBars', size: '2x2', opts: { bars: 'life' } })).join('');
  ok(mbNoAge.includes('生命'), 'v3.12：未填 age/life 时生命行按默认 18/120 渲染');
  const mbBadLife = flatten(renderInfoBlock({ ...b0, content: 'progress', style: 'multiBars', size: '2x2', opts: { bars: 'life', age: '', life: '' } })).join('');
  ok(!mbBadLife.includes('生命'), 'age/life 显式为空时不应出现生命进度');
  const mbZeroLife = flatten(renderInfoBlock({ ...b0, content: 'progress', style: 'multiBars', size: '2x2', opts: { bars: 'life', age: 30, life: 0 } })).join('');
  ok(!mbZeroLife.includes('生命'), '预计年龄为 0（非法）时不应出现生命进度');

  const listEmpty = flatten(renderInfoBlock({ ...b0, content: 'schedule', style: 'list', size: '2x2' })).join('');

  ok(stylesForSize('single', 'progress', '2x2').length >= 1, 'stylesForSize 应返回可用样式');
  const n1 = normalizeOpts({ unit: 'week', shape: 'dot', bars: 'y,life', age: 30, life: 85, ids: ['a', 'b'] });
  ok(n1.unit === 'week' && n1.shape === 'dot' && n1.bars === 'y,life', 'normalizeOpts 应接受 unit / shape / bars');
  ok(n1.age === 30 && n1.life === 85, 'normalizeOpts 应接受 age / life');
  ok(normalizeOpts({ sched: 's_abc' }).sched === 's_abc', 'normalizeOpts 应接受关联日程 id');
  {
    // v2.16 回归点：写入口自我调用会无限递归，导致点「确定」后整个组件更新抛栈溢出
    const cfgSrc = readFileSync(new URL('../src/components/widgetConfig.js', import.meta.url), 'utf8');
    const seg = cfgSrc.slice(cfgSrc.indexOf('_writeBlocks(next) {'), cfgSrc.indexOf('_writeBlocks(next) {') + 220);
    ok(seg.includes('this.cardBlocks = next;'), '写入口 _writeBlocks 必须直接赋值 cardBlocks');
    ok(!seg.includes('this._writeBlocks('), '写入口 _writeBlocks 不得自我调用（栈溢出回归点）');
  }
  {
    const kept = sanitizeBlocks([{ c: 'schedule', s: 'targetDay', opts: { color: '#ff3b30', sched: 's_1' } }], 'single', '2x2');
    ok(kept.length === 1 && kept[0].opts && kept[0].opts.color === '#ff3b30' && kept[0].opts.sched === 's_1',
      '单独模式保存必须保留 opts（设置不生效的回归点）');
    ok(kept[0].c === 'schedule' && kept[0].s === 'targetDay', '单独模式块的内容与样式键应保持');
  }
  ok(!(normalizeOpts({ sched: 'x'.repeat(60) }) || {}).sched, 'normalizeOpts 应丢弃过长日程 id');
  ok(Object.keys(normalizeOpts({ unit: 'x', shape: 'y', bars: 'zz' }) || {}).length === 0, 'normalizeOpts 应丢弃非法枚举值');
}

// ===== v3.1：新增样式的渲染与尺寸门控 =====
{
  const f = flatten(renderInfoBlock({ ...base, content: 'important', style: 'festival', singleRow: true, size: '2x2' })).join('');
  ok(f.includes('pv-fe-name'), '节日卡应渲染 .pv-fe-name 主名');
  ok(f.includes('pv-fe-gap'), '节日卡应渲染「N 天后」胶囊');
  const hd = flatten(renderInfoBlock({ ...base, content: 'schedule', style: 'holidayNext', singleRow: true, size: '2x1' })).join('');
  ok(hd.includes('pv-hd-days') || hd.includes('暂无假期'),
    '节假日(采用假期倒计时排版)应渲染 pv-hd-days 或「暂无假期」空态（node 无节假日服务时走空态）');
  const bt = flatten(renderInfoBlock({ ...base, content: 'progress', style: 'battery', singleRow: true, size: '2x2' })).join('');
  ok(bt.includes('pv-bt-body') && bt.includes('%'), '年电量应渲染电池主体与百分比');
  // v3.56：单独模式电量条保留装饰（分段刻度 <u> 与条下方端点 pv-bt-nub）
  ok(bt.includes('pv-bt-nub'), '单独模式电量条应保留下方端点 pv-bt-nub');
  ok(bt.includes('<u'), '单独模式电量条应保留分段刻度 <u>');
  // v3.12：1×2 去掉 festival；1×1 整块清空（改由新款式承担）。
  // v3.13：holiday 恢复到 1×2 与 2×1（用户点名启用）；festival 仍不在 1×2 / 2×1。
  // v3.14：「重要日期」并入「日程」—— 旧 content key 'important' 在单独模式已不存在，
  // 断言全部改到新 key 'schedule' 上（渲染层的 aliasContent 负责迁移存量配置）。
  // 注意：stylesForSize 在「一个都不适配」时会回落到该内容的第一个样式（不留给用户空白），
  // 所以尺寸门控必须用 styleFitsSize 断言（chip 可见性的唯一真源）。
  ok(styleFitsSize('single', 'schedule', 'festival', '1x2') === false,
    '节日卡在 1x2 尺寸下应被隐藏');
  ok(styleFitsSize('single', 'schedule', 'holiday', '1x2') === false,
    '假期倒计时(holiday)已在 v3.20 下线，1x2 不应再可选');
  ok(styleFitsSize('single', 'schedule', 'holiday', '2x1') === false,
    '假期倒计时(holiday)已在 v3.20 下线，2x1 不应再可选');
  ok(styleFitsSize('single', 'schedule', 'festival', '2x1') === false,
    '节日卡在 2x1 尺寸下应被隐藏');
  ok(styleFitsSize('single', 'schedule', 'festival', '2x2') === true,
    '节日卡在 2x2 尺寸下应可选');
  // v3.14：festivalDay（节日节假日）在 1×1 / 1×2 / 2×1 提供
  for (const size of ['1x1', '1x2', '2x1']) {
    ok(styleFitsSize('single', 'schedule', 'festivalDay', size) === true,
      `节日节假日在 ${size} 尺寸下应可选（v3.14 新增）`);
  }
  // v3.14：旧内容类 key 在单独模式必须返回 false（已合并），但渲染层要能迁移
  for (const size of ['1x1', '1x2', '2x1', '2x2', '2x4', '4x4', '1xfull']) {
    ok(styleFitsSize('single', 'important', 'festival', size) === false,
      `v3.14：important 内容类在单独模式已合并，${size} 应返回 false`);
    ok(styleFitsSize('single', 'gauge', 'dial', size) === false,
      `v3.14：gauge 内容类在单独模式已合并，${size} 应返回 false`);
  }
  // v3.51：拼接模式也把「重要日期」并入「日程」（图标沿用重要日期 ⭐）
  ok(styleFitsSize('combo', 'schedule', 'festival', '2x2') === true,
    '拼接模式 schedule 含 festival（原重要日期并入）');
  ok(styleFitsSize('combo', 'schedule', 'holidayGap', '2x2') === true,
    '拼接模式 schedule 含 holidayGap（原重要日期并入）');
  // v3.14：内容类别名表
  ok(aliasContent('important') === 'schedule' && aliasContent('gauge') === 'progress',
    'CONTENT_ALIAS 应把 important→schedule、gauge→progress');
  ok(aliasContent('schedule') === 'schedule' && aliasContent('time') === 'time',
    'aliasContent 对未合并的 key 应原样返回');
  // 存量配置经 sanitizeBlocks 迁移后应落到新内容类，且样式仍可用
  {
    const mig = sanitizeBlocks([{ c: 'important', s: 'festival' }], 'single', '2x2');
    ok(mig.length === 1 && mig[0].c === 'schedule' && mig[0].s === 'festival',
      `旧 important.festival 配置应迁移到 schedule.festival，实际 ${JSON.stringify(mig[0] || {})}`);
    const mig2 = sanitizeBlocks([{ c: 'gauge', s: 'dial' }], 'single', '4x4');
    ok(mig2.length === 1 && mig2[0].c === 'progress' && mig2[0].s === 'dial',
      `旧 gauge.dial 配置应迁移到 progress.dial，实际 ${JSON.stringify(mig2[0] || {})}`);
    // v3.51：拼接模式也迁移（重要日期已并入日程）
    const comboMig = sanitizeBlocks([{ c: 'important', s: 'festival', span: { cols: 2, rows: 1 } }], 'combo', '2x2');
    ok(comboMig.length === 1 && comboMig[0].c === 'schedule',
      '拼接模式的 important 配置也迁移到 schedule');
    // 渲染层也要认旧 key（存量配置不重新保存也能正常显示）
    const oldRender = flatten(renderInfoBlock({ ...base, content: 'important', style: 'festival', singleRow: true, size: '2x2' })).join('');
    ok(oldRender.includes('pv-fe-name'), '渲染层应接受旧 content key important（别名迁移）');
    const oldRender2 = flatten(renderInfoBlock({ ...base, content: 'gauge', style: 'dial', singleRow: true, size: '4x4' })).join('');
    ok(oldRender2.includes('pv-gl-val'), '渲染层应接受旧 content key gauge（别名迁移）');
  }
  // v3.14：schedule.nextUp 全尺寸移除
  for (const size of ['1x1', '1x2', '2x1', '2x2', '2x4', '4x4', '1xfull']) {
    ok(styleFitsSize('single', 'schedule', 'nextUp', size) === false,
      `nextUp 在 ${size} 应已下线（v3.14 全尺寸移除）`);
  }
  const nuGone = flatten(renderInfoBlock({ ...base, content: 'schedule', style: 'nextUp', singleRow: true, size: '1x1' })).join('');
  ok(!nuGone.includes('pv-nu-time'), 'nextUp 渲染分支应已删除');
}

// v3.51：进图四样式合并为「电量条」（粒度可切 年/月/周/日），移到「日历」下；拼接不再单列 progress 内容
const comboCal = COMBO_CONTENTS.find((x) => x.key === 'calendar');
ok(!!comboCal, '拼接模式有日历内容');
const calBattery = comboCal && comboCal.styles.find((x) => x.key === 'battery');
ok(!!calBattery, '日历下提供电量条样式（原进图四样式合并）');
ok(calBattery && Array.isArray(calBattery.opts) && calBattery.opts.includes('unit'), '电量条应带粒度选项(unit=年/月/周/日)');
const comboBattery = flatten(renderInfoBlock({ ...base, content: 'calendar', style: 'battery' })).join('');
ok(comboBattery.includes('pv-bt'), '日历:电量条 应渲染 .pv-bt');
// v3.56：拼接模式电量条为极简版，不应有下方端点 pv-bt-nub 与分段刻度 <u>
ok(!comboBattery.includes('pv-bt-nub'), '拼接模式电量条不应有下方端点 pv-bt-nub');
ok(!comboBattery.includes('<u'), '拼接模式电量条不应有分段刻度 <u>');

// ---------------------------------------------------------------------------
// v3.3：年月日「两行」与 1×FULL 字号随内容区宽度
// 用户实测：1×2（窄高）卡片上「年月日」实际显示三排，预览只有两排 → 以预览为准。
// 根因：日期串依赖自动折行，字号一变折行位置就变；窄块改为显式两行后与预览一致。
const tallHTML = flatten(renderBlocksHTML({
  ...base,
  blocks: layoutBlocks([{ c: 'time', s: 'dateFull' }], 'combo', '2x1', { cols: 1, rows: 2 }),
  grid: { cols: 1, rows: 2 },
  cellW: 120,
  cellH: 126,
  size: '2x1',
})).join('');
const tallText = tallHTML.replace(/<[^>]+>/g, '');
const y2 = String(base.now.getFullYear()).slice(-2);
const moNow = base.now.getMonth() + 1;
const dayNow = base.now.getDate();
ok(tallText.includes(`${y2}年${moNow}月`), `窄高块 年月日 首行应为「${y2}年${moNow}月」，实际「${tallText.trim().slice(0, 40)}」`);
ok(tallText.includes(`${dayNow}日`), `窄高块 年月日 次行应为「${dayNow}日」，实际「${tallText.trim().slice(0, 40)}」`);
// v3.6：窄/高块回到竖排三行（pv-vstack + pv-vline），预览与实际同用真实像素几何。
// 用户澄清 1×2 是窄高卡，三行「26年/10月/22日」是期望形态；预览与实际的不一致
// 根源在预览框 cellH 估算（14px 内边距）与真实卡片（24px）不同，已在 widgetConfig 修正。
ok(tallHTML.includes('pv-vstack'), '窄高块 年月日 应走竖排（pv-vstack）');
ok((tallHTML.match(/pv-vline/g) || []).length >= 2, `窄高块 年月日 竖排至少两行，实际 ${(tallHTML.match(/pv-vline/g) || []).length}`);

const wideHTML = flatten(renderBlocksHTML({
  ...base,
  blocks: layoutBlocks([{ c: 'time', s: 'dateFull' }], 'combo', '1x2', { cols: 2, rows: 1 }),
  grid: { cols: 2, rows: 1 },
  cellW: 126,
  cellH: 120,
  size: '1x2',
})).join('');
const wideText = wideHTML.replace(/<[^>]+>/g, '');
ok(!wideHTML.includes('pv-flip'), `宽扁块 年月日 不应走竖排两行，实际「${wideHTML.replace(/<[^>]+>/g, '').trim().slice(0, 40)}」`);
ok(/2026|26/.test(wideText), `宽扁块 年月日 应保留年份，实际「${wideText.trim().slice(0, 40)}」`);

// 1×FULL：一行高的横条，内容高度是硬约束 → 基准字号由「高度」决定（h/6.7，设计基准 1080×120/18px），
// 宽度只做上限兜底（w/24）。旧公式 w/60 只看宽度，真实 1386.88×346.72 上字号只有设计值的 1.28 倍
// 而高度是 2.89 倍，内容缩成中间一小块（用户实测「1×FULL 一批样式变形」）。
const pxOf = (htmlText) => {
  const m = htmlText.match(/font-size:([0-9.]+)px/);
  return m ? Number(m[1]) : NaN;
};
const fullPx = (w, h) => pxOf(flatten(renderInfoBlock({ ...base, content: 'timeDate', style: 'dateFull', singleRow: true, size: '1xfull', w, h })).join(''));
const full1080h120 = fullPx(1080, 120);
const full2000h120 = fullPx(2000, 120);
const full520h120 = fullPx(520, 120);
ok(Math.abs(full1080h120 - 17.91) < 0.05, `1×FULL 设计基准 1080×120 字号应为 120/6.7≈17.91px，实际 ${full1080h120}`);
ok(Math.abs(full1080h120 - full2000h120) < 0.05 && Math.abs(full520h120 - full1080h120) < 0.05,
  `1×FULL 同高不同宽字号应一致（高度决定），实际 520=${full520h120} 1080=${full1080h120} 2000=${full2000h120}`);
const full1080h240 = fullPx(1080, 240);
ok(full1080h240 > full1080h120 * 1.9, `1×FULL 高度翻倍字号应近似翻倍，实际 ${full1080h120} → ${full1080h240}`);
const fullNarrow = fullPx(300, 120);
ok(fullNarrow < full1080h120, `1×FULL 过窄时应被宽度兜底压小字号，实际 ${fullNarrow} vs ${full1080h120}`);
ok(fullPx(1386.88, 346.72) > 45, `1×FULL 真实面板（1386.88×346.72）字号应约 51.7px，实际 ${fullPx(1386.88, 346.72)}`);
ok(full1080h240 <= 56, `1×FULL 字号上限 56px，实际 ${full1080h240}`);
ok(full1080h120 >= 16 && full1080h120 <= 20, `1×FULL 在 1080px 应≈18px，实际 ${full1080h120}`);

// v3.5：进度格阵的行列数改为按容器宽高择优（格子接近正方形），因此恢复 1×FULL 档；
// 年热力图是 12 列 × 各月天数的固定结构，宽扁卡里无法自洽，仍不提供 1×FULL。
{
  const ygDef = SINGLE_CONTENTS.find((c) => c.styles.some((s) => s.key === 'yearGrid'));
  const ygSt = ygDef && ygDef.styles.find((s) => s.key === 'yearGrid');
  ok(!!(ygSt && ygSt.sizes && ygSt.sizes.includes('1xfull')), '进度格阵应恢复 1xfull 尺寸档（行列自适应）');

// ── v3.7：方向判定的单一来源 + 格子正方形 ──────────────────────────────
// ① 缺像素几何（样式条小预览）时必须按尺寸名兜底，不能退化成「单行/双行」两套形态；
//    否则又会出现「小预览两排、真实卡片三排」的反复回潮。
{
  const mk = (extra) => flatten(renderInfoBlock({
    ...base, content: 'time', style: 'dateFull', singleRow: true, size: '2x1', ...extra,
  })).join('');
  const withPx = mk({ w: 120, h: 252 });
  const noPx = mk({});
  const vline = (h) => (h.match(/pv-vline/g) || []).length;
  ok(vline(withPx) === vline(noPx),
    `样式条小预览与真实卡片的竖排行数必须一致（带像素 ${vline(withPx)} / 无像素 ${vline(noPx)}）`);
  ok(vline(withPx) >= 2, `2×1 窄高卡 年月日 应竖排（≥2 行），实际 ${vline(withPx)}`);
  const wide = flatten(renderInfoBlock({
    ...base, content: 'time', style: 'dateFull', singleRow: true, size: '1x2', w: 252, h: 120,
  })).join('');
  ok(vline(wide) === 0, `1×2 宽扁卡 年月日 应单行（无 .pv-vline），实际 ${vline(wide)}`);
}

// ② 尺寸方向表必须与 SunPanel 的「行×列」命名一致（1x2 宽扁 / 2x1 窄高）
{
  const o = SIZE_ORIENT;
  ok(o['1x2'].rows === 1 && o['1x2'].cols === 2, '1x2 应为 1 行 2 列（宽扁）');
  ok(o['2x1'].rows === 2 && o['2x1'].cols === 1, '2x1 应为 2 行 1 列（窄高）');
  ok(isTallBlock(120, 252) === true && isTallBlock(252, 120) === false, 'isTallBlock 方向判定应正确');
}

// ③ v3.12：年格阵的格子几何**已由 JS 内联 em 轨道改为 CSS 用 --cell 推导** ——
//    JS 只传 --cols/--rows 两个整数，CSS 从容器真实尺寸（100cqw/100cqh）算正方形格边长。
//    这样「不裁切」成为结构性保证：总宽 = cols×cell + (cols−1)×gap ≤ 100cqw 恒成立。
{
  const css = SHARED_CSS;
  ok(/\.pv-yg-grid \{[^}]*--cols:\s*31[^}]*--rows:\s*12/.test(css),
    '年格阵容器应声明 --cols/--rows 兜底（31/12）');
  ok(/\.pv-yg-grid \{[^}]*--cell:\s*min\(/.test(css),
    '年格阵容器应由 --cell 的 min() 推导格边长（宽度解/高度解/上限三值齐全）');
  ok(/\.pv-yg-grid \{[^}]*100cqw[^}]*100cqh/.test(css),
    '年格阵的 --cell 应用容器查询单位（真实内容盒，不是 JS 预测值）');
  ok(/\.pv-yg-body \{[^}]*container-type:\s*size/.test(css),
    '年格阵区（.pv-yg-body）应声明 container-type:size（提供 100cqw/100cqh）');
  ok(/\.pv-yg-grid \{[^}]*grid-template-columns:\s*repeat\(var\(--cols\),\s*var\(--cell\)\)/.test(css)
    && /\.pv-yg-grid \{[^}]*grid-template-rows:\s*repeat\(var\(--rows\),\s*var\(--cell\)\)/.test(css),
  '年格阵行/列轨道应由同一个 --cell 定义（格子恒正方形）');
  ok(/\.pv-yg-grid i \{[^}]*width:\s*100%[^}]*height:\s*100%/.test(css),
    '年格阵格子应铺满 em 轨道（width/height 100%）');
  ok(!/\.pv-yg-grid i \{[^}]*aspect-ratio/.test(css),
    '年格阵格子不应再用 aspect-ratio（轨道本身是正方形 em 尺寸）');
  ok(!/100cqw\s*\/\s*31/.test(css) && !/100cqh\s*\/\s*12/.test(css),
    '年格阵不应再写死 31 列/12 行的容器查询分母（v3.8 已改渲染层择优）');
  ok(/\.pv-hy i \{[^}]*width:\s*100%[^}]*height:\s*100%/.test(css),
    '年热力图格子应铺满月份列（width/height 100%）');
  ok(/\.pv-vstack \{[^}]*container-type:\s*inline-size/.test(css),
    '竖排容器应声明 container-type: inline-size（供 .fit 行宽收缩）');
  ok(/\.pv-vline\.fit \{ font-size:\s*min\(1\.25em, calc\(100cqw \/ var\(--w/.test(css),
    '竖排行应有 .fit 宽度自适应规则（min(1.25em, 100cqw/--w)）');
  // 渲染层：单独模式年格阵只内联 --cols/--rows（**不得**再内联 grid-template 轨道）
  const ygSingle = flatten(renderInfoBlock({
    ...base, content: 'progress', style: 'yearGrid', singleRow: true, size: '2x2', w: 252, h: 252,
  })).join('');
  ok(/--cols:\d+;--rows:\d+/.test(ygSingle),
    '单独模式年格阵应内联 --cols/--rows（两个整数）');
  ok(!/grid-template-columns/.test(ygSingle),
    '单独模式年格阵不得再内联 grid-template 轨道（真源只有 CSS 一处，否则两个真源打架）');
  ok(ygSingle.includes('pv-yg-body'), '年格阵应包在 .pv-yg-body 里（container-type:size 的载体）');
  const ygFull = flatten(renderInfoBlock({
    ...base, content: 'progress', style: 'yearGrid', singleRow: true, size: '1xfull', w: 1080, h: 120,
  })).join('');
  const colsFull = Number((ygFull.match(/--cols:(\d+)/) || [])[1]);
  ok(colsFull >= 30, `1×FULL 年格阵列数应随宽扁几何增多（≥30），实际 ${colsFull}`);
  // 窄高卡年月日：两排 + .fit + 容器 --w，且竖排内不得出现 <wbr>（折行根因）
  const tallV = flatten(renderInfoBlock({
    ...base, content: 'time', style: 'dateFull', singleRow: true, size: '2x1', w: 120, h: 252,
  })).join('');
  ok(tallV.includes('pv-vstack" style="--w:'), '窄高卡年月日竖排容器应写 --w（行宽模型）');
  ok((tallV.match(/pv-vline fit/g) || []).length === 2, '窄高卡年月日应为两排 .pv-vline.fit');
  ok(!/<wbr>/.test(tallV), '窄高卡年月日竖排不得含 <wbr>（nowrap 下仍会断行 → 三排）');
}

  const hyDef = SINGLE_CONTENTS.find((c) => c.styles.some((s) => s.key === 'heatYear'));
  const hySt = hyDef && hyDef.styles.find((s) => s.key === 'heatYear');
  ok(!(hySt && hySt.sizes && hySt.sizes.includes('1xfull')), '年热力图不应提供 1xfull 尺寸档');
}

// ---------- v3.12 / v3.13 尺寸门控矩阵 ----------
// v3.12：用户逐条点名下线；v3.13：又逐尺寸点名启用/停用，且 bigDays 全尺寸移除。
// 两个矩阵都必须用 styleFitsSize 断言（stylesForSize 有空回落，会假绿）。
{
  const MUST_NOT = [
    // 1×1：原有选项全部清空（只保留 4 款新做）
    ['1x1', 'timeDate', 'dayNum'], ['1x1', 'timeDate', 'miniMonth'], ['1x1', 'timeDate', 'stackTime'],
    ['1x1', 'timeDate', 'dualZone'], ['1x1', 'timeDate', 'ringClock'], ['1x1', 'timeDate', 'dotClock'],
    ['1x1', 'timeDate', 'boldClock'], ['1x1', 'timeDate', 'stripeClock'], ['1x1', 'timeDate', 'wordClock'],
    ['1x1', 'schedule', 'capsule'], ['1x1', 'schedule', 'targetDay'], ['1x1', 'schedule', 'bigDays'],
    ['1x1', 'progress', 'yearGrid'], ['1x1', 'progress', 'yearBars'], ['1x1', 'progress', 'weekGrid'],
    ['1x1', 'progress', 'multiBars'], ['1x1', 'progress', 'ringProgress'], ['1x1', 'progress', 'heatYear'],
    ['1x1', 'progress', 'battery'], ['1x1', 'progress', 'stackBars'],
    
    ['1x1', 'important', 'festival'], ['1x1', 'important', 'holiday'],
    // 1×2：ringClock / festival 仍下线（v3.13 恢复了 targetDay / holiday）
    ['1x2', 'timeDate', 'ringClock'],
    // 2×1：v3.13 恢复了一批，但仍下线这些
    ['2x1', 'timeDate', 'dualZone'], ['2x1', 'timeDate', 'ringClock'], ['2x1', 'timeDate', 'dotClock'],
    ['2x1', 'timeDate', 'boldClock'], ['2x1', 'timeDate', 'stripeClock'], ['2x1', 'timeDate', 'wordClock'],
    ['2x1', 'timeDate', 'miniMonth'],
    ['2x1', 'schedule', 'capsule'],
    ['2x1', 'progress', 'yearGrid'], ['2x1', 'progress', 'yearBars'], ['2x1', 'progress', 'weekGrid'],
    ['2x1', 'progress', 'multiBars'], ['2x1', 'progress', 'ringProgress'], ['2x1', 'progress', 'heatYear'],
    ['2x1', 'progress', 'battery'], ['2x1', 'progress', 'stackBars'],
    
    
    // 1×FULL：dial + semiGauge + multiBars
    
    ['1xfull', 'progress', 'multiBars'],
    // 2×2：stackBars（v3.13 停用）
    ['2x2', 'progress', 'stackBars'],
  ];
  // bigDays 在所有尺寸都必须下线（用户：与 targetDay 重复）
  for (const size of ['1x1', '1x2', '2x1', '2x2', '2x4', '4x4', '1xfull']) {
    MUST_NOT.push([size, 'schedule', 'bigDays']);
  }
  for (const [size, c, s] of MUST_NOT) {
    ok(styleFitsSize('single', c, s, size) === false,
      `尺寸门控：${c}.${s} 不应提供 ${size} 单独模式`);
  }
  // 必须保留的组合（v3.12 新样式 + v3.13 逐尺寸启用清单）
  const MUST = [
    // 1×1 / 2×1 新做 4+4 款
    ['1x1', 'timeDate', 'lunarDate'], ['1x1', 'timeDate', 'dayStack'],
    ['1x1', 'progress', 'dayRing'],
    ['2x1', 'timeDate', 'tallClock'], ['2x1', 'timeDate', 'weekColumn'],
    ['2x1', 'schedule', 'verticalList'], ['2x1', 'progress', 'lifeBar'],
    // 1×2 启用（v3.13）
    ['1x2', 'timeDate', 'wordClock'], ['1x2', 'timeDate', 'lunarDate'], ['1x2', 'timeDate', 'dayStack'],
    ['1x2', 'schedule', 'targetDay'], ['1x2', 'schedule', 'holidayNext'],
    // 2×1 启用（v3.13）
    ['2x1', 'timeDate', 'dayNum'], ['2x1', 'timeDate', 'stackTime'], ['2x1', 'timeDate', 'lunarDate'],
    ['2x1', 'timeDate', 'dayStack'], ['2x1', 'schedule', 'targetDay'], ['2x1', 'schedule', 'holidayNext'],
    // 2×2 启用（v3.13）
    ['2x2', 'timeDate', 'lunarDate'], ['2x2', 'timeDate', 'dayStack'], ['2x2', 'timeDate', 'tallClock'],
    ['2x2', 'timeDate', 'weekColumn'], ['2x2', 'schedule', 'capsule'],
    ['2x2', 'schedule', 'verticalList'], ['2x2', 'progress', 'dial'],
    // 2×4 启用（v3.13）
    ['2x4', 'timeDate', 'dayNum'], ['2x4', 'timeDate', 'lunarDate'], ['2x4', 'timeDate', 'weekColumn'],
    ['2x4', 'schedule', 'verticalList'],
    // 4×4 启用（v3.13）
    ['4x4', 'timeDate', 'dayNum'], ['4x4', 'timeDate', 'miniMonth'], ['4x4', 'timeDate', 'lunarDate'],
    ['4x4', 'timeDate', 'dayStack'], ['4x4', 'timeDate', 'tallClock'], ['4x4', 'timeDate', 'weekColumn'],
    ['4x4', 'schedule', 'verticalList'],
    // 1×FULL 启用（v3.13）+ 原有 10 款适配目标
    ['1xfull', 'timeDate', 'dayNum'], ['1xfull', 'timeDate', 'lunarDate'], ['1xfull', 'timeDate', 'dayStack'],
    ['1xfull', 'timeDate', 'dualZone'], ['1xfull', 'timeDate', 'ringClock'],
    ['1xfull', 'timeDate', 'stripeClock'], ['1xfull', 'timeDate', 'wordClock'],
    ['1xfull', 'progress', 'ringProgress'],
    ['1xfull', 'timeDate', 'dotClock'], ['1xfull', 'schedule', 'capsule'],
    ['1xfull', 'schedule', 'festival'], ['1xfull', 'schedule', 'targetDay'],
    ['1xfull', 'progress', 'stackBars'],
    // yearGrid 年/月/周/日 与 multiBars 在三种卡上都要可用
    ['2x2', 'progress', 'yearGrid'], ['2x4', 'progress', 'yearGrid'],
    ['4x4', 'progress', 'yearGrid'], ['1xfull', 'progress', 'yearGrid'],
    ['2x2', 'progress', 'multiBars'], ['2x4', 'progress', 'multiBars'], ['4x4', 'progress', 'multiBars'],
  ];
  for (const [size, c, s] of MUST) {
    ok(styleFitsSize('single', c, s, size) === true,
      `尺寸门控：${c}.${s} 应提供 ${size} 单独模式`);
  }
  // 1×1 / 2×1 / 1×2 只暴露新做的款式（数量锁定，防止以后误把旧款加回来）
  // v3.19：节日、节假日拆成独立卡（festivalNext / holidayNext）→ 1×1 4→6、1×2 17→19、2×1 11→13。
  //        旧的 festivalDay 保留，所以是「+2」而不是「替换」。
  // v3.20：假期倒计时(holiday) 下线，功能并入 holidayNext（沿用 pv-hd 排版）→ 1×2 19→18、2×1 13→12
  //        （holidayNext 本就在这两个尺寸白名单内，移除 holiday 只减 1 款）。
  for (const [size, expect] of [['1x1', 6], ['1x2', 18], ['2x1', 12]]) {
    let n = 0;
    for (const c of SINGLE_CONTENTS) for (const s of c.styles) if (styleFitsSize('single', c.key, s.key, size)) n++;
    ok(n === expect, `${size} 单独模式应恰好有 ${expect} 款样式，实际 ${n}`);
  }
  // multiBars：用户未配置 age/life 时，「生命」行必须按 STYLE_OPT_FIELDS 默认值（18/120）出现
  {
    const mbDef = STYLE_OPT_FIELDS.age.def + '/' + STYLE_OPT_FIELDS.life.def;
    const rowCount = (html) => (html.match(/pv-mb-row/g) || []).length;
    for (const size of ['2x2', '2x4', '4x4']) {
      const [dw, dh] = HOST[size] || [0, 0];
      const h = flatten(renderInfoBlock({
        ...base, content: 'progress', style: 'multiBars', singleRow: true, size,
        w: dw, h: dh, opts: {},
      })).join('');
      ok(rowCount(h) === 5, `multiBars 在 ${size} 无 opts 时应渲染 5 行（含生命 ${mbDef}），实际 ${rowCount(h)}`);
      ok(h.includes('生命'), `multiBars 在 ${size} 应含「生命」行标签`);
      // 百分比一律整数（用户要求「都不显示小数」）。
      // 注意只查 .pv-mb-v 的**文本**：条的填充宽度仍是 `width:80.0%`（那是长度不是文本）。
      const vals = (h.match(/class="pv-mb-v"[^>]*>([^<]*)</g) || []).map((x) => x.replace(/^[^>]*>/, '').replace(/<$/, ''));
      ok(vals.length === 5, `multiBars 在 ${size} 应有 5 个百分比文本，实际 ${vals.length}`);
      ok(vals.every((v) => /^\d+%$/.test(v)),
        `multiBars 在 ${size} 百分比应为整数（如 80%），实际 ${JSON.stringify(vals)}`);
      ok(/15%/.test(h), `multiBars 生命行应为 18/120 = 15%，实际未见`);
    }
  }
}

if (fails.length) {
  console.log(`✗ 失败 ${fails.length} 项 / 通过 ${pass} 项`);
  for (const f of fails.slice(0, 30)) console.log('  - ' + f);
  process.exit(1);
}
console.log(`✓ 全部通过（${pass} 项断言）`);
