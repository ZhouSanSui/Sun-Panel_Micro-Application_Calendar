/**
 * 日期工具函数（纯函数，无副作用）
 */

/** 'YYYY-MM-DD' → Date（本地时区） */
export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Date → 'YYYY-MM-DD'（本地时区，不使用 toISOString 避免时区偏移） */
export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayStr() {
  return formatDate(new Date());
}

/** 加减天数，返回新 Date */
export function addDays(date, days) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date, months) {
  const d = new Date(date.getFullYear(), date.getMonth() + months, 1);
  return d;
}

/** 两个日期相差天数（按天计算，忽略时分秒） */
export function diffDays(a, b) {
  const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((da.getTime() - db.getTime()) / 86400000);
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** 当月天数 */
export function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/** 当月 1 号是星期几（0=周日） */
export function firstDayWeekday(year, month) {
  return new Date(year, month - 1, 1).getDay();
}

/** 生成月份网格（含上下月补位），weekStart: 0=周日 1=周一 */
export function getMonthGrid(year, month, weekStart = 0) {
  const first = firstDayWeekday(year, month);
  const total = daysInMonth(year, month);
  const offset = (first - weekStart + 7) % 7;
  const cells = [];
  // 上月补位
  const prevTotal = daysInMonth(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);
  for (let i = offset - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, -(i + 1) + 1);
    d.setDate(prevTotal - i);
    cells.push({ date: d, inMonth: false });
  }
  for (let day = 1; day <= total; day++) {
    cells.push({ date: new Date(year, month - 1, day), inMonth: true });
  }
  // 下月补位（补满 6 行 42 格或整周）
  let nextDay = 1;
  while (cells.length % 7 !== 0 || (cells.length < 42 && cells.length % 7 === 0 && nextDay <= 7 && cells.length < 35)) {
    cells.push({ date: new Date(year, month, nextDay++), inMonth: false });
    if (cells.length >= 42) break;
  }
  // 若不满 42 格则补齐（固定 6 行视觉更稳定）
  while (cells.length < 42) {
    cells.push({ date: new Date(year, month, nextDay++), inMonth: false });
  }
  return cells;
}

/** 一年中的第几天 */
export function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 1);
  return Math.floor((date.getTime() - start.getTime()) / 86400000) + 1;
}

/** 一年中的第几周（周一为一周起点） */
export function weekOfYear(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

/** 今年剩余百分比 */
export function yearProgress(date) {
  const year = date.getFullYear();
  const start = new Date(year, 0, 1).getTime();
  const end = new Date(year + 1, 0, 1).getTime();
  const now = new Date(year, date.getMonth(), date.getDate()).getTime();
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
}

const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const GAN_PIN = ['Jia', 'Yi', 'Bing', 'Ding', 'Wu', 'Ji', 'Geng', 'Xin', 'Ren', 'Gui'];
const ZHI_PIN = ['Zi', 'Chou', 'Yin', 'Mao', 'Chen', 'Si', 'Wu', 'Wei', 'Shen', 'You', 'Xu', 'Hai'];

/**
 * 干支纪年：以公元 4 年（甲子）为基准循环 60 年。
 * @returns {{zh:string, en:string}} 如 { zh:'丙午', en:'Bingwu' }
 */
export function ganzhiYear(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return { zh: '', en: '' };
  const idx = ((y - 4) % 60 + 60) % 60;
  const g = idx % 10;
  const z = idx % 12;
  return { zh: `${GAN[g]}${ZHI[z]}`, en: `${GAN_PIN[g]}${ZHI_PIN[z]}` };
}

/** 当前时间 'HH:mm:ss' */
export function formatTime(date, hour12 = false) {
  let h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  let suffix = '';
  if (hour12) {
    suffix = h < 12 ? ' AM' : ' PM';
    h = h % 12 || 12;
  }
  return `${String(h).padStart(2, '0')}:${m}:${s}${suffix}`;
}
