/**
 * ICS / VCS（iCalendar / vCalendar）解析与序列化
 *
 * 解析兼容：
 * - 标准 ICS：BEGIN:VCALENDAR 包装、VERSION:2.0、RRULE
 * - 用户样本 VCS：裸 VEVENT 流（无 VCALENDAR 包装）、RDATE 逗号分隔日期列表、
 *   SUMMARY;ENCODING=QUOTED-PRINTABLE（UTF-8 QP 编码中文）
 * - 通用：行折叠（RFC5545）、QP 软换行、\: \; \, \n 转义、VALUE=DATE / DATE-TIME（含 Z）
 *
 * 解析结果经 schedule.js 的 normalizeImportedSchedule 规整为应用日程模型。
 * 序列化：variant 'ics' = VERSION:2.0 + UTF-8 明文；'vcs' = VERSION:1.0 + QUOTED-PRINTABLE。
 */
import cd from 'chinese-days';
import { formatDate } from './date-utils.js';
import { normalizeImportedSchedule } from './schedule.js';

// ---------- 底层：行处理 ----------

/** 去 BOM、统一换行、展开折叠行（含 QP 软换行 `=`） */
function unfoldLines(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  for (const line of raw) {
    if (!line) continue;
    const first = line[0];
    if (out.length && (first === ' ' || first === '\t')) {
      out[out.length - 1] += line.slice(1); // RFC5545：去掉 CRLF + 紧随的一个空白
    } else if (out.length && out[out.length - 1].endsWith('=')) {
      out[out.length - 1] = out[out.length - 1].slice(0, -1) + line; // QP 软换行
    } else {
      out.push(line);
    }
  }
  return out;
}

/** 属性行 → { name, params, value }；value 保持原样（含 QP 编码） */
function parseProp(line) {
  const i = line.indexOf(':');
  if (i < 0) return null;
  const segs = line.slice(0, i).split(';');
  const name = segs[0].trim().toUpperCase();
  if (!name) return null;
  const params = {};
  for (const seg of segs.slice(1)) {
    const eq = seg.indexOf('=');
    if (eq < 0) continue;
    const k = seg.slice(0, eq).trim().toUpperCase();
    const v = seg.slice(eq + 1).trim().replace(/^"(.*)"$/, '$1');
    if (k) params[k] = v;
  }
  return { name, params, value: line.slice(i + 1) };
}

/** QUOTED-PRINTABLE 解码（字节级，按 UTF-8 解释） */
function decodeQuotedPrintable(s) {
  const bytes = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '=') {
      const hex = s.substr(i + 1, 2);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    const code = s.codePointAt(i);
    bytes.push(code > 0xFF ? 0x3F : code); // 非常规字节按 '?' 处理
  }
  try {
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  } catch {
    return s;
  }
}

