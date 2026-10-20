/**
 * 卡片显示内容渲染（共享）
 * 主页面卡片预览、小部件（widget）与配置页预览共用同一套渲染逻辑。
 *
 * v1.24 起渲染模型：
 * - renderInfoBlock({ content, style, ... })：渲染单个「显示内容 + 显示样式」单元
 * - renderBlocksHTML({ blocks, ... })：拼接模式多单元纵向堆叠（blocks: [{c,s},...]）
 *
 * 依赖的全局服务（getUserStore / getHolidayService）从 core 模块惰性获取。
 */

import { html } from 'lit';
import {
  yearProgress, dayOfYear, diffDays, formatTime, getMonthGrid, formatDate, todayStr, addDays,
  daysInMonth, weekOfYear,
} from './date-utils.js';
import { getNextOccurrence } from './schedule.js';
import { autoLayout } from './user-store.js';
import { getNextHoliday, getNextSolarTerm, getNextFestival } from './highlights.js';
import { getUserStore, getHolidayService } from './app-state.js';

const WEEK_FULL_ZH = ['日', '一', '二', '三', '四', '五', '六'];
const WEEK_MIN_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** 软禁用状态的锁图标（纯装饰，读屏忽略） */
const LOCK_ICON = html`<svg class="se-lock" viewBox="0 0 12 12" width="10" height="10" aria-hidden="true"><path d="M3.4 5.2V3.9a2.6 2.6 0 015.2 0v1.3" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="2.3" y="5.2" width="7.4" height="5" rx="1.4" fill="currentColor" opacity=".8"/></svg>`;

/**
 * 各「内容:样式」的内容固有尺寸（单位 = 该块根字号的 em）。
 *   w = 单行最宽内容宽度；h = 竖直方向总高度；wrap = 是否允许两行换行兜底。
 *   w12 = 12 小时制下的宽度；wEn = 英文文案下的宽度。
 * 数值由 scripts/measure.html 用无头 Chrome 实测（font-weight 700/800 + tabular-nums）。
 * 拼接模式下块的根字号按 u = min(blockH / h, blockW / w) 反推（含块内边距修正）。
 * __default 为该内容的兜底值。
 */
const CONTENT_FIT = {
  calendar: {
    // 7 列网格：字号受列宽约束（每列约需 0.9em），行高由网格按剩余高度均分
    month: { w: 6.8, h: 7.0 },
    // 月历 + 日期标题（cols ≥ 4）：表头由「年月」升级为「年月日」（居中，不带星期）
    monthTitle: { w: 6.8, h: 7.0 },
    // 单行月历（今日居中，左右各 9 天 = 19 天）：横向约为周历的 2.5 倍
    // 实测（scripts/measure.html）：strip19 固有宽 19.826em 高 2.025em
    monthSingle: { w: 19.83, h: 2.1 },
    week: { w: 7.8, h: 2.1 },
    // 周历 + 日期标题（cols ≥ 4）：上方新增一行居中表头
    // 实测：整块 7.226em × 3.237em
    weekTitle: { w: 7.8, h: 3.24 },
    // 周历竖排（窄高块）：7 个日期改为 7 行，行内「日期 + 星期」横向排列
    // 实测：zh 2.238em / en 2.929em 宽 × 9.055em 高
    weekVert: { w: 3.1, h: 9.06 },
    __default: { w: 7.2, h: 4.0 },
  },
  // 空白单元：不占内容宽度（仅占位，无渲染内容）
  blank: { __default: { w: 1.0, h: 1.0 } },
  time: {
    // big = 1.875em（实测 24h "14:05:09" 4.27em → 8.0；12h 含 AM/PM 4.74em → 8.9）
    hm: { w: 5.3, w12: 9.0, h: 2.1 },
    hms: { w: 8.3, w12: 9.0, h: 2.1 },
    // mid = 1em（实测 dateFull 7.93 / dateWeekday 6.77 / dateFullWeekday 10.23）
    // v1.35 §8.5：en「October 18, 2026」实测 8.655em 偏紧 → 补 wEn（既有缺陷，独立提交）
    dateFull: { w: 8.1, wEn: 8.8, h: 1.3, wrap: true },
    // v1.35 需求 1：年月。插在年月日之后；zh「2026年10月」实测 5.700em → 5.9（+3.5%），en「Oct 2026」4.514em < zh 不声明 wEn
    dateYearMonth: { w: 5.9, h: 1.3, wrap: true },
    // v1.31 需求 6：月日。插在年月日之后，与「月日星期 / 年月日星期」构成完整的「年 / 星期」二维开关序列
    dateMonthDay: { w: 4.6, h: 1.3, wrap: true },
    // v1.35 §8.5：en 现状「Sunday, Oct 18」实测最坏 9.639em（Wednesday）远超声明 6.9 → 补 wEn（既有缺陷，独立提交）
    dateWeekday: { w: 6.9, wEn: 9.8, h: 1.3, wrap: true },
    // v1.35 §8.5：en「Sunday, October 18, 2026」实测最坏 ≈14.9em → 补 wEn
    dateFullWeekday: { w: 10.4, wEn: 15.2, h: 1.3, wrap: true },
    // v1.35 需求 2：横排「简约显示」（去单位，改用中心原点 ·）。均按方案 B 实测回写（自绘圆点，单点占位 0.84em）
    dateFullNoUnits: { w: 6.9, h: 1.3, wrap: true },
    dateYearMonthNoUnits: { w: 4.8, h: 1.3, wrap: true },
    dateMonthDayNoUnits: { w: 3.5, h: 1.3, wrap: true },
    dateWeekdayNoUnits: { w: 5.9, wEn: 6.5, h: 1.3, wrap: true },
    dateFullWeekdayNoUnits: { w: 9.3, wEn: 9.9, h: 1.3, wrap: true },
    // v1.31 需求 7：窄高块竖排变体。每行一个有效信息，单位字与数字同行。
    // 竖排一律不声明 wrap（slack = 0），行内 white-space:nowrap
    // v1.34 需求 2：.pv-vline 1em→1.25em（日期串字号上调），且宽度按**实际渲染文案**实测——
    // zh 年份为后两位「26年」（v1.32 需求 5），最宽行 2.79em（旧值 3.7 按 4 位年「2026年」量，过保守）；
    // en 用 month:'short'，最宽行「Sun」2.37em。实测（scripts/measure.html，root=200px）：
    //   zh 2.792em × 4.688em(3行)/3.063em(2行)/6.313em(4行)；en 2.186~2.372em
    dateFullVert: { w: 2.9, wEn: 2.5, h: 4.8 },
    dateYearMonthVert: { w: 2.9, h: 3.2 },
    dateMonthDayVert: { w: 2.9, wEn: 2.4, h: 3.2 },
    // v1.35 反馈 2：en 竖排最宽行是短星期 Mon 2.917em（Wed 2.868em 次之）——两份 v1.35 规格的
    // 修复清单都漏列了 dateWeekdayVert（与已修的 dateFullWeekdayVert 同缺陷类、同口径）：
    // 原 wEn 2.5 覆盖不到 → en 下溢出约 0.42em，故 2.5 → 3.1。
    dateWeekdayVert: { w: 2.9, wEn: 3.1, h: 4.8 },
    dateFullWeekdayVert: { w: 2.9, wEn: 3.1, h: 6.5 },
    // v1.35 需求 2：竖排「简约显示」—— 只留数字（en 也去 Oct）
    dateFullVertNoUnits: { w: 1.7, h: 4.8 },
    dateYearMonthVertNoUnits: { w: 1.7, h: 3.2 },
    dateMonthDayVertNoUnits: { w: 1.7, h: 3.2 },
    // v1.35 反馈 1：竖排简约的星期行降 .7em（.pv-vline.wk）后不再是宽度瓶颈，
    // 与无星期样式同声明 w=1.7 → 数字字号严格相等（此前 w=2.6 被「周二」2.5em 压小约 30%）。
    // .7em 下 zh「周二」1.4em / en「Mon」1.63em 均 ≤ 1.7em 预算，故不声明 wEn。
    dateWeekdayVertNoUnits: { w: 1.7, h: 4.8 },
    dateFullWeekdayVertNoUnits: { w: 1.7, h: 6.5 },
    hmVert: { w: 2.5, w12: 3.6, h: 4.3 },
    hmsVert: { w: 2.5, w12: 3.6, h: 6.5 },
    // v1.31 需求 8：年 / 星期。原先走 __default，en 会被 wEn=10.5 误压小，故显式声明
    year: { w: 4.7, h: 3.2 },
    yearShort: { w: 2.6, h: 3.2 },
    weekday: { w: 3.9, wEn: 10.5, h: 3.2 },
    weekdaySmall: { w: 2.0, wEn: 5.3, h: 2.1 },
    // big(≤4 位数字) + sub：en 的星期/月份名较宽
    __default: { w: 4.7, wEn: 10.5, h: 3.2 },
  },
  // 倒数型（大数字 + 单位 + 名称 + 说明）竖向占位较高
  // v1.40：宽扁（flat）走双栏（数字列 + 文字列），高取两列最大；窄高（tall）保持竖排、与默认同源
  // 实测（measure.html F 组，含 3 位天数最坏情况）：
  important: {
    __default: { w: 3.47, wEn: 7.95, h: 5.64 },
    __flat: { w: 6.22, wEn: 11.91, h: 2.79 },
    __tall: { w: 3.47, wEn: 7.95, h: 5.64 },
  },
  schedule: {
    recent: { w: 3.47, wEn: 4.98, h: 5.64 },
    // v1.40：recent 同属倒数型，flat/tall 同源（仅 recent 触发，multiple 不劫持）
    __flat: { w: 6.97, wEn: 8.95, h: 2.79 },
    __tall: { w: 3.47, wEn: 4.98, h: 5.64 },
    multiple: { w: 6.6, wEn: 8.0, h: 3.7 },
    // 占格水平 ≥4：日期（≈7.9em/0.5em 字号）+ 日程名，两行小字版
    multipleWide: { w: 11.0, wEn: 12.0, h: 3.4 },
    // v2.9：胶囊倒计时（年倒计时 d/h/m/s 四个数字格 + 胶囊标题）
    capsule: { w: 11.2, wEn: 11.8, h: 3.4 },
    bigDays: { w: 5.2, h: 5.2 },
    // v2.9：目标倒计时卡（标题 + 大天数 + 日期）
    targetDay: { w: 6.1, wEn: 7.0, h: 5.2 },
    __default: { w: 5.0, h: 4.0 },
  },
  timeDate: {
    __default: { w: 8.3, w12: 9.0, h: 3.2 },
    // v2.7：双区（时间一行 + 细分隔线 + 日期星期一行）。整块约 5.9em 宽 × 3.6em 高
    dualZone: { w: 5.9, w12: 6.6, h: 3.6 },
    stripeClock: { w: 6.2, h: 3.2 },
    wordClock: { w: 9.4, h: 3.4 },
    // v2.9 图像化时钟：环形刻度（接近正方，按直径算）/ 数码管 / 粗体大字
    ringClock: { w: 7.0, w12: 7.6, h: 6.4 },
    dotClock: { w: 8.6, wEn: 9.2, h: 3.6 },
    boldClock: { w: 5.0, w12: 5.6, h: 3.2 },
  },
  progress: {
    __default: { w: 7.0, h: 2.0 },
    // v2.7 图形化进度：格阵按 auto-fill 自适应列数（最小格 0.42em），故 w 取「可读的最小宽度」
    yearGrid: { w: 10.0, h: 9.0 },
    // 12 根月条 + 顶部年份 + 底部百分比
    yearBars: { w: 7.6, h: 4.6 },
    // v2.9：四条进度（年/月/周/日），每条「标签 + 条 + 百分比」
    multiBars: { w: 9.4, h: 5.4 },
    ringProgress: { w: 6.8, h: 6.8 },
    heatYear: { w: 9.6, h: 7.0 },
    // 7 个周格里「星期字母 + 日期」两行 + 底部百分比
    weekGrid: { w: 8.4, h: 3.0 },
  },
};

