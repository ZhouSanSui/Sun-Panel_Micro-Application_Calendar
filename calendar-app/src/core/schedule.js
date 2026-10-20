/**
 * 日程计算模块
 * 四种类型：event(日程) / birthday(生日) / anniversary(纪念日) / countdown(倒数日)
 * 年循环：birthday/anniversary/countdown 支持公历或农历年循环
 */
import { diffDays, formatDate, parseDate } from './date-utils.js';
import cd from 'chinese-days';
import { lunarToSolar } from './cd-adapter.js';

/** 日程类型元数据 */
export const SCHEDULE_TYPES = {
  event: { icon: '📅', colors: ['blue', 'green', 'teal', 'purple', 'pink', 'orange', 'yellow', 'red'] },
  birthday: { icon: '🎂', colors: ['red', 'pink', 'orange', 'purple'] },
  anniversary: { icon: '💖', colors: ['pink', 'red', 'purple', 'orange'] },
  countdown: { icon: '⏳', colors: ['orange', 'blue', 'teal', 'purple', 'green'] },
};

/**
 * 导入时的默认配色（用户约定：日程红 / 生日橙 / 纪念日黄 / 倒数日绿）。
 * 数据自带 color 时仍优先沿用自带值。
 */
export const IMPORT_DEFAULT_COLORS = {
  event: 'red',
  birthday: 'orange',
  anniversary: 'yellow',
  countdown: 'green',
};

/**
 * 计算年循环项的下一次发生日期
 * @param {Object} item 日程项（需含 date, lunar）
 * @param {Date} fromDate 从哪一天开始找（通常为今天）
 * @returns {{dateStr:string, date:Date, years:number}|null} years=已循环年数
 */
export function getNextOccurrence(item, fromDate = new Date()) {
  if (!item?.date) return null;
  const fromStr = formatDate(fromDate);
  const ref = parseDate(item.date);

  if (item.type === 'event' || (item.type === 'countdown' && item.yearly === false)) {
    // 日程：一次性，不循环；倒数日关闭年循环时为固定目标日
    if (item.date >= fromStr) return { dateStr: item.date, date: ref, years: 0 };
    return null;
  }

  // 年循环项（公历）
  if (!item.lunar) {
    for (let y = fromDate.getFullYear(); y <= fromDate.getFullYear() + 2; y++) {
      // 2 月 29 日特例：非闰年落到 2 月 28 日
      const m = ref.getMonth();
      let d = ref.getDate();
      if (m === 1 && d === 29 && !isLeapYear(y)) d = 28;
      const candidate = new Date(y, m, d);
      const candStr = formatDate(candidate);
      if (candStr >= fromStr) {
        return { dateStr: candStr, date: candidate, years: y - ref.getFullYear() };
      }
    }
    return null;
  }

  // 年循环项（农历）：从参考公历日期提取农历月日，逐年反推公历
  let lm, ld, leap = false;
  try {
    const lunarRef = cd.getLunarDate(item.date);
    lm = lunarRef.lunarMon;
    ld = lunarRef.lunarDay;
    leap = !!lunarRef.isLeap;
  } catch {
    return null;
  }
  for (let y = fromDate.getFullYear(); y <= fromDate.getFullYear() + 3; y++) {
    const candStr = lunarToSolar(`${y}-${String(lm).padStart(2, '0')}-${String(ld).padStart(2, '0')}`, leap);
    if (candStr && candStr >= fromStr) {
      return { dateStr: candStr, date: parseDate(candStr), years: y - ref.getFullYear() };
    }
  }
  return null;
}

/** 闰年判断 */
function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/**
 * 生成日程时间轴（包含已过去的发生记录），用于「日程」视图上下滑动浏览
 * @param {Array} schedules 全部日程
 * @param {Date} now 当前日期
 * @param {number} backYears 向前回溯年数
 * @param {number} forwardYears 向后预取年数
 * @returns {Array<{item, occurrence, days}>} 按日期升序
 */
