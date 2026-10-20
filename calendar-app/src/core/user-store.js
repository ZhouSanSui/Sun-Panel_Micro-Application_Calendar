/**
 * 用户数据存储层
 * 数据节点：userData（scope: user）
 * 结构：{ schedules: [...], settings: {...} }
 */
import { normalizeImportedSchedule, sanitizeScheduleList, scheduleListNeedsHeal } from './schedule.js';
import { parseICalToSchedules, toICal } from './ical.js';

const DEFAULT_SETTINGS = {
  language: 'auto',        // auto | zh-CN | en-US
  hour12: false,           // 12 小时制
  showSeconds: true,       // 显示秒
  weekStart: 1,            // 一周起始日 0=周日 1=周一（默认周一）
  themeColor: 'blue',      // 主题色（Apple 色板 key），默认蓝色
  cardTheme: 'glass-frosted', // 卡片主题（仅作用仪表盘卡片）
  cardBrightness: 100,     // 卡片亮度 30-100（仅作用仪表盘卡片）
  cardContent: null,       // 各尺寸显示模块映射 { [size]: string[] }，null 用默认（旧字段，兼容保留）
  cardMode: 'general',     // 旧版显示模式字段（迁移后为 combo 或信息块 key，仅作兼容）
  cardModeStyle: {},       // 样式子选项 { [信息块 key]: styleKey }
  displayMode: 'combo',    // 显示模式 combo=拼接 | single=单独
  cardBlocks: null,        // 当前显示的信息块 key 列表（null=按尺寸默认）
  cardCenterH: false,      // 卡片级水平置中（内容未填满时整体居中）
  cardCenterV: false,      // 卡片级垂直置中
};

/** 卡片主题定义（移除"跟随"，改为玻璃/渐变/纸感系列） */
export const CARD_THEMES = {
  'glass-transparent': { zh: '透明玻璃', en: 'Glass' },
  'glass-frosted': { zh: '毛玻璃', en: 'Frosted' },
  'glass-dark': { zh: '深色玻璃', en: 'Dark Glass' },
  'neon': { zh: '霓虹渐变', en: 'Neon' },
  'paper': { zh: '纸感暖白', en: 'Paper' },
};

/** 卡片显示模式定义 */
export const CARD_MODES = {
  general: { zh: '一般模式', en: 'General', icon: '▦' },
  yearProgress: { zh: '年进度', en: 'Year Progress', icon: '◴' },
  weekDayProgress: { zh: '周·日进度', en: 'Week/Day Progress', icon: '◷' },
  holidayCountdown: { zh: '节假日倒计时', en: 'Holiday Countdown', icon: '🎉' },
  customCountdown: { zh: '自定义倒计时', en: 'Custom Countdown', icon: '⏳' },
  clock: { zh: '时钟', en: 'Clock', icon: '🕐' },
  simpleCalendar: { zh: '简约日历', en: 'Minimal Calendar', icon: '▤' },
};

/** 各模式可用的样式子选项（sizes 省略表示全尺寸可用；否则仅列出的尺寸可选） */
export const CARD_MODE_STYLES = {
  general: [{ key: 'default', zh: '默认', en: 'Default' }],
  yearProgress: [
    { key: 'text', zh: '文字', en: 'Text' },
    { key: 'bar', zh: '进度条', en: 'Bar', sizes: ['1x2', '2x1', '2x2', '2x4', '4x4', '1xfull'] },
    { key: 'ring', zh: '环形', en: 'Ring', sizes: ['2x2', '2x4', '4x4', '1xfull'] },
  ],
  weekDayProgress: [
    { key: 'day', zh: '今日', en: 'Today' },
    { key: 'week', zh: '本周', en: 'Week' },
    { key: 'both', zh: '双进度', en: 'Both', sizes: ['2x2', '2x4', '4x4', '1xfull'] },
  ],
  holidayCountdown: [
    { key: 'big', zh: '大字', en: 'Large' },
    { key: 'chips', zh: '标签', en: 'Chips', sizes: ['2x1', '2x2', '2x4', '4x4', '1xfull'] },
    { key: 'list', zh: '列表', en: 'List', sizes: ['2x4', '4x4', '1xfull'] },
  ],
  customCountdown: [
    { key: 'big', zh: '大字', en: 'Large' },
    { key: 'compact', zh: '紧凑', en: 'Compact' },
  ],
  clock: [
    { key: 'digital', zh: '数字', en: 'Digital' },
    { key: 'analog', zh: '指针', en: 'Analog', sizes: ['2x2', '2x4', '4x4', '1xfull'] },
    { key: 'flip', zh: '翻页', en: 'Flip', sizes: ['2x2', '2x4', '4x4', '1xfull'] },
  ],
  simpleCalendar: [
    { key: 'mini', zh: '月历', en: 'Month', sizes: ['2x2', '2x4', '4x4', '1xfull'] },
    { key: 'compact', zh: '紧凑', en: 'Compact', sizes: ['2x2', '2x4', '4x4', '1xfull'] },
    { key: 'week', zh: '周历', en: 'Week', sizes: ['2x2', '2x4', '4x4', '1xfull'] },
  ],
};

// ---------- 显示内容 / 显示样式模型（v1.24 起） ----------

/** 两种显示模式：拼接（一卡多块）/ 单独（一卡一块） */
export const DISPLAY_MODES = {
  combo: { zh: '拼接模式', en: 'Combo', icon: '▤' },
  single: { zh: '单独模式', en: 'Single', icon: '▢' },
};

/**
 * 拼接模式显示内容（信息以文字显示为主）。
 * 每个内容下有若干显示样式；卡片堆叠单元 = { c: 内容, s: 样式 }。
 * span/minSpan：样式在卡片网格中的占位声明（列×行），autoLayout 据此放置；
 * preferred 放不下时降级 minSpan，再放不下则跳过（提示空间不足）。
 */
