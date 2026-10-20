/**
 * chinese-days 适配层
 * 统一封装农历、节气、传统节日、公历节日的查询，输出中英文双语信息
 */
import cd from 'chinese-days';
import { formatDate, parseDate } from './date-utils.js';

/** 二十四节气（库 term key → [中文, English]） */
const SOLAR_TERMS = {
  lesser_cold: ['小寒', 'Lesser Cold'],
  greater_cold: ['大寒', 'Greater Cold'],
  the_beginning_of_spring: ['立春', 'Start of Spring'],
  rain_water: ['雨水', 'Rain Water'],
  the_waking_of_insects: ['惊蛰', 'Awakening of Insects'],
  the_spring_equinox: ['春分', 'Spring Equinox'],
  pure_brightness: ['清明', 'Pure Brightness'],
  grain_rain: ['谷雨', 'Grain Rain'],
  the_beginning_of_summer: ['立夏', 'Start of Summer'],
  lesser_fullness_of_grain: ['小满', 'Lesser Fullness'],
  grain_in_beard: ['芒种', 'Grain in Beard'],
  the_summer_solstice: ['夏至', 'Summer Solstice'],
  lesser_heat: ['小暑', 'Lesser Heat'],
  greater_heat: ['大暑', 'Greater Heat'],
  the_beginning_of_autumn: ['立秋', 'Start of Autumn'],
  the_end_of_heat: ['处暑', 'End of Heat'],
  white_dew: ['白露', 'White Dew'],
  the_autumn_equinox: ['秋分', 'Autumn Equinox'],
  code_dew: ['寒露', 'Cold Dew'],
  frost_descent: ['霜降', 'Frost Descent'],
  the_beginning_of_winter: ['立冬', 'Start of Winter'],
  lesser_snow: ['小雪', 'Lesser Snow'],
  greater_snow: ['大雪', 'Greater Snow'],
  the_winter_solstice: ['冬至', 'Winter Solstice'],
};

/** 每月两个节气（顺序） */
const MONTH_TERMS = {
  1: ['lesser_cold', 'greater_cold'],
  2: ['the_beginning_of_spring', 'rain_water'],
  3: ['the_waking_of_insects', 'the_spring_equinox'],
  4: ['pure_brightness', 'grain_rain'],
  5: ['the_beginning_of_summer', 'lesser_fullness_of_grain'],
  6: ['grain_in_beard', 'the_summer_solstice'],
  7: ['lesser_heat', 'greater_heat'],
  8: ['the_beginning_of_autumn', 'the_end_of_heat'],
  9: ['white_dew', 'the_autumn_equinox'],
  10: ['code_dew', 'frost_descent'],
  11: ['the_beginning_of_winter', 'lesser_snow'],
  12: ['greater_snow', 'the_winter_solstice'],
};

/** 主要农历节日（库返回名 → [展示名, English]） */
const LUNAR_FESTIVALS = {
  '除夕': ['除夕', "New Year's Eve"],
  '春节': ['春节', 'Spring Festival'],
  '元宵节': ['元宵节', 'Lantern Festival'],
  '春龙节': ['春龙节', 'Dragon Heads-raising Day'],
  '上巳节': ['上巳节', 'Shangsi Festival'],
  '寒食节': ['寒食节', 'Cold Food Festival'],
  '端午节': ['端午节', 'Dragon Boat Festival'],
  '乞巧节': ['七夕节', 'Qixi Festival'],
  '中元(鬼)节': ['中元节', 'Zhongyuan Festival'],
  '中秋节': ['中秋节', 'Mid-Autumn Festival'],
  '重阳节': ['重阳节', 'Double Ninth Festival'],
  '寒衣节': ['寒衣节', 'Winter Clothing Day'],
  '下元节': ['下元节', 'Xia Yuan Festival'],
  '腊八节': ['腊八节', 'Laba Festival'],
  '祭灶': ['小年', 'Preliminary Eve'],
  '民间送灶': ['小年', 'Preliminary Eve'],
  '官家送灶': ['小年', 'Preliminary Eve'],
  '冬至': null, // 冬至作为节气展示，不重复计入节日
};

/** 公历固定节日 [月, 日, 中文, English] */
const SOLAR_FESTIVALS = [
  [1, 1, '元旦', "New Year's Day"],
  [2, 14, '情人节', "Valentine's Day"],
  [3, 8, '妇女节', "International Women's Day"],
  [3, 12, '植树节', 'Arbor Day'],
  [4, 1, '愚人节', "April Fools' Day"],
  [5, 1, '劳动节', 'International Workers\' Day'],
  [5, 4, '青年节', 'Youth Day'],
  [5, 12, '护士节', 'International Nurses Day'],
  [6, 1, '儿童节', "Children's Day"],
  [7, 1, '建党节', 'CPC Founding Day'],
  [8, 1, '建军节', 'Army Day'],
  [9, 10, '教师节', "Teachers' Day"],
  [10, 1, '国庆节', 'National Day'],
  [12, 24, '平安夜', 'Christmas Eve'],
  [12, 25, '圣诞节', 'Christmas Day'],
];

