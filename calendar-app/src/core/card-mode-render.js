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

// v3.11：SVG 片段必须用 lit 的 `svg` 标签函数生成 —— 用 `html` 会在 <svg> 里创建
// HTML 命名空间的未知元素（namespaceURI = xhtml），尺寸恒为 0，**完全不渲染**。
// 实测：html`<line/>` 插进 svg → 4 个 line 全部 width=0；换成 svg`<line/>` 才正常。
// 受影响：ringClock 的 60 刻度+时针分针、dial 的 21 刻度、ringProgress 的四环
// （用户报「环形刻度钟/指针仪表没有指针」「四环进度没有四环」即此因）。
// 注意：直接内联在外层模板里的 <circle>/<path>/<line> 不受影响（同模板内解析正确）。
import { html, svg } from 'lit';
import { ref } from 'lit/directives/ref.js';
import {
  yearProgress, dayOfYear, diffDays, formatTime, getMonthGrid, formatDate, todayStr, addDays,
  daysInMonth, weekOfYear, ganzhiYear,
} from './date-utils.js';
import { solarToLunarParts, LUNAR_DAY_CN, LUNAR_MONTH_CN } from './picker.js';
import { getNextOccurrence, getSchedulesOfDay, getScheduleTimeline } from './schedule.js';
import { APPLE_COLORS } from './apple-ui.js';
import { autoLayout, STYLE_OPT_FIELDS, styleFitsSize, SINGLE_CONTENTS, aliasContent } from './user-store.js';
import { getNextHoliday, getNextSolarTerm, getNextFestival } from './highlights.js';
import { getUserStore, getHolidayService } from './app-state.js';

const WEEK_FULL_ZH = ['日', '一', '二', '三', '四', '五', '六'];
const WEEK_MIN_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * v3.38：月视图同款的「假期 / 日程」标记（小月历与拼接月、周日历共用）。
 * 判定与 src/components/mainPage.js 月视图一致：
 *   休息日 = 节假日 isOffDay，或周末且非调休上班；日程 = 该日日程（最多 3 个彩色圆点）。
 * @returns {{isRest:boolean, dots:string[]}}
 */
function dayMarks(dateStr, date, scheds) {
  const hol = getHolidayService()?.getHolidayInfo(dateStr) || null;
  const weekend = date.getDay() === 0 || date.getDay() === 6;
  const isRest = !!(hol && hol.isOffDay) || (weekend && !(hol && hol.isMakeupWorkday));
  const items = scheds && scheds.length ? getSchedulesOfDay(scheds, dateStr) : [];
  return { isRest, dots: items.slice(0, 3).map((s) => APPLE_COLORS[s.item.color] || APPLE_COLORS.red) };
}

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
    // v3.8：dateFull 竖排固定两排（年 / 月日），行宽由 .pv-vline.fit 按容器自适应收缩
    // （--w = 最宽行 line-em，实测「10月22日」4.4668），永不折行 → 不会再出现「三排」。
    // fitFontU 的 w 只表达「不触发 fit 收缩的最小宽度」（年行 2.23 line-em ×1.25 ≈ 2.8，
    // 取 2.0 让高度优先反推 u，行字号上限交给 fit 的 min(1.25em, cqw/--w)）；
    // h = 2 行 ×1.25×1.15 + gap .1875 ≈ 3.06，声明 3.25 留余量。
    dateFullVert: { w: 2.0, wEn: 2.0, h: 3.25 },
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
    holiday: { w: 5.4, wEn: 6.2, h: 4.0 },
  },
  schedule: {
    // v3.55：recent 与节日同构（同一 countdown），固有尺寸同步 festival 宽比（否则高瘦→tightH 省掉天后/副标题）
    recent: { w: 7.4, wEn: 8.5, h: 3.0 },
    // v1.40：recent 同属倒数型，flat/tall 同源（仅 recent 触发，multiple 不劫持）
    __flat: { w: 6.97, wEn: 8.95, h: 2.79 },
    __tall: { w: 3.47, wEn: 4.98, h: 5.64 },
    // v3.56：日期改为 YY-MM-DD HH:MM（带时间约 6em/0.5em 字号），放宽固有宽避免裁切
    multiple: { w: 8.4, wEn: 9.2, h: 3.7 },
    // 占格水平 ≥4：日程名（左）+ 紧凑日期时间（右），单行
    multipleWide: { w: 12.0, wEn: 13.0, h: 3.4 },
    // v3.14 合并遗留：节日卡 / 假期倒计时从 important 并入 schedule，固有尺寸必须跟着搬 ——
    // 否则 fitFor 回落到 schedule.__default（5.0×4.0），与实测（important.holiday 5.4×4.0）
    // 差 7%，单独模式基准字号（v3.15 起由 fitFor 解算）会系统性偏小。
    holiday: { w: 5.4, wEn: 6.2, h: 4.0 },
    // festival 原 important 表里也没有（回落 __default 3.47×5.64，高瘦比与 pv-fe 的
    // 「名称行 + 日期行 + 右侧胶囊」宽扁布局相反）→ 按 .tmp/measure-fe.mjs 实测补：
    // 名称 1.32em×最长 3 字（腊八节）+ 行距 0.2em + 胶囊 2.26em ≈ 6.42em；
    // 2×4/4×4 上名称涨到 1.5em → 取 7.4em 覆盖两档 multipliers（名字超长时 ellipsis 兜底）。
    festival: { w: 7.4, wEn: 8.5, h: 3.0 },
    // v3.55：节气/距放假 与节日同构（同一 countdown），固有尺寸同步 festival，否则回落 __default 高瘦 →省掉天后/副标题
    solarTerm: { w: 7.4, wEn: 8.5, h: 3.0 },
    holidayGap: { w: 7.4, wEn: 8.5, h: 3.0 },
    // v2.9：胶囊倒计时（年倒计时 d/h/m/s 四个数字格 + 胶囊标题）
    capsule: { w: 11.2, wEn: 11.8, h: 3.4 },
    // v2.9：目标倒计时卡（标题 + 大天数 + 日期）
    // v3.17：w 6.1 → 4.6、h 5.2 → 4.4 —— measure-fit317b/c.mjs 实测（root=100px，
    // sched=年循环日程）：
    //   1×2 双列横排：左列（还有/天数/天 1.28em）+ 右列（标题 0.6em 2.68em +
    //     日期 0.46em 2.5em）≈ 4.28em，自然高 3.95em；
    //   2×1 竖排：宽 = 右列 2.68em（日期行 2.5em），自然高 6.14em。
    // 旧 w 6.1 = 2.68×2.3 严重过期（v2.9 时按 4 位天数+长标题拍的），把 2×1
    // 根字号压到 7.7、1×2 压到 9。fit 为全局条目取覆盖值：w 4.6（保 1×2 不溢）、
    // h 4.4（1×2 h 方向瓶颈；2×1 h 方向解 156/4.775=32.7 非瓶颈，实际高 6.14em
    // 在 root 10.1 时 availH 9.8em 内放得下）。
    // 解出 2×1 = 10.1px（修复前 7.7）、1×2 = 10.6px（修复前 9）。
    targetDay: { w: 4.6, wEn: 7.0, h: 4.4 },
    // v3.14：schedule.nextUp 已全尺寸移除（CONTENT_FIT 一并删除）
    // v3.14：festivalDay 节日节假日（1×1）—— 两行「标签 + 名称 + 日期/天数」
    // v3.15：w 4.2 → 5.0、h 2.6 → 2.7 —— .tmp/measure-fe.mjs 实测：1×2/2×1 上
    // k/v/d 涨到 0.4/0.68/0.5em，最宽行「节日 寒衣节 11/09」≈ 4.74em；2×1 卡内容盒
    // 仅 94px 宽，旧值 4.2 会让 fitFontU 解出 u=20.5 → 行宽 97px > 盒 87px 被裁。
    // 5.0 下 2×1 解出 u≈17.5（与 v3.14 写死的 17px 基准几乎一致），1×1 解出 16.2px。
    // v3.17：w 5.0 → 3.9、h 2.7 → 2.8 —— measure-fit317b/c.mjs 重测（root=100px）：
    // 1×1 行宽 4.076em（k0.8+gap0.26+v1.68+gap0.26+d1.06）、自然高 1.91em；
    // 2×1 行宽 4.584em、自然高 2.27em。按 w4.6 抬 k/d 后实测行宽 4.80em
    // （中文字形系数致实测略大于几何和），仍挤 2×1 卡宽（50px）。
    // 破局：1×1/2×1 上「节日/假期」标签 k 仅 0.44em≈4px 本就不可读，
    // 按「1×1 极简靠尺寸类裁剪」惯例直接 display:none（CSS），行宽降到
    // v+d ≈ 3.6em → w3.9。解出 1×1/2×1 = 11.7px（修复前 9.3）：
    // v「寒衣节」0.56em = 6.6px、d 0.48em = 5.6px，主信息反而更大更清。
    // 1×2 保留 k（h 方向 root 15.7，k 0.44em = 6.9px 可读）；
    // 2×2/2×4/4×4/1×FULL 的 w 方向解均远大于各自设计基准，w3.9 不影响。
    festivalDay: { w: 3.9, wEn: 5.2, h: 2.8 },
    // v3.19：节日 / 节假日**拆成两张独立卡**（festivalNext / holidayNext）。
    // **必须写在 schedule 分组里** —— fitFor 是 CONTENT_FIT[content][style] 两级查表，
    // 写错分组会静默回落 __default（我第一版误放进 progress 分组 → 1×1 root 只有 9.3px，
    // 与 v3.17「dayNum 缺条目把 2×1 压到 6px」是同一个坑）。
    // measure-fnx.mjs 实测（root=100px、4000px 大卡、card 不设 height）：
    // k 0.52em「节日」104px、v 0.95em「寒衣节」285px、d 0.62em「14 天」157px，
    // .pv-fnx 固有尺寸 = w 2.85em（最宽即名称）/ h 3.16em（三行 + 2 个 0.3125em gap）。
    // **最坏组合已核查**：节日名最长 3 字（全年 33 个）、法定假期名最长 3 字
    // （劳动节 / 国庆节 / 清明节）→ 2.85em 即上限。取 w 3.0 / h 3.3 留约 5% 余量；
    // h 还要吃掉 v 的字形纵向溢出（scrollHeight 114 vs 行盒 102.6，即 +0.11em），
    // 否则 1×1 上名称的上下缘会被卡边缘切掉。两个样式共用一组值（版式与数据源一致，
    // 空态少一行，按有数据的最坏情况取）。
    festivalNext: { w: 3.0, h: 3.3 },
    holidayNext: { w: 3.0, h: 3.3 },
    // v3.12：纵向日程表（2×1）—— 每行「时间 + 事件名」，条数按高度定
    // v3.17：w 5.6 → 4.6 —— measure-fit317b/c.mjs 实测（root=100px）：行 =
    // 时间 0.46em（「14:00」1.15em）+ gap 0.4 + 名称 0.72em（ellipsis 截断，
    // 不记全宽）；非弹性文字行最宽是头部「今日 1 项」0.42em≈2.2em 与
    // 底部「下一项 14:00」0.42em≈3.36em。旧 w 5.6 无实测依据，把 2×1
    // 根字号压到 8.4。新值 2×1 = 10.1px；名称 ellipsis 兜底长名。
    // 配套：head/next 0.42→0.54em、行时间 0.46→0.54em（CSS），
    // 抬后 next 行宽 0.54×8≈4.32em < 4.6 ✓。
    verticalList: { w: 4.6, wEn: 6.4, h: 9.0 },
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
    // v3.12：日数大字 + 月日副标题（1×2/2×1）
    // v3.17 补条目 —— 原无条目回落 timeDate.__default（w8.3/h3.2），2×1（卡宽仅 50px）
    // 根字号被压到 6px，副标题 0.56em 只有 3.4px。.tmp/measure-fit317c.mjs 实测
    // （root=100px 超大卡）：2×1 主行「26」4em 两位 = 4.63em、副标题行 3.38em、
    // 自然总高 4.9em（3.92+gap+0.81）；1×2 主行 2.6em = 3.01em、总高 3.42em。
    // w 4.9 = 4.63×1.06；h 5.0 = 4.9×1.02（2×1 h 方向 156/5.375=29 非瓶颈）。
    // 解出 2×1 = 9.5px（修复前 6）、1×2 = 9.3px（h 方向，与修复前持平）。
    dayNum: { w: 4.9, h: 5.0 },
    // ===== v3.12：1×1 / 2×1 专用 =====
    // 农历日：干支年 + 农历日大字（2.6em，两字 ≈ 2.9em 宽）+ 公历行
    // v3.17：w 试改 4.7 被 test-lit-commit 抓回 —— 「十六」2.6em 布局宽 4.488em，
    // 但**中文字形实际占宽 ≈ 布局宽 ×1.27~1.34**（scrollWidth 口径实测 5.7em），
    // root 16 时 scrollW 91px > 内容盒 81px → 「十六」右边被裁（用户 v3.15 实锤的
    // 「十」同类事故）。w6.0 = 4.488×1.34 的系数保护必须保留，**几何 rect 口径
    // （getBoundingClientRect）会低估中文字形宽，fit 修订必须以 scrollWidth 为准**。
    // h4.2 同理由几何 3.84em×1.04 得，垂直方向行盒亦有 ~1.15 系数但不触裁
    // （.pv-ld-day line-height 管束），保持。
    lunarDate: { w: 6.0, h: 4.0 },
    // 日时堆叠：左 68% 四行时刻 + 右 32% 巨大「日」
    // v3.15：w 6.2 → 5.2 —— .tmp/measure-fit315.mjs 实测（root=100px 超大卡）：
    // 1×2/2×1/2×2 自然总宽 = 左列 1.11（0.36em 的「14:05」）+ gap 0.4 + 「日」3em 两位 3.414
    // = 4.924em；1×1 左列 display:none（CSS 尺寸类裁剪），只剩「日」3.4em = 3.869em。
    // 旧值 6.2 是 v3.12 拍脑袋值（连 1×1 隐藏左列都不知道），公式化后把 1×1 根字号
    // 从设计基准 16 压到 13.2、2×1 从 17 压到 13.2（0.36em 行 = 4.76px 不可读）。
    // 5.2 = 4.924×1.055（项目惯例 +5%），解出 1×1 = 15.6 / 2×1 = 15.6px。
    // v3.17：h 4.6 → 4.3 —— 初版按几何自然高 3.0em 修到 3.2，audit 立刻抓出
    // 1×2 scrollH 溢 5px：.pv-ds-day 有 line-height:1，但**中文字体度量系数
    // ≈1.3**（ascent+descent > 1em），3em 字号的字形/行盒高 ≈ 3.9em，
    // fit.h 必须含这层保护（v3.15 的 4.6 ≈ 3.0×1.3+0.75 恰是此意，当初不知其所以然）。
    // 安全线：root ≤ (blockH)/(3.0×1.3+0.375) = 11.7px。取 h4.3 → root 10.9
    // （1×2 h 方向；2×1/1×1 仍是 w 方向瓶颈 9.3px 不受影响）。
    // 配套：左列时刻 0.36→0.4em（1×2 上 4.4px，2×1 3.7px）。
    dayStack: { w: 5.2, h: 4.3 },
    // 竖向大钟：超大时分（主行）+ 次级秒 + 当日进度条 + 日期行
    // v3.15：w 6.4 → 6.1、h 9.6 → 5.8 —— 实测主行「14:05」2.2em = 5.811em（letter-spacing
    // -0.04em 已含），日期行 2.707em、秒行 2.123em 均非瓶颈；自然高 = 2.2+0.3+1.6+0.3+0.16
    // +0.3+0.61 = 5.47em。旧 h 9.6 是 v3.12 遗留的过期代理值（比实测大 75%）。
    tallClock: { w: 6.1, h: 5.8 },
    // 竖向星期条：7 行（星期字 + 1.1em 日期数字）
    // v3.17：w 4.4 → 2.6、h 12.0 → 10.0 —— measure-fit317c.mjs 实测（root=100px）：
    // 行内容 = 星期 0.52em + padding 0.6 + 日期 1.1em 两位 1.3em = 2.42em
    // （space-between，行容器被拉伸故不能直接量行宽）；表头「第44周」0.44em≈1.54em；
    // 7 行自然高 = 7×1.32 + 6×0.12 ≈ 9.96em。旧 w 4.4/h 12.0 双过期，
    // 2×1（50×156）根字号被压到 10.5。新值解出 2×1 = 15.0px（星期 0.6em=9.0px）；
    // 2×2/2×4/4×4 上 h 方向解均大于设计基准，不受影响。
    weekColumn: { w: 2.6, h: 10.0 },
    // v3.11 stackTime：竖排时间 —— 时/分/秒 三行堆叠，专门吃 2×1 这类窄高卡的高度
    // v3.15 前无独立条目 → 回落 timeDate.__default（w 8.3），公式化后 2×1 根字号被压到
    // 10px（设计基准 17），0.5em 单位标签只有 5px。实测（2×1，b=2.3em）行宽 3.395em、
    // 行高 2.3em（line-height:1），三行 + 2×gap 0.12 = 6.9em；2×2（b=2.2em）行宽 3.276em。
    // 3.6 = 3.395×1.06；7.2 覆盖 6.9。解出 2×1 = 17px（设计基准，修复前 10）。
    stackTime: { w: 3.6, h: 7.2 },
  },
  progress: {
    __default: { w: 7.0, h: 2.0 },
    // v2.7 图形化进度：格阵按 auto-fill 自适应列数（最小格 0.42em），故 w 取「可读的最小宽度」
    yearGrid: { w: 10.0, h: 9.0 },
    // 12 根月条 + 顶部年份 + 底部百分比
    // v3.17：h 4.6 → 1.4 —— .pv-yb-bars 是 flex:1 1 auto 弹性填充（12 根条
    // 随剩余空间伸缩，不约束字号，同 ringProgress 的弹性容器纪律），
    // 高度只该记非弹性部分：底部「今年 81.6%」0.94em + 容器 gap 0.3 ≈ 1.24em。
    // 旧 h 4.6 是 v2.7 过期代理值，把 1×2（卡高 50px）根字号压到 10.1、
    // 底部「今年」0.5em 只有 5.05px。新值 1×2 = 17px（设计基准，脚注 8.5px）；
    // 2×2/2×4/4×4 上 h 方向解均大于各自设计基准（22/26/34），不受影响。
    yearBars: { w: 7.6, h: 1.4 },
    // v2.9：四条进度（年/月/周/日），每条「标签 + 条 + 百分比」
    // v3.15：h 5.4 → 7.0 —— 行数裁剪模型是「每行 1.15em + 行间 0.3em」，5 行需
    // 5×1.15+4×0.3 = 6.95em；旧值 5.4 与模型脱节 → fitFontU 解出的字号让 availH
    // 只剩 5.4em → perCol=floor(5.4/1.15)=4，「生命」行被裁（用户截图 5 行变 4 行）。
    // fit.h 必须 ≥ 行数模型的全量高度，否则「5 行都放下」与 fit 表自相矛盾。
    multiBars: { w: 9.4, h: 7.0 },
    // v2.10 ringProgress 四环进度：年/月/周/日 四条同心弧
    // v3.15：w 6.8 → 9.6、h 6.8 → 1.2 —— .tmp/measure-fit315.mjs 实测：
    // 图例单行自然宽 = 4 跨度 ×1.598（「年 81%」）+ 3×gap 0.6 = 8.19em，最坏情况
    // （百分比 3 位「100%」）= 4×1.838+1.8 = 9.15em；行高 0.58em（0.4em×1.45）。
    // 旧 h 6.8 是过期代理值：`.pv-rp-ring` 是 flex:1 1 auto + SVG absolute inset:0
    // 的**弹性填充**容器（SVG 随剩余空间缩放，不约束字号），高度只该记账式图例
    // 0.58 + 容器 gap 0.3 = 0.88em。旧值让 1×2 根字号被压到 12.3px（设计 17），
    // 图例 0.4em 只有 4.9px。1.2 = 0.88×1.36；9.6 = 9.15×1.05。
    ringProgress: { w: 9.6, h: 1.2 },
    heatYear: { w: 9.6, h: 7.0 },
    battery: { w: 6.4, h: 3.2 },
    // 7 个周格里「星期字母 + 日期」两行 + 底部百分比
    weekGrid: { w: 8.4, h: 3.0 },
    // ===== v3.12：1×1 / 2×1 专用 =====
    // 日环进度：3.4em 见方单环 + 环内百分比 + 底部时刻
    // v3.17：w 6.0 → 3.8、h 4.6 → 2.7 —— measure-fit317b.mjs 实测（root=100px）：
    // 环 .pv-dr-ring 固定 3.4em 见方（非弹性），pct「59%」0.95em≈2.36em、
    // time「今日 14:05」0.44em≈2.08em，自然总高 2.4em（环 3.4 是列内 max？
    // 不——环与文字是上下结构，总高 2.4em 含环的视觉高由 CSS 定）。
    // 旧 w 6.0/h 4.6 双过期，1×1（50×50）根字号被压到 7.8，time 0.44em
    // 只有 3.4px（用户卡4 实锤）。新值 1×1 = 12.0px；配套 time 0.44→0.5em
    // （宽 2.36em < 3.8 ✓）→ time 6.0px。
    dayRing: { w: 3.8, h: 2.7 },
    // 生命刻度尺：顶部标签 + 20 个竖刻度 + 底部读数
    lifeBar: { w: 4.6, h: 10.0 },
  },
};