export const COMBO_CONTENTS = [
  { key: 'calendar', zh: '日历', en: 'Calendar', icon: '📅', styles: [
    { key: 'month', zh: '月日历', en: 'Month Calendar', span: { cols: 2, rows: 2 }, minSpan: { cols: 2, rows: 2 } },
    { key: 'week', zh: '周日历', en: 'Week Calendar', span: { cols: 2, rows: 2 }, minSpan: { cols: 2, rows: 1 } },
  ] },
  { key: 'time', zh: '时间', en: 'Time', icon: '🕐', styles: [
    // 文字串不可压缩，故不声明 minSpan（放不下即视为空间不足，不做降级）
    // v1.32 需求 5：可竖排拆分的多信息样式，最小占格水平降到 1（垂直足够时可排成 1×N 窄条）
    { key: 'dateFull', zh: '年月日', en: 'Y/M/D', span: { cols: 2, rows: 1 }, minSpan: { cols: 1, rows: 1 } },
    // v1.35 需求 1：年月。插在「年月日」之后，与「年月日 / 月日」带年的两个样式成组
    { key: 'dateYearMonth', zh: '年月', en: 'Y/M', span: { cols: 2, rows: 1 }, minSpan: { cols: 1, rows: 1 } },
    // v1.31 需求 6：月日。排在年月日之后，与「月日星期 / 年月日星期」构成完整的「年 / 星期」二维开关序列
    { key: 'dateMonthDay', zh: '月日', en: 'M/D', span: { cols: 2, rows: 1 }, minSpan: { cols: 1, rows: 1 } },
    { key: 'dateWeekday', zh: '月日星期', en: 'M/D Weekday', span: { cols: 2, rows: 1 }, minSpan: { cols: 1, rows: 1 } },
    { key: 'dateFullWeekday', zh: '年月日星期', en: 'Y/M/D Weekday', span: { cols: 2, rows: 1 }, minSpan: { cols: 1, rows: 1 } },
    { key: 'hm', zh: '时分', en: 'HH:MM', span: { cols: 1, rows: 1 } },
    { key: 'hms', zh: '时分秒', en: 'HH:MM:SS', span: { cols: 2, rows: 1 }, minSpan: { cols: 1, rows: 1 } },
    { key: 'year', zh: '年', en: 'Year', span: { cols: 1, rows: 1 } },
    { key: 'month', zh: '月', en: 'Month', span: { cols: 1, rows: 1 } },
    { key: 'weekOfYear', zh: '第几周', en: 'Week of Year', span: { cols: 1, rows: 1 } },
    { key: 'weekday', zh: '星期', en: 'Weekday', span: { cols: 1, rows: 1 } },
    { key: 'day', zh: '日', en: 'Day', span: { cols: 1, rows: 1 } },
    { key: 'hour', zh: '时', en: 'Hour', span: { cols: 1, rows: 1 } },
    { key: 'minute', zh: '分', en: 'Minute', span: { cols: 1, rows: 1 } },
    { key: 'second', zh: '秒', en: 'Second', span: { cols: 1, rows: 1 } },
  ] },
  { key: 'important', zh: '重要日期', en: 'Important Dates', icon: '⭐', styles: [
    // 倒数型单元竖向占位较高（大数字 + 单位 + 名称 + 说明），默认 2×2 保证可读；
    // v1.40：minArea=2 放开下限——可缩至 1×2（宽扁）或 2×1（窄高），但禁 1×1（面积<2 不可读）
    { key: 'festival', zh: '节日', en: 'Festival', span: { cols: 2, rows: 2 }, minArea: 2 },
    { key: 'solarTerm', zh: '节气', en: 'Solar Term', span: { cols: 2, rows: 2 }, minArea: 2 },
    { key: 'holidayGap', zh: '距放假', en: 'To Holiday', span: { cols: 2, rows: 2 }, minArea: 2 },
  ] },
  { key: 'schedule', zh: '日程', en: 'Schedules', icon: '🗓', styles: [
    // v1.40：recent 同属倒数型，minArea=2 放开下限（1×2 / 2×1 可缩、禁 1×1）
    { key: 'recent', zh: '最近日程', en: 'Recent', span: { cols: 2, rows: 2 }, minArea: 2 },
    // v1.40：多个日程水平最低 2、垂直可到 1（用户要求「少显示一点就好」）
    { key: 'multiple', zh: '多个日程', en: 'Multiple', span: { cols: 2, rows: 2 }, minSpan: { cols: 2, rows: 1 } },
  ] },
  // 空白填充：只占位不显示内容，可重复添加（用 n 序号区分）
  { key: 'blank', zh: '空白', en: 'Blank', icon: '⬚', styles: [
    { key: 'space', zh: '空白', en: 'Blank', span: { cols: 1, rows: 1 } },
  ] },
];

/** 空白内容 key（可重复出现，靠 n 序号区分） */
export const BLANK_CONTENT = 'blank';

/**
 * 单独模式显示内容（信息以图像为主，当前用文字实现，后续迭代）。
 * 注意：不含「日历」（已移除）。
 */
export const SINGLE_CONTENTS = [
  { key: 'timeDate', zh: '时间及日期', en: 'Time & Date', icon: '🕐', styles: [
    { key: 'led', zh: 'LED样式表', en: 'LED Clock' },
    { key: 'analog', zh: '指针表', en: 'Analog Clock' },
    { key: 'flip', zh: '翻页表', en: 'Flip Clock' },
    { key: 'yearCal', zh: '年日历', en: 'Year Calendar' },
    { key: 'weekCal', zh: '周日历', en: 'Week Calendar' },
    { key: 'flipMonthDay', zh: '翻页月日', en: 'Flip Month/Day' },
  ] },
  { key: 'schedule', zh: '日程', en: 'Schedule', icon: '🗓', styles: [
    { key: 'holidayCountdown', zh: '放假倒计时', en: 'Holiday Countdown' },
    { key: 'recentEvent', zh: '最近事项', en: 'Recent Events' },
  ] },
  { key: 'progress', zh: '进度', en: 'Progress', icon: '◴', styles: [
    { key: 'year', zh: '年进度', en: 'Year' },
    { key: 'month', zh: '月进度', en: 'Month' },
    { key: 'week', zh: '周进度', en: 'Week' },
    { key: 'day', zh: '日进度', en: 'Day' },
    { key: 'recentSchedule', zh: '最近日程进度', en: 'Nearest Schedule' },
  ] },
];

/** 取某显示模式下的内容列表 */
export function displayContents(displayMode) {
  return displayMode === 'single' ? SINGLE_CONTENTS : COMBO_CONTENTS;
}

/** 取内容定义 */
export function contentDef(displayMode, key) {
  return displayContents(displayMode).find((c) => c.key === key) || null;
}

/** 取样式定义 */
export function styleDef(displayMode, contentKey, styleKey) {
  const c = contentDef(displayMode, contentKey);
  return c ? (c.styles.find((s) => s.key === styleKey) || null) : null;
}

/** 某内容下的默认样式（第一个） */
export function defaultStyleFor(displayMode, contentKey) {
  const c = contentDef(displayMode, contentKey);
  return c && c.styles.length ? c.styles[0].key : '';
}

// ---------- 拼接模式网格布局（v1.28 起，参照「元素显示方案」落地） ----------

/**
 * 卡片网格（列×行）。SunPanel 尺寸为 行×列，此处换算为网格坐标用的 列×行。
 * 1×FULL 为横向占满的宽扁条（垂直 1 行 × 水平 FULL），故列多行少；
 * 其列数在 widget 内按宿主实际宽度动态计算（基准列宽约 90px）。
 */
export const CARD_GRID = {
  // 约定：SunPanel 面板一格 = 本网格 2×2，保证各尺寸宽高比与实物一致
  '1x1': { cols: 2, rows: 2 },   // 1 行 1 列（方形）
  '1x2': { cols: 4, rows: 2 },   // 1 行 2 列（宽扁）
  '2x1': { cols: 2, rows: 4 },   // 2 行 1 列（窄高）
  '2x2': { cols: 4, rows: 4 },   // 2 行 2 列（方形）
  '2x4': { cols: 8, rows: 4 },   // 2 行 4 列（宽）
  '4x4': { cols: 8, rows: 8 },   // 4 行 4 列（大方）
  '1xfull': { cols: 8, rows: 2 }, // 1 行高 × 水平 FULL（宽扁条；列数运行时按实测宽度覆盖）
};

/** 某尺寸的网格（未知尺寸回退 4×4） */
export function gridForSize(size) {
  const g = CARD_GRID[size];
  return g ? { cols: g.cols, rows: g.rows } : { cols: 4, rows: 4 };
}

/** 取某样式的占位声明（preferred + min，未声明时 1×1） */
export function styleSpanDef(displayMode, contentKey, styleKey) {
  const c = contentDef(displayMode, contentKey);
  const s = c ? (c.styles.find((x) => x.key === styleKey) || null) : null;
  const span = (s && s.span) || { cols: 1, rows: 1 };
  return {
    span: { ...span },
    min: (s && s.minSpan) ? { ...s.minSpan } : { ...span },
    minArea: (s && s.minArea) || 0,
  };
}

/**
 * 单元的「建议占格」：样式声明 + 尺寸感知特例。
 * 1×FULL 卡片的月日历单行默认给 6×2（≈3 个 SunPanel 格宽、占满全高），
 * 避免 19 天挤在 1 格宽里字号过小；用户显式设置过 span 时不干预。
 *
 * v1.31 · D13：1×FULL 上用户**显式关闭**月历「单行显示」时，建议占格回退到 2×2。
 *   - 不是提升字号：1×FULL 只有 2 行高，非单行月历的日格字号恒为 7.32px（被块高锁死），
 *     与占格宽度无关；回退的理由是 6×2 时日格被拉成 ≈90px 宽的扁矩形、
 *     7.32px 数字周围全是空白，2×2 时 ≈30px 近正方、留白更少、观感更好。
 *   - 双重守卫（缺一不可，避免在渲染期改写用户数据）：
 *     ① `b.opts.singleLine === false` 必须**显式设置**（未设置 / true 都不触发
 *        → 1×FULL 默认 singleLine=true 仍走 6×2，存量用户零影响）；
 *     ② 该单元没有显式 `span`（手动设过占格就绝不自动改写）。
 */