/** 可读下限：低于此字号且允许换行时，按两行重算 */
const FIT_MIN_U = 9;
/** .pv-block 单侧内边距（em） */
const FIT_PAD = 0.1875;

/** 窄高块判定阈值：块高 ≥ TALL_RATIO × 块宽（v1.31 需求 7） */
export const TALL_RATIO = 2;
/** 宽扁块判定阈值：块宽 ≥ FLAT_RATIO × 块高（v1.40 需求 2：四样式可缩至 1×2 宽扁） */
export const FLAT_RATIO = 2;
/**
 * 日历日期标题的最小占格列数（v1.31 需求 4）。
 * 用「占格列数」而非像素宽度：1×FULL 的 cellW 在 84~106px 间浮动（±25%），
 * 用像素阈值会出现「同一设置两种表现」；且 1×FULL 只有 2 行高，格数规则天然规避误加标题。
 */
export const CAL_TITLE_MIN_COLS = 4;
/** 支持竖排的 time 样式（单一信息项如「年 / 日 / 秒」无需拆分，不在列） */
const TIME_VERT = new Set(['dateFull', 'dateMonthDay', 'dateWeekday', 'dateFullWeekday', 'hm', 'hms']);
/** 支持竖排的 calendar 样式（month 本身已是 7×6 竖排网格） */
const CAL_VERT = new Set(['week']);
/**
 * 单独模式（整卡）根字号基准（px），与 CSS `.pv-single-<size>` 的基准同源
 * （见 card-mode-styles.js「单独模式字号基准」段，两者改一处必须改另一处）。
 * 预览框会按几何等比缩小（pvScale），字号必须同比缩小，否则「预览 = 实际」失守：
 * 预览框缩到 0.56×、字号仍按 CSS 的 17px，肉眼就比实际卡片大 ~1.8×。
 */
export const SINGLE_BASE_PX = {
  '1x1': 16, '1x2': 17, '2x1': 17, '2x2': 22, '2x4': 26, '4x4': 34, '1xfull': 18,
};
/**
 * 小卡差异化渲染（v1.32 修正，v1.40 规则对调）：
 * 只对 1×1 / 2×1 小部件卡片生效（v1.40 按用户截图反馈，原 1×2 与 2×1 规则互换），
 * 且只看「水平占格是否为 1」，垂直方向不做限制。
 */
const SMALL_CARD_SIZES = new Set(['1x1', '2x1']);
/** 月历单行：单个日期格的固有宽度（em，由实测 monthSingle 19.83 / 19 天反推） */
const SINGLE_CELL_EM = 1.044;
/** 月历单行：整体高度（em，与 monthSingle.h 一致） */
const SINGLE_H_EM = 2.1;
/** 月历单行：首尾留白余量（em），避免边缘被裁 */
const SINGLE_PAD_EM = 0.6;
/** 多日程显示「年月日 / 时分秒」两行小字所需的最小水平占格 */
const SCH_MULTI_WIDE_COLS = 4;
/**
 * 多日程行高/行距模型（v1.34 需求 3，单位 em，与 .pv-sch-* / .pv-col 的 CSS 同源，
 * 改 CSS 的 line-height 或 gap 必须同步这里，否则末行会被裁）：
 * - 行高由显式 line-height 决定（不依赖字体度量，跨机器稳定）：
 *   宽布局行 = max(名 0.75em×1.2,  meta 两行 2×0.5em×1.2) = 1.2em；
 *   窄布局行 = 0.75em×1.25（.pv-sch-line）= 0.9375em。
 * - 行距基准 = .pv-col 的 gap；剩余空间再匀进行距（增量上限 SCH_GAP_MAX_EXTRA），
 *   大盘子下疏密得当、小盘子下也不少放。
 */
const SCH_ROW_H_WIDE = 1.2;
const SCH_ROW_H_NARROW = 0.9375;
const SCH_ROW_GAP = 0.3125;
const SCH_GAP_MAX_EXTRA = 0.6875;
/** 行数公式的安全余量（em）：吸收字体度量/像素取整差异，宁可少放一行也不裁切 */
const SCH_ROWS_RESERVE = 0.2;

/**
 * 取内容固有尺寸（未声明回退到内容默认，再回退到通用值）。
 * @param {boolean} hour12  12 小时制时取 w12
 * @param {boolean} isZh    非中文时取 wEn（取两者较大值）
 * @param {?{singleLine?:boolean,tall?:boolean,small?:boolean}} opts 显示选项
 */
export function fitFor(content, style, hour12 = false, isZh = true, opts = null) {
  const c = CONTENT_FIT[content];
  let key = style;
  // 月历单行显示时用单行固有尺寸（横向更宽、高度同周历）
  if (content === 'calendar' && style === 'month' && opts && opts.singleLine) key = 'monthSingle';
  // 多日程占格水平 ≥4：改为「日程名 + 右侧两行小字（年月日 / 时分秒）」
  if (content === 'schedule' && style === 'multiple' && opts && opts.wide) key = 'multipleWide';
  // 窄高块竖排：竖排 key 优先于日期标题（两者互斥，见 v1.31 §2.5）
  if (opts && opts.tall) key = vertFitKey(content, style, true);
  // v1.40 需求 2：倒数型（important / schedule.recent）在窄高块保留竖排但改用 `__tall` 固有尺寸
  // （宽度预算收窄——窄块下不强行撑满，与默认竖排 DOM 一致、仅影响字体缩放基准）
  if (opts && opts.tall && key === style
    && (content === 'important' || (content === 'schedule' && style === 'recent'))
    && c['__tall']) key = '__tall';
  // v1.35：简约显示 → 取对应的 NoUnits 固有尺寸（横排/竖排 key 都已声明）
  if (opts && opts.noUnits && c[key + 'NoUnits']) key = key + 'NoUnits';
  // 1×1 占格：年取后两位、星期字号减半
  if (content === 'time' && opts && opts.small) {
    if (style === 'year') key = 'yearShort';
    else if (style === 'weekday') key = 'weekdaySmall';
  }
  // v1.40 需求 2：倒数型在宽扁块（flat）改用双栏 `__flat` 固有尺寸（数字列 + 文字列）
  if (opts && opts.flat
    && (content === 'important' || (content === 'schedule' && style === 'recent'))
    && c['__flat']) key = '__flat';
  const f = (c && (c[key] || c[style] || c.__default)) || { w: 6, h: 3.4 };
  let w = f.w;
  if (hour12 && f.w12) w = f.w12;
  if (!isZh && f.wEn) w = Math.max(w, f.wEn);
  return { w, h: f.h, wrap: !!f.wrap };
}

/** 窄高块：块高 ≥ TALL_RATIO × 块宽（用**实际像素比**，非格数比——见 v1.31 §3.1 反例） */
export function isTallBlock(blockW, blockH) {
  return blockH >= blockW * TALL_RATIO;
}

/** 宽扁块：块宽 ≥ FLAT_RATIO × 块高（v1.40 需求 2：1×2 等宽扁卡用双栏横向布局） */
export function isFlatBlock(blockW, blockH) {
  return blockW >= blockH * FLAT_RATIO;
}

/**
 * 小卡差异化渲染（v1.40 规则对调）：卡片尺寸为 1×1 / 2×1，且该单元水平占格为 1（垂直不限）。
 * 例：2×1 卡片上年占 2×1 生效（窄高卡走小号：年取后两位、星期字号减半）；
 *     1×2 卡片上年占 1×2 不生效（宽扁卡走全量：2026 / 周四）。
 */
export function isSmallUnit(span, size) {
  if (!SMALL_CARD_SIZES.has(size)) return false;
  return !!span && span.cols === 1;
}

/**
 * 月历「单行显示」可显示的天数：先按块高定字号上限，再按可用宽度算能放几格。
 * 结果取奇数以保证「今日」正好落在水平正中；两侧留白用不完时自动多显示几天。
 */
export function singleLineDays(blockW, blockH) {
  if (!Number.isFinite(blockW) || !Number.isFinite(blockH) || blockW <= 0 || blockH <= 0) return 19;
  const u = blockH / (SINGLE_H_EM + 2 * FIT_PAD);
  const avail = blockW / u - 2 * FIT_PAD;
  if (!Number.isFinite(avail) || avail <= 0) return 19;
  let days = Math.floor(avail / SINGLE_CELL_EM);
  days = Math.max(7, Math.min(35, days));
  if (days % 2 === 0) days -= 1;
  return days;
}

/**
 * 竖排 → CONTENT_FIT key。竖排优先于日期标题；不支持竖排的样式原样返回（回退横排）。
 * camelCase 复合名可天然享受「找不到竖排 key 就回退横排」的单层查找兜底。
 */
export function vertFitKey(content, style, tall) {
  if (!tall) return style;
  if (content === 'time' && TIME_VERT.has(style)) return `${style}Vert`;
  if (content === 'calendar' && CAL_VERT.has(style)) return `${style}Vert`;
  return style;
}

/**
 * 日历日期标题显示条件（v1.31 需求 4 —— v1.32 已按产品要求回退，恒为 false）。
 * 保留此函数仅为兼容旧调用；日历表头一律显示「年月」，不再升级为完整日期。
 */
export function showCalTitle() {
  return false;
}

/**
 * 由块像素尺寸 + 内容固有尺寸反推块根字号（已扣除块内边距）。
 * 单行放不下且允许换行时，按两行重算：用纵向余量换横向宽度。
 */
export function fitFontU(blockW, blockH, fit) {
  // 换行式断行按贪心策略填充，行宽利用不均匀，预留约 1 个字符宽的余量
  const slack = fit.wrap ? 1 : 0;
  // 防御：blockW/blockH/fit 任一非有限数时 solve 会得到 NaN，而 Math.max(7, NaN) === NaN，
  // 会让 font-size 变成 "NaNpx" 导致整块内容不可见。非有限值一律按 0 处理（落到字号下限）。
  const num = (v) => (Number.isFinite(v) ? v : 0);
  const solve = (n) => Math.min(
    num(blockH) / (num(fit.h) * n + 2 * FIT_PAD),
    (n * num(blockW)) / (num(fit.w) + slack + 2 * n * FIT_PAD),
  );
  const u1 = Math.max(7, Math.min(40, num(solve(1))));
  if (u1 >= FIT_MIN_U || !fit.wrap) return u1;
  const u2 = Math.max(7, Math.min(40, num(solve(2))));
  return Math.max(u1, u2);
}

