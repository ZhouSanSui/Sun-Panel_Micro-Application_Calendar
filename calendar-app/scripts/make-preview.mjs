/**
 * 生成静态预览页：把 renderBlocksHTML 的 lit 模板展平成 HTML，
 * 套上与组件相同的 em/网格 CSS，用于肉眼校验各尺寸下的排版。
 */
import { writeFileSync } from 'node:fs';
import { renderBlocksHTML, renderInfoBlock } from '../src/core/card-mode-render.js';
import { layoutBlocks, gridForSize } from '../src/core/user-store.js';
import { ensureAppState, getUserStore } from '../src/core/app-state.js';

// 注入一批临近日程（供 schedule.multiple 用例渲染真实数据；now=2026-10-18）
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

const CASES = [
  ['1x1', 120, 120, [['time', 'hms'], ['time', 'dateWeekday']]],
  ['1x2', 252, 120, [['time', 'hms'], ['time', 'dateFull']]],
  ['2x1', 120, 252, [['time', 'hms'], ['time', 'dateFullWeekday'], ['calendar', 'week']]],
  ['2x2', 252, 252, [['calendar', 'month'], ['time', 'hms'], ['schedule', 'recent']]],
  ['2x4', 516, 252, [['time', 'hms'], ['time', 'dateFullWeekday'], ['calendar', 'month'], ['schedule', 'multiple'], ['important', 'holidayGap']]],
  ['4x4', 516, 516, [['time', 'hms'], ['time', 'dateFullWeekday'], ['calendar', 'month'], ['calendar', 'week'], ['schedule', 'multiple'], ['important', 'holidayGap']]],
  ['1xfull', 1080, 120, [['time', 'hms'], ['time', 'dateFullWeekday'], ['important', 'holidayGap'], ['schedule', 'recent']]],
  // ↓ v1.30 新增场景
  ['1xfull', 1080, 120, [['calendar', 'month'], ['time', 'hms'], ['important', 'holidayGap']]],
  ['1xfull', 1080, 120, [['calendar', 'month']]],
  ['1xfull', 700, 120, [['calendar', 'month'], ['schedule', 'multiple']]],
  ['2x4', 516, 252, [['blank', 'space'], ['time', 'hms'], ['blank', 'space'], ['schedule', 'multiple']]],
  ['2x2', 252, 252, [['blank', 'space'], ['time', 'hms']]],
  ['2x4', 516, 252, [['time', 'hms']], { h: true, v: true }],
  ['2x2', 252, 252, []],
  // ↓ v1.31 新增场景
  // 需求 6：新增「月日」样式
  ['2x2', 252, 252, [['time', 'dateMonthDay']], null, '需求6 月日'],
  ['1xfull', 1080, 120, [['time', 'dateMonthDay'], ['time', 'hms']], null, '需求6 月日 + 时分秒'],
  // 需求 4：cols ≥ 4 的日历块显示居中「年月日」标题（月历不带星期 / 周历带星期）
  ['4x4', 516, 516, [['calendar', 'month', { span: { cols: 4, rows: 4 } }]], null, 'v1.32回退 月历（无日期标题）'],
  ['4x4', 516, 516, [['calendar', 'week', { span: { cols: 4, rows: 1 } }], ['time', 'hms']], null, 'v1.32回退 周历（无日期标题）'],
  ['2x4', 516, 252, [['calendar', 'month', { span: { cols: 4, rows: 4 } }]], null, 'v1.32回退 月历（无日期标题）(2x4)'],
  // 需求 4 反向：cols < 4 不应有标题
  ['2x2', 252, 252, [['calendar', 'month', { span: { cols: 2, rows: 2 } }]], null, 'v1.32回退 无标题(cols=2)'],
  // 需求 7：窄高块 → time 竖排
  ['2x1', 120, 252, [['time', 'hms', { span: { cols: 1, rows: 2 } }]], null, '需求7 竖排 hms'],
  ['4x4', 516, 516, [['time', 'dateFullWeekday', { span: { cols: 2, rows: 5 } }]], null, '需求7 竖排 年月日星期'],
  // 需求 7：窄高块周历 → 7 天改 7 行（且不加日期标题）
  ['2x1', 120, 252, [['calendar', 'week', { span: { cols: 1, rows: 4 } }]], null, '需求7 周历竖排'],
  // 需求 8：1×1 占格 → 年后两位 / 星期字号减半
  ['1x1', 120, 120, [['time', 'year']], null, '需求8 年后两位'],
  ['1x1', 120, 120, [['time', 'weekday']], null, '需求8 星期缩小'],
  // 需求 3 + D13：1×FULL 月历单行 19 天；显式关闭单行时建议占格回退 2×2
  ['1xfull', 1080, 120, [['calendar', 'month', { opts: { singleLine: false } }]], null, '需求3/D13 关闭单行→2×2'],
  // v1.32：1×FULL 月历单行占满整行 + 按宽度动态天数（1080 与 700 对比）
  ['1xfull', 1080, 120, [['calendar', 'month']], null, 'v1.32 单行占满+动态天数(1080)'],
  ['1xfull', 700, 120, [['calendar', 'month']], null, 'v1.32 单行占满+动态天数(700)'],
  // v1.32 需求 6：小卡差异渲染只对 1×1 / 1×2 卡片生效，垂直不限
  ['1x2', 252, 120, [['time', 'year', { span: { cols: 1, rows: 2 } }]], null, 'v1.32 1x2 卡年(1×2 占格)'],
  ['1x2', 252, 120, [['time', 'weekday', { span: { cols: 1, rows: 2 } }]], null, 'v1.32 1x2 卡星期(1×2 占格)'],
  ['2x2', 252, 252, [['time', 'year'], ['time', 'weekday']], null, 'v1.32 2x2 卡年/星期(不缩小)'],
  // ↓ v1.34 新增场景
  // 反馈1：FULL 按钮存 span 8×2，运行时 10 列网格应拉伸铺满（天间距 +30%）
  ['1xfull', 2400, 180, [['calendar', 'month', { span: { cols: 8, rows: 2 } }]], null, 'v1.34 反馈1 FULL拉伸铺满(2400→10列)'],
  // 反馈1：月历 + 时间并排 → 月历保持 8×2，时间落剩余 2 列（不挤掉邻居）
  ['1xfull', 2400, 180, [['calendar', 'month', { span: { cols: 8, rows: 2 } }], ['time', 'hms', { span: { cols: 2, rows: 1 } }]], null, 'v1.34 反馈1 月历+时间并排'],
  // 反馈2：竖排日期（.pv-vline 1.25em）vs 时分秒，各占 1×2
  ['2x1', 120, 252, [['time', 'dateFull', { span: { cols: 1, rows: 2 } }], ['time', 'hms', { span: { cols: 1, rows: 2 } }]], null, 'v1.34 反馈2 竖排日期vs时分秒(2x1)'],
  ['2x2', 252, 252, [['time', 'dateFull', { span: { cols: 1, rows: 2 } }], ['time', 'hms', { span: { cols: 1, rows: 2 } }]], null, 'v1.34 反馈2 竖排日期vs时分秒(2x2)'],
  // 反馈3：多日程宽布局（span.cols≥4 → 日程名 + 右侧两行小字），末行不截断
  ['4x4', 580, 580, [['schedule', 'multiple', { span: { cols: 8, rows: 8 } }]], null, 'v1.34 反馈3 多日程宽布局(580)'],
  ['4x4', 420, 420, [['schedule', 'multiple', { span: { cols: 8, rows: 8 } }]], null, 'v1.34 反馈3 多日程宽布局(420)'],
  // ↓ v1.35 新增场景
  // 需求 1：新样式「年月」横排（2026年10月）vs 简约态（2026·10）
  ['2x2', 252, 252, [['time', 'dateYearMonth'], ['time', 'dateYearMonth', { opts: { noUnits: true } }]], null, 'v1.35 年月 常规vs简约'],
  // 需求 2：简约横排——年月日/月日星期用 · 分隔，星期段保留（不加点）
  ['2x4', 516, 252, [['time', 'dateFull', { opts: { noUnits: true } }], ['time', 'dateWeekday', { opts: { noUnits: true } }]], null, 'v1.35 简约横排 年月日/月日星期'],
  ['2x4', 516, 252, [['time', 'dateFullWeekday', { opts: { noUnits: true } }], ['time', 'dateMonthDay', { opts: { noUnits: true } }]], null, 'v1.35 简约横排 年月日星期/月日'],
  // 需求 2：简约竖排——只显示数字（年后两位），星期独立成段
  ['2x1', 120, 252, [['time', 'dateFull', { span: { cols: 1, rows: 2 }, opts: { noUnits: true } }]], null, 'v1.35 简约竖排 年月日'],
  ['2x1', 120, 252, [['time', 'dateYearMonth', { span: { cols: 1, rows: 2 }, opts: { noUnits: true } }]], null, 'v1.35 简约竖排 年月'],
  ['2x1', 120, 252, [['time', 'dateFullWeekday', { span: { cols: 1, rows: 2 }, opts: { noUnits: true } }]], null, 'v1.35 简约竖排 年月日星期'],
  // 对照：同一竖排占格下常规（带单位）vs 简约（纯数字）
  ['2x2', 252, 252, [['time', 'dateFull', { span: { cols: 1, rows: 2 } }], ['time', 'dateFull', { span: { cols: 1, rows: 2 }, opts: { noUnits: true } }]], null, 'v1.35 竖排 常规vs简约'],
  // 反馈1（2026-10-20）：用户同款三兄弟 1×3 —— 时分秒 + 月日星期-简约 + 年月日-简约，两块数字字号须一致
  ['2x2', 252, 252, [['time', 'hms', { span: { cols: 1, rows: 3 } }], ['time', 'dateWeekday', { span: { cols: 1, rows: 3 }, opts: { noUnits: true } }], ['time', 'dateFull', { span: { cols: 1, rows: 3 }, opts: { noUnits: true } }]], null, 'v1.35 反馈1 三兄弟1×3 数字字号一致'],
  // 反馈1 延伸：4 行样式在自然 4 行占格下与 3 行样式字号一致（挤压进 3 行会转高度约束，属预期）
  ['2x2', 252, 252, [['time', 'dateFullWeekday', { span: { cols: 1, rows: 4 }, opts: { noUnits: true } }], ['time', 'dateFull', { span: { cols: 1, rows: 4 }, opts: { noUnits: true } }]], null, 'v1.35 反馈1 4行样式 自然4行占格'],
  // ↓ v1.40 新增场景（三项显示优化）
  // ① 年/星期规则对调：2×1 走小号（年后两位 / 星期减半），1×2 走全量（2026 / 周四）
  ['2x1', 120, 252, [['time', 'year', { span: { cols: 1, rows: 2 } }], ['time', 'weekday', { span: { cols: 1, rows: 2 } }]], null, 'v1.40 ① 2x1 年/星期(小号)'],
  ['1x2', 252, 120, [['time', 'year', { span: { cols: 1, rows: 2 } }], ['time', 'weekday', { span: { cols: 1, rows: 2 } }]], null, 'v1.40 ① 1x2 年/星期(全量)'],
  // ② 四样式可缩至 1×2 / 2×1，宽扁走双栏 flat
  ['1x2', 252, 120, [['important', 'festival', { span: { cols: 2, rows: 1 } }], ['important', 'solarTerm', { span: { cols: 2, rows: 1 } }]], null, 'v1.40 ② 1x2 节日/节气(双栏flat)'],
  ['2x1', 120, 252, [['important', 'festival', { span: { cols: 1, rows: 2 } }], ['schedule', 'recent', { span: { cols: 1, rows: 2 } }]], null, 'v1.40 ② 2x1 节日/最近日程(竖排)'],
  ['2x2', 252, 252, [['important', 'holidayGap', { span: { cols: 2, rows: 1 } }], ['schedule', 'multiple', { span: { cols: 2, rows: 1 } }]], null, 'v1.40 ② 2x2 距放假/多日程(双栏flat混合)'],
  ['1x2', 252, 120, [['important', 'festival', { span: { cols: 4, rows: 1 } }]], null, 'v1.40 ② 1x2 节日(通栏flat)'],
  ['2x1', 120, 252, [['schedule', 'recent', { span: { cols: 2, rows: 1 } }], ['important', 'festival', { span: { cols: 2, rows: 1 } }], ['important', 'solarTerm', { span: { cols: 2, rows: 1 } }]], null, 'v1.42 窄高卡 2×1×3 倒数(占格横向意图→flat)'],
];