export function getScheduleTimeline(schedules, now = new Date(), backYears = 3, forwardYears = 5) {
  const out = [];
  const centerYear = now.getFullYear();
  for (const item of schedules) {
    if (!item?.date) continue;
    const ref = parseDate(item.date);
    // 一次性：日程 / 关闭年循环的倒数日
    if (item.type === 'event' || (item.type === 'countdown' && item.yearly === false)) {
      out.push({
        item,
        occurrence: { dateStr: item.date, date: ref, years: 0 },
        days: diffDays(ref, now),
      });
      continue;
    }
    let leap = false;
    let lm = 0;
    let ld = 0;
    if (item.lunar) {
      try {
        const l = cd.getLunarDate(item.date);
        lm = l.lunarMon;
        ld = l.lunarDay;
        leap = !!l.isLeap;
      } catch {
        continue;
      }
    }
    const rm = ref.getMonth();
    const rd = ref.getDate();
    for (let y = centerYear - backYears; y <= centerYear + forwardYears; y++) {
      let cand = null;
      if (item.lunar) {
        cand = lunarToSolar(`${y}-${String(lm).padStart(2, '0')}-${String(ld).padStart(2, '0')}`, leap);
      } else {
        let d = rd;
        if (rm === 1 && d === 29 && !isLeapYear(y)) d = 28;
        cand = formatDate(new Date(y, rm, d));
      }
      if (cand && /^\d{4}-\d{2}-\d{2}$/.test(cand)) {
        const cdDate = parseDate(cand);
        out.push({
          item,
          occurrence: { dateStr: cand, date: cdDate, years: y - ref.getFullYear() },
          days: diffDays(cdDate, now),
        });
      }
    }
  }
  out.sort((a, b) => (
    a.occurrence.dateStr.localeCompare(b.occurrence.dateStr)
    || (a.item.time || '').localeCompare(b.item.time || '')
  ));
  return out;
}

/**
 * 获取某天的日程列表（含当天一次性日程 + 当天生效的年循环项）
 * @param {Array} schedules 全部日程
 * @param {string} dateStr 'YYYY-MM-DD'
 * @returns {Array} 当天日程（附带 occurrence 信息）
 */
export function getSchedulesOfDay(schedules, dateStr) {
  const result = [];
  const date = parseDate(dateStr);
  for (const item of schedules) {
    if (item.type === 'event') {
      if (item.date === dateStr) {
        result.push({ item, occurrence: { dateStr, date, years: 0 } });
      }
      continue;
    }
    const next = getNextOccurrence(item, date);
    if (next && next.dateStr === dateStr) {
      result.push({ item, occurrence: next });
    }
  }
  // 按时间排序，无时间的排后面
  result.sort((a, b) => {
    const ta = a.item.time || '99:99';
    const tb = b.item.time || '99:99';
    return ta.localeCompare(tb);
  });
  return result;
}

/**
 * 获取最近的前 N 个日程（跨全部类型，按日期升序）
 * @returns {Array<{item, occurrence}>}
 */
export function getUpcoming(schedules, fromDate = new Date(), limit = 5, withinDays = 365) {
  const list = [];
  for (const item of schedules) {
    const next = getNextOccurrence(item, fromDate);
    if (!next) continue;
    const days = diffDays(next.date, fromDate);
    if (days < 0 || days > withinDays) continue;
    list.push({ item, occurrence: next, days });
  }
  list.sort((a, b) => a.days - b.days || (a.item.time || '').localeCompare(b.item.time || ''));
  return list.slice(0, limit);
}

/** 按月视图聚合：dateStr → items[]（含跨天循环项） */
export function getMonthScheduleMap(schedules, year, month) {
  const map = new Map();
  const total = new Date(year, month, 0).getDate();
  for (let d = 1; d <= total; d++) {
    const dateStr = formatDate(new Date(year, month - 1, d));
    const items = getSchedulesOfDay(schedules, dateStr);
    if (items.length > 0) map.set(dateStr, items);
  }
  return map;
}

