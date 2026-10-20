/**
 * 日期滚轮选择器数据层（公历 / 农历）
 * 提供三列（年 / 月 / 日）选项、农历中文月日名称、闰月处理与日期互转
 */
import cd from 'chinese-days';
import { lunarToSolar } from './cd-adapter.js';

/** 滚轮可选年份范围（与 chinese-days 支持范围一致 1900-2100） */
export const PICKER_YEAR_MIN = 1900;
export const PICKER_YEAR_MAX = 2100;

/** 农历月份中文名 */
export const LUNAR_MONTH_CN = [
  '正月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '冬月', '腊月',
];

/** 农历日期中文名 */
export const LUNAR_DAY_CN = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十',
];

const EN_MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** 年份列：{value, label} */
export function yearOptions() {
  const list = [];
  for (let y = PICKER_YEAR_MIN; y <= PICKER_YEAR_MAX; y++) {
    list.push({ value: y, label: `${y}` });
  }
  return list;
}

export function clampYear(y) {
  const year = Number(y);
  if (!Number.isFinite(year)) return new Date().getFullYear();
  return Math.min(PICKER_YEAR_MAX, Math.max(PICKER_YEAR_MIN, Math.round(year)));
}

/** 公历月份列 */
export function solarMonthOptions(lang = 'zh') {
  const list = [];
  for (let m = 1; m <= 12; m++) {
    list.push({ value: m, label: lang === 'en' ? EN_MONTH_SHORT[m - 1] : `${m}月` });
  }
  return list;
}

/** 公历日期列（按年月的实际天数） */
export function solarDayOptions(year, month, lang = 'zh') {
  const total = new Date(year, month, 0).getDate();
  const list = [];
  for (let d = 1; d <= total; d++) {
    list.push({ value: d, label: lang === 'en' ? `${d}` : `${d}日` });
  }
  return list;
}

/** 公历某月天数 */
export function daysInSolarMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/** 农历月列（含闰月）：{value, label, leap} */
export function lunarMonthOptions(year) {
  let leapMonth = null;
  let leapMonthCN = `闰${LUNAR_MONTH_CN[0]}`;
  try {
    const info = cd.getYearLeapMonth(year);
    if (info && Number.isFinite(info.leapMonth) && info.leapMonth > 0) {
      leapMonth = info.leapMonth;
      leapMonthCN = info.leapMonthCN || `闰${LUNAR_MONTH_CN[leapMonth - 1]}`;
    }
  } catch { /* ignore */ }

  const list = [];
  for (let m = 1; m <= 12; m++) {
    list.push({ value: m, label: LUNAR_MONTH_CN[m - 1], leap: false });
    if (leapMonth === m) {
      list.push({ value: m, label: leapMonthCN, leap: true });
    }
  }
  return list;
}

/** 农历当月天数（leap=true 时返回闰月天数） */
export function daysInLunarMonth(year, month, leap = false) {
  try {
    if (leap) {
      const info = cd.getYearLeapMonth(year);
      if (info && info.leapMonth === month && Number.isFinite(info.days) && info.days > 0) {
        return info.days;
      }
      return 29;
    }
    const days = cd.monthDays(year, month);
    return Number.isFinite(days) && days > 0 ? days : 29;
  } catch {
    return 29;
  }
}

/** 农历日期列 */
export function lunarDayOptions(year, month, leap = false) {
  const total = daysInLunarMonth(year, month, leap);
  return LUNAR_DAY_CN.slice(0, total).map((label, i) => ({ value: i + 1, label }));
}

/**
 * 农历年月日 → 公历参考日期
 * @returns {string|null} 'YYYY-MM-DD'
 */
export function lunarToSolarDate(year, month, day, leap = false) {
  const res = lunarToSolar(`${year}-${pad2(month)}-${pad2(day)}`, leap);
  return /^\d{4}-\d{2}-\d{2}$/.test(res || '') ? res : null;
}

/** 公历日期 → 公历年月日 */
export function splitSolarDate(dateStr) {
  const [y, m, d] = (dateStr || '').split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return { year: y, month: m, day: d };
}

/**
 * 公历日期 → 农历年月日（用于初始化农历滚轮）
 * @returns {{year:number, month:number, day:number, leap:boolean}|null}
 */
export function solarToLunarParts(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return null;
  try {
    const l = cd.getLunarDate(dateStr);
    if (!l || !Number.isFinite(l.lunarMon)) return null;
    return {
      year: l.lunarYear,
      month: l.lunarMon,
      day: l.lunarDay,
      leap: !!l.isLeap,
    };
  } catch {
    return null;
  }
}

/** 农历月日的可读文本（如 闰四月初八） */
export function lunarPartsText(month, day, leap = false) {
  const m = LUNAR_MONTH_CN[month - 1] || `${month}月`;
  const d = LUNAR_DAY_CN[day - 1] || `${day}`;
  return `${leap ? '闰' : ''}${m}${d}`;
}