const cards = CASES.map(([size, w, h, list, cardCenter, note]) => {
  const g = gridForSize(size);
  let cols = g.cols;
  if (size === '1xfull') cols = Math.max(4, Math.min(10, Math.round((w - 24) / 90)));
  const grid = { cols, rows: g.rows };
  const cellW = (w - 24) / grid.cols;
  const cellH = (h - 24) / grid.rows;
  const blocks = list.map(([c, s, extra]) => ({ c, s, ...(extra || {}) }));
  const laid = layoutBlocks(blocks, 'combo', size, grid, cardCenter);
  const cc = cardCenter ? ` <b style="color:#58a6ff">置中${cardCenter.h ? 'H' : ''}${cardCenter.v ? 'V' : ''}</b>` : '';
  const nt = note ? ` <i style="color:#7ee787">${note}</i>` : '';
  const html = toHTML(renderBlocksHTML({ ...base, blocks: laid, grid, cellW, cellH, size }));
  return `
  <figure>
    <figcaption>${size} · ${w}×${h}px · 网格 ${grid.cols}×${grid.rows} · ${laid.length}/${list.length} 块${cc}${nt}</figcaption>
    <div class="card item-card-content" style="width:${w}px;height:${h}px">
      <div class="card-mode-wrap text-light">${html}</div>
    </div>
  </figure>`;
}).join('\n');