/**
 * 日程展示文案（中英双语）
 * @param {string} lang 'zh' | 'en'
 * @returns {{title:string, sub:string, badge:string, lunarMD:string}}
 */
export function describeSchedule(item, occurrence, today = new Date(), lang = 'zh') {
  const zh = lang !== 'en';
  const days = diffDays(occurrence.date, today);
  const title = item.title || '';
  let lunarMD = '';
  if (item.lunar) {
    try {
      const l = cd.getLunarDate(item.date);
      lunarMD = zh
        ? `农历${l.isLeap ? '闰' : ''}${l.lunarMonCN}${l.lunarDayCN}`
        : `Lunar ${l.isLeap ? 'Leap ' : ''}${l.lunarMon}/${l.lunarDay}`;
    } catch { /* ignore */ }
  }

  if (item.type === 'birthday') {
    const age = occurrence.years;
    return {
      title,
      sub: days === 0 ? (zh ? '今天生日' : 'Birthday today') : (zh ? `${days} 天后` : `in ${days} days`),
      badge: age > 0 ? (zh ? `${age + 1} 岁` : `${age + 1} yrs`) : '',
      lunarMD,
    };
  }
  if (item.type === 'anniversary') {
    return {
      title,
      sub: days === 0 ? (zh ? '今天纪念日' : 'Anniversary today') : (zh ? `${days} 天后` : `in ${days} days`),
      badge: occurrence.years > 0 ? (zh ? `第 ${occurrence.years + 1} 年` : `Year ${occurrence.years + 1}`) : '',
      lunarMD,
    };
  }
  if (item.type === 'countdown') {
    if (item.yearly === false) {
      // 固定倒数日：目标可能是过去
      const diff = diffDays(parseDate(item.date), today);
      if (diff > 0) return { title, sub: zh ? `还有 ${diff} 天` : `${diff} days left`, badge: '', lunarMD };
      if (diff === 0) return { title, sub: zh ? '就是今天' : 'Today', badge: '', lunarMD };
      return { title, sub: zh ? `已过去 ${-diff} 天` : `${-diff} days ago`, badge: '', lunarMD };
    }
    return {
      title,
      sub: days === 0 ? (zh ? '就在今天' : 'Today') : (zh ? `还有 ${days} 天` : `${days} days left`),
      badge: occurrence.years > 0 ? (zh ? `第 ${occurrence.years + 1} 次` : `No.${occurrence.years + 1}`) : '',
      lunarMD,
    };
  }
  // event
  return {
    title,
    sub: item.time ? `${occurrence.dateStr} ${item.time}` : occurrence.dateStr,
    badge: days === 0 ? (zh ? '今天' : 'Today') : '',
    lunarMD,
  };
}

/** 校验并补全日程字段（创建/导入时） */
export function normalizeSchedule(raw, lang = 'zh') {
  if (!raw || typeof raw.title !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date || '')) return null;
  const type = ['event', 'birthday', 'anniversary', 'countdown'].includes(raw.type) ? raw.type : 'event';
  const lunar = type !== 'event' ? !!raw.lunar : false;
  return {
    type,
    title: raw.title.trim().slice(0, 60) || (lang === 'en' ? 'Untitled' : '未命名'),
    date: raw.date,
    lunar,
    yearly: type === 'countdown' ? (raw.yearly === false ? false : true) : true,
    time: type === 'event' && /^\d{2}:\d{2}(:\d{2})?$/.test(raw.time || '') ? raw.time : null,
    note: typeof raw.note === 'string' ? raw.note.slice(0, 300) : '',
    color: typeof raw.color === 'string' ? raw.color : 'red',
  };
}

// ---------- 导入用：宽松规整（兼容第三方 JSON / ICS 解析结果） ----------

/** 中文农历月名 → 月数 */
const LUNAR_MONTH_CN = { '正': 1, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '冬': 11, '腊': 12 };
const CN_NUM = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };

/** 农历日中文 → 日数（初一…初十 / 十一…十九 / 二十 / 廿一…廿九 / 三十） */
function parseLunarDayCN(s) {
  if (!s) return null;
  if (s.startsWith('初')) {
    const r = s.slice(1);
    return r === '十' ? 10 : (CN_NUM[r] ?? null);
  }
  if (s.startsWith('三十')) return 30;
  if (s.startsWith('二十')) {
    const r = s.slice(2);
    return r ? 20 + (CN_NUM[r] ?? 0) : 20;
  }
  if (s.startsWith('廿')) {
    const r = s.slice(1);
    return r ? 20 + (CN_NUM[r] ?? 0) : 20;
  }
  if (s.startsWith('十')) {
    const r = s.slice(1);
    return r ? 10 + (CN_NUM[r] ?? 0) : 10;
  }
  return CN_NUM[s] ?? null;
}

/** '农历九月初十' / '闰八月十五' → { mon, day, leap }，失败返回 null */
function parseLunarMD(text) {
  if (typeof text !== 'string') return null;
  const leap = /闰/.test(text);
  const body = text.replace(/\s/g, '').replace(/农历/g, '').replace(/^闰/, '');
  const mi = body.indexOf('月');
  if (mi < 0) return null;
  const mon = LUNAR_MONTH_CN[body.slice(0, mi)];
  const day = parseLunarDayCN(body.slice(mi + 1));
  if (!mon || !day) return null;
  return { mon, day, leap };
}

/** 任意日期串 → 'YYYY-MM-DD'（支持 2026-1-5 / 2026/1/5 / 20260105），失败返回 null */
function toDateStr(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return formatDate(v);
  if (typeof v !== 'string') return null;
  const s = v.trim();
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);
  if (!m) m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (!m) return null;
  const y = +m[1];
  const mo = +m[2];
  const d = +m[3];
  const probe = new Date(y, mo - 1, d);
  if (probe.getFullYear() !== y || probe.getMonth() !== mo - 1 || probe.getDate() !== d) return null;
  return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 'HH:MM' / 'H:MM:SS' → 'HH:MM'，无效返回 null */