/** 取包含 now 的某一周的 7 个日期（按 weekStart 对齐）。卡片场景以「今天所在周」为准。 */
export function weekDatesForNow(now, weekStart = 1) {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = addDays(base, -((base.getDay() - weekStart + 7) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** 时分（可选秒），支持 12 小时制 */
function fmtHM(now, hour12, withSec) {
  let h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = withSec ? `:${String(now.getSeconds()).padStart(2, '0')}` : '';
  let suffix = '';
  if (hour12) {
    suffix = h < 12 ? ' AM' : ' PM';
    h = h % 12 || 12;
  }
  return `${String(h).padStart(2, '0')}:${m}${s}${suffix}`;
}

/**
 * 渲染单个显示内容单元。
 * @param {Object} o
 *   content: 内容 key（calendar/time/important/schedule/timeDate/progress）
 *   style: 样式 key
 *   visual: cardThemeVisual() 返回值（label/label2/label3/cardBg）
 *   theme: 主题色 hex
 *   now: Date
 *   isZh: boolean
 *   weekStart: number
 *   hour12: boolean
 *   t: (key)=>string
 */
function renderInfoBlockInner(o) {
  const {
    content, style, visual, theme, now, isZh, weekStart = 1, hour12, t,
    // v1.31：窄高块 → 竖排；1×1 占格 → 小卡差异化渲染；span 用于日期标题判定
    // v1.40：宽扁块（flat）→ 倒数型双栏布局
    tall = false, small = false, flat = false,
    /** v1.44：日期串窄块使用两位年份（2026 → 26）；未显式传入时按卡片尺寸推断 */
    shortYear = undefined,
  } = o;
  const label = visual.label, label2 = visual.label2, label3 = visual.label3, cardBg = visual.cardBg;
  const TODAY = (t && t('MAIN_TODAY')) || (isZh ? '今天' : 'Today');
  const DAYS = (t && t('MAIN_DAYS')) || (isZh ? '天' : 'd');
  // v2.9「样式设置」：主色覆盖（未设置时回落到主题色）
  const opt = o.opts || {};
  // v2.12：优先取「关联日程」里挑中的那条（自定义日程已写回日历，因此同样命中）
  const schedPick = (() => {
    const sel = opt.sched;
    if (!sel) return null;
    const list = (getUserStore()?.getSchedules() || []);
    const hit = list.find((x) => String(x.id) === String(sel)) || list.find((x) => x.date === String(sel));
    if (!hit) return null;
    const mk = (x) => ({ title: x.title || x.name || '', date: x.date });
    const today0s = todayStr();
    // 选中的日程已过期时，自动滚动到「之后最近的一条」，仍是最新可数的日程
    if (String(hit.date) >= today0s) return mk(hit);
    const next = list
      .filter((x) => x && x.date && String(x.date) >= today0s && String(x.date) !== String(hit.date))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
    return next ? mk(next) : mk(hit);
  })();
  const accentOf = (fb) => (typeof opt.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(opt.color) ? opt.color : fb);  const pct = (p) => Math.max(0, Math.min(100, p)).toFixed(1);
  const ws = weekStart;
  const todayStrV = todayStr();
  const sec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const weekPct = (((now.getDay() - ws + 7) % 7) * 86400 + sec) / (7 * 86400) * 100;
  const dayPct = (sec / 86400) * 100;

  /** 大数字 + 单位小字 */
  const big = (v, sub, sub2) => html`<div class="pv-center">
    <div class="pv-big" style="color:${label};font-variant-numeric:tabular-nums;">${v}</div>
    ${sub ? html`<div class="pv-sub" style="color:${label3}">${sub}</div>` : ''}
    ${sub2 ? html`<div class="pv-sub" style="color:${label3}">${sub2}</div>` : ''}
  </div>`;

  /**
   * v1.31 需求 8：1×1 占格下的「星期」——主文字字号减半（1.875em→0.9375em，字重 800→700），
   * 副标题同步降到 0.5em（0.9375 : 0.5 = 1.875 : 1，保持原有层级比例）。
   * 注意：em 减半 ≠ 渲染像素减半（u 会随之上升），净效果是层级更均衡、不再头重脚轻。
   */
  const bigSmall = (v, sub, sub2) => html`<div class="pv-center">
    <div class="pv-wd-sm" style="color:${label};font-variant-numeric:tabular-nums;">${v}</div>
    ${sub ? html`<div class="pv-sub pv-sub-sm" style="color:${label3}">${sub}</div>` : ''}
    ${sub2 ? html`<div class="pv-sub pv-sub-sm" style="color:${label3}">${sub2}</div>` : ''}
  </div>`;

  /** 中号文字（长日期串） */
  const mid = (v, sub) => html`<div class="pv-center">
    <div class="pv-mid" style="color:${label};font-variant-numeric:tabular-nums;">${v}</div>
    ${sub ? html`<div class="pv-sub" style="color:${label3}">${sub}</div>` : ''}
  </div>`;

  /**
   * v1.44 日期单位绑定规则：
   * - 每个「数值 + 单位」（如 2026年 / 10月 / 18日）作为一个不可断整体（.pv-seg nowrap）
   * - 只允许在段与段之间换行（<wbr>），绝不出现「2026」与「年」分行
   * - 窄块（shortYear）年份只显示后两位（26年），同行可省约 1.1em
   */
  const isShortYear = shortYear === undefined
    ? (o.size ? ['1x1', '1x2', '2x1'].includes(o.size) : false)
    : !!shortYear;
  const seg = (v) => html`<span class="pv-seg">${v}</span>`;
  const joinSegs = (parts) => parts.reduce((acc, cur, i) => (i
    ? html`${acc}<wbr>${cur}`
    : cur), '');

  /**
   * v1.31 需求 7：竖排容器。
   * tight=false → 日期串类（.pv-vline 1.25em/700/lh1.15，gap .1875em）
   * tight=true  → 时间大类数字（.pv-vbig 1.875em/800/lh1.1，gap .125em）
   * apText：12 小时制的 AM/PM，内联在「时」行右侧（间隔 .25em），不单独成行
   */
  const vbigRow = (v, ap) => html`<div class="pv-vrow"><span class="pv-vbig">${v}</span>${ap
    ? html`<span class="pv-ap">${ap}</span>` : ''}</div>`;
  const vstack = (lines, tight, apText = '') => html`<div class="pv-vstack ${tight ? 't' : ''}">
    ${lines.map((v, i) => (tight ? vbigRow(v, i === 0 ? apText : '') : html`<div class="pv-vline">${v}</div>`))}
  </div>`;

  // v1.35：简约显示（noUnits）辅助
  // 圆点用自绘实心圆（方案 B，见 v135 视觉规格）：单点占位 0.84em，水平位在段间；
  // 星期前保持字面空格（与 dateWeekday 现状一致），不加 ·、不加 <wbr>。
  const noUnits = !!(o.opts && o.opts.noUnits);
  const dot = html`<span class="pv-dot" aria-hidden="true"></span><wbr>`;
  // 横排/竖排简约：根节点加 role=img + aria-label（= 同一样式「横排 + 未开启」原串，恒 4 位年），
  // 视觉子节点 aria-hidden —— 零新增格式化逻辑、与未开启态零语义差异。
  const nuH = (visStr, ariaStr) => html`<div class="pv-center" role="img" aria-label="${ariaStr}">
    <div class="pv-mid" aria-hidden="true" style="color:${label};font-variant-numeric:tabular-nums;">${visStr}</div>
  </div>`;
  // v1.35 反馈：竖排简约的星期行降为 .7em 说明级字号（介于 .pv-row2 .75em 与 .pv-sub .5em 之间，
  // 沿用设计系统既有次级字号档）。原因：无星期样式的数字行宽 1.542em（声明 w=1.7），而星期行
  // 「周二」2.5em 会把 w 抬到 2.6、字号压小约 30%。降级后星期行不再是宽度瓶颈
  // （zh「周二」1.4em / en「Mon」1.63em ≤ 1.7em 预算），数字行与无星期样式同声明 w=1.7 → 字号严格相等。
  const nuV = (lines, ariaStr, hasWk = false) => html`<div class="pv-vstack" role="img" aria-label="${ariaStr}">
    ${lines.map((v, i) => html`<div class="pv-vline${hasWk && i === lines.length - 1 ? ' wk' : ''}" aria-hidden="true">${v}</div>`)}
  </div>`;

  /** 进度条行 */
  const bar = (name, p) => html`<div class="pv-col">
    <div class="pv-row2" style="color:${label2}">${name} ${pct(p)}%</div>
    <div class="pv-bar" style="background:${cardBg}"><div class="pv-fill" style="width:${p}%;background:${theme}"></div></div>
  </div>`;

  /**
   * 空间自适应（v2.5）：块内可用宽/高不足时不再硬塞满 4 行——
   *   · fitW < 4.4：`今天`（2 字 @1.875em ≈ 3.75em）在窄块会折成 2 行、把总高顶出 1 行，
   *     改用半号主字（.pv-big-sm 0.9375em）保住单行；
   *   · fitH < 5.6：去掉末尾说明行（图3 被裁的正是这一行），必要时连「天后」一并省掉。
   * mock 数据为空时此路径不触发，故 audit-matrix 基线不受影响。
   */
  const fitW = Number.isFinite(o.availW) ? o.availW : 99;
  const fitH = Number.isFinite(o.availH) ? o.availH : 99;
  const tightH = fitH < 5.6;
  const countdown = (name, days, sub) => html`<div class="pv-center">
    <div class="pv-big${days === 0 && fitW < 4.4 ? ' pv-big-sm' : ''}" style="color:${label};font-variant-numeric:tabular-nums;">${days === 0 ? TODAY : days}</div>
    ${days === 0 || tightH ? '' : html`<div class="pv-sub" style="color:${label3}">${isZh ? '天后' : 'days left'}</div>`}
    <div class="pv-row2" style="color:${theme}">${name}</div>
    ${sub && !tightH ? html`<div class="pv-sub" style="color:${label3}">${sub}</div>` : ''}
  </div>`;

  /** 倒数单元·宽扁双栏（v1.40 需求 2）：左列数字 + 右列名称/说明，横向并排 */
  const countdownFlat = (name, days, sub) => html`<div class="pv-center pv-flat">
    <div class="pv-fnum">
      <div class="pv-big" style="color:${label};font-variant-numeric:tabular-nums;">${days === 0 ? TODAY : days}</div>
      ${days === 0 ? '' : html`<div class="pv-sub" style="color:${label3}">${isZh ? '天后' : 'days left'}</div>`}
    </div>
    <div class="pv-ftext">
      <div class="pv-row2" style="color:${theme}">${name}</div>
      ${sub ? html`<div class="pv-sub" style="color:${label3}">${sub}</div>` : ''}
    </div>
  </div>`;

  /** 临近日程列表（近→远） */
  const upcoming = (getUserStore()?.getSchedules() || [])
    .map((item) => ({ item, next: getNextOccurrence(item, now) }))
    .filter((x) => x.next)
    .sort((a, b) => diffDays(a.next.date, b.next.date) - diffDays(b.next.date, b.next.date));

  const empty = (text) => html`<div class="pv-center"><div class="pv-sub" style="color:${label3}">${text}</div></div>`;

  // ---------- 拼接：日历 ----------
  if (content === 'calendar') {
    if (style === 'week') {
      const days = weekDatesForNow(now, ws);
      // 窄高块：7 个日期改为 7 行，行内「日期（左）+ 星期（右）」
      if (tall) {
        return html`<div class="pv-col">
          <div class="pv-wkv">
            ${days.map((d) => {
    const isT = formatDate(d) === todayStrV;
    const wd = isZh
      ? `周${WEEK_FULL_ZH[d.getDay()]}`
      : d.toLocaleDateString('en-US', { weekday: 'short' });
    const fg = isT ? '#fff' : label3;
    return html`<div class="pv-wkv-cell ${isT ? 'today' : ''}" style="${isT ? `background:${theme};` : ''}color:${fg}"><span class="pv-wkv-d" style="color:${isT ? '#fff' : label2}">${d.getDate()}</span><span class="pv-wkv-w" style="color:${fg}">${wd}</span></div>`;
  })}
          </div>
        </div>`;
      }
      return html`<div class="pv-col">
        <div class="pv-wk">
          ${days.map((d) => {
    const ds = formatDate(d);
    const isT = ds === todayStrV;
    return html`<div class="pv-wk-cell ${isT ? 'today' : ''}" style="${isT ? `background:${theme};color:#fff` : `color:${label3}`}"><span class="pv-wk-d">${d.getDate()}</span><span class="pv-wk-w">${isZh ? WEEK_FULL_ZH[d.getDay()] : WEEK_MIN_EN[d.getDay()]}</span></div>`;
  })}
        </div>
      </div>`;
    }
    // month（单行显示）：同周日历的一行样式，但天数更多，今日居水平中央
    if (style === 'month' && o.opts && o.opts.singleLine) {
      // v1.32：天数按可用宽度动态计算（奇数 → 今日居中），尽量填满减少两侧留白
      const total = Number.isFinite(o.singleDays) && o.singleDays >= 7
        ? (o.singleDays % 2 === 0 ? o.singleDays - 1 : o.singleDays)
        : 19;
      const side = (total - 1) / 2;
      const days = Array.from({ length: side * 2 + 1 }, (_, i) => addDays(now, i - side));
      return html`<div class="pv-col">
        <div class="pv-wk" style="grid-template-columns:repeat(${days.length},1fr)">
          ${days.map((d) => {
    const ds = formatDate(d);
    const isT = ds === todayStrV;
    return html`<div class="pv-wk-cell ${isT ? 'today' : ''}" style="${isT ? `background:${theme};color:#fff` : `color:${label3}`}"><span class="pv-wk-d">${d.getDate()}</span><span class="pv-wk-w">${isZh ? WEEK_FULL_ZH[d.getDay()] : WEEK_MIN_EN[d.getDay()]}</span></div>`;
  })}
        </div>
      </div>`;
    }
    // month：月日历（v1.32 回退：表头仍为「年月」，不再升级为完整日期）
    const cells = getMonthGrid(now.getFullYear(), now.getMonth() + 1, ws);
    const head = isZh
      ? `${now.getFullYear()}年${now.getMonth() + 1}月`
      : now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return html`<div class="pv-col">
      <div class="pv-cal-head pv-row2" style="color:${label2}">${head}</div>
      <div class="pv-mini-grid">
        ${cells.map((cell) => {
    const ds = formatDate(cell.date);
    const isT = ds === todayStrV;
    return html`<span class="pv-c ${cell.inMonth ? '' : 'out'} ${isT ? 'today' : ''}" style="${isT ? `background:${theme};color:#fff` : `color:${label3}`}">${cell.date.getDate()}</span>`;
  })}
      </div>
    </div>`;
  }

  // ---------- 拼接：时间（文字为主） ----------
  if (content === 'time') {
    const y = now.getFullYear();
    const yS = String(y).slice(-2); // 两位年（竖排/小卡用）
    const mo = now.getMonth() + 1;
    const d = now.getDate();
    const wdZh = `周${WEEK_FULL_ZH[now.getDay()]}`;
    const wdEn = now.toLocaleDateString('en-US', { weekday: 'long' });
    // 竖排 / 小卡用的拆字段文案：en 用 short（竖排里宽度才是稀缺维度）
    const moEn = now.toLocaleDateString('en-US', { month: 'short' });
    const wdEnShort = now.toLocaleDateString('en-US', { weekday: 'short' });
    const h24 = String(now.getHours()).padStart(2, '0');
    const h12v = String(now.getHours() % 12 || 12).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const apText = hour12 ? (now.getHours() < 12 ? 'AM' : 'PM') : '';
    const hPart = hour12 ? h12v : h24;
    switch (style) {
      case 'dateFull': {
        // v1.32 需求 5：竖排时年份只显示后两位（26 而非 2026），让竖排更紧凑、字号更大
        if (noUnits) {
          const aria = isZh ? `${y}年${mo}月${d}日` : now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          return tall ? nuV([yS, mo, d], aria) : nuH(html`${y}${dot}${mo}${dot}${d}`, aria);
        }
        return tall
          ? vstack(isZh ? [`${yS}年`, `${mo}月`, `${d}日`] : [`${yS}`, moEn, `${d}`], false)
          : mid(isZh
            ? joinSegs([seg(`${isShortYear ? yS : y}年`), seg(`${mo}月`), seg(`${d}日`)])
            : now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }));
      }
      // v1.35 需求 1：年月。横排「2026 · 10」，竖排「26 / 10」；简约时同形只去「年/月」单位
      case 'dateYearMonth': {
        if (noUnits) {
          const aria = isZh ? `${y}年${mo}月` : now.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
          return tall ? nuV([yS, mo], aria) : nuH(html`${y}${dot}${mo}`, aria);
        }
        return tall
          ? vstack(isZh ? [`${yS}年`, `${mo}月`] : [`${yS}`, moEn], false)
          : mid(isZh
            ? joinSegs([seg(`${isShortYear ? yS : y}年`), seg(`${mo}月`)])
            : now.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }));
      }
      case 'dateMonthDay': {
        if (noUnits) {
          const aria = isZh ? `${mo}月${d}日` : now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          return tall ? nuV([mo, d], aria) : nuH(html`${mo}${dot}${d}`, aria);
        }
        return tall
          ? vstack(isZh ? [`${mo}月`, `${d}日`] : [moEn, `${d}`], false)
          : mid(isZh
            ? joinSegs([seg(`${mo}月`), seg(`${d}日`)])
            : now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
      }
      case 'dateWeekday': {
        if (noUnits) {
          const wk = isZh ? wdZh : wdEnShort;
          const aria = isZh ? `${mo}月${d}日 ${wdZh}` : now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'long' });
          return tall ? nuV([mo, d, wk], aria, true) : nuH(html`${mo}${dot}${d} ${wk}`, aria);
        }
        return tall
          ? vstack(isZh ? [`${mo}月`, `${d}日`, wdZh] : [moEn, `${d}`, wdEnShort], false)
          : mid(isZh
            ? joinSegs([seg(`${mo}月`), seg(`${d}日`), seg(wdZh)])
            : now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'long' }));
      }
      case 'dateFullWeekday': {
        if (noUnits) {
          const wk = isZh ? wdZh : wdEnShort;
          const aria = isZh ? `${y}年${mo}月${d}日 ${wdZh}` : now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
          return tall ? nuV([yS, mo, d, wk], aria, true) : nuH(html`${y}${dot}${mo}${dot}${d} ${wk}`, aria);
        }
        return tall
          ? vstack(isZh ? [`${yS}年`, `${mo}月`, `${d}日`, wdZh] : [`${yS}`, moEn, `${d}`, wdEnShort], false)
          : mid(isZh
            ? joinSegs([seg(`${isShortYear ? yS : y}年`), seg(`${mo}月`), seg(`${d}日`), seg(wdZh)])
            : now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }));
      }
      case 'hm':
        return tall ? vstack([hPart, mm], true, apText) : big(fmtHM(now, hour12, false));
      case 'hms':
        return tall ? vstack([hPart, mm, ss], true, apText) : big(fmtHM(now, hour12, true));
      case 'year':
        // v1.31 需求 8：1×1 占格显示后两位（副标题保留，否则 26 失去语义）
        return big(small ? String(y).slice(-2) : String(y), isZh ? '年' : 'Year');
      case 'month':
        return big(String(mo), isZh ? '月' : 'Month');
      case 'weekOfYear':
        return big(String(weekOfYear(now)), isZh ? '周' : 'Week');
      case 'weekday':
        return small
          ? bigSmall(isZh ? wdZh : wdEn, isZh ? '星期' : 'Weekday')
          : big(isZh ? wdZh : wdEn, isZh ? '星期' : 'Weekday');
      case 'day':
        return big(String(d), isZh ? '日' : 'Day');
      case 'hour':
        return big(String(now.getHours()), isZh ? '时' : 'Hour');
      case 'minute':
        return big(String(now.getMinutes()).padStart(2, '0'), isZh ? '分' : 'Minute');
      case 'second':
        return big(String(now.getSeconds()).padStart(2, '0'), isZh ? '秒' : 'Second');
      default:
        return big(fmtHM(now, hour12, false));
    }
  }

  // ---------- 拼接：重要日期 ----------
  if (content === 'important') {
    let info = null;
    let sub = '';
    if (style === 'festival') {
      info = getNextFestival(now);
      sub = isZh ? '下个节日' : 'Next festival';
    } else if (style === 'solarTerm') {
      info = getNextSolarTerm(now);
      sub = isZh ? '下个节气' : 'Next solar term';
    } else {
      info = getNextHoliday(getHolidayService(), now);
      sub = isZh ? '距下次放假' : 'To next holiday';
    }
    if (!info) return empty(isZh ? '暂无数据' : 'No data');
    const name = style === 'solarTerm'
      ? (isZh ? info.zh : info.en)
      : (isZh ? info.nameZh : info.nameEn);
    return flat ? countdownFlat(name, info.days, sub) : countdown(name, info.days, sub);
  }

  // ---------- 空白（只占位不显示内容） ----------
  if (content === 'blank') {
    return html`<div class="pv-blank"></div>`;
  }

  // ---------- 拼接：日程（仅拼接模式；单独模式的日程样式在下方「单独：日程」分支）----------
  if (!o.singleRow && content === 'schedule') {
    if (style === 'multiple') {
      // 按块内可用空间自适应：横向够宽时补具体日期，纵向够高时多显示几条
      const availW = Number.isFinite(o.availW) ? o.availW : 8;
      const availH = Number.isFinite(o.availH) ? o.availH : 6;
      const wide = !!(o.opts && o.opts.wide);
      const withDate = availW >= 13;
      const withWeek = availW >= 17;
      // v1.34 需求 3：行数按「实测行高 + 行距」折算（旧公式固定除 1.3em，对宽布局
      // 行高 1.25em 估算不足 → 末行被裁）。总高 = n×rowH + (n-1)×gap ≤ availH - 余量。
      const rowH = wide ? SCH_ROW_H_WIDE : SCH_ROW_H_NARROW;
      const rows = Math.max(1, Math.min(8,
        Math.floor((availH - SCH_ROWS_RESERVE + SCH_ROW_GAP) / (rowH + SCH_ROW_GAP))));
      const top = upcoming.slice(0, rows);
      if (!top.length) return empty(isZh ? '暂无日程' : 'No schedules');
      // 剩余空间匀进行距（单侧增量有上限），避免列表顶部堆叠、底部留大洞
      const contentH = rows * rowH + (rows - 1) * SCH_ROW_GAP;
      const extra = rows > 1
        ? Math.min(SCH_GAP_MAX_EXTRA, Math.max(0, availH - SCH_ROWS_RESERVE - contentH) / (rows - 1))
        : 0;
      const gapEm = (SCH_ROW_GAP + extra).toFixed(3);
      // 占格水平 ≥4：日程名在左，右侧缩小的「年月日 / 时分秒」两行
      // （wide 由 renderBlocksHTML 并入 opts，见该处 SCH_MULTI_WIDE_COLS 判定）
      if (wide) {
        return html`<div class="pv-col" style="gap:${gapEm}em">
          ${top.map(({ item, next }) => {
    const dateTxt = isZh
      ? `${next.date.getFullYear()}年${next.date.getMonth() + 1}月${next.date.getDate()}日`
      : next.date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const timeTxt = item.time || (isZh ? '全天' : 'All day');
    // 标题可容纳字符数：availW - 右侧 meta 预留（实测 meta 两行最宽≈3.72em：zh「2026年10月22日」
    // 9 字符 @0.5em + gap 0.5em + 0.6em 安全余量；旧值 7.5em 为 meta 改两行前的预留，过保守）
    const keep = Math.max(3, Math.min(24, Math.floor((availW - 4.8) / 0.75)));
    const title = item.title.length > keep ? `${item.title.slice(0, keep)}…` : item.title;
    return html`<div class="pv-sch-row">
              <span class="pv-sch-name" style="color:${label}">${title}</span>
              <span class="pv-sch-meta" style="color:${label3}">
                <span class="pv-sch-date">${dateTxt}</span>
                <span class="pv-sch-time">${timeTxt}</span>
              </span>
            </div>`;
  })}
        </div>`;
      }
      return html`<div class="pv-col" style="gap:${gapEm}em">
        ${top.map(({ item, next }) => {
    const d = diffDays(next.date, now);
    const dateTxt = withDate
      ? (isZh
        ? `${next.date.getMonth() + 1}月${next.date.getDate()}日${withWeek ? ` 周${WEEK_FULL_ZH[next.date.getDay()]}` : ''}`
        : `${next.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}${withWeek ? ` ${WEEK_MIN_EN[next.date.getDay()]}` : ''}`)
      : '';
    // 标题可容纳字符数：按行字号（0.75em）折算，带日期时再减去日期占位
    const units = availW / 0.75;
    const keep = withDate ? Math.floor(units - 8) : Math.floor(units * 0.9);
    const left = Math.max(3, Math.min(20, keep));
    const title = item.title.length > left ? `${item.title.slice(0, left)}…` : item.title;
    return html`<div class="pv-row2 pv-sch-line" style="color:${label}">
            ${dateTxt ? html`<span style="color:${label3}">${dateTxt}</span> ` : ''}${title} <b style="color:${theme}">${d === 0 ? TODAY : `${d}${DAYS}`}</b>
          </div>`;
  })}
      </div>`;
    }
    // recent：最近日程
    const first = upcoming[0];
    if (!first) return empty(isZh ? '暂无日程' : 'No schedules');
    const recentDays = diffDays(first.next.date, now);
    return flat
      ? countdownFlat(first.item.title, recentDays, isZh ? '最近日程' : 'Nearest schedule')
      : countdown(first.item.title, recentDays, isZh ? '最近日程' : 'Nearest schedule');
  }

  // ---------- 单独：时间及日期（图像为主，当前用文字实现） ----------
  if (content === 'timeDate') {
    const dateSub = isZh
      ? `${now.getMonth() + 1}月${now.getDate()}日 周${WEEK_FULL_ZH[now.getDay()]}`
      : now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
    if (style === 'led') {
      return html`<div class="pv-center">
        <div class="pv-big pv-led" style="color:${theme}">${fmtHM(now, hour12, true)}</div>
        <div class="pv-sub" style="color:${label3}">${dateSub}</div>
      </div>`;
    }
    if (style === 'analog') {
      const h = now.getHours() % 12, m = now.getMinutes(), s = now.getSeconds();
      const ang = (deg) => deg * Math.PI / 180;
      const pt = (len, val, unit) => { const a = ang((val / unit) * 360 - 90); return [30 + Math.cos(a) * len, 30 + Math.sin(a) * len]; };
      const [hx, hy] = pt(12, h + m / 60, 12);
      const [mx, my] = pt(18, m + s / 60, 60);
      const [sx, sy] = pt(24, s, 60);
      return html`<div class="pv-center">
        <svg viewBox="0 0 60 60" width="76" height="76">
          <circle cx="30" cy="30" r="24" fill="none" stroke="${cardBg}" stroke-width="3"/>
          <line x1="30" y1="30" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}" stroke="${label}" stroke-width="3" stroke-linecap="round"/>
          <line x1="30" y1="30" x2="${mx.toFixed(1)}" y2="${my.toFixed(1)}" stroke="${label2}" stroke-width="2.5" stroke-linecap="round"/>
          <line x1="30" y1="30" x2="${sx.toFixed(1)}" y2="${sy.toFixed(1)}" stroke="${theme}" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="30" cy="30" r="2" fill="${theme}"/>
        </svg>
        <div class="pv-sub" style="color:${label3}">${dateSub}</div>
      </div>`;
    }
    if (style === 'flip') {
      const tt = fmtHM(now, hour12, true);
      const parts = tt.split(/[:\s]/);
      const digits = parts.filter((p) => /^\d+$/.test(p));
      const ap = parts[parts.length - 1];
      return html`<div class="pv-center"><div class="pv-flip">
        ${digits.map((p) => html`<span class="pv-flip-box" style="background:${cardBg};color:${label}">${p}</span>`)}
        ${/^(AM|PM)$/.test(ap) ? html`<span class="pv-ap" style="color:${label3}">${ap}</span>` : ''}
      </div><div class="pv-sub" style="color:${label3}">${dateSub}</div></div>`;
    }
    if (style === 'yearCal') {
      const y = now.getFullYear();
      return html`<div class="pv-col">
        <div class="pv-row2" style="color:${label2}">${y}</div>
        <div class="pv-yearcal">
          ${Array.from({ length: 12 }, (_, mi) => {
    const cells = getMonthGrid(y, mi + 1, ws);
    return html`<div class="pv-yearcal-m">
              <div class="pv-yearcal-t" style="color:${mi === now.getMonth() ? theme : label3}">${mi + 1}</div>
              <div class="pv-mini-grid">
                ${cells.map((cell) => {
    const ds = formatDate(cell.date);
    const isT = ds === todayStrV;
    return html`<span class="pv-c ${cell.inMonth ? '' : 'out'} ${isT ? 'today' : ''}" style="${isT ? `background:${theme};color:#fff` : `color:${label3}`}">${cell.date.getDate()}</span>`;
  })}
              </div>
            </div>`;
  })}
        </div>
      </div>`;
    }
    if (style === 'weekCal') {
      const days = weekDatesForNow(now, ws);
      return html`<div class="pv-col">
        <div class="pv-wk">
          ${days.map((d) => {
    const ds = formatDate(d);
    const isT = ds === todayStrV;
    return html`<div class="pv-wk-cell ${isT ? 'today' : ''}" style="${isT ? `background:${theme};color:#fff` : `color:${label3}`}"><span class="pv-wk-d">${d.getDate()}</span><span class="pv-wk-w">${isZh ? WEEK_FULL_ZH[d.getDay()] : WEEK_MIN_EN[d.getDay()]}</span></div>`;
  })}
        </div>
        <div class="pv-sub" style="color:${label3};text-align:center;">${dateSub}</div>
      </div>`;
    }
    // v2.7 dualZone：上「时间」大字 / 细分隔线 / 下「日期 + 星期」
    if (style === 'dualZone') {
      const t = fmtHM(now, hour12, false);
      const dateTxt = isZh
        ? `${now.getMonth() + 1}月${now.getDate()}日`
        : now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const wdTxt = isZh ? `周${WEEK_FULL_ZH[now.getDay()]}` : WEEK_MIN_EN[now.getDay()];
      return html`<div class="pv-col pv-dz">
        <div class="pv-dz-time" style="color:${label}">${t}</div>
        <div class="pv-dz-rule"></div>
        <div class="pv-dz-date">
          <span style="color:${label2}">${dateTxt}</span>
          <b style="color:${theme}">${wdTxt}</b>
        </div>
      </div>`;
    }

    // v2.10 stripeClock 极简条钟：超大细体时间 + 主题色细线 + 日期
    if (style === 'stripeClock') {
      const ac = accentOf(theme);
      const hm = fmtHM(now, hour12, false);
      const md = isZh ? `${now.getMonth() + 1}月${now.getDate()}日` : `${now.getMonth() + 1}/${now.getDate()}`;
      const wd = isZh ? `周${'日一二三四五六'[now.getDay()]}` : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()];
      return html`<div class="pv-col pv-st">
        <div class="pv-st-time" style="color:${label}">${hm}</div>
        <div class="pv-st-rule" style="background:${ac}"></div>
        <div class="pv-st-date">${md} · ${wd}</div>
      </div>`;
    }
    // v2.10 wordClock 文字时钟：中文数字/英文单词表达时间
    if (style === 'wordClock') {
      const ac = accentOf(theme);
      const zw = (n) => {
        const d = '〇一二三四五六七八九';
        if (n < 10) return d[n];
        if (n < 20) return '十' + (n % 10 ? d[n % 10] : '');
        return d[Math.floor(n / 10)] + '十' + (n % 10 ? d[n % 10] : '');
      };
      const en = (n) => {
        const a = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
        const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty'];
        if (n < 20) return a[n];
        const t = Math.floor(n / 10), rest = n % 10;
        return b[t] + (rest ? ' ' + a[rest] : '');
      };
      const main = isZh
        ? `${zw(now.getHours())}时${zw(now.getMinutes())}分`
        : `${en(now.getHours())} ${en(now.getMinutes())}`.toUpperCase();
      const sub = isZh
        ? `${String(now.getFullYear()).split('').map((x) => zw(Number(x))).join('')}年${zw(now.getMonth() + 1)}月${zw(now.getDate())}日`
        : `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
      return html`<div class="pv-col pv-wc">
        <div class="pv-wc-main" style="color:${label}">${main}</div>
        <div class="pv-wc-sub" style="color:${ac}">${sub}</div>
      </div>`;
    }
    // v2.9 ringClock：环形刻度钟（60 刻度 + 当日走过比例的弧 + 中心时间）
    if (style === 'ringClock') {
      const ac = accentOf(theme);
      const t = fmtHM(now, hour12, true);
      const ratio = sec / 86400;
      const C = 2 * Math.PI * 44;
      const ticks = Array.from({ length: 60 }, (_, i) => {
        const a = (i / 60) * Math.PI * 2;
        const r1 = i % 5 === 0 ? 30 : 35;
        const sn = Math.sin(a), cs = Math.cos(a);
        return html`<line x1="${(50 + sn * r1).toFixed(2)}" y1="${(50 - cs * r1).toFixed(2)}" x2="${(50 + sn * 39.5).toFixed(2)}" y2="${(50 - cs * 39.5).toFixed(2)}" stroke="currentColor" stroke-opacity="${i % 5 === 0 ? 0.55 : 0.24}" stroke-width="${i % 5 === 0 ? 1.1 : 0.6}" stroke-linecap="round" />`;
      });
      return html`<div class="pv-col pv-rc">
        <div class="pv-rc-ring">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            ${ticks}
            <circle cx="50" cy="50" r="44" fill="none" stroke="${ac}" stroke-width="2.6" stroke-linecap="round"
              stroke-dasharray="${(C * ratio).toFixed(2)} ${C.toFixed(2)}" transform="rotate(-90 50 50)" />
          </svg>
          <div class="pv-rc-time" style="color:${label}">${t}</div>
        </div>
      </div>`;
    }
    // v2.9 dotClock：数码管风格（等宽数字 + 发光 + 顶部点阵条）
    if (style === 'dotClock') {
      const ac = accentOf(theme);
      const t = fmtHM(now, hour12, true);
      const dots = Array.from({ length: 24 }, (_, i) => html`<i style="opacity:${i < Math.round(24 * sec / 86400) ? 0.9 : 0.14}"></i>`);
      return html`<div class="pv-col pv-dc">
        <div class="pv-dc-dots" style="color:${ac}">${dots}</div>
        <div class="pv-dc-time" style="color:${ac}">${t}</div>
        <div class="pv-dc-date" style="color:${label3}">${isZh ? `${now.getMonth() + 1}月${now.getDate()}日 周${WEEK_FULL_ZH[now.getDay()]}` : now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
      </div>`;
    }
    // v2.9 boldClock：粗体大字钟（两行大数字 + 右侧竖排日期；色块用主色）
    if (style === 'boldClock') {
      const ac = accentOf(theme);
      const hh = String(hour12 ? (now.getHours() % 12 || 12) : now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      return html`<div class="pv-col pv-bc">
        <div class="pv-bc-nums" style="background:${ac}">
          <b>${hh}</b><b>${mm}</b>
        </div>
        <div class="pv-bc-side">
          <span style="color:${label2}">${now.getMonth() + 1}/${now.getDate()}</span>
          <span style="color:${label3}">${isZh ? `周${WEEK_FULL_ZH[now.getDay()]}` : WEEK_MIN_EN[now.getDay()]}</span>
        </div>
      </div>`;
    }
    // flipMonthDay：翻页月日
    const wdShort = isZh ? `周${WEEK_FULL_ZH[now.getDay()]}` : now.toLocaleDateString('en-US', { weekday: 'short' });
    return html`<div class="pv-center"><div class="pv-flip">
      <span class="pv-flip-box" style="background:${cardBg};color:${label}">${now.getMonth() + 1}月</span>
      <span class="pv-flip-box" style="background:${cardBg};color:${label}">${now.getDate()}日</span>
    </div><div class="pv-sub" style="color:${label3}">${now.getFullYear()} · ${wdShort}</div></div>`;
  }

  // ---------- 单独：日程 ----------
  // v2.11 gauge 仪表类内容：指针仪表 / 半环仪表（读年初进度与当日进度）
  if (content === 'gauge' && o.singleRow) {
    const ac = accentOf(theme);
    const yp0 = yearProgress(now);
    const secAll = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const dP = Math.min(1, secAll / 86400);
    if (style === 'dial') {
      const A0 = -120, SWEEP = 240;
      const ang = A0 + SWEEP * yp0;
      const rad = (ang * Math.PI) / 180;
      const nx = 50 + Math.sin(rad) * 26, ny = 50 - Math.cos(rad) * 26;
      const ticks = Array.from({ length: 21 }, (_, i) => {
        const a = ((A0 + (SWEEP * i) / 20) * Math.PI) / 180;
        const big = i % 5 === 0;
        const r1 = big ? 34 : 37, r2 = 40;
        return html`<line x1="${(50 + Math.sin(a) * r1).toFixed(2)}" y1="${(50 - Math.cos(a) * r1).toFixed(2)}"
            x2="${(50 + Math.sin(a) * r2).toFixed(2)}" y2="${(50 - Math.cos(a) * r2).toFixed(2)}"
            stroke="currentColor" stroke-opacity="${big ? 0.6 : 0.28}" stroke-width="${big ? 1.4 : 0.8}" stroke-linecap="round" />`;
      });
      return html`<div class="pv-col pv-gl">
          <div class="pv-gl-dial">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              ${ticks}
              <circle cx="50" cy="50" r="44" fill="none" stroke="${ac}" stroke-opacity="0.16" stroke-width="2"
                stroke-dasharray="${(2 * Math.PI * 44 * (SWEEP / 360)).toFixed(2)} 999" transform="rotate(210 50 50)" />
              <line x1="50" y1="50" x2="${nx.toFixed(2)}" y2="${ny.toFixed(2)}" stroke="${ac}" stroke-width="2.6" stroke-linecap="round" />
              <circle cx="50" cy="50" r="2.6" fill="${ac}" />
            </svg>
            <div class="pv-gl-val" style="color:${label}">${Math.round(yp0)}%</div>
          </div>
          <div class="pv-gl-cap">${isZh ? '今年已过' : 'Year'}</div>
        </div>`;
    }
    if (style === 'semiGauge') {
      const C2 = Math.PI * 40;
      return html`<div class="pv-col pv-sg">
          <div class="pv-sg-wrap">
            <svg viewBox="0 0 100 58" aria-hidden="true">
              <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="currentColor" stroke-opacity="0.14" stroke-width="7" stroke-linecap="round" />
              <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="${ac}" stroke-width="7" stroke-linecap="round"
                stroke-dasharray="${(C2 * dP).toFixed(2)} ${C2.toFixed(2)}" />
            </svg>
            <div class="pv-sg-val" style="color:${label}">${Math.round(dP * 100)}%</div>
          </div>
          <div class="pv-sg-cap">${isZh ? '今日已过' : 'Today'}</div>
        </div>`;
    }
  }

  if (content === 'schedule') {
    if (style === 'holidayCountdown') {
      const nh = getNextHoliday(getHolidayService(), now);
      if (!nh) return empty(isZh ? '暂无数据' : 'No data');
      return countdown(isZh ? nh.nameZh : nh.nameEn, nh.days, isZh ? '距放假' : 'To holiday');
    }

    // v2.9 capsule：胶囊倒计时（年倒计时 d/h/m/s，可按「样式设置」改主色与文案）
    if (style === 'capsule') {
      const ac = accentOf(theme);
      const title = typeof opt.text === 'string' && opt.text
        ? opt.text
        : (isZh ? `${now.getFullYear()} 年倒计时` : `Year ${now.getFullYear()}`);
      const end = new Date(now.getFullYear() + 1, 0, 1);
      const ms = Math.max(0, end.getTime() - now.getTime());
      const dd = Math.floor(ms / 86400000);
      const hh = Math.floor(ms / 3600000) % 24;
      const mm = Math.floor(ms / 60000) % 60;
      const ss = Math.floor(ms / 1000) % 60;
      const pad = (v) => String(v).padStart(2, '0');
      const cell = (v, u) => html`<span class="pv-cp-cell"><b style="color:${label}">${pad(v)}</b><i style="color:${label3}">${u}</i></span>`;
      return html`<div class="pv-col pv-cp">
        <div class="pv-cp-pill" style="border-color:${ac};color:${ac}">${title}</div>
        <div class="pv-cp-row">
          ${cell(dd, isZh ? '天' : 'd')}${cell(hh, isZh ? '时' : 'h')}${cell(mm, isZh ? '分' : 'm')}${cell(ss, isZh ? '秒' : 's')}
        </div>
      </div>`;
    }
    // v2.10 bigDays 巨型天数：超大数字 + 标题 + 目标日期（可用样式设置改文案/目标日）
    if (style === 'bigDays') {
      const ac = accentOf(theme);
      const opt = o.opts || {};
      const title = (schedPick && schedPick.title) || opt.text || (isZh ? '倒计时' : 'Countdown');
      const isoPick = (schedPick && schedPick.date) || (typeof opt.date === 'string' ? opt.date : '');
      let ty = now.getFullYear(), tm = now.getMonth() + 1, td = now.getDate();
      if (/^\d{4}-\d{2}-\d{2}$/.test(isoPick)) {
        const [a, b2, c2] = isoPick.split('-').map(Number);
        ty = a; tm = b2; td = c2;
      }
      const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const d1 = new Date(ty, tm - 1, td);
      const diff = Math.round((d1 - d0) / 86400000);
      const abs = Math.abs(diff);
      const dateStr = `${ty}-${String(tm).padStart(2, '0')}-${String(td).padStart(2, '0')}`;
      const tail = isZh ? `距 ${dateStr}` : dateStr;
      return html`<div class="pv-col pv-bd">
        <div class="pv-bd-title" style="color:${label2}">${title}</div>
        <div class="pv-bd-num" style="color:${ac}">${abs}<${'small'}>${isZh ? '天' : 'd'}</small></div>
        <div class="pv-bd-tail">${tail}</div>
      </div>`;
    }
    // v2.9 targetDay：目标倒计时卡（标题 / 目标日都可在「样式设置」里改）
    if (style === 'targetDay') {
      const ac = accentOf(theme);
      const title = (schedPick && schedPick.title) || (typeof opt.text === 'string' && opt.text ? opt.text : (isZh ? '目标日' : 'Target'));
      const iso = (schedPick && schedPick.date) || (typeof opt.date === 'string' ? opt.date : '');
      let left = null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        const [y, m, d] = iso.split('-').map(Number);
        const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        left = Math.round((new Date(y, m - 1, d).getTime() - t0.getTime()) / 86400000);
      }
      return html`<div class="pv-col pv-tg">
        <div class="pv-tg-title" style="color:${label2}">${title}</div>
        ${left === null
    ? html`<div class="pv-sub" style="color:${label3}">${isZh ? '未设置目标日' : 'No target date'}</div>`
    : html`<div class="pv-center">
            <span class="pv-tg-pre" style="color:${label3}">${left >= 0 ? (isZh ? '还有' : 'in') : (isZh ? '已过' : 'over')}</span>
            <span class="pv-tg-days" style="color:${ac}">${Math.abs(left)}</span>
            <span class="pv-tg-unit" style="color:${label3}">${isZh ? '天' : Math.abs(left) === 1 ? 'day' : 'days'}</span>
          </div>
          <div class="pv-tg-date" style="color:${label3}">${iso}</div>`}
      </div>`;
    }
    // recentEvent：最近事项列表
    const top = upcoming.slice(0, 4);
    if (!top.length) return empty(isZh ? '暂无日程' : 'No schedules');
    return html`<div class="pv-col">
      ${top.map(({ item, next }) => {
    const d = diffDays(next.date, now);
    return html`<div class="pv-row2" style="color:${label}">${item.title} <b style="color:${theme}">${d === 0 ? TODAY : `${d}${DAYS}`}</b></div>`;
  })}
    </div>`;
  }

  // ---------- 单独：进度 ----------
  if (content === 'progress') {
    if (style === 'year') {
      const yp = yearProgress(now);
      const r = 24, c = 2 * Math.PI * r, off = c * (1 - yp / 100);
      return html`<div class="pv-center">
        <svg viewBox="0 0 60 60" width="76" height="76">
          <circle cx="30" cy="30" r="${r}" fill="none" stroke="${cardBg}" stroke-width="7"/>
          <circle cx="30" cy="30" r="${r}" fill="none" stroke="${theme}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 30 30)"/>
          <text x="30" y="34" text-anchor="middle" font-size="13" font-weight="800" fill="${label}">${yp.toFixed(0)}%</text>
        </svg>
        <div class="pv-sub" style="color:${label3}">${isZh ? '今年进度' : 'Year'} · ${dayOfYear(now)}${isZh ? '天' : 'd'}</div>
      </div>`;
    }
    if (style === 'month') {
      const dim = daysInMonth(now.getFullYear(), now.getMonth() + 1);
      const p = ((now.getDate() - 1) + sec / 86400) / dim * 100;
      return bar(isZh ? '本月进度' : 'Month', p);
    }
    if (style === 'week') return bar(isZh ? '本周进度' : 'Week', weekPct);
    if (style === 'day') return bar(isZh ? '今日进度' : 'Today', dayPct);

    // v2.9 multiBars：多条进度（年 / 月 / 周 / 日），一条一行，主色可改
    if (style === 'multiBars') {
      const ac = accentOf(theme);
      const dimM = daysInMonth(now.getFullYear(), now.getMonth() + 1);
      const mp = ((now.getDate() - 1) + sec / 86400) / dimM * 100;
      // v2.11：opts.bars 选要哪几条（y/m/w/d/life），opts.age + opts.life 组成生命进度
      const mbOpt = o.opts || {};
      const pickedBars = String(mbOpt.bars || 'y,m,w,d').split(',').filter(Boolean);
      const ageN = Number(mbOpt.age), lifeN = Number(mbOpt.life);
      const lifePct = Number.isFinite(ageN) && Number.isFinite(lifeN) && lifeN > 0
        ? Math.max(0, Math.min(100, (ageN / lifeN) * 100)) : null;
      const rows = [
        ['y', isZh ? '年' : 'Year', yearProgress(now)],
        ['m', isZh ? '月' : 'Month', mp],
        ['w', isZh ? '周' : 'Week', weekPct],
        ['d', isZh ? '日' : 'Day', dayPct],
        ['life', isZh ? '生命' : 'Life', lifePct],
      ].filter(([k2, , v2]) => pickedBars.includes(k2) && v2 !== null)
        .map(([, k2, v2]) => [k2, v2]);
      return html`<div class="pv-col pv-mb">
        ${rows.map(([k, v]) => html`<div class="pv-mb-row">
          <span class="pv-mb-k" style="color:${label3}">${k}</span>
          <b class="pv-mb-bar"><i style="width:${Math.max(0, Math.min(100, v)).toFixed(1)}%;background:${ac}"></i></b>
          <span class="pv-mb-v" style="color:${label2}">${v.toFixed(1)}%</span>
        </div>`)}
      </div>`;
    }
    // v2.7 yearGrid：整卡年进度格阵（今日点亮），365/366 格按容器宽度自动折行
    // v2.10 ringProgress 四环进度：年/月/周/日 四条同心弧
    if (style === 'ringProgress') {
      const ac = accentOf(theme);
      const y0 = new Date(now.getFullYear(), 0, 1);
      const isLeap = (now.getFullYear() % 4 === 0 && now.getFullYear() % 100 !== 0) || now.getFullYear() % 400 === 0;
      const yTotal = isLeap ? 366 : 365;
      const dayIdx = Math.floor((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - y0) / 86400000) + 1;
      const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const secDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      const pY = Math.min(1, dayIdx / yTotal);
      const pM = Math.min(1, now.getDate() / dim);
      const pW = Math.min(1, ((now.getDay() + 6) % 7 + secDay / 86400) / 7);
      const pD = Math.min(1, secDay / 86400);
      const rings = [[44, pY, 0.95], [34, pM, 0.7], [24, pW, 0.5], [14, pD, 0.34]].map(([rr, p2, op]) => {
        const C2 = 2 * Math.PI * rr;
        return html`<circle cx="50" cy="50" r="${rr}" fill="none" stroke="${ac}" stroke-opacity="${op}"
          stroke-width="3.2" stroke-linecap="round" stroke-dasharray="${(C2 * p2).toFixed(2)} ${C2.toFixed(2)}"
          transform="rotate(-90 50 50)" />`;
      });
      return html`<div class="pv-col pv-rp">
        <div class="pv-rp-ring">
          <svg viewBox="0 0 100 100" aria-hidden="true">${rings}</svg>
          <div class="pv-rp-pct" style="color:${label}">${Math.round(pY * 100)}%</div>
        </div>
        <div class="pv-rp-legend">
          <span><i style="background:${ac}"></i>${isZh ? '年' : 'Y'} ${Math.round(pY * 100)}%</span>
          <span><i style="background:${ac};opacity:.7"></i>${isZh ? '月' : 'M'} ${Math.round(pM * 100)}%</span>
          <span><i style="background:${ac};opacity:.5"></i>${isZh ? '周' : 'W'} ${Math.round(pW * 100)}%</span>
          <span><i style="background:${ac};opacity:.34"></i>${isZh ? '日' : 'D'} ${Math.round(pD * 100)}%</span>
        </div>
      </div>`;
    }
    // v2.10 heatYear 年热力图：12 列 × 各月天数的方块阵（今天高亮）
    if (style === 'heatYear') {
      const ac = accentOf(theme);
      const yNow = now.getFullYear(), mNow = now.getMonth(), dNow = now.getDate();
      const cols = Array.from({ length: 12 }, (_, m) => {
        const dn = new Date(yNow, m + 1, 0).getDate();
        const cells = Array.from({ length: dn }, (_, i) => {
          const d = i + 1;
          const past = m < mNow || (m === mNow && d < dNow);
          const isNow = m === mNow && d === dNow;
          return html`<i class="${past ? 'on' : ''}${isNow ? ' now' : ''}"${isNow ? html` style="background:${ac}"` : ''}></i>`;
        });
        return html`<b>${cells}</b>`;
      });
      return html`<div class="pv-col pv-hy-wrap"><div class="pv-hy" aria-hidden="true">${cols}</div></div>`;
    }
    // v2.11 yearGrid 升级：opts.unit 决定粒度（年=当年天数 / 周=7 格 / 日=24 格），opts.shape 切换圆点或方块
    if (style === 'yearGrid') {
      const ygOpt = o.opts || {};
      const ygUnit = ygOpt.unit === 'week' || ygOpt.unit === 'day' ? ygOpt.unit : 'year';
      const ygShape = ygOpt.shape === 'dot' ? ' dot' : '';
      const ac0 = ygOpt.color || theme;
      if (ygUnit === 'week') {
        const wd = (now.getDay() + 6) % 7;
        return html`<div class="pv-col pv-yg">
          <div class="pv-yg-head"><span style="color:${label3}">${isZh ? `第${weekOfYear(now)}周` : `W${weekOfYear(now)}`}</span><b style="color:${ac0}">${wd + 1}/7</b></div>
          <div class="pv-yg-grid pv-yg-w7${ygShape}">${Array.from({ length: 7 }, (_, i) => {
  const cls = i === wd ? 'now' : i < wd ? 'on' : '';
  return html`<i class="${cls}" style="${i === wd ? `background:${ac0}` : ''}"></i>`;
})}</div>
        </div>`;
      }
      if (ygUnit === 'day') {
        const hr = now.getHours();
        return html`<div class="pv-col pv-yg">
          <div class="pv-yg-head"><span style="color:${label3}">${isZh ? '今日' : 'Today'}</span><b style="color:${ac0}">${hr + 1}/24</b></div>
          <div class="pv-yg-grid pv-yg-h24${ygShape}">${Array.from({ length: 24 }, (_, i) => {
  const cls = i === hr ? 'now' : i < hr ? 'on' : '';
  return html`<i class="${cls}" style="${i === hr ? `background:${ac0}` : ''}"></i>`;
})}</div>
        </div>`;
      }
      const _ygUnused = 0;

      const doy = dayOfYear(now);
      const total = new Date(now.getFullYear(), 1, 29).getDate() === 29 ? 366 : 365;
      return html`<div class="pv-col pv-yg">
        <div class="pv-yg-head">
          <span style="color:${label3}">${now.getFullYear()}</span>
          <b style="color:${theme}">${isZh ? `${doy}/${total} 天` : `${doy}/${total} d`}</b>
        </div>
        <div class="pv-yg-grid${ygShape}">${Array.from({ length: total }, (_, i) => {
  const n = i + 1;
  const cls = n === doy ? 'now' : n < doy ? 'on' : '';
  return html`<i class="${cls}" style="${n === doy ? `background:${theme}` : ''}"></i>`;
})}</div>
      </div>`;
    }
    // v2.7 yearBars：12 根月条（当月高亮），底部年度百分比
    if (style === 'yearBars') {
      const yp = yearProgress(now);
      const m0 = now.getMonth(), d0 = now.getDate();
      const dimCur = daysInMonth(now.getFullYear(), m0 + 1);
      return html`<div class="pv-col pv-yb">
        <div class="pv-yb-bars">${Array.from({ length: 12 }, (_, m) => {
    const fill = m < m0 ? 100 : m === m0 ? (d0 / dimCur) * 100 : 0;
    const cur = m === m0;
    return html`<b class="${cur ? 'cur' : ''}"><i style="height:${fill.toFixed(1)}%${cur ? `;background:${theme};opacity:1` : ''}"></i></b>`;
  })}</div>
        <div class="pv-yb-foot"><span style="color:${label3}">${isZh ? '今年' : 'Year'}</span><b style="color:${theme}">${yp.toFixed(1)}%</b></div>
      </div>`;
    }
    // v2.7 weekGrid：7 格周进度（星期 + 日期），今天高亮
    if (style === 'weekGrid') {
      const days = weekDatesForNow(now, ws);
      return html`<div class="pv-col pv-wg2">
        <div class="pv-wg2-row">${days.map((d) => {
    const ds = formatDate(d);
    const isT = ds === todayStrV, passed = ds < todayStrV;
    return html`<div class="pv-wg2-cell ${isT ? 'now' : ''} ${passed ? 'on' : ''}" style="${isT ? `background:${theme}` : ''}">
              <span style="color:${isT ? '#fff' : label3}">${isZh ? WEEK_FULL_ZH[d.getDay()] : WEEK_MIN_EN[d.getDay()]}</span>
              <b style="color:${isT ? '#fff' : label}">${d.getDate()}</b>
            </div>`;
  })}</div>
        <div class="pv-wg2-foot" style="color:${label3}">${isZh ? '本周' : 'Week'} <b style="color:${theme}">${weekPct.toFixed(0)}%</b></div>
      </div>`;
    }
    // recentSchedule：最近日程进度（年内已过天数 → 目标日）
    const first = upcoming[0];
    if (!first) return empty(isZh ? '暂无日程' : 'No schedules');
    const target = first.next.date;
    const doyNow = dayOfYear(now);
    const doyTarget = dayOfYear(target);
    const p = doyTarget > 0 ? (doyNow / doyTarget) * 100 : 100;
    return html`<div class="pv-col">
      <div class="pv-row2" style="color:${label}">${first.item.title} <b style="color:${theme}">${diffDays(target, now) === 0 ? TODAY : `${diffDays(target, now)}${DAYS}`}</b></div>
      <div class="pv-bar" style="background:${cardBg}"><div class="pv-fill" style="width:${Math.min(100, p)}%;background:${theme}"></div></div>
      <div class="pv-sub" style="color:${label3}">${isZh ? '进度' : 'Progress'} ${pct(Math.min(100, p))}%</div>
    </div>`;
  }

  return empty(isZh ? '未知内容' : 'Unknown content');
}

/**
 * 渲染单个显示内容单元（v1.24 外壳）。
 * @param {boolean} o.singleRow 单独模式整卡渲染时内容按「一行」排列
 * @param {string} [o.size] 单独模式卡片尺寸（1x1/1x2/2x1/2x2/2x4/4x4/1xfull）：
 *   输出 pv-single-<size> 类名，供按尺寸版式规则命中（CSS 见三组件与预览镜像）
 */
export function renderInfoBlock(o) {
  const body = renderInfoBlockInner(o);
  const cls = o.size ? 'pv-single pv-single-' + o.size : 'pv-single';
  // 预览等比缩放：把 CSS 的根字号基准同比缩小，保证缩小后的预览与真实卡片同比例
  // （scale 缺省 / =1 时不内联，交给 CSS 的 px 基准兜底）
  const base = o.size ? SINGLE_BASE_PX[o.size] : 0;
  const scale = Number(o.singleScale);
  const inline = base && Number.isFinite(scale) && scale > 0 && scale !== 1
    ? html` style="font-size:${(base * scale).toFixed(2)}px"`
    : '';
  if (!o.singleRow) return body;
  // v2.7：整卡装饰层（按尺寸自动加顶栏/底栏/纹理）已撤回 —— 版面差异改由用户点选的
  // 「显示样式」（SINGLE_CONTENTS 里的 chip）决定，外壳只负责尺寸类名与预览缩放
  return html`<div class="${cls}"${inline}>${body}</div>`;
}

/**
 * 拼接模式：按网格布局渲染多单元（绝对定位 + span 占位 + em 等比字号）。
 * @param {Object} o
 *   blocks: [{c,s,span,pos},...]（sanitizeBlocks 的输出；缺 span/pos 时现场推导）
 *   grid: {cols,rows} 卡片网格（列×行）
 *   cellW / cellH: 单元格像素宽/高（块根字号基准，块内部一律 em 相对缩放）
 *   其余同 renderInfoBlock
 */
export function renderBlocksHTML(o) {
  const { blocks } = o;
  const grid = o.grid || { cols: 4, rows: 4 };
  // 卡片可以不显示任何内容（拼接模式允许 0 个单元）：渲染空容器，不占位提示
  if (!Array.isArray(blocks) || !blocks.length) {
    return html`<div class="pv-blocks"></div>`;
  }
  // 兜底：调用方未做布局时现场按顺序推导
  const laid = blocks.every((b) => b.span && b.pos)
    ? blocks
    : autoLayout(blocks.map(({ c, s, span }) => (span ? { c, s, span } : { c, s })), 'combo', null, grid);
  const cellW = Math.max(1, o.cellW || 40);
  const cellH = Math.max(1, o.cellH || 40);
  const pct = (v, total) => `${(v / total * 100).toFixed(3)}%`;
  return html`<div class="pv-blocks">
    ${laid.map((b) => {
    const blockW = b.span.cols * cellW;
    const blockH = b.span.rows * cellH;
    // v1.31：按块的实际像素比判定窄高块（竖排）
    const tall = isTallBlock(blockW, blockH);
    // v1.32：小卡差异渲染仅对 1×1 / 2×1 卡片生效，且只看水平占格是否为 1（垂直不限）
    const small = isSmallUnit(b.span, o.size);
    // 多日程：占格水平 ≥4 时改用「日程名 + 日期/时间两行」布局
    const wide = b.c === 'schedule' && b.s === 'multiple' && b.span.cols >= SCH_MULTI_WIDE_COLS;
    // v1.40 需求 2：宽扁块（像素比 ≥2:1）走双栏 flat 布局。
    // v1.42：倒数型四样式（important / schedule.recent）占格「水平2×垂直1」即横向意图——
    // 窄高卡上该占格像素比常不足 2:1（如 120×252 卡格子 60×63，2×1 块 120×63 ≈ 1.9:1），
    // 仅靠 isFlatBlock 会漏判回默认竖排；补「rows===1 且块宽>块高」的占格意图判定
    const flatCountdown = (b.c === 'important' || (b.c === 'schedule' && b.s === 'recent'))
      && b.span.rows === 1 && blockW > blockH;
    const flat = isFlatBlock(blockW, blockH) || flatCountdown;
    const opts = (b.opts || tall || small || wide || flat) ? { ...(b.opts || {}), tall, small, wide, flat } : null;
    // 月历「单行显示」：天数按可用宽度动态计算，尽量填满、减少两侧留白（今日居中 → 奇数天）
    let fit = fitFor(b.c, b.s, o.hour12, o.isZh !== false, opts);
    let singleDays = 0;
    if (b.c === 'calendar' && b.s === 'month' && opts && opts.singleLine) {
      singleDays = singleLineDays(blockW, blockH);
      fit = { w: singleDays * SINGLE_CELL_EM + SINGLE_PAD_EM, h: fit.h, wrap: false };
    }
    // 块根字号：按该内容的固有尺寸反推，取宽/高两个约束的较小值（等比缩放）
    const u = fitFontU(blockW, blockH, fit);
    // 块内可用空间（em）：供内容按空间自适应（如多个日程按高度增减条数）
    const availW = blockW / u - 2 * FIT_PAD;
    const availH = blockH / u - 2 * FIT_PAD;
    // v1.43：块根字号过小时（<10px，典型为 48px 小块）附加 pv-tight，
    // 隐藏说明级小字（.pv-sub），避免出现 5px 左右不可读的副标题
    const cls = `${b.c === 'blank' ? 'pv-block pv-blank' : 'pv-block'}${u < 10 ? ' pv-tight' : ''}`;
    return html`<div
        class="${cls}"
        style="left:${pct(b.pos.col, grid.cols)};top:${pct(b.pos.row, grid.rows)};width:${pct(b.span.cols, grid.cols)};height:${pct(b.span.rows, grid.rows)};font-size:${u.toFixed(1)}px"
      >${renderInfoBlockInner({
    ...o, content: b.c, style: b.s, span: b.span, opts, availW, availH, tall, small, flat, singleDays,
    // v1.44：窄块（<150px）日期串年份降为两位，给「数值+单位」留同排空间
    shortYear: blockW < 150,
  })}</div>`;
  })}
  </div>`;
}
/**
 * 占格编辑器（v1.29，配置页 / 主页面共用）。
 * 点击已选样式的名称展开：左侧为卡片网格示意（点击格子直接拉伸），右侧为垂直/水平步进与「自适应」。
 * @param {object} o
 *   grid   { cols, rows } 当前卡片尺寸的网格
 *   target { pos, span } | null 该单元在当前布局中的实际落位（null = 放不下）
 *   span   { cols, rows } 当前占格（已含单元级覆盖）
 *   bounds { min, max }   可调区间（min 为保证可读的最小占格，max 为网格上限）
 *   name   string         样式名
 *   theme  string         主题色
 *   isZh   boolean
 *   sizeLabel string      当前卡片尺寸（用于提示）
 *   alignLocked {h,v}     该轴是否已被卡片级置中接管（软禁用：保留可点击 → 弹提示 + 解锁）
 *   alignDefault {h,v}    该轴是否为「未显式设置」（显示「默认」角标）
 *   alignHint string      单元级置中的副标题文案（独立元素，放在 .se-toggles 之外）
 *   t        (key, vars)=>string  可选；缺省时按 isZh 内联
 *   onPick(row, col) / onResize(dCols, dRows) / onReset() / onClose()
 *   onToggleAlign(axis) / onFull() / onToggleSingleLine() / onUnlock(axis)
 */
export function renderSpanEditor(o) {
  const {
    grid, target, span, bounds, name, theme, isZh, sizeLabel,
    occupied, align, isFull, singleLine, noUnits,
    alignLocked, alignDefault, alignHint,
    onPick, onResize, onReset, onClose,
  } = o;
  const tr = (key, vars) => (typeof o.t === 'function' ? o.t(key, vars) : null);
  const onToggleAlign = o.onToggleAlign || (() => {});
  const onFull = o.onFull || (() => {});
  const onToggleSingleLine = o.onToggleSingleLine || (() => {});
  const onToggleNoUnits = o.onToggleNoUnits || (() => {});
  const onUnlock = o.onUnlock || (() => {});
  const locked = { h: !!(alignLocked && alignLocked.h), v: !!(alignLocked && alignLocked.v) };
  const isDef = { h: !!(alignDefault && alignDefault.h), v: !!(alignDefault && alignDefault.v) };
  const min = bounds && bounds.min ? bounds.min : { cols: 1, rows: 1 };
  const max = bounds && bounds.max ? bounds.max : grid;
  // v1.40：面积下限（minArea>0，如四样式禁 1×1）时，单轴降到 1 仍可能面积不达标，
  // 故「−」按钮在「会跌破面积下限」时同样禁用（而非仅看单轴 min）
  const minArea = (bounds && bounds.minArea) || 0;
  const cells = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const on = target
        && r >= target.pos.row && r < target.pos.row + target.span.rows
        && c >= target.pos.col && c < target.pos.col + target.span.cols;
      // 其他单元已占用的格子：用主题色的淡色显示
      const occ = !on && occupied && occupied.has(`${r},${c}`);
      const cellCls = `se-cell${on ? ' on' : ''}${occ ? ' occ' : ''}`;
      cells.push(html`<button
        class="${cellCls}"
        style="${on ? `background:${theme}` : (occ ? `background:${theme}33;border-color:transparent` : '')}"
        aria-label="${r + 1}-${c + 1}"
        @click=${() => onPick(r, c)}
      ></button>`);
    }
  }
  /**
   * 通用开关按钮。
   * locked → 软禁用（v1.31 · D7）：aria-disabled + .locked 灰显/虚线边，
   *   但**保留可点击**（不用 pointer-events:none / disabled），点了弹原因 + 一键解锁。
   *   理由：真禁用是死胡同，用户点了没反应又不知道去哪改。
   * isDefault → 追加「默认」角标，区分「未显式设置」与「用户显式设置」。
   */
  const toggle = (label, on, cb, axis = null, isDefault = false, asSwitch = false, desc = null) => {
    const isLocked = axis ? !!locked[axis] : false;
    // 接管态：title = 「为什么是灰的」 + 「点了会怎样」——触摸端没有 hover，title 是补充通道，
    // 主通道是可见的虚线边 + 「接管」角标 + 锁图标；点击即解锁并应用本次意图（不死胡同）。
    const lockWhy = axis === 'h' ? tr('CARD_ALIGN_LOCKED_H') : tr('CARD_ALIGN_LOCKED_V');
    const lockHow = tr('CARD_ALIGN_UNLOCK');
    const lockTitle = [lockWhy, lockHow].filter(Boolean).join(' → ')
      || (isZh ? '由预览栏接管，点按改为单元级控制' : 'Managed by the preview bar — tap for per-unit control');
    // v1.35：简约显示 / 单行显示 这类二元持久开关用 role=switch + aria-checked（含星期/置中三态的不用，避免语义冲突）
    const switchAttrs = asSwitch ? `role="switch" aria-checked="${on ? 'true' : 'false'}"` : '';
    return html`<button
      class="se-toggle ${on ? 'on' : ''} ${isLocked ? 'locked' : ''}"
      ${switchAttrs}
      aria-disabled="${isLocked ? 'true' : 'false'}"
      title="${isLocked ? lockTitle : (asSwitch ? (desc || '') : '')}"
      style="${on ? `border-color:${theme};color:${theme};background:${theme}1A` : ''}"
      @click=${isLocked ? () => onUnlock(axis) : cb}
    >${label}${isLocked ? LOCK_ICON : ''}${isLocked
  ? html`<span class="se-tag">${tr('CARD_ALIGN_TAKEOVER_TAG') || (isZh ? '接管' : 'Taken over')}</span>`
  : (isDefault ? html`<span class="se-tag">${tr('CARD_ALIGN_DEFAULT_TAG') || (isZh ? '默认' : 'Default')}</span>` : '')}</button>`;
  };
  /** 单元级置中开关（带「接管/默认」三态） */
  const alignToggle = (axis, label) => toggle(
    label, !!(align && align[axis]), () => onToggleAlign(axis), axis, isDef[axis],
  );
  const stepRow = (label, val, dec, inc, offMin, offMax) => html`
    <div class="se-row">
      <span class="se-lab">${label}</span>
      <button class="se-btn" ?disabled=${offMin} aria-label="minus" @click=${() => onResize(dec[0], dec[1])}>−</button>
      <span class="se-val">${val}</span>
      <button class="se-btn" ?disabled=${offMax} aria-label="plus" @click=${() => onResize(inc[0], inc[1])}>+</button>
    </div>
  `;
  return html`
    <div class="span-editor">
      <div class="se-head">
        <span class="se-title">${isZh ? '调整占格' : 'Resize'}</span>
        <span class="se-unit">${name}</span>
        <button class="se-close" aria-label="close" @click=${onClose}>
          <svg viewBox="0 0 10 10" width="9" height="9"><path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div class="se-body">
        <div class="se-grid" style="grid-template-columns:repeat(${grid.cols},1fr)">${cells}</div>
        <div class="se-ctrls">
          ${stepRow(
    isZh ? '垂直' : 'Vert', span.rows, [0, -1], [0, 1],
    span.rows <= min.rows || (minArea > 0 && span.cols * (span.rows - 1) < minArea),
    span.rows >= max.rows,
  )}
          ${stepRow(
    isZh ? '水平' : 'Horz', span.cols, [-1, 0], [1, 0],
    span.cols <= min.cols || (minArea > 0 && (span.cols - 1) * span.rows < minArea),
    span.cols >= max.cols,
  )}
          <div class="se-size">${span.rows}×${span.cols}<span class="se-size-h">${isZh ? ' 垂直×水平' : ' V×H'}</span></div>
        </div>
      </div>
      <div class="se-toggles">
        ${alignToggle('h', isZh ? '水平置中' : 'Center H')}
        ${alignToggle('v', isZh ? '垂直置中' : 'Center V')}
        ${singleLine === null || singleLine === undefined ? '' : toggle(isZh ? '单行显示' : 'One line', !!singleLine, () => onToggleSingleLine(), null, false, true)}
        ${noUnits === null || noUnits === undefined ? '' : toggle(isZh ? '简约显示' : 'Compact', !!noUnits, () => onToggleNoUnits(), null, false, true, isZh ? '简约显示，隐藏年/月/日单位' : 'Compact — hides year/month/day labels')}
      </div>
      ${alignHint ? html`<div class="se-hint">${alignHint}</div>` : ''}
      <div class="se-actions">
        <button class="se-reset" @click=${onReset}>${isZh ? '自适应' : 'Auto'}</button>
        ${isFull ? html`<button class="se-reset" @click=${onFull}>FULL</button>` : ''}
      </div>
      ${target ? '' : html`<div class="se-warn">${isZh
    ? `当前放不下：${sizeLabel} 已无空位，请缩小占格或调整其他单元`
    : `No room left on ${sizeLabel} — shrink this unit or others`}</div>`}
    </div>
  `;
}