/** 可读下限：低于此字号且允许换行时，按两行重算 */
const FIT_MIN_U = 9;
/** .pv-block 单侧内边距（em） */
const FIT_PAD = 0.1875;
/** 宿主 `.widget` 的左右/上下内边距合计（widget.js:662 `padding: 12px` → 12×2 = 24px）。
 *  可用空间计算必须扣掉它，否则几何比真实内容盒宽高各恒定多 24px → 固定 em 尺寸必溢出。 */
const HOST_PAD_X2 = 24;

/**
 * 尺寸名 → 行列数。SunPanel 的尺寸名是「行×列」（见 mainPage.js CARD_SIZE_GRID），
 * 1x2 = 1 行 2 列（宽扁），2x1 = 2 行 1 列（窄高）。
 */
export const SIZE_ORIENT = {
  '1x1': { rows: 1, cols: 1 },
  '1x2': { rows: 1, cols: 2 },
  '2x1': { rows: 2, cols: 1 },
  '2x2': { rows: 2, cols: 2 },
  '2x4': { rows: 2, cols: 4 },
  '4x4': { rows: 4, cols: 4 },
  '1xfull': { rows: 1, cols: 4 },
};

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
  '1x1': 17, '1x2': 19, '2x1': 19, '2x2': 22, '2x4': 26, '4x4': 34, '1xfull': 20,
};
/**
 * 单独模式预览的「设计基准尺寸」（与 audit-matrix 的 DIMS 同源）。
 * 用途：拿不到 widget 实测尺寸时，预览按这套尺寸渲染再等比缩小，
 * 保证 ① 宽高比与真实卡片一致 ② 16px 基准字号在该尺寸下不裁切
 * （旧回退用 64px 小框，内容必然被裁——「预览与实际两处裁切不一样」的根因之一）。
 */