// v1.40：单独模式按卡片尺寸版式预览（renderInfoBlock + pv-single-<size> 尺寸类名）
const SINGLE_CASES = [
  ['1x1', 120, 120, 'timeDate', 'led'],
  ['2x1', 120, 252, 'timeDate', 'led'],
  ['1xfull', 1080, 120, 'timeDate', 'led'],
  ['1x2', 252, 120, 'timeDate', 'led'],
  ['2x2', 252, 252, 'timeDate', 'led'],
  ['2x4', 516, 252, 'timeDate', 'led'],
  ['4x4', 516, 516, 'timeDate', 'led'],
  ['1x1', 120, 120, 'schedule', 'recentEvent'],
  ['2x1', 120, 252, 'schedule', 'recentEvent'],
  ['1xfull', 1080, 120, 'schedule', 'recentEvent'],
];
const singleCards = SINGLE_CASES.map(([size, w, h, c, s]) => {
  const inner = toHTML(renderInfoBlock({ ...base, content: c, style: s, singleRow: true, size }));
  return `
  <figure>
    <figcaption>单独 ${size} · ${w}×${h}px · ${c}:${s} · pv-single-${size}</figcaption>
    <div class="card item-card-content" style="width:${w}px;height:${h}px">
      <div class="card-mode-wrap text-light">${inner}</div>
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
  /* v1.39：mock 卡复刻线上宿主 .item-card-content 的裁剪形态（20px 圆角 + overflow:hidden），
     保证预览与线上合成一致；item-card-content class 让运行时同步路径可复用。 */
  .card { padding:12px; box-sizing:border-box; border-radius:20px; overflow:hidden;
          box-shadow:0 2px 10px rgba(0,0,0,.45); display:flex; flex-direction:column; }
  .card-mode-wrap { flex:1; min-height:0; width:100%; display:flex; flex-direction:column;
                    align-items:center; justify-content:center; font-size:16px; }
  .text-light { color:#F5F5F7; text-shadow:0 1px 2px rgba(0,0,0,.35); }
  .pv-center { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.375em; width:100%; text-align:center; }
  /* v1.40 需求 2：宽扁块（像素比 ≥2:1）倒数型双栏布局（数字列 + 文字列） */
  .pv-center.pv-flat { flex-direction:row; align-items:center; justify-content:center; gap:.5em; }
  .pv-fnum { display:flex; flex-direction:column; align-items:center; justify-content:center; flex:0 1 auto; }
  .pv-ftext { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.1875em; flex:0 1 auto; min-width:0; text-align:center; }
  .pv-col { display:flex; flex-direction:column; gap:.3125em; width:100%; }
  .pv-gap { height:.5em; }
  .pv-big { font-size:1.875em; font-weight:800; line-height:1.1; font-variant-numeric:tabular-nums; }
  .pv-mid { font-size:1em; font-weight:700; line-height:1.25; }
  /* v1.35：简约显示的间隔圆点（方案 B 自绘，实测单点占位 0.84em） */
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
  /* v1.31：间距统一由 .pv-col 的 gap(.3125em) 提供，不再叠加 margin-top */
  .pv-mini-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:.125em; margin-top:0; }
  /* ---- v1.31 新增：窄高块竖排容器 ---- */
  .pv-vstack { display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; gap:.1875em; }
  .pv-vstack.t { gap:.125em; }
  .pv-vline { font-size:1.25em; font-weight:700; line-height:1.15; white-space:nowrap; font-variant-numeric:tabular-nums; }
  /* v1.35 反馈 1：竖排简约的星期行降为说明级字号，使数字行与无星期样式字号相等 */
  .pv-vline.wk { font-size:.7em; }
  .pv-vbig { font-size:1.875em; font-weight:800; line-height:1.1; white-space:nowrap; font-variant-numeric:tabular-nums; }
  .pv-vrow { display:flex; align-items:baseline; justify-content:center; gap:.25em; width:100%; }
  /* ---- v1.31 新增：日历日期标题 ---- */
  .pv-cal-head { text-align:center; color:inherit; line-height:1.2; }
  .pv-cal-wd { font-size:.5625em; font-weight:600; margin-left:.3125em; }
  /* ---- v1.31 新增：周日历竖排（7 天改 7 行） ---- */
  .pv-wkv { display:grid; grid-template-rows:repeat(7,1fr); grid-template-columns:1fr; gap:.0625em; width:100%; }
  .pv-wkv-cell { display:flex; align-items:center; justify-content:space-between; padding:.125em .375em; border-radius:.375em; }
  .pv-wkv-d { font-size:.75em; font-weight:600; line-height:1.2; font-variant-numeric:tabular-nums; }
  .pv-wkv-w { font-size:.5625em; line-height:1.3; text-align:right; }
  /* ---- v1.31 新增：1×1 占格的小卡星期（字号减半） ---- */
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
  /* v1.40：单独模式按卡片尺寸的版式规则（与三组件 CSS 同源，改规则必须同步） */
  .pv-single .pv-center { flex-direction:row; flex-wrap:wrap; justify-content:center; gap:.5em; }
  .pv-single-1x1 .pv-big, .pv-single-1x1 .pv-mid, .pv-single-1x1 .pv-vbig { font-size:1.25em; }
  .pv-single-1x1 .pv-sub { display:none; }
  .pv-single-1x2 .pv-center { gap:.75em; }
  .pv-single-1x2 .pv-big, .pv-single-1x2 .pv-mid, .pv-single-1x2 .pv-vbig { font-size:1.15em; }
  .pv-single-2x1 .pv-center { flex-direction:column; gap:.375em; }
  .pv-single-2x1 .pv-big, .pv-single-2x1 .pv-mid, .pv-single-2x1 .pv-vbig { font-size:1.1em; }
  .pv-single-2x2 .pv-center { gap:.5em; }
  .pv-single-2x4 .pv-center { gap:.875em; }
  .pv-single-2x4 .pv-big, .pv-single-2x4 .pv-mid, .pv-single-2x4 .pv-vbig { font-size:1.2em; }
  .pv-single-4x4 .pv-big, .pv-single-4x4 .pv-mid, .pv-single-4x4 .pv-vbig { font-size:1.25em; }
  .pv-single-4x4 .pv-sub { font-size:.6875em; }
  .pv-single-1xfull .pv-center { align-items:center; gap:1em; }
  .pv-single-1xfull .pv-big, .pv-single-1xfull .pv-mid, .pv-single-1xfull .pv-vbig { font-size:1.3em; }
`;

writeFileSync(new URL('./preview.html', import.meta.url),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>v1.35 拼接模式网格布局预览</title><style>${CSS}</style></head>
<body><h1>v1.35 拼接模式 · 网格布局静态预览（虚线为块边界）</h1>
<div class="grid-wrap">${cards}</div></body></html>`);
// v1.40：单独模式按尺寸版式独立预览页（便于无头截图逐尺寸肉眼校验）
writeFileSync(new URL('./preview-single.html', import.meta.url),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>v1.40 单独模式 · 按尺寸版式预览</title><style>${CSS}</style></head>
<body><h1>v1.40 单独模式 · 按卡片尺寸的版式（pv-single-*）</h1>
<div class="grid-wrap">${singleCards}</div></body></html>`);
console.log('✅ scripts/preview.html + scripts/preview-single.html 已生成');