/** 计算型节日：返回该年日期 */
const COMPUTED_FESTIVALS = [
  {
    name: '母亲节', en: "Mother's Day",
    calc: (y) => nthWeekdayOfMonth(y, 5, 0, 2), // 5月第2个周日
  },
  {
    name: '父亲节', en: "Father's Day",
    calc: (y) => nthWeekdayOfMonth(y, 6, 0, 3), // 6月第3个周日
  },
  {
    name: '感恩节', en: 'Thanksgiving',
    calc: (y) => nthWeekdayOfMonth(y, 11, 4, 4), // 11月第4个周四
  },
];

/** 某年某月第 n 个星期几的日期 */
function nthWeekdayOfMonth(year, month, weekday, n) {
  const first = new Date(year, month - 1, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month - 1, 1 + offset + (n - 1) * 7);
}

/** 缓存每年节气表：{ '2026': [{date, key, zh, en}] } */
const solarTermYearCache = new Map();

/** 获取某年 24 节气列表 */
export function getYearSolarTerms(year) {
  if (solarTermYearCache.has(year)) return solarTermYearCache.get(year);
  const list = [];
  for (let m = 1; m <= 12; m++) {
    for (const key of MONTH_TERMS[m]) {
      const dateStr = cd.getSolarTermDate(year, m, key);
      if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        list.push({ date: dateStr, key, zh: SOLAR_TERMS[key][0], en: SOLAR_TERMS[key][1] });
      }
    }
  }
  list.sort((a, b) => a.date.localeCompare(b.date));
  solarTermYearCache.set(year, list);
  return list;
}

/** 查询某日期的节气（当天恰为节气则返回） */
export function getSolarTermOfDate(dateStr) {
  const year = Number(dateStr.slice(0, 4));
  return getYearSolarTerms(year).find((t) => t.date === dateStr) || null;
}

/** 查询某日期的农历节日（精选主要节日） */
export function getLunarFestivalsOfDate(dateStr) {
  const festivals = cd.getLunarFestivals(dateStr, dateStr)[0]?.name || [];
  const result = [];
  for (const name of festivals) {
    const mapped = LUNAR_FESTIVALS[name];
    if (mapped) {
      result.push({ zh: mapped[0], en: mapped[1], type: 'lunar' });
    }
  }
  return result;
}

/** 查询某日期的公历节日 */
export function getSolarFestivalsOfDate(dateStr) {
  const d = parseDate(dateStr);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const result = [];
  for (const [fm, fd, zh, en] of SOLAR_FESTIVALS) {
    if (fm === m && fd === day) result.push({ zh, en, type: 'solar' });
  }
  const y = d.getFullYear();
  for (const f of COMPUTED_FESTIVALS) {
    if (formatDate(f.calc(y)) === dateStr) {
      result.push({ zh: f.name, en: f.en, type: 'computed' });
    }
  }
  return result;
}

/**
 * 获取某日期的完整日历信息（不含官方节假日，节假日由 holidayService 提供）
 * @returns {Object} 日期详情
 */
export function getDayInfo(dateStr) {
  const d = parseDate(dateStr);
  const lunar = cd.getLunarDate(dateStr);
  const solarTerm = getSolarTermOfDate(dateStr);
  const festivals = [
    ...getSolarFestivalsOfDate(dateStr),
    ...getLunarFestivalsOfDate(dateStr),
  ];
  return {
    date: dateStr,
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    weekday: d.getDay(),
    isWeekend: d.getDay() === 0 || d.getDay() === 6,
    lunar: {
      year: lunar.lunarYear,
      month: lunar.lunarMon,
      day: lunar.lunarDay,
      isLeap: lunar.isLeap,
      monthCN: lunar.lunarMonCN,
      dayCN: lunar.lunarDayCN,
      zodiac: lunar.zodiac,
      yearCyl: lunar.yearCyl,
      display: `${lunar.isLeap ? '闰' : ''}${lunar.lunarMonCN}${lunar.lunarDayCN}`,
    },
    solarTerm: solarTerm ? { zh: solarTerm.zh, en: solarTerm.en, key: solarTerm.key } : null,
    festivals,
  };
}

/** 农历 → 公历（用于生日/纪念日/倒数日的农历年循环）
 * @param {string} lunarStr 'YYYY-MM-DD'，其中 MM/DD 为农历月/日
 * @param {boolean} isLeap 参考日期是否在闰月
 * @returns {string|null} 公历日期，失败返回 null
 */
export function lunarToSolar(lunarStr, isLeap = false) {
  try {
    const res = cd.getSolarDateFromLunar(lunarStr);
    if (!res) return null;
    // 闰月生日：优先使用闰月日期，无闰月则退回普通月
    const useLeap = isLeap && res.leapMonthDate && /^\d{4}-\d{2}-\d{2}$/.test(res.leapMonthDate);
    const date = useLeap ? res.leapMonthDate : res.date;
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  } catch {
    return null;
  }
}

/** 公历 → 农历信息（快捷方法） */
export function solarToLunar(dateStr) {
  return cd.getLunarDate(dateStr);
}