export const SINGLE_REF_PX = {
  '1x1': [120, 120], '1x2': [252, 120], '2x1': [120, 252], '2x2': [252, 252],
  '2x4': [516, 252], '4x4': [516, 516], '1xfull': [1080, 120],
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
 * 多日程行高/行距模型（v1.34 需求 3，单位 em，与 .pv-sch-* / .pv-sch-list 的 CSS 同源，
 * 改 CSS 的 line-height 或 gap 必须同步这里，否则末行会被裁）：
 * - 行高由显式 line-height 决定（不依赖字体度量，跨机器稳定）：
 *   宽布局行 = max(名 0.75em×1.2,  meta 两行 2×0.5em×1.2) = 1.2em；
 *   窄布局行 = 名 0.75em×1.2（.pv-sch-name）≈ 0.9em，仍按 0.9375em 保守估算。
 * - 行距 = .pv-col 的 gap（0.3125em）。v3.69：剩余空间**不再**匀进行距（拉大 gap 会让
 *   行失去成组感、且封顶后底部必然留洞），改由 CSS 让行自身「增长 + 封顶」（.pv-sch-list）。
 *   这三个常量现在只服务于「最多能放几行」的溢出保护（maxRows）。
 */
const SCH_ROW_H_WIDE = 1.2;
const SCH_ROW_H_NARROW = 0.9375;
const SCH_ROW_GAP = 0.3125;
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
 * @param {{min?:number, max?:number}} [clamp] 字号夹取区间（默认 [7, 40]）——
 *   拼接模式用默认值；单独模式（v3.15）传按尺寸的 [0.35×base, 4×base]，
 *   只防 fit 表过期，不参与正常求解（fit 表是 measure.html 实测的唯一尺寸来源）。
 */
export function fitFontU(blockW, blockH, fit, clamp = null) {
  // 换行式断行按贪心策略填充，行宽利用不均匀，预留约 1 个字符宽的余量
  const slack = fit.wrap ? 1 : 0;
  const lo = clamp && Number.isFinite(clamp.min) ? clamp.min : 7;
  const hi = clamp && Number.isFinite(clamp.max) ? clamp.max : 40;
  // 防御：blockW/blockH/fit 任一非有限数时 solve 会得到 NaN，而 Math.max(7, NaN) === NaN，
  // 会让 font-size 变成 "NaNpx" 导致整块内容不可见。非有限值一律按 0 处理（落到字号下限）。
  const num = (v) => (Number.isFinite(v) ? v : 0);
  const solve = (n) => Math.min(
    num(blockH) / (num(fit.h) * n + 2 * FIT_PAD),
    (n * num(blockW)) / (num(fit.w) + slack + 2 * n * FIT_PAD),
  );
  const u1 = Math.max(lo, Math.min(hi, num(solve(1))));
  if (u1 >= FIT_MIN_U || !fit.wrap) return u1;
  const u2 = Math.max(lo, Math.min(hi, num(solve(2))));
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
    tall = false, small = false, flat = false, narrow = false,
    /** v1.44：日期串窄块使用两位年份（2026 → 26）；未显式传入时按卡片尺寸推断 */
    shortYear = undefined,
  } = o;
  const label = visual.label, label2 = visual.label2, label3 = visual.label3, cardBg = visual.cardBg;
  const TODAY = (t && t('MAIN_TODAY')) || (isZh ? '今天' : 'Today');
  const DAYS = (t && t('MAIN_DAYS')) || (isZh ? '天' : 'd');
  // v2.9「样式设置」：主色覆盖（未设置时回落到主题色）
  const opt = o.opts || {};
  // v3.40：日程 / 节假日 两个独立开关（默认开；未设 = 开）
  const showSchedule = opt.showSchedule !== false && opt.showSchedule !== '0' && opt.showSchedule !== 0;
  const showHoliday = opt.showHoliday !== false && opt.showHoliday !== '0' && opt.showHoliday !== 0;
  // v2.12：优先取「关联日程」里挑中的那条（自定义日程已写回日历，因此同样命中）
  const schedPick = (() => {
    // v3.6：schedMode === 'auto' 时忽略选中项，直接取「之后最近的一条日程」
    if (opt.schedMode === 'auto') {
      // v3.13：必须按**下一次发生日**挑最近，不能按原始记录日期比大小 ——
      // 年循环日程（生日/纪念日）记录的往往是多年前的日期，按 `x.date >= 今天`
      // 过滤会把它们全部筛掉，只剩「初始日期就在今年」的日程（用户实锤）。
      // getNextOccurrence 已经把年循环搬到今年/明年，一次性日程原样返回。
      const all = (getUserStore()?.getSchedules() || [])
        .map((x) => ({ x, n: getNextOccurrence(x, now) }))
        .filter((e) => e.n)
        // v3.69：补两级次级排序（日期串 → 时间升序），使「同一天多条日程」时稳定取到
        // **当天最早**那条；只按日差排序时并列项依赖原数组顺序，会取到当天靠后那条。
        // 与 verticalList 分支的 occurrence.dateStr + item.time 两级比较同源。
        .sort((a, b) => diffDays(a.n.date, b.n.date)
          || (a.n.dateStr || '').localeCompare(b.n.dateStr || '')
          || (a.x.time || '').localeCompare(b.x.time || ''));
      if (!all.length) return null;
      return { title: all[0].x.title || all[0].x.name || '', date: all[0].n.dateStr, time: all[0].x.time, note: all[0].x.note || '' };
    }
    const sel = opt.sched;
    if (!sel) return null;
    const list = (getUserStore()?.getSchedules() || []);
    // v3.3：用户明确「选中的就是这条」——即使这条已过期也不再改选其它日程。
    // 只有当选中的日程已经不存在（被删除）时才返回 null，由下面的 opt.text / opt.date 兜底。
    const hit = list.find((x) => String(x.id) === String(sel))
      || list.find((x) => x && x.date && String(x.date) === String(sel));
    if (!hit) return null;
    // v3.13：年循环日程（生日/纪念日）要走 getNextOccurrence 取**下一次**发生日，
    // 不是「把月日搬到今年」——搬到今年后若已过，倒计时会恒为 0（用户实锤：
    // 「没有统计到如生日这样循环显示的日程」）。一次性日程的未来日期原样返回；
    // 一次性且已过 → getNextOccurrence 返回 null，此时保留原记录日期（倒计时 0）。
    const nxt = getNextOccurrence(hit, now);
    let iso = nxt ? nxt.dateStr : String(hit.date || '');
    if (!nxt && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      const [yy, mm, dd] = iso.split('-').map(Number);
      const thisY = now.getFullYear();
      if (yy < thisY) {
        iso = `${thisY}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
      }
    }
    return { title: hit.title || hit.name || '', date: iso, time: hit.time, note: hit.note || '' };
  })();
  const accentOf = (fb) => (typeof opt.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(opt.color) ? opt.color : fb);  const pct = (p) => Math.max(0, Math.min(100, p)).toFixed(1);
  // v3.11：统一「统计粒度」进度 —— dial / semiGauge / battery 共用（用户要求这 3 个也能选年/月/周/日）。
  // 返回 0~1 的「已过比例」，含当日已过的时间部分，避免整天不动。
  const unitOf = (def) => (['year', 'month', 'week', 'day'].includes(opt.unit) ? opt.unit : def);
  const unitElapsed = (u) => {
    const yy = now.getFullYear(), mo = now.getMonth(), dd = now.getDate();
    const secDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const frac = secDay / 86400;
    if (u === 'month') {
      const dim = new Date(yy, mo + 1, 0).getDate();
      return Math.min(1, (dd - 1 + frac) / dim);
    }
    if (u === 'week') return Math.min(1, (((now.getDay() + 6) % 7) + frac) / 7);
    if (u === 'day') return Math.min(1, frac);
    const leap = (yy % 4 === 0 && yy % 100 !== 0) || yy % 400 === 0;
    const doy = Math.floor((new Date(yy, mo, dd) - new Date(yy, 0, 1)) / 86400000);
    return Math.min(1, (doy + frac) / (leap ? 366 : 365));
  };
  const UNIT_CAP = {
    year: { zh: '今年已过', en: 'Year' },
    month: { zh: '本月已过', en: 'Month' },
    week: { zh: '本周已过', en: 'Week' },
    day: { zh: '今日已过', en: 'Day' },
  };
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
   * v2.9：横排日期段的「原子段」行数估算与降级。
   * 段（数值+单位）不可断行、只能整段换行；用实测字宽模型 lineWidthEm 估每段宽度，
   * 贪心装行得行数，再按行高 1.3em + 内边距估算所需高度；放不下就丢弃末段（星期）。
   * 背景：v1.44 段不可断行后，dateWeekday 在 1×2/2×4 最小占格会换成 3 行撑爆块高
   * （audit-matrix 实测溢出 6px/2px）；此前审计台自身 CSS 缺 .pv-seg 规则而长期失明。
   * 未取到可用空间（如单独模式某些调用）时不做降级，保持原行为。
   */
  const segsFit = (parts) => {
    if (!Number.isFinite(o.availW) || !Number.isFinite(o.availH)) return true;
    let lines = 1;
    let cur = 0;
    for (const p of parts) {
      const w = lineWidthEm(p);
      if (cur === 0) { cur = w; continue; }
      if (cur + w <= o.availW) { cur += w; continue; }
      lines += 1;
      cur = w;
    }
    return lines * 1.3 + 2 * FIT_PAD <= o.availH;
  };
  /** 从末段起丢弃，直到放得下或到达最小段数（月日 / 年月日） */
  const trimSegs = (parts, min) => {
    const list = parts.slice();
    while (list.length > min && !segsFit(list)) list.pop();
    return list;
  };

  /**
   * v3.8：竖排行「文字固有宽度」模型（line-em = 宽度 / 该行自身字号）。
   * 字符宽度为无头 Chrome 实测（.tmp/probe-vw2.mjs：与 widget.js 同源字体栈、
   * font-weight:700 + tabular-nums、root=200px），组合串实测交叉验证：
   * 「26年」2.2334、「10月22日」4.4668、「Oct 22」3.2803、「Mon」2.3335。
   * 用途：给 .pv-vline.fit 传容器级 --w（取各行最大值 → 所有行同字号收缩），
   * 让浏览器在行宽超过竖排容器时按容器宽缩字号。
   * 替代旧的 <wbr> 折行方案：<wbr> 在 white-space:nowrap 下仍是合法断行点，
   * 会把「26年 / 10月22日」的两排渲染成三排 —— 即用户反馈「1×2 年月日还是 3 排」的根因。
   */
  const VW_DIGIT = 0.6167;
  const VW_CJK = 1.0;
  const VW_SPACE = 0.2979;
  const VW_LATIN = {
    A: 0.752, B: 0.6836, C: 0.6734, D: 0.7916, E: 0.5718, F: 0.5581, G: 0.7652,
    H: 0.8213, I: 0.3355, J: 0.4702, K: 0.6929, L: 0.5469, M: 1.0284, N: 0.8482,
    O: 0.8184, P: 0.6573, Q: 0.8184, R: 0.6983, S: 0.6016, T: 0.6255, U: 0.7764,
    V: 0.7148, W: 1.0762, X: 0.7002, Y: 0.6484, Z: 0.6504,
    a: 0.5777, b: 0.666, c: 0.5166, d: 0.6646, e: 0.582, f: 0.4053, g: 0.6646,
    h: 0.6455, i: 0.2959, j: 0.3018, k: 0.5962, l: 0.2959, m: 0.982, n: 0.648,
    o: 0.6573, p: 0.666, q: 0.6646, r: 0.4238, s: 0.4937, t: 0.4141, u: 0.648,
    v: 0.5772, w: 0.8516, x: 0.585, y: 0.5742, z: 0.5137,
  };
  const lineWidthEm = (s) => {
    let w = 0;
    for (const ch of String(s)) {
      if (ch >= '0' && ch <= '9') w += VW_DIGIT;
      else if (ch === ' ') w += VW_SPACE;
      else if (VW_LATIN[ch] !== undefined) w += VW_LATIN[ch];
      else if (ch.charCodeAt(0) > 0x2e80) w += VW_CJK; // CJK 与全角标点
      else w += 0.65; // 其余符号取保守均值
    }
    return w;
  };

  /**
   * v1.31 需求 7：竖排容器。
   * tight=false → 日期串类（.pv-vline 1.25em/700/lh1.15，gap .1875em）
   * tight=true  → 时间大类数字（.pv-vbig 1.875em/800/lh1.1，gap .125em）
   * apText：12 小时制的 AM/PM，内联在「时」行右侧（间隔 .25em），不单独成行
   * v3.8：非 tight 的每行挂 .fit 并在容器上写 --w（各行 line-em 的最大值，+2% 余量），
   * 行宽超过容器时整组同字号收缩，绝不折行（折行 = 用户看到的「三排」）。
   */
  const vbigRow = (v, ap) => html`<div class="pv-vrow"><span class="pv-vbig">${v}</span>${ap
    ? html`<span class="pv-ap">${ap}</span>` : ''}</div>`;
  const vstack = (lines, tight, apText = '') => {
    if (tight) {
      return html`<div class="pv-vstack t">
    ${lines.map((v, i) => vbigRow(v, i === 0 ? apText : ''))}
  </div>`;
    }
    const wMax = Math.max(...lines.map(lineWidthEm)) * 1.02;
    return html`<div class="pv-vstack" style="--w:${wMax.toFixed(3)}">
    ${lines.map((v) => html`<div class="pv-vline fit">${v}</div>`)}
  </div>`;
  };

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
    .sort((a, b) => diffDays(a.next.date, b.next.date));

  const empty = (text) => html`<div class="pv-center"><div class="pv-sub" style="color:${label3}">${text}</div></div>`;

  // ---------- 拼接：日历 ----------
  // v3.51：battery 走下方进图/电量条分支（calendar:battery），不进日历分支
  if (content === 'calendar' && style !== 'battery') {
    if (style === 'week') {
      const days = weekDatesForNow(now, ws);
      const wkScheds = getUserStore()?.getSchedules() || [];
      // 窄高块：7 个日期改为 7 行，行内「日期（左）+ 星期（右）」
      if (tall) {
        return html`<div class="pv-col">
          <div class="pv-wkv">
            ${days.map((d) => {
    const ds = formatDate(d);
    const isT = ds === todayStrV;
    const mk = dayMarks(ds, d, wkScheds);
    const wd = isZh
      ? `周${WEEK_FULL_ZH[d.getDay()]}`
      : d.toLocaleDateString('en-US', { weekday: 'short' });
    const fg = isT ? '#fff' : label3;
    return html`<div class="pv-wkv-cell ${isT ? 'today' : ''}${showHoliday && mk.isRest && !isT ? ' rest' : ''}" style="${isT ? `background:${theme};` : `color:${fg}`}"><span class="pv-wkv-d" style="color:${isT ? '#fff' : (showHoliday && mk.isRest ? theme : label2)}">${d.getDate()}</span><span class="pv-wkv-w" style="color:${fg}">${wd}</span>${showSchedule && mk.dots.length ? html`<i class="pv-dots">${mk.dots.map((c) => html`<i class="pv-dot" style="background:${isT ? '#fff' : c}"></i>`)}</i>` : ''}</div>`;
  })}
          </div>
        </div>`;
      }
      return html`<div class="pv-col">
        <div class="pv-wk">
          ${days.map((d) => {
    const ds = formatDate(d);
    const isT = ds === todayStrV;
    const mk = dayMarks(ds, d, wkScheds);
    return html`<div class="pv-wk-cell ${isT ? 'today' : ''}${showHoliday && mk.isRest && !isT ? ' rest' : ''}" style="${isT ? `background:${theme};color:#fff` : `color:${showHoliday && mk.isRest ? theme : label3}`}"><span class="pv-wk-d">${d.getDate()}</span><span class="pv-wk-w">${isZh ? WEEK_FULL_ZH[d.getDay()] : WEEK_MIN_EN[d.getDay()]}</span>${showSchedule && mk.dots.length ? html`<i class="pv-dots">${mk.dots.map((c) => html`<i class="pv-dot" style="background:${isT ? '#fff' : c}"></i>`)}</i>` : ''}</div>`;
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
      const wkScheds = getUserStore()?.getSchedules() || [];
      return html`<div class="pv-col">
        <div class="pv-wk" style="grid-template-columns:repeat(${days.length}, minmax(0, 1fr))">
          ${days.map((d) => {
    const ds = formatDate(d);
    const isT = ds === todayStrV;
    const mk = dayMarks(ds, d, wkScheds);
    return html`<div class="pv-wk-cell ${isT ? 'today' : ''}" style="${isT ? `background:${theme};color:#fff` : `color:${label3}`}"><span class="pv-wk-d"${showHoliday && mk.isRest && !isT ? ` style="color:${theme}"` : ''}>${d.getDate()}</span><span class="pv-wk-w">${isZh ? WEEK_FULL_ZH[d.getDay()] : WEEK_MIN_EN[d.getDay()]}</span>${showSchedule && mk.dots.length ? html`<i class="pv-dots">${mk.dots.map((c) => html`<i class="pv-dot" style="background:${isT ? '#fff' : c}"></i>`)}</i>` : ''}</div>`;
  })}
        </div>
      </div>`;
    }
    // month：月日历（v1.32 回退：表头仍为「年月」，不再升级为完整日期）
    const cells = getMonthGrid(now.getFullYear(), now.getMonth() + 1, ws);
    const moScheds = getUserStore()?.getSchedules() || [];
    const head = isZh
      ? `${now.getFullYear()}年${now.getMonth() + 1}月`
      : now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return html`<div class="pv-col">
      <div class="pv-cal-head pv-row2" style="color:${label2}">${head}</div>
      <div class="pv-mini-grid">
        ${cells.map((cell) => {
    const ds = formatDate(cell.date);
    const isT = ds === todayStrV;
    const mk = dayMarks(ds, cell.date, moScheds);
    return html`<span class="pv-c ${cell.inMonth ? '' : 'out'} ${isT ? 'today' : ''}${showHoliday && mk.isRest && !isT ? ' rest' : ''}" style="${isT ? `background:${theme};color:#fff` : `color:${showHoliday && mk.isRest ? theme : label3}`}">${cell.date.getDate()}${showSchedule && mk.dots.length ? html`<i class="pv-dots">${mk.dots.map((c) => html`<i class="pv-dot" style="background:${isT ? '#fff' : c}"></i>`)}</i>` : ''}</span>`;
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
        // v3.6：窄高卡（w < h）统一走竖排三行「26年 / 10月 / 22日」。
        // 预览与实际都从同一组真实像素（o.w/o.h）判定，不再依赖缩放后的折行巧合。
        if (noUnits) {
          const aria = isZh ? `${y}年${mo}月${d}日` : now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
          return (tall || narrow) ? nuV([yS, mo, d], aria) : nuH(html`${y}${dot}${mo}${dot}${d}`, aria);
        }
        // v3.7：竖排改两排（年 / 月日），与预览小框保持一致，也避免 2×1 高度吃紧
        // v3.8：月日不再用 joinSegs(<wbr>) 连接 —— <wbr> 在 nowrap 下仍是合法断行点，
        // 窄容器里会把第二排折成两行（用户看到「三排」）。改为整串不可断 + .fit 按容器宽缩字号。
        return (tall || narrow)
          ? vstack(
            isZh ? [`${yS}年`, `${mo}月${d}日`] : [`${yS}`, `${moEn} ${d}`],
            false,
          )
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
            ? joinSegs(trimSegs([`${mo}月`, `${d}日`, wdZh], 2).map(seg))
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
            ? joinSegs(trimSegs([`${isShortYear ? yS : y}年`, `${mo}月`, `${d}日`, wdZh], 3).map(seg))
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
  if (!o.singleRow && (content === 'important' || content === 'schedule')
    && (style === 'festival' || style === 'solarTerm' || style === 'holidayGap')) {
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

  // ---------- 拼接：日程（仅拼接模式；单独模式的日程样式在下方「单独：日程」分支）----------
  if (!o.singleRow && content === 'schedule') {
    if (style === 'multiple') {
      // 按块内可用空间自适应：纵向够高时多显示几条（横向留白交给 CSS 省略）
      const availH = Number.isFinite(o.availH) ? o.availH : 6;
      const wide = !!(o.opts && o.opts.wide);
      // v3.56：日期格式与纵向日程表一致 → YY-MM-DD HH:MM（无时间只显示日期），不再带星期
      const p2 = (n) => String(n).padStart(2, '0');
      const metaOf = (item, next) => {
        const d = next.date;
        const dt = `${String(d.getFullYear()).slice(-2)}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
        const t = item.time ? String(item.time).slice(0, 5) : '';
        return t ? `${dt} ${t}` : dt;
      };
      // v3.69：天数钳到 3 位（>999 → 999+天），避免位数变化带动右侧列宽抖动；0 天沿用「今天」
      const daysOf = (d) => (d === 0 ? TODAY : (d > 999 ? `999+${DAYS}` : `${d}${DAYS}`));
      const rowH = wide ? SCH_ROW_H_WIDE : SCH_ROW_H_NARROW;
      // 行数按「实测行高 + 行距」折算；上限取「可显示条数」与「高度可容纳条数」的较小值，
      // 避免日程不足时强塞空行、又能在够高时多显示。（溢出保护逻辑不变）
      const maxRows = Math.max(1, Math.min(20,
        Math.floor((availH - SCH_ROWS_RESERVE + SCH_ROW_GAP) / (rowH + SCH_ROW_GAP))));
      const top = upcoming.slice(0, maxRows);
      if (!top.length) return empty(isZh ? '暂无日程' : 'No schedules');
      // v3.69：垂直留白改为 CSS 主导分配（.pv-sch-list）—— 容器撑满可用高度，行按可用高度
      // 「增长 + 封顶」，不再把剩余空间折算进行距（拉大 gap 会让行失去成组感、且封顶后底部留洞）。
      // 日程名过长交给 CSS text-overflow 省略（.pv-sch-name 已带 min-width:0），
      // 不再在 JS 里按 availW/0.72 估算切片——那套估算对中文很不准且会与 CSS 双重截断。
      // 一条日程严格一行：name 伸缩 + meta 定宽不挤压，两者之间 column-gap 约 1 字符。
      return html`<div class="pv-col pv-sch-list${wide ? ' wide' : ''}">
        ${top.map(({ item, next }) => html`<div class="pv-sch-row">
          <span class="pv-sch-name" style="color:${label}">${item.title || ''}</span>
          <span class="pv-sch-meta${wide ? '' : ' pv-sch-days'}" style="color:${wide ? label3 : theme}">${wide ? metaOf(item, next) : daysOf(diffDays(next.date, now))}</span>
        </div>`)}
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

    // ===== v3.12：专为 1×1 方卡 / 2×1 窄高卡新设计的 8 款样式 =====
    // 用户要求「移除 1×1 / 2×1 卡片独立显示的所有选项，再单独做几个关于时间、日期和日程相关的」。
    // 排版铁律（见 docs/v312-visual-spec.md §8）：
    //   1×1 = 346×346，内容盒仅 6.6em 见方 → 1 个主数字（≤3.4em）+ 极少辅助；
    //   2×1 = 346×693，内容盒仅 6.52em 宽 → **任何横排长文本都不可行**，必须纵向堆叠。

    // ① timeDate.lunarDate 农历日（1×1）：主视觉 = 农历日两字大字，辅 = 干支年 + 公历
    if (style === 'lunarDate') {
      const ac = accentOf(theme);
      const parts = solarToLunarParts(formatDate(now));
      // 农历日是 1~3 个汉字（初一/廿三/三十），这是方卡唯一能承载的中文短词
      const dayTxt = parts ? (LUNAR_DAY_CN[parts.day - 1] || String(parts.day)) : '';
      const monTxt = parts ? (LUNAR_MONTH_CN[parts.month - 1] || `${parts.month}月`) : '';
      const gz = ganzhiYear(now.getFullYear());
      const is2x1 = o.size === '2x1';
      // v3.41：1×FULL 也走「干支年/月」「月日/周」两排拆分（三段式布局用），周字前缀随 bot2x1 自带
      const isSplit = is2x1 || o.size === '1xfull';
      const top = parts
        ? `${gz.zh}年 ${parts.leap ? '闰' : ''}${monTxt}`
        : `${now.getFullYear()}`;
      const bot = isZh
        ? `${now.getMonth() + 1}月${now.getDate()}日 ${WEEK_FULL_ZH[now.getDay()]}`
        : now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      // 2×1：上沿拆「干支年 / 月份」两排、下沿拆「月日 / 星期(加周字)」两排（v3.32）
      //      v3.34：月日改用小点分隔（「10月21」→「10.21」，用户：月日字移除改为小点），
      //      宽度 42px → 约 32px，2×1 的 50px 内容盒更宽裕
      const top2x1 = parts
        ? html`<span class="pv-ld-gz">${gz.zh}年</span><span class="pv-ld-mon">${parts.leap ? '闰' : ''}${monTxt}</span>`
        : html`<span class="pv-ld-gz">${now.getFullYear()}</span>`;
      const bot2x1 = isZh
        ? html`<span class="pv-ld-sol">${now.getMonth() + 1}·${now.getDate()}</span><span class="pv-ld-wd">周${WEEK_FULL_ZH[now.getDay()]}</span>`
        : html`<span class="pv-ld-sol">${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span><span class="pv-ld-wd">${now.toLocaleDateString('en-US', { weekday: 'short' })}</span>`;
      return html`<div class="pv-col pv-ld">
        <div class="pv-ld-top" style="color:${label3}">${isSplit ? top2x1 : top}</div>
        <div class="pv-ld-day" style="color:${ac}">${dayTxt}</div>
        <div class="pv-ld-bot" style="color:${label2}">${isSplit ? bot2x1 : bot}</div>
      </div>`;
    }

    // ② timeDate.dayStack 日时堆叠（1×1）：左 68% 放 4 行时刻，右 32% 放巨大「日」
    if (style === 'dayStack') {
      const ac = accentOf(theme);
      // 4 行「时:分」读数（数字宽度固定，0.36em 字号 → 一行 ≈ 1.1em，1×1 内容盒 6.6em 足够）
      const rows = [
        [String(hour12 ? (now.getHours() % 12 || 12) : now.getHours()).padStart(2, '0'), String(now.getMinutes()).padStart(2, '0')],
        [String(now.getMinutes()).padStart(2, '0'), String(now.getSeconds()).padStart(2, '0')],
        [String(now.getHours()).padStart(2, '0'), String((now.getHours() + 1) % 24).padStart(2, '0')],
        [String(Math.floor(now.getMinutes() / 5) * 5).padStart(2, '0'), String(Math.floor(now.getSeconds() / 5) * 5).padStart(2, '0')],
      ];
      return html`<div class="pv-col pv-ds">
        <div class="pv-ds-left">
          ${rows.map(([a, b2], i) => html`<div class="pv-ds-row">
            <b style="color:${i === 0 ? label2 : label3}">${a}</b><i style="color:${label3}">:</i><b style="color:${i === 0 ? label2 : label3}">${b2}</b>
          </div>`)}
        </div>
        <div class="pv-ds-right">
          <div class="pv-ds-day" style="color:${ac}">${now.getDate()}</div>
        </div>
      </div>`;
    }

    // ③ timeDate.tallClock 竖向大钟（2×1）：超大时分（主行）+ 次级秒 + 当日进度条
    if (style === 'tallClock') {
      const ac = accentOf(theme);
      const hh = String(hour12 ? (now.getHours() % 12 || 12) : now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const dayP = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
      const tc2x1 = o.size === '2x1';
      const timeInner = tc2x1
        ? html`<b style="color:${ac}">${hh}</b><i style="color:${ac}">${mm}</i>`
        : html`<b style="color:${ac}">${hh}</b><i style="color:${ac}">:${mm}</i>`;
      return html`<div class="pv-col pv-tc${tc2x1 ? ' pv-tc-2x1' : ''}">
        <div class="pv-tc-time">${timeInner}</div>
        <div class="pv-tc-sec" style="color:${label2}">${ss}<em style="color:${label3}">${isZh ? '秒' : 's'}</em></div>
        <div class="pv-tc-bar"><i style="width:${(dayP * 100).toFixed(1)}%;background:${ac}"></i></div>
        <div class="pv-tc-date" style="color:${label3}">${o.size === '2x1' ? (isZh ? `${now.getMonth() + 1}·${now.getDate()}` : now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })) : (isZh ? `周${WEEK_FULL_ZH[now.getDay()]} ${now.getMonth() + 1}月${now.getDate()}日` : now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))}</div>
      </div>`;
    }

    // ④ timeDate.weekColumn 竖向星期条（2×1）：7 行（星期字 + 大日期数字），今天整行高亮
    if (style === 'weekColumn') {
      const ac = accentOf(theme);
      const days = weekDatesForNow(now, ws);
      return html`<div class="pv-col pv-wc2">
        <div class="pv-wc2-head" style="color:${label3}">${isZh ? `第${weekOfYear(now)}周` : `W${weekOfYear(now)}`}</div>
        <div class="pv-wc2-list">${days.map((d) => {
    const isT = d.getDate() === now.getDate() && d.getMonth() === now.getMonth();
    const wd = isZh ? WEEK_FULL_ZH[d.getDay()] : WEEK_MIN_EN[d.getDay()];
    return html`<div class="pv-wc2-row${isT ? ' now' : ''}" style="${isT ? `background:${ac};color:#fff` : `color:${label2}`}">
              <span>${wd}</span><b>${d.getDate()}</b>
            </div>`;
  })}</div>
      </div>`;
    }

    // v3.11 dayNum：今日大数字 —— 方形卡（1×1）与窄高卡（2×1）最省空间的主角样式：
    // 一个占据大半个卡片的日数 + 一行「月 · 周几」，没有横向长文本，几乎不可能被裁。
    if (style === 'dayNum') {
      const ac = accentOf(theme);
      const mo = now.getMonth() + 1;
      const wd = isZh ? `周${WEEK_FULL_ZH[now.getDay()]}` : WEEK_MIN_EN[now.getDay()];
      const sub = isZh ? `${mo} 月 · ${wd}` : `${now.toLocaleDateString('en-US', { month: 'short' })} · ${wd}`;
      const sub2x1 = html`<span class="pv-dn-m">${mo}月</span><span class="pv-dn-w">${wd}</span>`;
      return html`<div class="pv-col pv-dn">
        <div class="pv-dn-num" style="color:${ac}">${now.getDate()}</div>
        <div class="pv-dn-sub" style="color:${label2}">${o.size === '2x1' ? sub2x1 : sub}</div>
      </div>`;
    }
    // v3.11 miniMonth：小月历 —— 单卡里唯一「看得见整月」的样式，7 列固定，1×1 上刚好铺满
    if (style === 'miniMonth') {
      const ac = accentOf(theme);
      const cells = getMonthGrid(now.getFullYear(), now.getMonth() + 1, ws);
      const mmScheds = getUserStore()?.getSchedules() || [];
      const wdZh = ['日', '一', '二', '三', '四', '五', '六'];
      const wdEn = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      const wdOrder = Array.from({ length: 7 }, (_, i) => (isZh ? wdZh : wdEn)[(ws + i) % 7]);
      const head = isZh
        ? `${now.getFullYear()} 年 ${now.getMonth() + 1} 月`
        : now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return html`<div class="pv-col pv-mm">
        <div class="pv-mm-head" style="color:${label2}">${head}</div>
        <div class="pv-mm-wd">${wdOrder.map((w) => html`<i style="color:${label3}">${w}</i>`)}</div>
        <div class="pv-mm-grid">${cells.map((cell) => {
    // 「今天」取渲染基准 now 而不是真实 todayStr()：预览/审计用固定 now 时两者会不一致（高亮落到别的日子）。
    const isT = cell.date.getFullYear() === now.getFullYear()
      && cell.date.getMonth() === now.getMonth()
      && cell.date.getDate() === now.getDate();
    const mk = dayMarks(formatDate(cell.date), cell.date, mmScheds);
    const cls = `pv-mm-c${cell.inMonth ? '' : ' out'}${isT ? ' now' : ''}${showHoliday && mk.isRest && !isT ? ' rest' : ''}`;
    return html`<span class="${cls}" style="${isT ? `background:${ac};color:#fff` : `color:${showHoliday && mk.isRest ? ac : label3}`}">${cell.date.getDate()}${showSchedule && mk.dots.length ? html`<i class="pv-dots">${mk.dots.map((c) => html`<i class="pv-dot" style="background:${isT ? '#fff' : c}"></i>`)}</i>` : ''}</span>`;
  })}</div>
      </div>`;
    }
    // v3.11 stackTime：竖排时间 —— 时/分/秒 三行堆叠，专门吃 2×1 这类窄高卡的高度
    if (style === 'stackTime') {
      const rows = [
        [String(hour12 ? (now.getHours() % 12 || 12) : now.getHours()).padStart(2, '0'), isZh ? '时' : 'h'],
        [String(now.getMinutes()).padStart(2, '0'), isZh ? '分' : 'm'],
        [String(now.getSeconds()).padStart(2, '0'), isZh ? '秒' : 's'],
      ];
      return html`<div class="pv-col pv-skt">
        ${rows.map(([v, u], i) => html`<div class="pv-skt-row">
          <b style="color:${i === 0 ? label : label2}">${v}</b><i style="color:${label3}">${u}</i>
        </div>`)}
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
        return svg`<line x1="${(50 + sn * r1).toFixed(2)}" y1="${(50 - cs * r1).toFixed(2)}" x2="${(50 + sn * 39.5).toFixed(2)}" y2="${(50 - cs * 39.5).toFixed(2)}" stroke="currentColor" stroke-opacity="${i % 5 === 0 ? 0.55 : 0.24}" stroke-width="${i % 5 === 0 ? 1.1 : 0.6}" stroke-linecap="round" />`;
      });
      // v3.10 指针：外圈刻度只表达「当日已过比例」，钟面本身必须有时针/分针才叫刻度钟。
      // 指针长度控制在 26 以内（刻度内圈半径 30），避免与刻度/进度弧打架；数字下沉到 6 点位。
      const handOf = (deg, len, w2, op) => {
        const a = (deg * Math.PI) / 180;
        return svg`<line x1="50" y1="50" x2="${(50 + Math.sin(a) * len).toFixed(2)}" y2="${(50 - Math.cos(a) * len).toFixed(2)}" stroke="${ac}" stroke-opacity="${op}" stroke-width="${w2}" stroke-linecap="round" />`;
      };
      const hDeg = (((now.getHours() % 12) * 60 + now.getMinutes()) / 720) * 360;
      const mDeg = ((now.getMinutes() * 60 + now.getSeconds()) / 3600) * 360;
      return html`<div class="pv-col pv-rc">
        <div class="pv-rc-ring">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            ${ticks}
            <circle cx="50" cy="50" r="44" fill="none" stroke="${ac}" stroke-width="2.6" stroke-linecap="round"
              stroke-dasharray="${(C * ratio).toFixed(2)} ${C.toFixed(2)}" transform="rotate(-90 50 50)" />
            ${handOf(hDeg, 17, 3.4, 0.95)}
            ${handOf(mDeg, 25.5, 2, 0.7)}
            <circle cx="50" cy="50" r="3.2" fill="${ac}" />
          </svg>
        </div>
        <div class="pv-rc-time" style="color:${label}">${t}</div>
      </div>`;
    }
    // v2.9 dotClock：数码管风格（等宽数字 + 发光 + 顶部点阵条）
    if (style === 'dotClock') {
      const ac = accentOf(theme);
      const t = fmtHM(now, hour12, true);
      const dots = Array.from({ length: 24 }, (_, i) => html`<i style="opacity:${i < Math.round(24 * sec / 86400) ? 0.9 : 0.14}"></i>`);
      return html`<div class="pv-col pv-dc">
        <div class="pv-dc-left">
          <div class="pv-dc-dots" style="color:${ac}">${dots}</div>
          <div class="pv-dc-time" style="color:${ac}">${t}</div>
        </div>
        <div class="pv-dc-right">
          <div class="pv-dc-date" style="color:${label3}">${isZh ? `${now.getMonth() + 1}月${now.getDate()}日 周${WEEK_FULL_ZH[now.getDay()]}` : now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
        </div>
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
  // ---------- 单独：重要日期（节日卡 / 假期倒计时） ----------
  // v3.14：「重要日期」类已并入「日程」，这里同时认旧 key（存量配置经 renderInfoBlock
  // 顶部的 aliasContent 迁移后走新 key，但 Inner 也被测试直接调用，两个 key 都要放行）。
  if ((content === 'important' || content === 'schedule') && o.singleRow
    && style === 'festival') {
    const acI = accentOf(theme);
    const f = getNextFestival(now);
    if (!f) return html`<div class="pv-center"><div class="pv-sub">${isZh ? '暂无节日' : 'No festival'}</div></div>`;
    return html`<div class="pv-col pv-fe">
      <div class="pv-fe-left">
        <div class="pv-fe-name">${isZh ? f.nameZh : (f.nameEn || f.nameZh)}</div>
        <div class="pv-fe-date">${f.dateStr.slice(5).replace('-', '/')}</div>
      </div>
      <div class="pv-fe-right">
        <div class="pv-fe-top"><span class="pv-fe-gap" style="background:${acI}">${f.days === 0 ? (isZh ? '今天' : 'NOW') : (isZh ? `${f.days} 天后` : `in ${f.days}d`)}</span></div>
      </div>
    </div>`;
  }

  // v3.14：「仪表」类已并入「进图仪表」，这里同时认旧 key（理由同上）。
  if ((content === 'gauge' || content === 'progress') && o.singleRow
    && (style === 'dial' || style === 'semiGauge')) {
    const ac = accentOf(theme);
    // v3.11：指针仪表默认「年」；半环仪表默认「日」。两者都能在样式设置里选年/月/周/日。
    const uDial = unitOf('year');
    const uSg = unitOf('day');
    const yp0 = unitElapsed(uDial);
    const dP = unitElapsed(uSg);
    const capDial = UNIT_CAP[uDial];
    const capSg = UNIT_CAP[uSg];
    if (style === 'dial') {
      const A0 = -120, SWEEP = 240;
      const ang = A0 + SWEEP * yp0;
      const rad = (ang * Math.PI) / 180;
      const nx = 50 + Math.sin(rad) * 26, ny = 50 - Math.cos(rad) * 26;
      const ticks = Array.from({ length: 21 }, (_, i) => {
        const a = ((A0 + (SWEEP * i) / 20) * Math.PI) / 180;
        const big = i % 5 === 0;
        const r1 = big ? 34 : 37, r2 = 40;
        return svg`<line x1="${(50 + Math.sin(a) * r1).toFixed(2)}" y1="${(50 - Math.cos(a) * r1).toFixed(2)}"
            x2="${(50 + Math.sin(a) * r2).toFixed(2)}" y2="${(50 - Math.cos(a) * r2).toFixed(2)}"
            stroke="currentColor" stroke-opacity="${big ? 0.6 : 0.28}" stroke-width="${big ? 1.4 : 0.8}" stroke-linecap="round" />`;
      });
      return html`<div class="pv-col pv-gl">
          <div class="pv-gl-dial">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              ${ticks}
              <circle cx="50" cy="50" r="44" fill="none" stroke="${ac}" stroke-opacity="0.16" stroke-width="2"
                stroke-dasharray="${(2 * Math.PI * 44 * (SWEEP / 360)).toFixed(2)} 999" transform="rotate(210 50 50)" />
              <line x1="${(50 - Math.sin(rad) * 6).toFixed(2)}" y1="${(50 + Math.cos(rad) * 6).toFixed(2)}"
                x2="${nx.toFixed(2)}" y2="${ny.toFixed(2)}" stroke="${ac}" stroke-width="2.8" stroke-linecap="round" />
              <circle cx="50" cy="50" r="3.4" fill="${ac}" />
            </svg>
            <div class="pv-gl-val" style="color:${label}">${Math.round(yp0 * 100)}%</div>
          </div>
          <div class="pv-gl-cap">${isZh ? capDial.zh : capDial.en}</div>
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
          <div class="pv-sg-cap">${isZh ? capSg.zh : capSg.en}</div>
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
      // v3.11：胶囊倒计时也能选年/月/周/日 —— 终点分别是元旦 / 次月 1 号 / 本周结束 / 今晚 24 点。
      const u = unitOf('year');
      const yy = now.getFullYear(), mo = now.getMonth(), dNow = now.getDate();
      const end = u === 'month' ? new Date(yy, mo + 1, 1)
        : u === 'week' ? new Date(yy, mo, dNow + (7 - ((now.getDay() - ws + 7) % 7)))
          : u === 'day' ? new Date(yy, mo, dNow + 1)
            : new Date(yy + 1, 0, 1);
      const defTitle = u === 'month' ? (isZh ? `${mo + 1} 月倒计时` : `Month ${mo + 1}`)
        : u === 'week' ? (isZh ? '本周倒计时' : 'This week')
          : u === 'day' ? (isZh ? '今日倒计时' : 'Today')
            : (isZh ? `${yy} 年倒计时` : `Year ${yy}`);
      const title = typeof opt.text === 'string' && opt.text ? opt.text : defTitle;
      const ms = Math.max(0, end.getTime() - now.getTime());
      const dd = Math.floor(ms / 86400000);
      const hh = Math.floor(ms / 3600000) % 24;
      const mm = Math.floor(ms / 60000) % 60;
      const ss = Math.floor(ms / 1000) % 60;
      const pad = (v) => String(v).padStart(2, '0');
      const cell = (v, uu) => html`<span class="pv-cp-cell"><b style="color:${label}">${pad(v)}</b><i style="color:${label3}">${uu}</i></span>`;
      // 周/日剩余不足 1 天时不再占一格「00 天」，避免小卡片挤出一行。
      const showD = u === 'year' || u === 'month' || dd > 0;
      return html`<div class="pv-col pv-cp">
        <div class="pv-cp-left">
          <div class="pv-cp-row">
            ${showD ? cell(dd, isZh ? '天' : 'd') : ''}${cell(hh, isZh ? '时' : 'h')}${cell(mm, isZh ? '分' : 'm')}${cell(ss, isZh ? '秒' : 's')}
          </div>
        </div>
        <div class="pv-cp-right">
          <div class="pv-cp-pill" style="border-color:${ac};color:${ac}">${title}</div>
        </div>
      </div>`;
    }
    // ===== v3.12 新增日程类 =====
    // ⑤ v3.14：schedule.nextUp 全尺寸移除（用户：「显示的逻辑我没有太明白」）。
    // 渲染分支一并删除；旧配置走到 renderInfoBlock 顶部的尺寸门禁，提示重新选择样式。
    // 想看「下一件事」的用户可改用 targetDay（可关联日程，语义更直白）。

    // ⑥ schedule.festivalDay 节日节假日（v3.14，1×1 为主）：下一节日 + 下一假期两行。
    // 用户要求「加一个显示节日和节假日的，字体尽可能小别被裁切」—— 全部字号压到
    // 0.34~0.56em，最宽行「节日 寒衣节 11/09」≈ 3.9em，1×1 内容盒约 6.6em，余量 > 40%。
    if (style === 'festivalDay') {
      const ac = accentOf(theme);
      // getNextHoliday 需要 holidayService（node 环境下没有服务时返回 null → 走空态）
      const f = getNextFestival(now);
      const h = getNextHoliday(getHolidayService(), now);
      const fmtMd = (iso) => {
        const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(String(iso || ''));
        return m ? `${Number(m[1])}/${Number(m[2])}` : '';
      };
      const fDays = f && f.date ? diffDays(f.date, now) : null;
      const hDays = h && h.date ? diffDays(h.date, now) : null;
      const row = (k, name, md, days, useAccent) => html`<div class="pv-fd-row">
        <span class="pv-fd-k" style="color:${label3}">${k}</span>
        <span class="pv-fd-v" style="color:${useAccent ? ac : label}">${name}</span>
        <span class="pv-fd-d" style="color:${label2}">${days === null ? md : `${days} 天`}</span>
      </div>`;
      const fName = f ? (isZh ? (f.nameZh || '节日') : (f.nameEn || f.nameZh || 'Festival')) : (isZh ? '暂无' : 'None');
      const hName = h ? (isZh ? (h.nameZh || '假期') : (h.nameEn || h.nameZh || 'Holiday')) : (isZh ? '暂无' : 'None');
      return html`<div class="pv-col pv-fd">
        ${row(isZh ? '节日' : 'Fest', fName, fmtMd(f && f.date), fDays, false)}
        <div class="pv-fd-rule"></div>
        ${row(isZh ? '假期' : 'Holiday', hName, fmtMd(h && h.date), hDays, true)}
      </div>`;
    }

    // ⑦ schedule.festivalNext / holidayNext（v3.19）：节日与节假日**拆成两张独立的卡**。
    // 用户："还是给节日和节假日放开显示，两个放在一个卡片有些放不下"。
    // 一张卡只放一个信息后：标签 k 不再需要隐藏（festivalDay 在 1×1 上被迫 hidden），
    // 且名称行独占可用宽度 → root 与字号都能比两行合一放大约一倍（实测见 panel-sizes 记载）。
    // 两个分支共用 .pv-fnx-*（**不是 pv-fd-***，否则会被旧卡的尺寸类裁剪规则命中）。
    // 数据源结构一致（getNextFestival / getNextHoliday 都返回 {dateStr,date,days,nameZh,nameEn}）。
    if (style === 'festivalNext' || style === 'holidayNext') {
      const ac = accentOf(theme);
      const isHol = style === 'holidayNext';
      // 节假日（holidayNext）：承接已下线的「假期倒计时」样式排版（pv-hd：大天数 + 名称 + 日期）
      if (isHol) {
        const nh = getNextHoliday(getHolidayService(), now);
        if (!nh) return html`<div class="pv-center"><div class="pv-sub">${isZh ? '暂无假期' : 'No holiday'}</div></div>`;
        return html`<div class="pv-col pv-hd">
          <div class="pv-hd-left">
            <div class="pv-hd-days" style="color:${ac}">${nh.days === 0 ? (isZh ? '假期中' : 'ON') : nh.days}<small>${isZh ? '天' : 'd'}</small></div>
          </div>
          <div class="pv-hd-right">
            <div class="pv-hd-name">${isZh ? nh.nameZh : (nh.nameEn || nh.nameZh)}</div>
            <div class="pv-hd-date">${nh.dateStr.slice(5).replace('-', '/')}</div>
          </div>
        </div>`;
      }
      const f = getNextFestival(now);
      if (!f) return html`<div class="pv-center"><div class="pv-sub">${isZh ? '暂无节日' : 'No festival'}</div></div>`;
      const name = isZh ? (f.nameZh || '节日') : (f.nameEn || f.nameZh || 'Festival');
      const days = f.days === 0 ? (isZh ? '今天' : 'NOW') : `${f.days} 天`;
      return html`<div class="pv-col pv-fnx">
        <div class="pv-fnx-k" style="color:${label3}">${isZh ? '节日' : 'Festival'}</div>
        <div class="pv-fnx-v" style="color:${label}">${name}</div>
        <div class="pv-fnx-d" style="color:${label2}">${days}</div>
      </div>`;
    }

    // ⑥ schedule.verticalList 纵向日程表：可上下拖动滚动浏览全部日程（含已过的一次性日程）；
    //    标题「日程表」+「顶部」按钮复位；v3.58：屏蔽已过的循环项，初始滚动到首个未来项。
    if (style === 'verticalList') {
      const ac = accentOf(theme);
      // v3.21：2×2 / 2×4 / 4×4 每行同时显示「日期 + 时间」；v3.56：日期加两位年 → YY-MM-DD HH:MM
      // 2×1 完全不显示时间（仅日程名）
      const showMeta = o.size === '2x2' || o.size === '2x4' || o.size === '4x4';
      // 时间轴：一次性日程（event / 关闭年循环的倒计时）保留过去与未来；循环项只保留「下一个」未来发生
      // （屏蔽已过的循环项，且不展开多年未来，保持列表长度与原「下一次发生」一致）。
      const tl = getScheduleTimeline(getUserStore()?.getSchedules() || [], now, 3, 5);
      const list = [];
      const seenRecurring = new Set();
      for (const e of tl) {
        const it = e.item;
        const oneTime = it.type === 'event' || (it.type === 'countdown' && it.yearly === false);
        if (oneTime) {
          list.push(e);                               // 一次性：含过去与未来
        } else if (e.days >= 0) {
          const key = `${it.title}|${it.date}`;        // 循环：仅保留下一个未来发生
          if (!seenRecurring.has(key)) { seenRecurring.add(key); list.push(e); }
        }
      }
      list.sort((a, b) => a.occurrence.dateStr.localeCompare(b.occurrence.dateStr)
        || (a.item.time || '').localeCompare(b.item.time || ''));
      if (!list.length) return empty(isZh ? '暂无日程' : 'No schedules');
      let firstFutureIdx = list.findIndex((e) => e.days >= 0);
      if (firstFutureIdx < 0) firstFutureIdx = 0;
      const p2 = (n) => String(n).padStart(2, '0');
      const metaOf = (date, time) => {
        const dt = `${String(date.getFullYear()).slice(-2)}-${p2(date.getMonth() + 1)}-${p2(date.getDate())}`;
        const t = time ? String(time).slice(0, 5) : '';
        return t ? `${dt} ${t}` : dt;
      };
      // 首个「未来/今日」行（即最近/即将到来的日程；无未来时取最后一行=最新）
      const firstFutureRow = (list) =>
        list.querySelector('[data-future="1"]') || [...list.querySelectorAll('.pv-vl-row')].pop() || null;
      // 当前视口顶部对齐的那条行 index：基于 getBoundingClientRect（视口坐标，不依赖 offsetParent）
      const currentTopIdx = (sc) => {
        const rows = [...sc.querySelectorAll('.pv-vl-row')];
        if (!rows.length) return 0;
        const top0 = sc.getBoundingClientRect().top;
        let idx = 0;
        for (let i = 0; i < rows.length; i++) {
          if (rows[i].getBoundingClientRect().top - top0 > 1) break;
          idx = i;
        }
        return idx;
      };
      // 按「一个日程」为单位翻页：dir=+1 下一日程（向更未来）/ -1 上一日程（向已过的方向）。
      // 目标 scrollTop = 当前 + 该行相对容器顶的视口偏移（自然含行高与 gap，方向与 offsetParent 均无关）
      const pageOne = (sc, dir) => {
        const rows = [...sc.querySelectorAll('.pv-vl-row')];
        if (!rows.length) return;
        const idx = Math.max(0, Math.min(rows.length - 1, currentTopIdx(sc) + dir));
        const top0 = sc.getBoundingClientRect().top;
        const target = sc.scrollTop + (rows[idx].getBoundingClientRect().top - top0);
        sc.style.scrollBehavior = 'smooth';
        sc.scrollTop = Math.max(0, Math.min(sc.scrollHeight - sc.clientHeight, target));
      };
      // 拖动滚动：记录起点，move 时按位移反向滚动（触摸式），方向天然对称
      const onVlDown = (e) => {
        const sc = e.currentTarget;
        sc._vy = e.clientY; sc._vtop = sc.scrollTop;
        sc.style.scrollBehavior = 'auto';
        try { sc.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      };
      const onVlMove = (e) => {
        const sc = e.currentTarget;
        if (sc._vy == null) return;
        sc.scrollTop = sc._vtop - (e.clientY - sc._vy);
      };
      // 松手：视为一次「滑动」则按一个日程为单位翻页（上滑→下一日程，下滑→上一日程）；轻点不动
      const onVlUp = (e) => {
        const sc = e.currentTarget;
        const dy = sc._vy != null ? (e.clientY - sc._vy) : 0;
        sc._vy = null;
        const rows = [...sc.querySelectorAll('.pv-vl-row')];
        if (!rows.length) return;
        const rowH = rows[0].offsetHeight || 1;
        if (Math.abs(dy) < Math.max(6, rowH * 0.18)) return;   // 轻点：不改滚动
        pageOne(sc, dy < 0 ? 1 : -1);                          // 上滑 dy<0 → 向下翻（下一日程）
      };
      // 鼠标滚轮：每滚一格（一个 notch）精确移动「一个日程显示框高度」，并阻止原生滚动叠加
      const onVlWheel = (e) => {
        e.preventDefault();
        pageOne(e.currentTarget, e.deltaY > 0 ? 1 : -1);       // 下滚 deltaY>0 → 下一日程
      };
      // 回到顶部：滚动到最近/即将到来的日程（首个未来项），并阻止冒泡避免打开视图页（v3.58）
      const onVlTop = (e) => {
        e.stopPropagation();
        const sc = e.currentTarget.closest('.pv-vl') && e.currentTarget.closest('.pv-vl').querySelector('.pv-vl-list');
        if (!sc) return;
        const first = firstFutureRow(sc);
        if (!first) return;
        const target = sc.scrollTop + (first.getBoundingClientRect().top - sc.getBoundingClientRect().top);
        sc.style.scrollBehavior = 'smooth';
        sc.scrollTop = Math.max(0, Math.min(sc.scrollHeight - sc.clientHeight, target));
      };
      // 初始滚动到首个未来/今日项：向上滑可见已过的一次性日程，向下滑可见更远的未来
      const onVlListRef = (el) => {
        if (!el || el._vlInit) return;
        el._vlInit = true;
        requestAnimationFrame(() => {
          const first = firstFutureRow(el);
          if (!first) return;
          const target = el.scrollTop + (first.getBoundingClientRect().top - el.getBoundingClientRect().top);
          el.scrollTop = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, target));
        });
      };
      const topLabel = isZh ? '顶部' : 'Top';
      return html`<div class="pv-col pv-vl">
        <div class="pv-vl-head" style="color:${label3}">
          <span>${isZh ? '日程表' : 'Schedules'}</span>
          <button class="pv-vl-top" @click=${onVlTop} title="${isZh ? '回到最近日程（即将到来）' : 'Back to latest schedule'}">${topLabel}</button>
        </div>
        <div class="pv-vl-list" ${ref(onVlListRef)} @wheel=${onVlWheel} @pointerdown=${onVlDown} @pointermove=${onVlMove} @pointerup=${onVlUp} @pointercancel=${onVlUp}>
          ${list.map((e, i) => {
    const future = e.days >= 0;
    const nm = e.item.title || e.item.name || '';
    const left = showMeta ? metaOf(e.occurrence.date, e.item.time) : '';
    const isAccent = i === firstFutureIdx;
    return html`<div class="pv-vl-row${future ? '' : ' past'}" data-future="${future ? 1 : 0}">
              ${left ? html`<span style="color:${future ? (isAccent ? ac : label3) : label3}">${left}</span>` : ''}
              <b style="color:${future ? (isAccent ? label : label2) : label2}">${nm}</b>
            </div>`;
  })}
        </div>
      </div>`;
    }

    // v2.9 targetDay：目标倒计时卡（标题 / 目标日都可在「样式设置」里改）
    // v3.13：bigDays 已全尺寸移除（用户：与 targetDay 显示样式重复）—— 渲染分支一并删除，
    // 旧配置走到 renderInfoBlock 顶部的尺寸门禁，提示「该显示样式不适用于此卡片尺寸」。
    if (style === 'targetDay') {
      const ac = accentOf(theme);
      const title = (schedPick && schedPick.title) || (typeof opt.text === 'string' && opt.text ? opt.text : (isZh ? '目标日' : 'Target'));
      const iso = (schedPick && schedPick.date) || (typeof opt.date === 'string' ? opt.date : '');
      // v3.64：关联日程的备注（无备注时右侧日程名放大）
      const note = (schedPick && schedPick.note) ? schedPick.note : '';
      // v3.56：关联日程时显示其具体时间（手动目标日 / 无时间则不显示）
      const schedTime = (schedPick && schedPick.time) ? String(schedPick.time).slice(0, 5) : '';
      const is2x1 = o.size === '2x1';
      const isFull = o.size === '1xfull';
      let left = null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        const [y, m, d] = iso.split('-').map(Number);
        const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        left = Math.round((new Date(y, m - 1, d).getTime() - t0.getTime()) / 86400000);
      }
      // 2×1：日期拆两排（年 / 月日），各 10px（v3.32）
      const date2x1 = is2x1 && /^\d{4}-\d{2}-\d{2}$/.test(iso)
        ? html`<span class="pv-tg-y">${iso.slice(0, 4)}</span><span class="pv-tg-md">${iso.slice(5)}</span>`
        : iso;
      const timeNode = schedTime ? html`<span class="pv-tg-time" style="color:${label3}">${isFull ? ` ${schedTime}` : schedTime}</span>` : '';
      const preTxt = left >= 0 ? (isZh ? '还有' : 'in') : (isZh ? '已过' : 'over');
      const unitTxt = isZh ? '天' : Math.abs(left) === 1 ? 'day' : 'days';
      if (left === null) {
        return html`<div class="pv-col pv-tg">
          <div class="pv-sub" style="color:${label3}">${isZh ? '未设置目标日' : 'No target date'}</div>
        </div>`;
      }
      // v3.64：1×FULL 新排版 —— 左：还有X天(上) + 日期时间(下)；右：日程名(上) + 备注(下)，无备注则放大日程名
      if (isFull) {
        return html`<div class="pv-col pv-tg pv-tg-full">
          <div class="pv-tg-left">
            <div class="pv-tg-left-top">
              <span class="pv-tg-pre" style="color:${label3}">${preTxt}</span>
              <span class="pv-tg-days" style="color:${ac}">${Math.abs(left)}</span>
              <span class="pv-tg-unit" style="color:${label3}">${unitTxt}</span>
            </div>
            <div class="pv-tg-left-bottom">
              <span class="pv-tg-date" style="color:${label3}">${iso}</span>${timeNode}
            </div>
          </div>
          <div class="pv-tg-right ${note ? '' : 'pv-tg-nonote'}">
            <div class="pv-tg-title" style="color:${label2}">${title}</div>
            ${note ? html`<div class="pv-tg-note" style="color:${label3}">${note}</div>` : ''}
          </div>
        </div>`;
      }
      // 非 1×FULL：维持原结构（左=天数组，右=标题 + 目标日/时分）
      return html`<div class="pv-col pv-tg">
        <div class="pv-tg-left">
          <div class="pv-center">
            <span class="pv-tg-pre" style="color:${label3}">${preTxt}</span>
            <span class="pv-tg-days" style="color:${ac}">${Math.abs(left)}</span>
            <span class="pv-tg-unit" style="color:${label3}">${unitTxt}</span>
          </div>
        </div>
        <div class="pv-tg-right">
          <div class="pv-tg-title" style="color:${label2}">${title}</div>
          <div class="pv-tg-date" style="color:${label3}">${date2x1}</div>${timeNode}
        </div>
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
  if (content === 'progress' || (content === 'calendar' && style === 'battery')) {
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

    // v2.9 multiBars：多条进度（年 / 月 / 周 / 日 / 生命），一条一行，主色可改
    if (style === 'multiBars') {
      const ac = accentOf(theme);
      const dimM = daysInMonth(now.getFullYear(), now.getMonth() + 1);
      const mp = ((now.getDate() - 1) + sec / 86400) / dimM * 100;
      // v2.11：opts.bars 选要哪几条（y/m/w/d/life），opts.age + opts.life 组成生命进度
      // v3.12：age/life 未配置时回退到 STYLE_OPT_FIELDS 的默认值（18 / 120，用户指定）——
      // 否则用户没点过「样式设置」时 lifePct = null，「生命」行被过滤掉，5 行只剩 4 行。
      const mbOpt = o.opts || {};
      const pickedBars = String(mbOpt.bars || STYLE_OPT_FIELDS.bars.def || 'y,m,w,d,life').split(',').filter(Boolean);
      const ageRaw = mbOpt.age ?? STYLE_OPT_FIELDS.age.def;
      const lifeRaw = mbOpt.life ?? STYLE_OPT_FIELDS.life.def;
      const ageN = Number(ageRaw), lifeN = Number(lifeRaw);
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
      // v3.12：百分比一律整数、无小数 —— 「100.0%」有 6 个字符，实宽超过 .pv-mb-v 的定宽框
      // → 末尾的「%」被裁（用户截图实锤）。整数后是「100%」4 字符，留足余量。
      // 条的填充宽度仍保留 1 位小数（那是长度不是文本，不受定宽框约束）。
      // v3.12：行数裁剪 —— 1×FULL 是 2 列 × 3 行布局，单列可用高度只有一半，
      // 沿用「单列」算法会把 5 行裁成 2 行（用户报「5 个同时显示被裁切」）。
      // 这里按实际列数算容量：2 列时能放 2×floor(...) 行。
      const availH2 = Number(o.availH);
      const isWideFull = o.size === '1xfull';
      const rowH = 1.15;
      const perCol = Number.isFinite(availH2) && availH2 > 0 ? Math.max(1, Math.floor(availH2 / rowH)) : 99;
      const maxRows = isWideFull ? perCol * 2 : perCol;
      const shown = rows.slice(0, maxRows);
      return html`<div class="pv-col pv-mb">
        ${shown.map(([k, v]) => html`<div class="pv-mb-row">
          <span class="pv-mb-k" style="color:${label3}">${k}</span>
          <b class="pv-mb-bar"><i style="width:${Math.max(0, Math.min(100, v)).toFixed(1)}%;background:${ac}"></i></b>
          <span class="pv-mb-v" style="color:${label2}">${Math.round(v)}%</span>
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
        return svg`<circle cx="50" cy="50" r="${rr}" fill="none" stroke="${ac}" stroke-opacity="${op}"
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
    // ===== v3.12 新增进度类 =====
    // ⑦ progress.dayRing 日环进度（1×1）：单环 + 环内大百分比 + 底部时刻
    if (style === 'dayRing') {
      const ac = accentOf(theme);
      const secDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
      const pD = Math.min(1, secDay / 86400);
      const C1 = 2 * Math.PI * 44;
      return html`<div class="pv-col pv-dr">
        <div class="pv-dr-ring">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="44" fill="none" stroke="${label3}" stroke-opacity="0.2" stroke-width="7" />
            <circle cx="50" cy="50" r="44" fill="none" stroke="${ac}" stroke-width="7" stroke-linecap="round"
              stroke-dasharray="${(C1 * pD).toFixed(2)} ${C1.toFixed(2)}" transform="rotate(-90 50 50)" />
          </svg>
          <div class="pv-dr-pct" style="color:${label}">${Math.round(pD * 100)}%</div>
        </div>
        <div class="pv-dr-time" style="color:${label3}">${isZh ? `今日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` : `Today ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`}</div>
      </div>`;
    }

    // ⑧ progress.lifeBar 生命刻度尺（2×1）：竖向刻度尺把「18/120」这种稀疏比例画出来
    if (style === 'lifeBar') {
      const ac = accentOf(theme);
      const lbOpt = o.opts || {};
      // v3.12：age/life 默认值与 multiBars 同源（STYLE_OPT_FIELDS.age/life = 18 / 120）
      const ageN = Number(lbOpt.age ?? STYLE_OPT_FIELDS.age.def);
      const lifeN = Number(lbOpt.life ?? STYLE_OPT_FIELDS.life.def);
      const age = Number.isFinite(ageN) ? Math.max(0, ageN) : Number(STYLE_OPT_FIELDS.age.def);
      const span = Number.isFinite(lifeN) && lifeN > 0 ? lifeN : Number(STYLE_OPT_FIELDS.life.def);
      const N = 20;
      const filled = Math.round((age / span) * N);
      const pct = Math.round((age / span) * 100);
      return html`<div class="pv-col pv-lb">
        <div class="pv-lb-head" style="color:${label2}">${isZh ? `生命进度 ${pct}%` : `Life ${pct}%`}</div>
        <div class="pv-lb-scale">${Array.from({ length: N }, (_, i) => html`<i class="${i < filled ? 'on' : ''}" style="${i < filled ? `background:${ac}` : ''}"></i>`)}</div>
        <div class="pv-lb-foot" style="color:${label3}">${isZh ? `已过 ${age} / ${span}` : `${age} / ${span}`}</div>
      </div>`;
    }

    // v2.10 heatYear 年热力图：12 列 × 各月天数的方块阵（今天高亮）
    // v3.11 stackBars：分层进度条 —— 年/月/周/日 四行横条，窄高卡（2×1）上按高度均分铺满
    if (style === 'stackBars') {
      const sbAc = accentOf(theme);
      const mPct = ((now.getDate() - 1 + sec / 86400)
        / daysInMonth(now.getFullYear(), now.getMonth() + 1)) * 100;
      const rows = [
        [isZh ? '年' : 'Y', yearProgress(now)],
        [isZh ? '月' : 'M', mPct],
        [isZh ? '周' : 'W', weekPct],
        [isZh ? '日' : 'D', dayPct],
      ];
      return html`<div class="pv-col pv-sb">
        ${rows.map(([k, v], i) => {
    const w = Math.max(2, Math.min(100, v));
    return html`<div class="pv-sb-row">
          <span class="pv-sb-k" style="color:${i === 0 ? label2 : label3}">${k}</span>
          <span class="pv-sb-bar"><i style="width:${w.toFixed(1)}%;background:${sbAc};opacity:${(1 - i * 0.16).toFixed(2)}"></i></span>
          <b class="pv-sb-v" style="color:${i === 0 ? label : label2}">${Math.round(v)}%</b>
        </div>`;
  })}
      </div>`;
    }
    if (style === 'battery') {
      const acb = accentOf(theme);
      // v3.11：电量条同样支持年/月/周/日，默认「年」。
      const uBt = unitOf('year');
      const capBt = UNIT_CAP[uBt];
      const pct = Math.max(0, Math.min(100, unitElapsed(uBt) * 100));
      // 单独模式（progress:battery）保留分段刻度 <u> 与条下方端点 pv-bt-nub；
      // 拼接模式（calendar:battery）走极简版，去掉两者，只留纯进度条（v3.55 起）。
      const combo = content === 'calendar';
      const segs = combo ? 0 : 10;
      return html`<div class="pv-col pv-bt">
        <div class="pv-bt-head"><span style="color:${label3}">${isZh ? capBt.zh : capBt.en}</span><b style="color:${acb}">${Math.round(pct)}%</b></div>
        <div class="pv-bt-body" style="border-color:${acb}">
          <i style="width:${Math.max(2, Math.round(pct))}%;background:${acb}"></i>
          ${combo ? '' : Array.from({ length: segs - 1 }, (_, i) => html`<u style="left:${((i + 1) * 100) / segs}%"></u>`)}
        </div>
        ${combo ? '' : html`<div class="pv-bt-nub" style="background:${acb}"></div>`}
      </div>`;
    }
    if (style === 'heatYear') {
      const ac = accentOf(theme);
      const yNow = now.getFullYear(), mNow = now.getMonth(), dNow = now.getDate();
      const cols = Array.from({ length: 12 }, (_, m) => {
        const dn = new Date(yNow, m + 1, 0).getDate();
        const cells = Array.from({ length: dn }, (_, i) => {
          const d = i + 1;
          const past = m < mNow || (m === mNow && d < dNow);
          const isNow = m === mNow && d === dNow;
          // v3.15：插值必须放在引号属性值里 —— 原写法 ${isNow ? html` style="..."` : ''} 落在
          // 标签内引号外，lit 当 ElementPart 静默丢弃，「今天」格的 themes 背景从未生效。
          return html`<i class="${past ? 'on' : ''}${isNow ? ' now' : ''}" style="${isNow ? `background:${ac}` : ''}"></i>`;
        });
        return html`<b>${cells}</b>`;
      });
      return html`<div class="pv-col pv-hy-wrap"><div class="pv-hy" aria-hidden="true">${cols}</div></div>`;
    }
    // v2.11 yearGrid 升级：opts.unit 决定粒度（年=当年天数 / 周=7 格 / 日=24 格），opts.shape 切换圆点或方块
    if (style === 'yearGrid') {
      const ygOpt = o.opts || {};
      const ygUnit = ['week', 'day', 'month'].includes(ygOpt.unit) ? ygOpt.unit : 'year';
      const ygShape = ygOpt.shape === 'dot' ? ' dot' : '';
      const ac0 = ygOpt.color || theme;
      // ===== v3.12：格阵尺寸的所有权从 JS 移到 CSS =====
      // 旧做法：JS 用 availW/availH（基于设计基准的**预测值**，且少扣了宿主 24px）
      // 算出固定的 em 轨道 `grid-template-columns: repeat(cols, X em)` 内联到元素上。
      // 一旦真实卡片比设计基准小，X em 轨道必然越出内容盒 → 底部末行被裁（用户截图实锤）。
      // 新做法：JS 只传两个**整数**（--cols / --rows），格边长由 CSS 用
      //   --cell: min(宽度解, 高度解, 上限)
      // 从容器的真实尺寸（container query 单位 100cqw / 100cqh）推出。
      // 于是「不裁切」变成**结构性保证**：总宽 = cols×cell + (cols−1)×gap ≤ 100cqw 恒成立，
      // JS 算错最多导致「填不满 / 形状不好看」，永远不会导致「被裁」。
      //
      // 形状查表（按真实卡片宽高比 A = w/h，语义优先于几何）：
      //   月 = 7 列（周为行）、周 = 7 格一行 —— 这两个永远不变，是语义底线；
      //   日 = 6×4 / 8×3 / 12×2，按卡宽高比在候选集里挑覆盖率最高的；
      //   年 = 允许随形状变化（近方形铺满）。
      const ygAspect = Number.isFinite(o.w) && Number.isFinite(o.h) && o.h > 0 ? o.w / o.h : 1;
      const YG_SHAPE = {
        // v3.21：1×FULL（A≥12）年格阵把 73×5 改为 122×3——用户要求年格更密（122 列×3 行 = 366）。
        // 超宽卡高度仅 76px，3 行时每格高度解充足，122 列在宽度解下每格仍清晰可辨。
        // 122×3 = 366，可铺满闰年当年天数。
        year: [
          [1.25, 20, 19], [1.7, 24, 16], [2.6, 29, 13], [3.4, 35, 11], [Infinity, 122, 3],
        ],
        // v3.13：超宽卡上月/日都改**一排**（用户：现在两排两侧空）。
        // 月一排 = 31 格（自然月上限），日一排 = 24 格（小时）。
        month: [
          [1.25, 7, 5], [1.7, 7, 5], [2.6, 7, 5], [3.4, 16, 2], [Infinity, 31, 1],
        ],
        week: [
          [1.25, 7, 1], [1.7, 7, 1], [2.6, 7, 1], [3.4, 7, 1], [Infinity, 7, 1],
        ],
        day: [
          [1.25, 6, 4], [1.7, 8, 3], [2.6, 8, 3], [3.4, 12, 2], [Infinity, 24, 1],
        ],
      };
      const ygShapeOf = (u) => {
        const tbl = YG_SHAPE[u] || YG_SHAPE.year;
        for (const [lim, cols, rows] of tbl) if (ygAspect <= lim) return { cols, rows };
        const last = tbl[tbl.length - 1];
        return { cols: last[1], rows: last[2] };
      };
      // 粒度类名 → CSS 侧的 --gap / --cap（见 card-mode-styles.js 的 .pv-yg-grid.m/.w/.d）
      const YG_CLASS = { month: ' m', week: ' w', day: ' d', year: '' };
      // 只输出两个整数，格边长交给 CSS
      const ygGridInline = (u) => {
        const { cols, rows } = ygShapeOf(u);
        return `--cols:${cols};--rows:${rows}`;
      };
      const ygClass = (u) => YG_CLASS[u] || '';
      if (ygUnit === 'month') {
        // v3.6：月粒度 —— 本月天数格子（今天点亮）；v3.8 起列数按几何择优
        const mDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const todayD = now.getDate();
        return html`<div class="pv-col pv-yg">
          <div class="pv-yg-head"><span style="color:${label3}">${now.getFullYear()}</span><b style="color:${ac0}">${todayD}/${mDays}</b></div>
          <div class="pv-yg-body"><div class="pv-yg-grid${ygShape}${ygClass('month')}" style="${ygGridInline('month')}">${Array.from({ length: mDays }, (_, i) => {
  const n = i + 1;
  const cls = n === todayD ? 'now' : n < todayD ? 'on' : '';
  return html`<i class="${cls}" style="${n === todayD ? `background:${ac0}` : ''}"></i>`;
})}</div></div>
        </div>`;
      }
      if (ygUnit === 'week') {
        const wd = (now.getDay() + 6) % 7;
        return html`<div class="pv-col pv-yg">
          <div class="pv-yg-head"><span style="color:${label3}">${isZh ? `第${weekOfYear(now)}周` : `W${weekOfYear(now)}`}</span><b style="color:${ac0}">${wd + 1}/7</b></div>
          <div class="pv-yg-body"><div class="pv-yg-grid${ygShape}${ygClass('week')}" style="${ygGridInline('week')}">${Array.from({ length: 7 }, (_, i) => {
  const cls = i === wd ? 'now' : i < wd ? 'on' : '';
  return html`<i class="${cls}" style="${i === wd ? `background:${ac0}` : ''}"></i>`;
})}</div></div>
        </div>`;
      }
      if (ygUnit === 'day') {
        const hr = now.getHours();
        return html`<div class="pv-col pv-yg">
          <div class="pv-yg-head"><span style="color:${label3}">${isZh ? '今日' : 'Today'}</span><b style="color:${ac0}">${hr + 1}/24</b></div>
          <div class="pv-yg-body"><div class="pv-yg-grid${ygShape}${ygClass('day')}" style="${ygGridInline('day')}">${Array.from({ length: 24 }, (_, i) => {
  const cls = i === hr ? 'now' : i < hr ? 'on' : '';
  return html`<i class="${cls}" style="${i === hr ? `background:${ac0}` : ''}"></i>`;
})}</div></div>
        </div>`;
      }
      const doy = dayOfYear(now);
      const total = new Date(now.getFullYear(), 1, 29).getDate() === 29 ? 366 : 365;
      return html`<div class="pv-col pv-yg">
        <div class="pv-yg-head">
          <span style="color:${label3}">${now.getFullYear()}</span>
          <b style="color:${ac0}">${isZh ? `${doy}/${total} 天` : `${doy}/${total} d`}</b>
        </div>
        <div class="pv-yg-body"><div class="pv-yg-grid${ygShape}${ygClass('year')}" style="${ygGridInline('year')}">${Array.from({ length: total }, (_, i) => {
  const n = i + 1;
  const cls = n === doy ? 'now' : n < doy ? 'on' : '';
  return html`<i class="${cls}" style="${n === doy ? `background:${ac0}` : ''}"></i>`;
})}</div></div>
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
        <div class="pv-wg2-foot" style="color:${label3}"><span>${isZh ? '本周' : 'Week'}</span> <b style="color:${theme}">${weekPct.toFixed(0)}%</b></div>
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
  // v3.14：单独模式下把旧内容类 key 迁到新 key（important→schedule、gauge→progress），
  // 否则存量配置会被上面的尺寸门禁误拦（新 SINGLE_CONTENTS 里已没有这两个 key）。
  // **只对单独模式生效**：拼接模式的 COMBO_CONTENTS 仍保留「重要日期」类。
  if (o.singleRow && o.content) {
    const aliased = aliasContent(o.content);
    if (aliased !== o.content) o = { ...o, content: aliased };
  }
  // v3.13：单独模式补一道**渲染期**尺寸门禁。
  // 此前「移除样式」只改 `sizes` 白名单（影响选择器），用户旧配置的卡片仍按旧排版继续渲染
  // —— 用户看到的就是「明明移除了的样式还在，而且照样被裁」（v3.13 实锤：1×1 上
  // semiGauge「今年已过」、festival「寒衣节」两张卡仍在渲染且都裁切）。
  // 不可用时给一行小提示，让用户知道该重新选样式，而不是留一张裁坏的卡。
  // 注意：这里只打标记、不提前返回 —— 外壳（尺寸类名 + 内联根字号）必须照常生成，
  // 否则拿不到几何信息的调用方（预览缩放、审计）会拿到没有 font-size 的残壳。
  // 另外：只有「单独模式自己的内容类」才受门禁管 —— `time` / `calendar` / `schedule:multiple`
  // 这些键只存在于 COMBO_CONTENTS，SINGLE_CONTENTS 里查不到，不能误判成「已下线」。
  const gated = !!(o.singleRow && o.size && o.content && o.style
    && SINGLE_CONTENTS.some((c) => c.key === o.content)
    && !styleFitsSize('single', o.content, o.style, o.size));
  // v3.3：单独模式的 tall 不再由调用方凭尺寸名猜，改为按真实像素几何判定 ——
  // 预览框是按 real×pvScale 缩出来的，只要两边都传 w/h，方向判定就完全一致。
  const geo = Number.isFinite(o.w) && Number.isFinite(o.h) && o.w > 0 && o.h > 0;
  // v3.7：尺寸兜底 —— 缺像素几何（样式条小预览）时按尺寸名推方向，避免与真实卡片判定不一致
  const sizeGeo = SIZE_ORIENT[o.size] || null;
  // 优先级：真实像素 > 尺寸名 > 调用方显式传入（测试/自定义场景）
  const tallGeo = geo
    ? isTallBlock(o.w, o.h)
    : (sizeGeo ? sizeGeo.rows >= sizeGeo.cols * TALL_RATIO : o.tall);
  const narrowGeo = geo
    ? o.w < o.h
    : (sizeGeo ? sizeGeo.cols < sizeGeo.rows : o.narrow);
  // v3.8：单独模式也把「块内可用空间(em)」传给渲染内核 —— 格阵/热力图按几何
  // 自适应列行与格边长需要它（此前只有拼接模式传 availW/availH）。
  // v3.9：baseForAvail 必须计入 singleScale —— 缩放预览的「可用空间(em)」要与真实卡片同源，
  // 否则行数裁剪/格阵自适应等几何判定在预览里走另一条路（预览裁一处、实际裁另一处）。
  // v3.15：基准字号改为「设计基准封顶 + fitFontU 原理公式保底」，取代 v3.10 的
  // 「写死 px 基准 × 参考缩放比（SINGLE_REF_PX）」。写死基准缩放的两处死穴：
  // ① 设计基准自身就在溢：lunarDate 在 120×120 参考 + 16px 基准下实测文本 5.73em >
  //    参考可用 5.625em → 用户截图「十六」被裁成「十」；
  // ② 参考缩放只能让 availW 对尺寸守恒，救不了基准本身不准。
  // 公式保底让「availW ≥ fit.w 且 availH ≥ fit.h」在卡片小于设计基准时结构性成立
  // （拼接模式一直如此）；详见下方 uFit 处的完整模型说明。
  // 宿主 chrome = .widget padding 12×2 + 主题玻璃描边 border 1×2 = 26px
  // （border 来自 _cardBgStyle，CDP 实测见 .tmp/panel-geo.mjs）。
  const scaleForAvail = Number(o.singleScale);
  const scaleOk = Number.isFinite(scaleForAvail) && scaleForAvail > 0 ? scaleForAvail : 1;
  // 固有尺寸的 opts 必须与 renderInfoBlockInner 实际用的布局开关同源：tall 已按真实
  // 像素比算出；singleLine/noUnits 等用户开关原样透传。两边不同源 → 字号与排版错配。
  const fitSingle = o.content && o.style
    ? fitFor(o.content, o.style, o.hour12, o.isZh !== false, { ...(o.opts || {}), tall: tallGeo })
    : { w: 6, h: 3.4, wrap: false };
  const hostChromeX2 = HOST_PAD_X2 + 2;
  const basePx = (o.size && SINGLE_BASE_PX[o.size]) || 16;
  // v3.15 最终模型 = **设计基准封顶 + 原理公式保底**：
  //   u = min(设计基准 px, fitFontU(内容盒, 固有尺寸))
  // ① 封顶：真实卡片 ≥ 设计基准时恒等于出厂设计（SINGLE_BASE_PX 与 CSS 兜底同源），
  //    大卡上不会因为「填满」把字放大到失控（audit 实测：纯 fitFontU 在 2×4/4×4 上把
  //    wordClock/dayNum/stripeClock 放大到设计值的 2 倍 → 集体溢出）。
  // ② 保底：卡片小于设计基准（用户真实 1×1 = 113×114、headless 76×76）时按公式收缩，
  //    「availW ≥ fit.w」结构性成立 → 不再裁切；设计基准自身就溢的款式（lunarDate
  //    在 120×120 参考下文本 5.73em > 可用 5.625em）也会被公式压到不溢（14.75 < 16）。
  // 1×FULL 不走这支（高度驱动的 baseFull，见下）—— 横条卡的实测高度可达设计值 2.9 倍，
  // 封顶会把内容缩成中间一小块（v3.10 用户实锤）。
  const uFit = geo
    ? Math.min(basePx, fitFontU(Math.max(0, o.w - hostChromeX2), Math.max(0, o.h - hostChromeX2), fitSingle,
      o.size ? { min: 0.35 * basePx, max: 4 * basePx } : null))
    : basePx;
  // 1×FULL 的基准字号由「高度」决定，不能只看宽度：它是一行高的横条，内容按 6.7em 高排版
  // （设计基准 1080×120 / 18px）。用户实测 1×FULL = 1386.88×346.72，旧公式 w/60=23.1px 只
  // 相当于设计值的 1.28 倍，而实际高度是设计值的 2.89 倍 → 内容缩在中间一小块、四周大片留白。
  // 取 min(h/6.7, w/24)：高度是硬约束，宽度只做上限兜底（防窄屏横排溢出）。
  const baseFull = geo ? Math.min(56, Math.max(6, Math.min(o.h / 6.7, o.w / 24))) : 18;
  const baseForAvail = (o.size === '1xfull'
    ? baseFull
    : uFit)
    * scaleOk;
  // v3.10：可用空间要用「缩放后的盒子尺寸」—— 预览传的是未缩放实测尺寸 + singleScale，
  // 若不乘 scaleOk，预览的 avail 会是真实卡片的两倍，行数裁剪/格阵自适应又会漂移。
  // v3.12：可用空间必须扣掉宿主 `.widget` 的 24px padding（widget.js:662 padding:12px，
  // widget.js:83 的 availW 也扣了同样的 24）。此前只扣了 .pv-single 自身的 0.375em，
  // 几何比真实内容盒**宽高各恒定多 24px** → 所有按它算出的固定 em 尺寸必然溢出被裁。
  // 这是 yearGrid 在 2×2/2×4/4×4 上被裁切的根因之一。
  // 注意：宿主 padding 也要随 singleScale 缩放 —— 缩放预览里整张卡连 padding 一起缩小，
  // 若扣的是固定 24px，缩放预览的可用空间会比真实卡片少一截 → 行数裁剪结果不一致
  // （「预览正常、实际被切」的另一个来源）。
  const availGeo = geo
    ? {
      availW: (o.w * scaleOk - hostChromeX2 * scaleOk) / baseForAvail - 2 * FIT_PAD,
      availH: (o.h * scaleOk - hostChromeX2 * scaleOk) / baseForAvail - 2 * FIT_PAD,
    }
    : {};
  const body = gated
    ? html`<div class="pv-col pv-center"><div class="pv-sub" style="color:${(o.visual || {}).label3 || '#8E8E93'}">${
      o.isZh === false ? 'This style is not available for this card size' : '该显示样式不适用于此卡片尺寸，请重新选择'
    }</div></div>`
    : renderInfoBlockInner({ ...o, ...availGeo, tall: tallGeo, narrow: narrowGeo });
  const cls = o.size ? 'pv-single pv-single-' + o.size : 'pv-single';
  // 预览等比缩放：把 CSS 的根字号基准同比缩小，保证缩小后的预览与真实卡片同比例
  // 1×FULL 与 baseForAvail 同源（否则可用空间与真实字号两套基准，行数裁剪会漂）
  const base = o.size === '1xfull'
    ? baseFull
    : (o.size ? uFit : 0);
  const eff = base * scaleOk;
  // v3.10：SVG 表盘类的「容器 0 高度」问题改由 CSS 的 aspect-ratio 解决
  // （见 card-mode-styles.js 的 .pv-rc-ring/.pv-rp-ring/.pv-gl-dial），不在这里硬塞高度——
  // 实测内联 height 会破坏 yearGrid 的格阵自适应（参考尺寸下 4 处子元素越界）。
  // 有实测几何（真实卡片/配置预览）或显式缩放时才内联字号；两者都没有（样式条小预览）交给 CSS 基准
  const inlineStyle = eff && (geo || scaleOk !== 1) ? `font-size:${eff.toFixed(2)}px` : '';
  if (!o.singleRow) return body;
  // v2.7：整卡装饰层（按尺寸自动加顶栏/底栏/纹理）已撤回 —— 版面差异改由用户点选的
  // 「显示样式」（SINGLE_CONTENTS 里的 chip）决定，外壳只负责尺寸类名与预览缩放
  // v3.15 铁律（真实面板 CDP 实测抓到的静默失败）：**插值必须放在引号属性值里**。
  // 这里原是 <div class="${cls}"${inline}>——插值落在「标签内、引号外」，lit 把它当
  // ElementPart（只认 styleMap/classMap 等 directive），普通字符串**静默丢弃**：
  // 拟合字号从未进过 DOM，.pv-single 吃 CSS 兜底 16px → 1×1「十六」2.8em×16px=91px 宽
  // 把 44px 盒子撑爆裁成「十」。本地预览/审计全是字符串拼接渲染，天然绕过此坑
  // →「脚本全过」≠「用户看得到」。回归门禁：scripts/test-lit-commit.mjs（真 lit + 真浏览器）。
  return html`<div class="${cls}" style="${inlineStyle}">${body}</div>`;
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
    ${laid.map((b, bi) => {
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
    // v3.54：节日族（节日/节气/距放假/最近日程）在高块 rows≥2 不加 pv-tight —— 1×N 窄高块会隐藏「天后/下个节日」
    const feFam = ['festival', 'solarTerm', 'holidayGap', 'recent'].includes(b.s);
    const tight = u < 10 && !(feFam && b.span.rows >= 2);
    const cls = `${b.c === 'blank' ? 'pv-block pv-blank' : 'pv-block'}${tight ? ' pv-tight' : ''}`;
    return html`<div
        class="${cls}"
        style="left:${pct(b.pos.col, grid.cols)};top:${pct(b.pos.row, grid.rows)};width:${pct(b.span.cols, grid.cols)};height:${pct(b.span.rows, grid.rows)};font-size:${u.toFixed(1)}px;z-index:${bi + 1};opacity:0.9"
      >${renderInfoBlockInner({
    ...o, content: b.c, style: b.s, span: b.span, opts, availW, availH, tall, small, flat, singleDays,
    // v3.3：窄块（宽 < 高）即使没到 2 倍，日期串也会被挤成三行 —— 显式两行，避免与预览观感不一致
    narrow: blockW < blockH,
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
    occupied, isFull, singleLine, noUnits, showSchedule, onToggleShowSchedule, showHoliday, onToggleShowHoliday,
    alignLocked,
    onPick, onResize, onClose,
  } = o;
  const tr = (key, vars) => (typeof o.t === 'function' ? o.t(key, vars) : null);
  const onFull = o.onFull || (() => {});
  const onToggleSingleLine = o.onToggleSingleLine || (() => {});
  const onToggleNoUnits = o.onToggleNoUnits || (() => {});
  const onUnlock = o.onUnlock || (() => {});
  const locked = { h: !!(alignLocked && alignLocked.h), v: !!(alignLocked && alignLocked.v) };
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
        ${singleLine === null || singleLine === undefined ? '' : toggle(isZh ? '单行显示' : 'One line', !!singleLine, () => onToggleSingleLine(), null, false, true)}
        ${noUnits === null || noUnits === undefined ? '' : toggle(isZh ? '简约显示' : 'Compact', !!noUnits, () => onToggleNoUnits(), null, false, true, isZh ? '简约显示，隐藏年/月/日单位' : 'Compact — hides year/month/day labels')}
        ${isFull ? html`<button class="se-reset" @click=${onFull}>FULL</button>` : ''}
        ${showSchedule === null || showSchedule === undefined ? '' : html`<button class="se-reset ${showSchedule ? 'on' : ''}" style="${showSchedule ? `background:${theme};color:#fff;border-color:${theme}` : ''}" @click=${() => onToggleShowSchedule()}>${isZh ? '显示日程' : 'Schedules'}</button>`}
        ${showHoliday === null || showHoliday === undefined ? '' : html`<button class="se-reset ${showHoliday ? 'on' : ''}" style="${showHoliday ? `background:${theme};color:#fff;border-color:${theme}` : ''}" @click=${() => onToggleShowHoliday()}>${isZh ? '显示节假日' : 'Holidays'}</button>`}
      </div>
      ${target ? '' : html`<div class="se-warn">${isZh
    ? `当前放不下：${sizeLabel} 已无空位，请缩小占格或调整其他单元`
    : `No room left on ${sizeLabel} — shrink this unit or others`}</div>`}
    </div>
  `;
}