export function prefSpan(displayMode, size, b) {
  const d = styleSpanDef(displayMode, b && b.c, b && b.s);
  const isMonth = b && b.c === 'calendar' && b.s === 'month';
  if (isMonth && !normalizeSpan(b.span)) {
    const o = (b.opts && typeof b.opts === 'object') ? b.opts : null;
    // v1.32：月历「单行显示」是横向日期条，默认占满整行宽度（任何卡片尺寸），
    // 否则在大卡片里会缩成窄窄一条、两侧留白过多。显式 span 仍然优先（用户手动设过就不动）。
    if (o && o.singleLine === false) {
      // 显式关闭单行 → 1×FULL 上回退 2×2（D13 守卫：只认显式 false）
      return isFullCard(size) ? { span: { cols: 2, rows: 2 }, min: d.min, minArea: d.minArea } : d;
    }
    if (unitOpts(displayMode, size, b).singleLine) {
      const g = gridForSize(size);
      return { span: { cols: g.cols, rows: Math.min(2, g.rows) }, min: d.min, minArea: d.minArea };
    }
  }
  return d;
}

/** 单元级占格的上限（网格单边最大格数；覆盖声明超出即忽略） */
export const SPAN_MAX = 8;

/** 归一化单元级占格覆盖：仅接受 1..SPAN_MAX 的整数，非法返回 null */
export function normalizeSpan(v) {
  if (!v || typeof v !== 'object') return null;
  const cols = Math.round(Number(v.cols));
  const rows = Math.round(Number(v.rows));
  if (!Number.isFinite(cols) || !Number.isFinite(rows)) return null;
  if (cols < 1 || rows < 1 || cols > SPAN_MAX || rows > SPAN_MAX) return null;
  return { cols, rows };
}

/** 单元实际占格：优先单元级覆盖（用户提供），否则用样式声明 */
export function blockSpanDef(displayMode, b) {
  const d = styleSpanDef(displayMode, b.c, b.s);
  return b && b.span ? { span: { ...b.span }, min: d.min } : d;
}

/**
 * 某单元在当前卡片上的可调占格区间。
 * min：样式保证可读的最小占格（声明了 minSpan 用它，否则 1×1）；max：不超过卡片网格。
 */
export function spanBounds(displayMode, size, b) {
  const grid = gridForSize(size);
  const d = styleSpanDef(displayMode, b.c, b.s);
  // v1.40：面积下限（minArea，如 四样式 禁 1×1）时，每轴下限退为 1，由面积校验接管
  const floor = d.minArea ? { cols: 1, rows: 1 } : d.min;
  return {
    grid,
    min: {
      cols: Math.max(1, Math.min(floor.cols, grid.cols)),
      rows: Math.max(1, Math.min(floor.rows, grid.rows)),
    },
    max: { cols: grid.cols, rows: grid.rows },
    def: d.span,
    minArea: d.minArea || 0,
  };
}

/**
 * 单元在某尺寸下的「实际占格」= 覆盖值按网格收窄后的结果（用于 chip 徽标等展示）。
 * 未覆盖时返回样式声明的 preferred span。
 */
export function effectiveSpan(displayMode, size, b) {
  const grid = gridForSize(size);
  const ov = normalizeSpan(b && b.span);
  if (ov) return { cols: Math.min(ov.cols, grid.cols), rows: Math.min(ov.rows, grid.rows) };
  return prefSpan(displayMode, size, b).span;
}

/** 1×FULL（横向占满的宽扁条）卡片：内容默认水平/垂直置中 */
export function isFullCard(size) {
  return size === '1xfull';
}

/** 归一化单元置中标记 {h,v}（缺失项按卡片尺寸取默认值） */
export function normalizeAlign(v) {
  if (!v || typeof v !== 'object') return null;
  return { h: !!v.h, v: !!v.v };
}

/**
 * 单元置中标记：显式设置优先，未设置时 1×FULL 卡片默认为 true。
 * 水平：所在行无其他内容（或同行内容同样水平置中）时，该行水平居中；
 * 垂直：同理按列判断。
 */
export function unitAlign(displayMode, size, b) {
  const def = isFullCard(size);
  const a = (b && b.align && typeof b.align === 'object') ? b.align : null;
  return {
    h: a && a.h !== undefined ? !!a.h : def,
    v: a && a.v !== undefined ? !!a.v : def,
  };
}

/** 单元是否「显式」设置过置中（未设置返回 null，此时 UI 应显示「默认」角标） */
export function unitAlignExplicit(b) {
  if (!b || !b.align || typeof b.align !== 'object') return null;
  return { h: !!b.align.h, v: !!b.align.v };
}

/**
 * 逐轴治理者（v1.31 需求 1 · D1）
 * 卡片级置中开启即接管该轴；单元级在该轴上被「忽略」而非被改写（不写用户数据、可逆）。
 * 两轴独立治理 → 允许「卡片级管水平 + 单元级管垂直」的混合用法。
 */
export function alignGovernor(cardCenter) {
  return {
    h: cardCenter && cardCenter.h ? 'card' : 'unit',
    v: cardCenter && cardCenter.v ? 'card' : 'unit',
  };
}

/**
 * 归一化单元显示选项 {singleLine, noUnits}。
 * v1.35：新增「简约显示」noUnits（去除年/月/日单位，横向用 · 分隔，竖向只显示数字）；
 *   未设置则不写该字段，整对象仍返回 null（存量行为不变）。
 */
export function normalizeOpts(v) {
  if (!v || typeof v !== 'object') return null;
  const out = {};
  if (v.singleLine !== undefined) out.singleLine = !!v.singleLine;
  if (v.noUnits !== undefined) out.noUnits = !!v.noUnits;
  return Object.keys(out).length ? out : null;
}

/** 月日历「单行显示」：1×FULL 卡片默认开启（窄高条放不下 6 行月历网格） */
export function unitOpts(displayMode, size, b) {
  const isMonth = b && b.c === 'calendar' && b.s === 'month';
  const o = (b && b.opts && typeof b.opts === 'object') ? b.opts : null;
  const singleLine = o && o.singleLine !== undefined
    ? !!o.singleLine
    : !!(isMonth && isFullCard(size));
  // v1.35：简约显示（noUnits）—— 任何尺寸下语义一致（默认关），无尺寸感知默认值，
  // 以免静默改存量用户视觉（教训见 singleLine 的 D13）。内部字段 noUnits，与既有样式 key
  // compact「紧凑」(user-store.js:66/75) 区分，避免撞名。
  const noUnits = (o && o.noUnits !== undefined) ? !!o.noUnits : false;
  return { singleLine, noUnits };
}

/**
 * 月日历「单行显示」是否真正生效（v1.31 需求 2 · D8/D9）
 * 仅 1×FULL 卡片生效；非 1×FULL 下开关按钮不渲染、数据保留不清零（可逆）。
 */
export function singleLineOn(displayMode, size, b) {
  return isFullCard(size) && !!unitOpts(displayMode, size, b).singleLine;
}

/** v1.35：支持「简约显示」的日期样式（年/月/日三单位可去除；其余样式去单位后与其同类不可区分） */
export const NO_UNITS_DATE_STYLES = ['dateFull', 'dateYearMonth', 'dateMonthDay', 'dateWeekday', 'dateFullWeekday'];

/**
 * 「简约显示」是否真正生效（v1.35）。
 * 与 singleLineOn 同构：白名单外的样式恒 false（「保留不清零」的结果 —— 切到不支持的样式时自动不生效）。
 */