/** 文本属性值：QP / BASE64 解码 + iCal 转义还原 */
function decodeText(value, params) {
  const enc = (params.ENCODING || '').toUpperCase();
  if (enc === 'QUOTED-PRINTABLE') return decodeQuotedPrintable(value);
  if (enc === 'BASE64' || enc === 'B') {
    try {
      const bin = atob(value.replace(/\s+/g, ''));
      return new TextDecoder('utf-8').decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
    } catch { /* 落到通用处理 */ }
  }
  return value
    .replace(/\\[nN]/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/** '19961010' / '19961010T012727Z' → { date:'YYYY-MM-DD', time:'HH:MM'|null } */
function parseDateValue(raw) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(String(raw).trim());
  if (!m) return null;
  const y = +m[1];
  const mo = +m[2];
  const dy = +m[3];
  if (m[7]) {
    // UTC → 本地时区（应用内日期均为本地）
    const d = new Date(Date.UTC(y, mo - 1, dy, +m[4], +m[5], +(m[6] || 0)));
    if (Number.isNaN(d.getTime())) return null;
    return { date: formatDate(d), time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}` };
  }
  const probe = new Date(y, mo - 1, dy);
  if (probe.getFullYear() !== y || probe.getMonth() !== mo - 1 || probe.getDate() !== dy) return null;
  return { date: `${m[1]}-${m[2]}-${m[3]}`, time: m[4] ? `${m[4]}:${m[5]}` : null };
}

/** RDATE 值 → [{date,time}]（支持逗号列表与 PERIOD 取值） */
function parseDateList(value) {
  const out = [];
  for (const part of String(value).split(',')) {
    const d = parseDateValue(part.trim().split('/')[0]);
    if (d) out.push(d);
  }
  return out;
}

/** RRULE 值 → { FREQ, INTERVAL, ... } */
function parseRRule(value) {
  const kv = {};
  for (const seg of String(value).split(';')) {
    const eq = seg.indexOf('=');
    if (eq > 0) kv[seg.slice(0, eq).trim().toUpperCase()] = seg.slice(eq + 1).trim();
  }
  return kv;
}

/** 日期集合的公历月日是否一致 */
function sameSolarMD(list) {
  return new Set(list.map((d) => d.date.slice(5))).size === 1;
}

/** 单日期的农历月日键（闰月加 L 前缀；失败返回 null） */
function lunarKey(d) {
  try {
    const l = cd.getLunarDate(d.date);
    return `${l.isLeap ? 'L' : ''}${l.lunarMon}-${l.lunarDay}`;
  } catch {
    return null;
  }
}

/**
 * 多数日期共有的农历月日键（≥70% 视为规律）。
 * 容忍个别偏移：用户样本中存在首日 +1 天的情况（9/10 一致）。
 */
function majorityLunarMD(list, minRatio = 0.7) {
  const counts = new Map();
  let n = 0;
  for (const d of list) {
    const k = lunarKey(d);
    if (!k) continue;
    counts.set(k, (counts.get(k) || 0) + 1);
    n += 1;
  }
  if (!n) return null;
  let best = null;
  let bestN = 0;
  for (const [k, c] of counts) {
    if (c > bestN) {
      best = k;
      bestN = c;
    }
  }
  return bestN / n >= minRatio ? best : null;
}

/** 收集所有 VEVENT 属性组（忽略 VCALENDAR 包装与 VALARM 内部属性） */
function collectEvents(text) {
  const events = [];
  let cur = null;
  let inAlarm = false;
  for (const line of unfoldLines(text)) {
    const prop = parseProp(line);
    if (!prop) continue;
    const upper = prop.value.trim().toUpperCase();
    if (prop.name === 'BEGIN') {
      if (upper === 'VEVENT') cur = [];
      else if (upper === 'VALARM') inAlarm = true;
      continue;
    }
    if (prop.name === 'END') {
      if (upper === 'VEVENT' && cur) {
        events.push(cur);
        cur = null;
      } else if (upper === 'VALARM') {
        inAlarm = false;
      }
      continue;
    }
    if (cur && !inAlarm) cur.push(prop);
  }
  return events;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

// ---------- 解析：ICS/VCS → 应用日程 ----------

/**
 * 解析 ICS/VCS 文本
 * @param {string} text 文件内容
 * @param {string} lang 'zh' | 'en'（仅影响缺省标题）
 * @returns {{schedules:Array, flattened:number, skipped:number}}
 *   schedules：应用日程模型数组（未分配 id）；flattened：因重复规则不支持而按单次导入的条数
 */
export function parseICalToSchedules(text, lang = 'zh') {
  const events = collectEvents(text);
  const schedules = [];
  let flattened = 0;
  let skipped = 0;

  for (const props of events) {
    const get = (name) => props.find((p) => p.name === name);
    const dtstartProp = get('DTSTART');
    const dtstart = dtstartProp ? parseDateValue(dtstartProp.value) : null;
    if (!dtstart) {
      skipped++;
      continue;
    }
    const summaryProp = get('SUMMARY');
    const summary = summaryProp ? decodeText(summaryProp.value, summaryProp.params) : '';
    const descProp = get('DESCRIPTION');
    const description = descProp ? decodeText(descProp.value, descProp.params) : '';
    const locProp = get('LOCATION');
    const location = locProp ? decodeText(locProp.value, locProp.params) : '';
    const rdateProp = get('RDATE');
    const rdates = rdateProp ? parseDateList(rdateProp.value) : [];
    const rruleProp = get('RRULE');
    const rrule = rruleProp ? parseRRule(rruleProp.value) : null;
    const freq = rrule?.FREQ;
    const interval = Number(rrule?.INTERVAL) || 1;

    let yearly = false;
    let lunar = false;
    let date = dtstart.date;
    let flatten = false;

    if (freq === 'YEARLY' && interval === 1) {
      yearly = true;
    } else if (freq === 'WEEKLY' || freq === 'MONTHLY' || freq === 'DAILY' || (freq === 'YEARLY' && interval > 1)) {
      flatten = true;
    } else if (rdates.length >= 2) {
      // 无 RRULE 但 RDATE 跨多个年份 → 年循环集合（用户样本用法）
      const years = new Set(rdates.map((d) => d.date.slice(0, 4)));
      if (years.size >= 2) {
        const mdCount = new Set(rdates.map((d) => d.date.slice(5))).size;
        if (mdCount <= 40) {
          yearly = true;
          const all = [dtstart, ...rdates];
          if (sameSolarMD(all)) {
            date = dtstart.date;
          } else {
            // 多数日期农历月日一致 → 农历年循环；参考日期取符合该月日的首个日期
            const modeKey = majorityLunarMD(all);
            if (modeKey) {
              lunar = true;
              const match = all.find((d) => lunarKey(d) === modeKey);
              date = (match || dtstart).date;
            } else {
              date = rdates[0].date;
            }
          }
        } else {
          flatten = true; // 密集日期集合（如按周/按天展开），无法用年循环表达
        }
      }
    }

    if (flatten) flattened++;

    // 组装为「外来原始对象」，复用统一规整逻辑（schedule.js）
    const raw = {
      title: summary,
      date,
      startTime: yearly ? null : dtstart.time,
      type: yearly ? (/生日|诞辰|birth/i.test(summary) ? 'birthday' : 'anniversary') : 'event',
      repeat: yearly ? '每年' : '无',
      lunar,
      description,
      location,
    };
    const out = normalizeImportedSchedule(raw, lang);
    if (!out) {
      skipped++;
      continue;
    }
    schedules.push(out.item);
  }
  return { schedules, flattened, skipped };
}

// ---------- 序列化：应用日程 → ICS/VCS ----------

function toDateValue(dateStr) {
  return String(dateStr || '').replace(/-/g, '');
}

function toDateTimeValue(dateStr, timeStr) {
  const [h = '00', m = '00'] = String(timeStr || '00:00').split(':');
  return `${toDateValue(dateStr)}T${pad2(h)}${pad2(m)}00`;
}

function utcStamp(d) {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}

/** iCal 文本转义 */
function escapeICalText(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/** QUOTED-PRINTABLE 编码（vCal 1.0 文本参数用） */
function encodeQuotedPrintable(s) {
  const bytes = new TextEncoder().encode(String(s));
  let out = '';
  for (const b of bytes) {
    if (b === 0x3D || b < 0x20 || b > 0x7E) {
      out += `=${b.toString(16).toUpperCase().padStart(2, '0')}`;
    } else {
      out += String.fromCharCode(b);
    }
  }
  return out;
}

/** 文本属性行（按变体选择编码方式） */
function textLine(name, value, isVcs) {
  if (isVcs) {
    return `${name};ENCODING=QUOTED-PRINTABLE;CHARSET=UTF-8:${encodeQuotedPrintable(value)}`;
  }
  return `${name}:${escapeICalText(value)}`;
}

/**
 * 按 RFC5545 折叠行（每行 ≤75 八位组）。
 * 以「原子」为单位折叠，避免切断 QP 的 =XX 三元组。
 */
function foldLine(line) {
  const LIMIT = 74; // 续行还有 1 个前导空格，合计 ≤75
  if (line.length <= LIMIT) return line;
  const atoms = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(line.substr(i + 1, 2))) {
      atoms.push(line.substr(i, 3));
      i += 2;
    } else {
      atoms.push(line[i]);
    }
  }
  const lines = [];
  let cur = '';
  for (const a of atoms) {
    if (cur.length + a.length > LIMIT) {
      lines.push(cur);
      cur = '';
    }
    cur += a;
  }
  if (cur) lines.push(cur);
  return lines.map((l, i) => (i === 0 ? l : ` ${l}`)).join('\r\n');
}

/**
 * 应用日程 → ICS/VCS 文本
 * @param {Array} schedules 日程数组
 * @param {{variant?:'ics'|'vcs'}} opts
 * @returns {string} 文件内容（CRLF 行尾）
 */
export function toICal(schedules, { variant = 'ics' } = {}) {
  const isVcs = variant === 'vcs';
  const lines = ['BEGIN:VCALENDAR'];
  lines.push(isVcs ? 'VERSION:1.0' : 'VERSION:2.0');
  if (!isVcs) {
    lines.push('PRODID:-//zhousansui//Holiday Count Down//CN');
    lines.push('CALSCALE:GREGORIAN');
    lines.push('METHOD:PUBLISH');
  }
  const stamp = utcStamp(new Date());
  let seq = 0;
  for (const s of schedules || []) {
    if (!s || !s.date) continue;
    seq += 1;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${s.id || `s${stamp}${seq}`}@zhousansui-holiday-count-down`);
    lines.push(`DTSTAMP:${stamp}`);
    const yearly = s.type !== 'event' && s.yearly !== false;
    if (s.type === 'event' && s.time) {
      lines.push(`DTSTART:${toDateTimeValue(s.date, s.time)}`);
    } else {
      lines.push('DTSTART;VALUE=DATE:' + toDateValue(s.date));
    }
    if (yearly) lines.push('RRULE:FREQ=YEARLY');
    lines.push(textLine('SUMMARY', s.title || '', isVcs));
    if (s.note) lines.push(textLine('DESCRIPTION', s.note, isVcs));
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
