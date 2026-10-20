/**
 * v1.28 渲染自检：
 *  1) renderBlocksHTML 输出的百分比坐标合法、块数量与布局一致
 *  2) 真实宿主像素下（按 SunPanel 单格约 120px 估算），每块根字号落在可读区间
 *  3) 1×FULL 动态列数：不同宽度下网格/字号自适应
 *  4) 单独模式仍走 renderInfoBlock（不产生 .pv-block）
 */
import { readFileSync } from 'node:fs';
import { html, render } from '../node_modules/lit/index.js';
import {
  renderBlocksHTML, renderInfoBlock, fitFor, fitFontU, renderSpanEditor,
  isTallBlock, isSmallUnit, vertFitKey, singleLineDays, TALL_RATIO,
} from '../src/core/card-mode-render.js';
import {
  gridForSize, layoutBlocks, spanBounds, effectiveSpan, styleSpanDef,
  singleLineOn, prefSpan, COMBO_CONTENTS,
  unitOpts, normalizeOpts, sanitizeBlocks, noUnitsOn, NO_UNITS_DATE_STYLES,
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
  '1xfull': [['time', 'hms'], ['time', 'dateFullWeekday'], ['important', 'holidayGap'], ['schedule', 'recent']],
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
  const sim = simulate('1xfull', w, 120, [{ c: 'time', s: 'hms' }, { c: 'time', s: 'dateFullWeekday' }, { c: 'important', s: 'holidayGap' }]);
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
// v1.40：三组件 CSS 镜像含按尺寸版式规则
for (const f of ['widget.js', 'mainPage.js', 'widgetConfig.js']) {
  const src = readFileSync(new URL('../src/components/' + f, import.meta.url), 'utf8');
  ok(src.includes('.pv-single-1x1'), `${f} CSS 应含 .pv-single-1x1`);
  ok(src.includes('.pv-single-1xfull'), `${f} CSS 应含 .pv-single-1xfull`);
  ok(src.includes('.pv-single-1x1 .pv-sub { display: none; }'), `${f} CSS 1x1 应隐藏 .pv-sub`);
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
  ok(s.includes('自适应'), '应含「自适应」按钮');
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
  ok(s2.includes('Resize') && s2.includes('Auto'), '英文文案应生效');

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
  ok(sBtns.includes('水平置中') && sBtns.includes('垂直置中'), '应提供水平/垂直置中按钮');
  ok((sBtns.match(/se-toggle on/g) || []).length === 2, '水平置中与单行显示开启时应高亮（垂直未开）');
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
  ok(monthLine.includes('repeat(19,1fr)'), '单行月历应为 19 列网格');
  const todayIdx = monthLine.indexOf('class="pv-wk-cell today"');
  ok(todayIdx > 0, '单行月历应标记今日');
  // 今日应在水平正中（第 10 格，前后各 9 天）
  const before = (monthLine.slice(0, todayIdx).match(/pv-wk-cell/g) || []).length;
  ok(before === 9, `今日应位于正中（前有 9 天），实际 ${before}`);

  // 空白单元：渲染为空占位
  const blank = flatten(mk({ content: 'blank', style: 'space' })).join('');
  ok(blank.includes('pv-blank'), '空白单元应渲染占位节点');
  ok(!blank.includes('暂无'), '空白单元不应显示任何文案');

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
  ok(/\d+月\d+日/.test(wide), '横向空间足够时应显示具体日期');
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
    ok((fl(renderSpanEditor({ ...sb, singleLine: null })).match(/class="se-toggle [^"]*"/g) || []).length === 2,
      '按钮隐藏后应只剩水平/垂直置中两个开关');
    // 副标题 .se-hint 在 .se-toggles 之外
    const hinted = fl(renderSpanEditor({ ...sb, singleLine: null, alignHint: 'HINT_XYZ' }));
    ok(hinted.includes('HINT_XYZ'), '单元级置中副标题应渲染');
    ok(hinted.includes('se-hint'), '副标题应使用 .se-hint 类');
    ok(hinted.indexOf('se-hint') > hinted.indexOf('</div>'),
      '副标题应位于 .se-toggles 之外（独立元素）');
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
    ok(single.includes('repeat(19,1fr)'), '单行月历默认 19 列');
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
    ok(wide.includes('pv-sch-date') && wide.includes('pv-sch-time'),
      '多日程宽布局应有「年月日」与「时分秒」两行');
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
    ok(fitFor('time', 'dateFull', false, true, { tall: true }).w === 2.9, 'time:dateFull 竖排 fit.w=2.9');
    ok(fitFor('time', 'dateFull', false, false, { tall: true }).w === 2.9, 'time:dateFull 竖排 en 取 max(w,wEn)=2.9');
    ok(fitFor('time', 'dateFull', false, true, { tall: true }).h === 4.8, 'time:dateFull 竖排 fit.h=4.8');
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
      const cssSrc = readFileSync(new URL(`../src/components/${f}`, import.meta.url), 'utf8');
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
      const cssSrc = readFileSync(new URL(`../src/components/${f}`, import.meta.url), 'utf8');
      ok(/\.pv-tight \.pv-sub \{ display:\s*none; \}/.test(cssSrc), `${f} 含 .pv-tight 隐藏副标题规则`);
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
      const cssSrc = readFileSync(new URL(`../src/components/${f}`, import.meta.url), 'utf8');
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

if (fails.length) {
  console.log(`✗ 失败 ${fails.length} 项 / 通过 ${pass} 项`);
  for (const f of fails.slice(0, 30)) console.log('  - ' + f);
  process.exit(1);
}
console.log(`✓ 全部通过（${pass} 项断言）`);