export function noUnitsOn(displayMode, size, b) {
  return !!(b && b.c === 'time' && NO_UNITS_DATE_STYLES.includes(b.s))
    && !!unitOpts(displayMode, size, b).noUnits;
}

/**
 * 把布局按「共享行 / 共享列」分组：
 * axis='row' → 共享行（横向相邻关系）的单元成组；axis='col' → 共享列。
 * 用并查集做传递闭包，保证同一行组内偏移一致。
 */
function groupByAxis(layout, axis, exclude) {
  const n = layout.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x) => { let r = x; while (parent[r] !== r) r = parent[r]; while (parent[x] !== r) { const nx = parent[x]; parent[x] = r; x = nx; } return r; };
  const union = (i, j) => { const ri = find(i); const rj = find(j); if (ri !== rj) parent[ri] = rj; };
  const overlap = (a, b) => (axis === 'row'
    ? a.pos.row < b.pos.row + b.span.rows && b.pos.row < a.pos.row + a.span.rows
    : a.pos.col < b.pos.col + b.span.cols && b.pos.col < a.pos.col + a.span.cols);
  const skip = (i) => !!(exclude && exclude.has(i));
  for (let i = 0; i < n; i++) {
    if (skip(i)) continue;
    for (let j = i + 1; j < n; j++) {
      if (skip(j)) continue;
      if (overlap(layout[i], layout[j])) union(i, j);
    }
  }
  const map = new Map();
  for (let i = 0; i < n; i++) {
    if (skip(i)) continue;
    const r = find(i);
    if (!map.has(r)) map.set(r, []);
    map.get(r).push(i);
  }
  return [...map.values()];
}

/**
 * 「孤立的 1×1 单元」下标集合（v1.32 需求 1）：
 * 占格为 1×1 且它所在的**行与列**都没有其他单元。
 * 这类单元独立居中——其他行/列有什么都与它无关，也不受成组判定影响。
 */
export function soloUnitIndexes(layout) {
  const out = new Set();
  for (let i = 0; i < layout.length; i++) {
    const b = layout[i];
    if (!b || !b.span || b.span.cols !== 1 || b.span.rows !== 1) continue;
    const shares = layout.some((c, j) => {
      if (j === i || !c || !c.span) return false;
      const rowHit = b.pos.row < c.pos.row + c.span.rows && c.pos.row < b.pos.row + b.span.rows;
      const colHit = b.pos.col < c.pos.col + c.span.cols && c.pos.col < b.pos.col + b.span.cols;
      return rowHit || colHit;
    });
    if (!shares) out.add(i);
  }
  return out;
}

/** 把居中偏移夹到网格内：保证 0 ≤ c0+dx 且 c1+dx ≤ cols（v1.31 · D5，修复偏移越界把单元推出卡片） */
function clampShift(raw, lo, hi, size) {
  return Math.min(Math.max(raw, -lo), size - hi);
}

/**
 * 单元级置中（v1.31 需求 1）：只在未被卡片级接管的轴上执行。
 * - D4：组内判定由 `every`（全部）放宽为 `some`（任一）——几何上只能整组（行带/列带）居中，
 *   「未要求」不该拥有一票否决权，`every` 会让「第一次点开」静默无反应（不灵敏的主因之一）。
 * - D5：偏移夹紧，永不把单元推出网格。
 * - D6：`dx === 0`（无空间）时写进 `report.noRoom`，由 UI 给出提示而非静默。
 * @param {{h?:boolean,v?:boolean}} opts 该轴是否由单元级治理（默认 true，向后兼容旧签名）
 * @returns {{layout:Array, report:Object}}
 */
export function applyAlignmentWithReport(layout, displayMode, size, grid, opts = {}) {
  const govH = opts.h !== false;
  const govV = opts.v !== false;
  const out = layout.map((b) => ({ ...b, pos: { col: b.pos.col, row: b.pos.row } }));
  const report = {
    skipped: { h: !govH, v: !govV },
    noRoom: { h: false, v: false },
    groupSize: { h: 0, v: 0 },
    clamped: { h: false, v: false },
  };
  // v1.32 需求 1：孤立的 1×1 单元独立居中，不参与成组，也不被其他组带动。
  // 注意：两轴都居中后落点可能落在别的单元上（原位置只保证自身行列是空的），
  // 所以每个候选落点都要做占用检查，被占则退化为单轴或保持原位。
  const solo = soloUnitIndexes(layout);
  if (solo.size) {
    const taken = new Set();
    layout.forEach((b, i) => {
      if (solo.has(i)) return;
      for (let r = b.pos.row; r < b.pos.row + b.span.rows; r++) {
        for (let c = b.pos.col; c < b.pos.col + b.span.cols; c++) taken.add(`${c},${r}`);
      }
    });
    const free = (c, r) => !taken.has(`${c},${r}`);
    for (const i of solo) {
      const a = unitAlign(displayMode, size, layout[i]);
      const cur = { col: layout[i].pos.col, row: layout[i].pos.row };
      const tc = govH && a.h ? Math.floor((grid.cols - 1) / 2) : cur.col;
      const tr = govV && a.v ? Math.floor((grid.rows - 1) / 2) : cur.row;
      let next = { ...cur };
      if (free(tc, tr)) {
        next = { col: tc, row: tr };
      } else if (free(tc, cur.row)) {
        next = { col: tc, row: cur.row };
        if (govV && a.v) report.noRoom.v = true;
      } else if (free(cur.col, tr)) {
        next = { col: cur.col, row: tr };
        if (govH && a.h) report.noRoom.h = true;
      } else {
        if (govH && a.h) report.noRoom.h = true;
        if (govV && a.v) report.noRoom.v = true;
      }
      if (next.col === cur.col && govH && a.h) report.noRoom.h = true;
      if (next.row === cur.row && govV && a.v) report.noRoom.v = true;
      out[i].pos.col = next.col;
      out[i].pos.row = next.row;
    }
  }
  // 水平：共享「行带」的组整体居中（空白单元也算占位，参与同行判定）
  if (govH) {
    for (const idxs of groupByAxis(layout, 'row', solo)) {
      if (!idxs.some((i) => unitAlign(displayMode, size, layout[i]).h)) continue;
      let c0 = Infinity;
      let c1 = 0;
      for (const i of idxs) {
        c0 = Math.min(c0, layout[i].pos.col);
        c1 = Math.max(c1, layout[i].pos.col + layout[i].span.cols);
      }
      const raw = Math.floor((grid.cols - (c1 - c0)) / 2);
      const dx = clampShift(raw, c0, c1, grid.cols);
      report.groupSize.h = Math.max(report.groupSize.h, idxs.length);
      if (dx !== raw) report.clamped.h = true;
      if (dx === 0) { report.noRoom.h = true; continue; }
      for (const i of idxs) out[i].pos.col = layout[i].pos.col + dx;
    }
  }
  // 垂直：共享「列带」的组整体居中（按 grid.rows / pos.row）
  if (govV) {
    for (const idxs of groupByAxis(layout, 'col', solo)) {
      if (!idxs.some((i) => unitAlign(displayMode, size, layout[i]).v)) continue;
      let r0 = Infinity;
      let r1 = 0;
      for (const i of idxs) {
        r0 = Math.min(r0, layout[i].pos.row);
        r1 = Math.max(r1, layout[i].pos.row + layout[i].span.rows);
      }
      const raw = Math.floor((grid.rows - (r1 - r0)) / 2);
      const dy = clampShift(raw, r0, r1, grid.rows);
      report.groupSize.v = Math.max(report.groupSize.v, idxs.length);
      if (dy !== raw) report.clamped.v = true;
      if (dy === 0) { report.noRoom.v = true; continue; }
      for (const i of idxs) out[i].pos.row = out[i].pos.row + dy;
    }
  }
  return { layout: out, report };
}

/** 单元级置中（向后兼容包装：仅返回 layout） */
export function applyAlignment(layout, displayMode, size, grid) {
  return applyAlignmentWithReport(layout, displayMode, size, grid).layout;
}