function toTimeStr(v) {
  if (typeof v !== 'string') return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(v.trim());
  if (!m) return null;
  const h = +m[1];
  const mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`;
}

/** 第三方类型描述 → 应用四类型；无法识别返回 null */
function mapScheduleType(t) {
  if (typeof t !== 'string') return null;
  const v = t.trim().toLowerCase();
  if (['event', 'birthday', 'anniversary', 'countdown'].includes(v)) return v;
  if (/农历生日|生日|诞辰|birth/.test(v)) return 'birthday';
  if (/农历/.test(v)) return 'anniversary'; // 农历纪念日
  if (/纪念|周年|anniversar/.test(v)) return 'anniversary';
  if (/倒数|倒计时|countdown/.test(v)) return 'countdown';
  if (/日程|工作|健康|社交|学习|生活|提醒|其他|event|schedule|task|todo|meeting/.test(v)) return 'event';
  return null;
}

/**
 * 导入用宽松规整：把第三方 JSON / ICS 解析结果映射为应用日程模型。
 * - 兼容中文/英文类型名、startTime/endTime、repeat、extra（birthYear/lunarDate…）
 * - repeat「每年」→ 年循环；「每周/每月/每天/每半年」→ 按单次导入并计 flattened
 * - 农历项结合 extra.lunarDate + birthYear/anniversaryYear 反推参考公历日期
 * @returns {{item:Object, flattened:boolean}|null}
 */
export function normalizeImportedSchedule(raw, lang = 'zh') {
  if (!raw || typeof raw !== 'object') return null;
  const zh = lang !== 'en';
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const dateStr = toDateStr(raw.date);
  if (!title || !dateStr) return null;

  const extra = raw.extra && typeof raw.extra === 'object' ? raw.extra : {};
  let type = mapScheduleType(raw.type) || 'event';
  const lunarHint = /农历|lunar/i.test(String(raw.type || ''))
    || /农历|lunar/i.test(String(extra.lunarDate || ''))
    || extra.calendar === '农历'
    || raw.lunar === true;
  const lunar = type !== 'event' ? !!lunarHint : false;

  // 重复规则 → 年循环语义
  const repeat = typeof raw.repeat === 'string' ? raw.repeat : '';
  const yearlyRepeat = /每年|yearly|annual/i.test(repeat);
  const flattenRepeat = /每周|每月|每天|每半年|weekly|monthly|daily|semiannual/i.test(repeat);
  let flattened = false;
  if (yearlyRepeat && type === 'event') {
    type = 'anniversary'; // 年循环必须落在非 event 类型上
  }
  if (flattenRepeat) {
    flattened = true;
    if (type !== 'event') type = 'event'; // 不支持的重复规则按单次日程导入
  }

  // 参考日期：优先用出生/纪念年份还原，让「N 岁 / 第 N 年」徽标准确
  let finalDate = dateStr;
  const baseYear = Number(extra.birthYear || extra.anniversaryYear) || null;
  if (type !== 'event') {
    if (lunar) {
      const lunarMD = parseLunarMD(extra.lunarDate);
      if (lunarMD && baseYear && baseYear >= 1900 && baseYear <= 2100) {
        const solar = lunarToSolar(`${baseYear}-${String(lunarMD.mon).padStart(2, '0')}-${String(lunarMD.day).padStart(2, '0')}`, lunarMD.leap);
        if (solar) finalDate = solar;
      }
    } else if (baseYear && baseYear >= 1900 && baseYear <= 2100) {
      finalDate = `${baseYear}-${dateStr.slice(5)}`;
    }
  }

  // 备注：description / location / note 合并
  const noteParts = [];
  if (typeof raw.description === 'string' && raw.description.trim()) noteParts.push(raw.description.trim());
  if (typeof raw.location === 'string' && raw.location.trim()) {
    noteParts.push(zh ? `地点：${raw.location.trim()}` : `Location: ${raw.location.trim()}`);
  }
  if (typeof raw.note === 'string' && raw.note.trim()) noteParts.push(raw.note.trim());
  if (typeof extra.note === 'string' && extra.note.trim() && !noteParts.includes(extra.note.trim())) {
    noteParts.push(extra.note.trim());
  }

  const item = {
    type,
    title: title.slice(0, 60) || (zh ? '未命名' : 'Untitled'),
    date: finalDate,
    lunar,
    yearly: type === 'countdown' ? (raw.yearly === false ? false : true) : true,
    time: type === 'event' ? toTimeStr(raw.startTime || raw.time) : null,
    note: noteParts.join('\n').slice(0, 300),
    color: (typeof raw.color === 'string' && raw.color)
      ? raw.color
      : (IMPORT_DEFAULT_COLORS[type] || SCHEDULE_TYPES[type].colors[0]),
  };
  if (typeof raw.id === 'string' && raw.id) item.id = raw.id;
  return { item, flattened };
}

/**
 * 列表规整（导入 / 读取自愈）：逐项宽松规整，丢弃无效项。
 * 保留原始 id（若有），供存储层复用。
 */
export function sanitizeScheduleList(list, lang = 'zh') {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const r = normalizeImportedSchedule(raw, lang);
    if (r) out.push(r.item);
  }
  return out;
}

/** 快速体检：是否为应用原生形态（用于 init 自愈判断，避免无谓落盘） */
function isValidNativeShape(s) {
  return !!s
    && typeof s === 'object'
    && ['event', 'birthday', 'anniversary', 'countdown'].includes(s.type)
    && typeof s.title === 'string'
    && !!s.title
    && /^\d{4}-\d{2}-\d{2}$/.test(s.date || '');
}

/** 列表是否需要自愈（存在非原生形态项） */
export function scheduleListNeedsHeal(list) {
  return Array.isArray(list) && list.some((s) => !isValidNativeShape(s));
}
