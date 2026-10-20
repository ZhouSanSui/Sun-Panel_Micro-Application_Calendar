/**
 * 聚合高亮信息：下个节假日 / 下个节气 / 临近日程
 */
import { addDays, diffDays, formatDate, parseDate, dayOfYear, yearProgress } from './date-utils.js';
import { getDayInfo, getYearSolarTerms } from './cd-adapter.js';
import { getUpcoming, describeSchedule } from './schedule.js';

/** 下个法定节假日（含名称与放假天数） */
export function getNextHoliday(holidayService, fromDate = new Date(), maxScanDays = 150) {
  if (!holidayService) return null;
  const seen = new Set();
  for (let i = 0; i <= maxScanDays; i++) {
    const d = addDays(fromDate, i);
    const dateStr = formatDate(d);
    const info = holidayService.getHolidayInfo(dateStr);
    if (info?.isOffDay && !seen.has(info.nameZh)) {
      seen.add(info.nameZh);
      return {
        dateStr,
        date: d,
        days: i,
        nameZh: info.nameZh,
        nameEn: info.nameEn,
        holidayDays: info.days,
      };
    }
    // 无数据的年份（未发布）提前终止
    if (!holidayService.getYearData(d.getFullYear()) && d.getMonth() === 0 && d.getDate() === 1) break;
  }
  return null;
}

/** 下个节气 */
export function getNextSolarTerm(fromDate = new Date()) {
  const year = fromDate.getFullYear();
  for (const y of [year, year + 1]) {
    const terms = getYearSolarTerms(y);
    const fromStr = formatDate(fromDate);
    const next = terms.find((t) => t.date >= fromStr);
    if (next) {
      return {
        dateStr: next.date,
        date: parseDate(next.date),
        days: diffDays(parseDate(next.date), fromDate),
        zh: next.zh,
        en: next.en,
      };
    }
  }
  return null;
}

/** 下个节日（农历/公历/现代节日，不含节气与法定节假日） */
export function getNextFestival(fromDate = new Date(), maxScanDays = 400) {
  for (let i = 0; i <= maxScanDays; i++) {
    const d = addDays(fromDate, i);
    const info = getDayInfo(formatDate(d));
    if (info?.festivals?.length) {
      return {
        dateStr: formatDate(d),
        date: d,
        days: i,
        nameZh: info.festivals[0].zh,
        nameEn: info.festivals[0].en,
      };
    }
  }
  return null;
}

/** 临近日程（最近 limit 条） */
export function getNextSchedules(userStore, fromDate = new Date(), limit = 3, withinDays = 90, lang = 'zh') {
  if (!userStore) return [];
  const schedules = userStore.getSchedules();
  const upcoming = getUpcoming(schedules, fromDate, limit, withinDays);
  return upcoming.map(({ item, occurrence, days }) => {
    const desc = describeSchedule(item, occurrence, fromDate, lang);
    return { item, occurrence, days, desc };
  });
}

/**
 * 卡片/主页面统一数据快照
 * @param {string} lang 'zh' | 'en'
 * @returns {{today, dayInfo, nextHoliday, nextSolarTerm, nextSchedules, yearProgress}}
 */
export function getSnapshot(holidayService, userStore, now = new Date(), lang = 'zh') {
  const dayInfo = getDayInfo(formatDate(now));
  return {
    now,
    dayInfo,
    nextHoliday: getNextHoliday(holidayService, now),
    nextSolarTerm: getNextSolarTerm(now),
    nextSchedules: getNextSchedules(userStore, now, 3, 90, lang),
    dayOfYear: dayOfYear(now),
    yearProgress: yearProgress(now),
  };
}