/** 卡片级置中：内容整体 bbox 在该轴居中；只处理被接管的轴（v1.31 · D1） */
export function applyCardCenter(layout, grid, on) {
  if (!on || (!on.h && !on.v) || !layout.length) return layout;
  let c0 = Infinity;
  let c1 = 0;
  let r0 = Infinity;
  let r1 = 0;
  for (const b of layout) {
    c0 = Math.min(c0, b.pos.col);
    c1 = Math.max(c1, b.pos.col + b.span.cols);
    r0 = Math.min(r0, b.pos.row);
    r1 = Math.max(r1, b.pos.row + b.span.rows);
  }
  const rawX = on.h ? Math.floor((grid.cols - (c1 - c0)) / 2) : 0;
  const rawY = on.v ? Math.floor((grid.rows - (r1 - r0)) / 2) : 0;
  const dx = clampShift(rawX, c0, c1, grid.cols);
  const dy = clampShift(rawY, r0, r1, grid.rows);
  if (!dx && !dy) return layout;
  return layout.map((b) => ({ ...b, pos: { col: b.pos.col + dx, row: b.pos.row + dy } }));
}

/** 布局指纹：用于「点了没反应」检测（v1.31 · D6） */
export function layoutSignature(laid) {
  return (laid || []).map((b) => `${b.pos.col},${b.pos.row},${b.span.cols},${b.span.rows}`).join('|');
}

/** 扁平样式序列（跨显示内容连续切换用）：[{ c, s }, ...] */
export function flatStyleSeq(displayMode) {
  const out = [];
  for (const c of displayContents(displayMode)) {
    for (const s of c.styles) out.push({ c: c.key, s: s.key });
  }
  return out;
}

/** 在扁平样式序列上左右移动（dir=±1，首尾循环；跨界即切到相邻显示内容） */
export function shiftFlatStyle(displayMode, contentKey, styleKey, dir) {
  const seq = flatStyleSeq(displayMode);
  if (!seq.length) return { c: contentKey, s: styleKey };
  const at = seq.findIndex((x) => x.c === contentKey && x.s === styleKey);
  const next = seq[((at < 0 ? 0 : at) + dir + seq.length) % seq.length];
  return { ...next };
}

/** 由 items（带 span/pos）推导占位矩阵 occ[row][col] = id | null */
export function buildOccupancy(items, grid) {
  const occ = Array.from({ length: grid.rows }, () => Array(grid.cols).fill(null));
  for (const it of items || []) {
    const pos = it.pos || { col: 0, row: 0 };
    const span = it.span || { cols: 1, rows: 1 };
    for (let r = pos.row; r < pos.row + span.rows; r++) {
      if (r < 0 || r >= grid.rows) continue;
      for (let c = pos.col; c < pos.col + span.cols; c++) {
        if (c < 0 || c >= grid.cols) continue;
        occ[r][c] = it.id || unitId(it);
      }
    }
  }
  return occ;
}

/** (col,row) 处的 span 是否可放置（ignoreId 允许与自身重叠，供交换校验） */
export function canPlace(occ, grid, col, row, span, ignoreId = null) {
  if (col < 0 || row < 0 || col + span.cols > grid.cols || row + span.rows > grid.rows) return false;
  for (let r = row; r < row + span.rows; r++) {
    for (let c = col; c < col + span.cols; c++) {
      if (occ[r][c] && occ[r][c] !== ignoreId) return false;
    }
  }
  return true;
}

/** 行优先扫描第一个可放下 span 的位置 */
export function findSlot(occ, grid, span) {
  for (let row = 0; row <= grid.rows - span.rows; row++) {
    for (let col = 0; col <= grid.cols - span.cols; col++) {
      if (canPlace(occ, grid, col, row, span)) return { col, row };
    }
  }
  return null;
}

/**
 * 拉伸预检（v1.34 需求 1）：第 idx 个单元按 stretched 占格整表试放一轮，
 * 全部单元都放得下才返回 true。用于「月历单行占满整行」的拉伸决策——
 * 放不下（同行/同列还有其他单元）时调用方应保持原占格，避免挤掉邻居。
 * 注意：stretched 可能超过 SPAN_MAX（运行时网格最多 10 列），不是合法用户数据，
 * 故经 autoLayout 的内部参数强制注入，不走 normalizeSpan；sim 标记确保试放轮次内
 * 不再触发新的拉伸试放（杜绝多月历单元场景下的递归）。
 */
function fitsWithStretch(list, displayMode, size, grid, idx, stretched) {
  const all = list || [];
  return autoLayout(all, displayMode, size, grid, { idx, span: stretched, sim: true }).length === all.length;
}

/**
 * 自动布局：按列表顺序把每个单元放入网格（行优先找空位）。
 * preferred 放不下降级 minSpan，再放不下则跳过（调用方据此提示空间不足）。
 * @param {?{idx:number,span:{cols,rows},sim?:boolean}} forceSpan 内部试放参数（fitsWithStretch 用）：
 *   指定下标的单元强制按该占格放置，跳过 normalizeSpan 收窄与拉伸逻辑；
 *   sim=true 表示当前为试放轮次，任何单元都不再触发新的拉伸试放。
 * @returns {Array<{c,s,span,pos}>} 仅含成功放置的单元
 */
export function autoLayout(list, displayMode, size, gridOverride, forceSpan) {
  const grid = gridOverride || gridForSize(size);
  const occ = Array.from({ length: grid.rows }, () => Array(grid.cols).fill(null));
  const out = [];
  const arr = list || [];
  const sim = !!(forceSpan && forceSpan.sim);
  for (let i = 0; i < arr.length; i++) {
    const b = arr[i];
    // 单元级覆盖优先；有覆盖时严格按该占格放置（不做降级），否则 preferred→minSpan 降级
    // 覆盖值超出当前卡片网格时按网格收窄，避免换尺寸后单元彻底消失
    const { span: pref, min: prefMin, minArea: prefArea } = prefSpan(displayMode, size, b);
    const override = normalizeSpan(b.span);
    // v1.34 需求 1：1×FULL 卡片月历「单行显示」占满整行宽度（消除两侧留白）。
    // 无覆盖 → 直接按运行时 grid.cols（4~10 随面板宽度变化）拉伸，而非固定格数。
    // 有覆盖但列数 ≥ 基础网格列数（= FULL 按钮 / 首选占格的目标宽度，即用户已表达
    // 「占满整行」意图）→ 同样拉伸；先用整表试放确认不挤掉其他单元，放不下则保持原占格。
    const baseGrid = gridForSize(size);
    const fillFull = isFullCard(size)
      && singleLineOn(displayMode, size, b)
      && b && b.c === 'calendar' && b.s === 'month';
    const forced = forceSpan && forceSpan.idx === i ? forceSpan.span : null;
    let span;
    if (forced) {
      span = { cols: Math.min(forced.cols, grid.cols), rows: Math.min(forced.rows, grid.rows) };
    } else if (override) {
      span = { cols: Math.min(override.cols, grid.cols), rows: Math.min(override.rows, grid.rows) };
      if (!sim && fillFull && override.cols >= baseGrid.cols && span.cols < grid.cols) {
        const stretched = { cols: grid.cols, rows: span.rows };
        if (fitsWithStretch(arr, displayMode, size, grid, i, stretched)) span = stretched;
      }
    } else if (!sim && fillFull) {
      // 无覆盖：首选即「占满整行」；同样先整表试放，放不下（还有别的单元要摆）
      // 回退首选占格（8×2），避免把邻居挤出网格（v1.32 起此处为无条件拉伸）
      span = { cols: grid.cols, rows: Math.min(2, grid.rows) };
      if (!fitsWithStretch(arr, displayMode, size, grid, i, span)) span = pref;
    } else {
      span = pref;
    }
    let slot = findSlot(occ, grid, span);
    let used = span;
    // v1.40：面积下限样式（minArea>0，如四样式禁 1×1）放不下首选 2×2 时，
    // 按面积降级链试放 [{2,1},{1,2}]——两者面积均为 2≥minArea、且非禁用的 1×1，
    // 同时不超当前卡片网格、且跳过等于首选的占格（避免无谓重算）。
    // 与 prefMin 降级互斥：面积样式 prefMin 即 span（无 minSpan），本分支优先。
    if (!slot && !override && prefArea > 0) {
      const cands = [{ cols: 2, rows: 1 }, { cols: 1, rows: 2 }]
        .filter((c) => c.cols * c.rows >= prefArea
          && c.cols <= grid.cols && c.rows <= grid.rows
          && (c.cols !== pref.cols || c.rows !== pref.rows));
      for (const cand of cands) {
        const s = findSlot(occ, grid, cand);
        if (s) { slot = s; used = cand; break; }
      }
    }
    if (!slot && !override && (prefMin.cols !== span.cols || prefMin.rows !== span.rows)) {
      slot = findSlot(occ, grid, prefMin);
      used = prefMin;
    }
    if (!slot) continue;
    // 保留单元的附加字段（空白序号 / 置中标记 / 显示选项），渲染层要用
    const extra = { c: b.c, s: b.s, span: used, pos: slot };
    if (b.n !== undefined) extra.n = b.n;
    if (b.align) extra.align = b.align;
    if (b.opts) extra.opts = b.opts;
    out.push(extra);
    const id = unitId(b);
    for (let r = slot.row; r < slot.row + used.rows; r++) {
      for (let c = slot.col; c < slot.col + used.cols; c++) occ[r][c] = id;
    }
  }
  return out;
}

/** 单元唯一标识（空白单元靠序号 n 区分） */
export function unitId(b) {
  return `${b.c}:${b.s}:${b.n === undefined ? 0 : b.n}`;
}

/** 全部单元是否都放得下（加入前的空间预检） */
export function blocksFit(list, displayMode, size) {
  const grid = gridForSize(size);
  return autoLayout(list, displayMode, size, grid).length === (list || []).length;
}

/**
 * 拼接模式「推荐默认样式」（v1.43）：卡片从未设置过内容（cardBlocks 为 null/undefined）时按尺寸取用。
 * 设计原则：小卡单信息；宽/高卡按方向分栏；大方卡叠加月历 + 四样式倒数；1×FULL 走月历条。
 * 显式空数组 [] 不套用（视为用户主动清空，保持空白）。
 * span 为占格覆盖（列×行，细网格）；autoLayout 会在运行时按实际网格收窄/拉伸。
 */
export const DEFAULT_CARD_BLOCKS = {
  // 1×1：整卡「日」数字
  '1x1': [
    { c: 'time', s: 'day', span: { cols: 2, rows: 2 } },
  ],
  // 1×2（宽扁）：日期 + 最近日程
  '1x2': [
    { c: 'time', s: 'dateFull', span: { cols: 2, rows: 2 } },
    { c: 'schedule', s: 'recent', span: { cols: 2, rows: 2 } },
  ],
  // 2×1（窄高）：竖向四段
  '2x1': [
    { c: 'time', s: 'dateFull', span: { cols: 2, rows: 1 } },
    { c: 'important', s: 'festival', span: { cols: 2, rows: 1 } },
    { c: 'important', s: 'solarTerm', span: { cols: 2, rows: 1 } },
    { c: 'schedule', s: 'recent', span: { cols: 2, rows: 1 } },
  ],
  // 2×2：四象限
  '2x2': [
    { c: 'time', s: 'dateFull', span: { cols: 2, rows: 2 } },
    { c: 'important', s: 'festival', span: { cols: 2, rows: 2 } },
    { c: 'important', s: 'solarTerm', span: { cols: 2, rows: 2 } },
    { c: 'schedule', s: 'recent', span: { cols: 2, rows: 2 } },
  ],
  // 2×4：周历条 + 大时钟 + 最近日程
  '2x4': [
    { c: 'calendar', s: 'week', span: { cols: 8, rows: 1 } },
    { c: 'time', s: 'hms', span: { cols: 4, rows: 3 } },
    { c: 'schedule', s: 'recent', span: { cols: 4, rows: 3 } },
  ],
  // 4×4：月历 + 四样式倒数
  '4x4': [
    { c: 'calendar', s: 'month', span: { cols: 8, rows: 5 } },
    { c: 'important', s: 'festival', span: { cols: 2, rows: 3 } },
    { c: 'important', s: 'solarTerm', span: { cols: 2, rows: 3 } },
    { c: 'important', s: 'holidayGap', span: { cols: 2, rows: 3 } },
    { c: 'schedule', s: 'recent', span: { cols: 2, rows: 3 } },
  ],
  // 1×FULL：整条月历（2 行 × 8 列，运行时拉伸铺满宽度）
  '1xfull': [
    { c: 'calendar', s: 'month', span: { cols: 8, rows: 2 } },
  ],
};

/** 取某尺寸的推荐默认块（深拷贝，调用方可安全修改）；未知尺寸回退 2×2 */
export function defaultCardBlocks(size) {
  const list = DEFAULT_CARD_BLOCKS[size] || DEFAULT_CARD_BLOCKS['2x2'];
  return list.map((b) => ({ c: b.c, s: b.s, span: { ...b.span } }));
}

/**
 * 规整堆叠单元列表：仅校验/补全/去重，返回 [{c,s},...]（不含布局）。
 * 布局由 layoutBlocks / autoLayout 在渲染时按实际网格计算（顺序即布局顺序）。
 * - 兼容旧字符串格式（['time', 'calendar'] → 补默认样式）
 * - 过滤无效内容/样式、去重（空白单元不去重，用 n 序号区分）
 * - **拼接模式允许为空**：卡片可以不显示任何内容
 * - v1.43：从未设置过（null/undefined）→ 套用 DEFAULT_CARD_BLOCKS[size] 推荐默认；
 *   显式 [] 仍为空（用户主动清空，不覆盖其意图）
 * - 附带字段：span（占格覆盖）/ align（置中）/ opts（显示选项）/ n（空白序号）
 */
export function sanitizeBlocks(list, displayMode, size) {
  const contents = displayContents(displayMode);
  const out = [];
  const src = list == null && displayMode === 'combo' ? defaultCardBlocks(size) : list;
  if (Array.isArray(src)) {
    for (const b of src) {
      if (!b) continue;
      const c = typeof b === 'string' ? b : b.c;
      const def = contents.find((x) => x.key === c);
      if (!def) continue;
      let s = typeof b === 'string' ? '' : b.s;
      if (!def.styles.some((x) => x.key === s)) s = def.styles[0].key;
      const isBlank = c === BLANK_CONTENT;
      if (!isBlank && out.some((x) => x.c === c && x.s === s)) continue;
      const raw = typeof b === 'string' ? null : b;
      const item = { c, s };
      const ov = normalizeSpan(raw && raw.span);
      if (ov) item.span = ov;
      const al = normalizeAlign(raw && raw.align);
      if (al) item.align = al;
      const op = normalizeOpts(raw && raw.opts);
      if (op) item.opts = op;
      if (isBlank) {
        const n = Math.round(Number(raw && raw.n));
        if (Number.isFinite(n) && n >= 1) item.n = n;
      }
      out.push(item);
    }
    // 缺号的空白单元补最小可用号（保证「空白1/空白2」稳定且不重复）
    const used = new Set(out.filter((x) => x.c === BLANK_CONTENT && x.n !== undefined).map((x) => x.n));
    let cand = 1;
    for (const item of out) {
      if (item.c !== BLANK_CONTENT || item.n !== undefined) continue;
      while (used.has(cand)) cand += 1;
      item.n = cand;
      used.add(cand);
    }
  }
  if (displayMode === 'single') {
    const first = out[0] || { c: contents[0].key, s: contents[0].styles[0].key };
    return [{ c: first.c, s: first.s }];
  }
  // 拼接模式：允许 0 个单元（卡片可以不显示内容）
  return out;
}

/**
 * 按实际网格计算布局（渲染入口；gridOverride 用于运行时动态网格）。
 * v1.31 新顺序（需求 1 · D1：卡片级 > 单元级，逐轴互斥而非叠加）：
 *   ① autoLayout 落位 → ② 补齐生效的显示选项（单行显示仅 1×FULL）
 *   → ③ 单元级置中（仅未被接管的轴） → ④ 卡片级置中（仅接管的轴）
 * @param {{h?:boolean,v?:boolean}} cardCenter 卡片级置中（所有内容作为整体居中）
 */
export function layoutBlocks(list, displayMode, size, gridOverride, cardCenter) {
  if (displayMode === 'single' || !Array.isArray(list) || !list.length) return list || [];
  const grid = gridOverride || gridForSize(size);
  // 落位后补齐「生效的显示选项」（未显式设置时按卡片尺寸取默认，如 1×FULL 的月日历单行显示）
  const base = autoLayout(list, displayMode, size, grid)
    // v1.35 修正：合并写而非整对象覆盖，否则会把同单元既有 opts（如 noUnits）抹掉
    .map((b) => (singleLineOn(displayMode, size, b)
      ? { ...b, opts: { ...(b.opts || {}), singleLine: true } }
      : b));
  const gov = alignGovernor(cardCenter);
  // ① 单元级：仅在未被卡片级接管的轴上（互斥，不再相加 → 杜绝偏移翻倍/贴边）
  const { layout: aligned } = applyAlignmentWithReport(base, displayMode, size, grid, {
    h: gov.h === 'unit',
    v: gov.v === 'unit',
  });
  // ② 卡片级：仅在接管的轴上，整体 bbox 居中
  return applyCardCenter(aligned, grid, { h: gov.h === 'card', v: gov.v === 'card' });
}

/** 旧版 7 种显示模式 → 单独模式「内容:样式」映射（迁移用） */
const LEGACY_MODE_TO_UNIT = {
  clock: { c: 'timeDate', s: 'led' },
  simpleCalendar: { c: 'timeDate', s: 'weekCal' },
  yearProgress: { c: 'progress', s: 'year' },
  weekDayProgress: { c: 'progress', s: 'day' },
  holidayCountdown: { c: 'schedule', s: 'holidayCountdown' },
  customCountdown: { c: 'schedule', s: 'recentEvent' },
};

/** 旧一般模式模块 → 拼接内容映射（迁移用） */
const LEGACY_MODULE_TO_CONTENT = {
  time: 'time',
  date: 'calendar',
  lunar: 'calendar',
  festival: 'calendar',
  minical: 'calendar',
  holiday: 'important',
  schedule: 'schedule',
};

/**
 * 旧版字段迁移：cardMode / modules → displayMode / cardBlocks([{c,s}])
 * 旧数据（无 displayMode 字段）在读取时自动迁移，无需用户操作。
 */
export function migrateToBlocks({ cardMode, modules } = {}) {
  const mode = cardMode || 'general';
  if (mode === 'general') {
    const mods = Array.isArray(modules) && modules.length ? modules : DEFAULT_WIDGET_CONFIG.modules;
    const order = [];
    for (const m of mods) {
      const c = LEGACY_MODULE_TO_CONTENT[m];
      if (c && !order.includes(c)) order.push(c);
    }
    const ordered = COMBO_CONTENTS.map((c) => c.key).filter((k) => order.includes(k));
    const keys = ordered.length ? ordered : ['calendar', 'time'];
    return {
      displayMode: 'combo',
      blocks: keys.map((c) => ({ c, s: defaultStyleFor('combo', c) })),
    };
  }
  const unit = LEGACY_MODE_TO_UNIT[mode] || { c: 'timeDate', s: 'led' };
  return { displayMode: 'single', blocks: [{ ...unit }] };
}

/** 把旧版 cardTheme（auto/light/dark）映射到新主题 */
export function resolveCardTheme(key) {
  if (!key || !CARD_THEMES[key]) {
    if (key === 'dark') return 'glass-dark';
    if (key === 'light') return 'paper';
    return 'glass-transparent';
  }
  return key;
}

/** 取某模式在某尺寸下的默认样式子选项（按 sizes 过滤后取第一个） */
export function defaultModeStyle(mode, size) {
  const list = CARD_MODE_STYLES[mode];
  if (!list || !list.length) return 'default';
  if (size) {
    const ok = list.find((s) => !s.sizes || s.sizes.includes(size));
    if (ok) return ok.key;
  }
  return list[0].key;
}

/**
 * 根据卡片主题计算视觉变量（背景 / 字色 / 进度条底色）
 * @param {string} key 主题 key（可为旧版 auto/light/dark，会自动映射）
 * @param {boolean} systemDark 系统是否深色
 */
export function cardThemeVisual(key, systemDark = false) {
  const t = resolveCardTheme(key);
  const textLight = (t === 'glass-dark' || t === 'neon') ? true : (t === 'paper' ? false : systemDark);
  let bg;
  switch (t) {
    case 'glass-frosted':
      bg = systemDark
        ? 'background:rgba(28,28,30,0.55);border:1px solid rgba(255,255,255,0.12);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);'
        : 'background:rgba(255,255,255,0.55);border:1px solid rgba(0,0,0,0.06);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);';
      break;
    case 'glass-dark':
      bg = 'background:rgba(18,18,22,0.72);border:1px solid rgba(255,255,255,0.10);';
      break;
    case 'glass-transparent':
      bg = systemDark
        ? 'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);'
        : 'background:rgba(0,0,0,0.03);border:1px solid rgba(0,0,0,0.05);';
      break;
    case 'neon':
      bg = 'background:linear-gradient(135deg,#5B2BD6 0%,#007AFF 55%,#00C7BE 100%);';
      break;
    case 'paper':
      bg = 'background:#FBF7F0;border:1px solid rgba(0,0,0,0.05);';
      break;
    default:
      bg = systemDark ? 'background:#1C1C1E;' : 'background:#FFFFFF;';
  }
  return {
    key: t,
    textLight,
    bg,
    // 高对比度纯色，玻璃/渐变/纸感背景下均清晰可读
    label: textLight ? '#FFFFFF' : '#000000',
    label2: textLight ? '#EAEAEE' : '#34343A',
    label3: textLight ? '#C7C7CC' : '#6B6B70',
    cardBg: textLight ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.09)',
  };
}

/** 各尺寸默认显示模块 */
export const CARD_SIZE_MODULES = {
  '1x1': ['schedule', 'date'],
  '1x2': ['time', 'date', 'lunar', 'festival'],
  '2x1': ['time', 'date', 'lunar', 'festival'],
  '2x2': ['time', 'date', 'lunar', 'festival', 'schedule', 'holiday'],
  '2x4': ['time', 'date', 'lunar', 'festival', 'schedule', 'holiday', 'progress'],
  '4x4': ['time', 'date', 'lunar', 'festival', 'schedule', 'holiday', 'progress', 'minical'],
  '1xfull': ['time', 'date', 'lunar', 'festival', 'schedule'],
};

/** 模块中英文名 */
export const CARD_MODULE_DEFS = {
  time: { zh: '时间', en: 'Time' },
  date: { zh: '公历日期', en: 'Date' },
  lunar: { zh: '农历日期', en: 'Lunar Date' },
  festival: { zh: '节日与节气', en: 'Festivals & Terms' },
  schedule: { zh: '日程提醒', en: 'Schedules' },
  holiday: { zh: '节假日倒数', en: 'Holiday Countdown' },
  progress: { zh: '今年进度', en: 'Year Progress' },
  minical: { zh: '月历', en: 'Mini Calendar' },
};

/** 默认卡片配置（均为「每小部件独立」的字段，未设置时回退到全局默认） */
export const DEFAULT_WIDGET_CONFIG = {
  // 显示模块（旧一般模式字段，仅迁移兼容保留）
  modules: ['date', 'time', 'lunar', 'festival', 'schedule'],
  // 外观
  themeColor: 'blue',
  cardTheme: 'glass-frosted',
  cardBrightness: 100,
  // 显示模式（信息块模型）
  displayMode: 'combo',
  cardBlocks: null,        // null=按尺寸默认
  cardMode: 'combo',       // 渲染模式：combo 或信息块 key（single）
  cardModeStyle: {},       // { [信息块 key]: styleKey }
  // 时间相关
  hour12: false,
  showSeconds: true,
  weekStart: 1,
};

export class UserStore {
  /** @param {Object} api spCtx.api */
  constructor(api) {
    this.api = api;
    this.data = { schedules: [], settings: { ...DEFAULT_SETTINGS } };
    this.ready = false;
    this._listeners = [];
  }

  onChange(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter((f) => f !== fn); };
  }

  _emit() {
    for (const fn of this._listeners) {
      try { fn(); } catch { /* ignore */ }
    }
  }

  async init() {
    if (this.ready) return;
    if (this.api?.dataNode?.user) {
      try {
        const saved = await this.api.dataNode.user.getByKey('userData', 'calendar');
        if (saved && typeof saved === 'object') {
          const rawList = Array.isArray(saved.schedules) ? saved.schedules : [];
          // 自愈：历史遗留 / 旧版异常数据（如第三方导入的未知 type）在读取时规整
          if (scheduleListNeedsHeal(rawList)) {
            this.data.schedules = sanitizeScheduleList(rawList, this._lang());
            this._healed = true;
          } else {
            this.data.schedules = rawList;
          }
          const savedSettings = saved.settings || {};
          const s = { ...DEFAULT_SETTINGS, ...savedSettings };
          // 旧版数据（无 displayMode 字段）自动迁移到信息块模型
          if (savedSettings.displayMode === undefined) {
            const m = migrateToBlocks({
              cardMode: savedSettings.cardMode,
              modules: savedSettings.modules,
            });
            s.displayMode = m.displayMode;
            s.cardBlocks = m.blocks;
            s.cardMode = m.displayMode === 'combo' ? 'combo' : m.blocks[0].c;
          }
          this.data.settings = s;
        }
      } catch { /* 首次使用或读取失败，使用默认值 */ }
    }
    this.ready = true;
    if (this._healed) {
      this._healed = false;
      await this._persist(); // 自愈后的数据落盘，修复持久化中的异常
    }
  }

  /** 界面语言（用于导入缺省标题等） */
  _lang() {
    return this.data.settings.language === 'en-US' ? 'en' : 'zh';
  }

  async _persist() {
    if (!this.api?.dataNode?.user) return;
    try {
      await this.api.dataNode.user.setByKey('userData', 'calendar', this.data);
    } catch { /* 忽略持久化失败 */ }
    this._emit();
  }

  // ---------- 日程 ----------

  getSchedules() {
    return this.data.schedules;
  }

  getSchedule(id) {
    return this.data.schedules.find((s) => s.id === id) || null;
  }

  async addSchedule(item) {
    const now = Date.now();
    const record = {
      id: `s_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
      ...item,
    };
    this.data.schedules.push(record);
    await this._persist();
    return record;
  }

  async updateSchedule(id, patch) {
    const idx = this.data.schedules.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    this.data.schedules[idx] = { ...this.data.schedules[idx], ...patch, updatedAt: Date.now() };
    await this._persist();
    return this.data.schedules[idx];
  }

  async removeSchedule(id) {
    const before = this.data.schedules.length;
    this.data.schedules = this.data.schedules.filter((s) => s.id !== id);
    if (this.data.schedules.length !== before) await this._persist();
  }

  /** 批量删除日程（日程管理页用）@returns {number} 实际删除条数 */
  async removeMany(ids) {
    const set = new Set(Array.isArray(ids) ? ids : []);
    if (!set.size) return 0;
    const before = this.data.schedules.length;
    this.data.schedules = this.data.schedules.filter((s) => !set.has(s.id));
    const removed = before - this.data.schedules.length;
    if (removed > 0) await this._persist();
    return removed;
  }

  /** 全量替换（导入用）：逐项宽松规整，只保留应用模型字段 */
  async replaceSchedules(list) {
    const lang = this._lang();
    const now = Date.now();
    this.data.schedules = (Array.isArray(list) ? list : []).map((s, i) => {
      const r = normalizeImportedSchedule(s, lang);
      if (!r) return null;
      return {
        id: (s && typeof s.id === 'string' && s.id) || `s_${now.toString(36)}_${i}`,
        createdAt: (s && s.createdAt) || now,
        updatedAt: now,
        ...r.item,
      };
    }).filter(Boolean);
    await this._persist();
  }

  // ---------- 设置 ----------

  getSettings() {
    return this.data.settings;
  }

  async updateSettings(patch) {
    const next = { ...this.data.settings, ...patch };
    // 主页面设置等仍可能写旧 cardMode 字段：自动迁移到信息块模型后再持久化
    if (patch.displayMode === undefined && patch.cardMode !== undefined) {
      const m = migrateToBlocks({
        cardMode: patch.cardMode,
        modules: patch.modules,
      });
      next.displayMode = m.displayMode;
      next.cardBlocks = m.blocks;
      next.cardMode = m.displayMode === 'combo' ? 'combo' : m.blocks[0].c;
    }
    this.data.settings = next;
    await this._persist();
  }

  /** 导入导出：序列化（JSON 备份，含设置） */
  exportData() {
    return JSON.stringify({
      app: 'zhousansui-holiday-count-down',
      version: 1,
      exportedAt: new Date().toISOString(),
      schedules: this.data.schedules,
      settings: this.data.settings,
    }, null, 2);
  }

  /** 导出 ICS / VCS（仅日程，不含设置） */
  exportICalData(variant = 'ics') {
    return toICal(this.data.schedules, { variant });
  }

  /**
   * 导入：按内容自动识别格式（JSON 备份 / ICS / VCS）
   * @returns {Promise<{ok:boolean, imported:number, error?:string, flattened?:number}>}
   */
  async importData(text) {
    const t = String(text || '').replace(/^\uFEFF/, '').trim();
    if (!t) return { ok: false, imported: 0, error: 'INVALID_FORMAT' };
    if (t.startsWith('{') || t.startsWith('[')) return this._importJSON(t);
    if (/BEGIN\s*:\s*VCALENDAR/i.test(t) || /BEGIN\s*:\s*VEVENT/i.test(t)) return this._importICal(t);
    return { ok: false, imported: 0, error: 'INVALID_FORMAT' };
  }

  async _importJSON(text) {
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, imported: 0, error: 'INVALID_JSON' };
    }
    const list = Array.isArray(parsed) ? parsed : parsed?.schedules;
    if (!Array.isArray(list)) {
      return { ok: false, imported: 0, error: 'INVALID_FORMAT' };
    }
    const lang = this._lang();
    let flattened = 0;
    const valid = [];
    for (const raw of list) {
      const r = normalizeImportedSchedule(raw, lang);
      if (!r) continue;
      if (r.flattened) flattened += 1;
      valid.push(raw); // replaceSchedules 会再规整，此处仅过滤无效项
    }
    await this.replaceSchedules(valid);
    if (parsed?.settings && typeof parsed.settings === 'object') {
      await this.updateSettings({ ...this.data.settings, ...parsed.settings });
    }
    return { ok: true, imported: valid.length, flattened };
  }

  async _importICal(text) {
    const { schedules, flattened } = parseICalToSchedules(text, this._lang());
    if (!schedules.length) {
      return { ok: false, imported: 0, error: 'EMPTY_ICAL' };
    }
    await this.replaceSchedules(schedules);
    return { ok: true, imported: schedules.length, flattened };
  }
}
