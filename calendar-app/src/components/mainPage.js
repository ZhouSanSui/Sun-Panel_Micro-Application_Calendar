/**
 * 日历微应用 - 主页面
 * 年 / 月 / 周 / 日程 / 天气 五视图 + 日程管理 + 全屏设置页
 */
import { SunPanelPageElement } from '@sun-panel/micro-app';
import { html, css } from 'lit';
import { setLocale } from '@sun-panel/micro-app';
import appConfig from '../../config/app.config.js';
import { ensureAppState, getHolidayService, getUserStore, subscribeAppState } from '../core/app-state.js';
import { getDayInfo } from '../core/cd-adapter.js';
import {
  formatDate, parseDate, todayStr, getMonthGrid, addDays, daysInMonth, firstDayWeekday,
  dayOfYear, weekOfYear, diffDays, formatTime, ganzhiYear,
} from '../core/date-utils.js';
import {
  SCHEDULE_TYPES, getSchedulesOfDay, getNextOccurrence, describeSchedule, normalizeSchedule,
  getScheduleTimeline,
} from '../core/schedule.js';
import {
  yearOptions, solarMonthOptions, solarDayOptions, daysInSolarMonth,
  lunarMonthOptions, lunarDayOptions, lunarToSolarDate, splitSolarDate, solarToLunarParts,
} from '../core/picker.js';
import { getNextHoliday, getNextSolarTerm } from '../core/highlights.js';
import {
  cardThemeVisual,
  DISPLAY_MODES, displayContents, contentDef, styleDef, defaultStyleFor,
  sanitizeBlocks,
  gridForSize, layoutBlocks, blocksFit, styleSpanDef, autoLayout,
  blockSpanDef, effectiveSpan, spanBounds, shiftFlatStyle,
  unitAlign, unitOpts, unitId, isFullCard, unitAlignExplicit,
  alignGovernor, applyAlignmentWithReport, layoutSignature, NO_UNITS_DATE_STYLES,
} from '../core/user-store.js';
import { renderInfoBlock, renderBlocksHTML, renderSpanEditor } from '../core/card-mode-render.js';
import {
  APPLE_COLORS, appleStyles, appleUiStyles, appleThemeVars, appleSwitch, appleSegmented,
  appleGroup, appleRow, appleButton, appleSelect,
} from '../core/apple-ui.js';

const WEEK_FULL_ZH = ['日', '一', '二', '三', '四', '五', '六'];
const WEEK_FULL_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_MIN_EN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const EN_MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** 滚轮单项高度（需与 CSS .pk-item height 保持一致） */
const PK_ITEM_H = 36;

/** SunPanel 尺寸为「行×列」；此处映射为预览用的 [列, 行] */
const CARD_SIZE_GRID = {
  '1x1': [1, 1], '1x2': [2, 1], '2x1': [1, 2], '2x2': [2, 2],
  '2x4': [4, 2], '4x4': [4, 4], '1xfull': [4, 1],
};

function pad2(n) {
  return String(n).padStart(2, '0');
}

export class MainPage extends SunPanelPageElement {
  static properties = {
    spCtx: { type: Object, attribute: false },
    now: { type: Object, attribute: false },
    viewMode: { type: String },
    viewYear: { type: Number },
    viewMonth: { type: Number },
    selected: { type: String },
    editor: { type: Object, attribute: false },
    picker: { type: Object, attribute: false },
    settingsOpen: { type: Boolean },
    ioOpen: { type: Boolean },
    scheduleMgrOpen: { type: Boolean },
    cardCfgOpen: { type: Boolean },
    cardCfgSize: { type: String },
    cardCfgPendingContent: { type: String },
    cardCfgPendingStyle: { type: String },
    cardCfgHint: { type: String },
    toast: { type: String },
  };

  onInitialized() {
    this.now = new Date();
    this.viewYear = this.now.getFullYear();
    this.viewMonth = this.now.getMonth() + 1;
    this.selected = todayStr();
    this.viewMode = 'month';
    this.editor = null;
    this.picker = null;
    this.settingsOpen = false;
    this.ioOpen = false;
    this.cardCfgOpen = false;
    this.scheduleMgrOpen = false;
    this._mgrSel = new Set();    // 日程管理页已选 id
    this._mgrConfirm = false;    // 删除二次确认
    this.ioFrom = 'settings';    // 导入导出页入口来源（settings | list）
    this.cardCfgSize = '2x2';
    this.cardCfgPendingContent = null;
    this.cardCfgPendingStyle = null;
    this.cardCfgHint = null;
    this._cardSpanEdit = null; // 占格编辑器：{ idx } | null（主页面「设置 → 显示模式」用）
    this.toast = '';
    this._wheelBusy = false;
    ensureAppState(this.spCtx?.api).then(() => {
      this._unsub = subscribeAppState(() => this.requestUpdate());
      this.requestUpdate();
    });
    const timer = this.spCtx?.api?.timer;
    if (timer?.setInterval) {
      this._timer = timer.setInterval(() => {
        this.now = new Date();
        // 卡片配置拖拽进行中不重渲染（避免 DOM 重建中断拖拽）
        if (this._cardDragIdx == null) this.requestUpdate();
      }, 1000);
    }
  }

  onDisconnected() {
    this._clearWheelTimer();
    if (this._cardCfgHintTimer) {
      clearTimeout(this._cardCfgHintTimer);
      this._cardCfgHintTimer = null;
    }
    if (this._timer != null && this.spCtx?.api?.timer?.clearInterval) {
      this.spCtx.api.timer.clearInterval(this._timer);
      this._timer = null;
    }
    if (this._unsub) { this._unsub(); this._unsub = null; }
  }

  onLanguageChanged() {
    this.requestUpdate();
  }

  // ---------- 工具 ----------

  _isZh() {
    return (this.spCtx?.language || 'zh-CN').toLowerCase().startsWith('zh');
  }

  _lang() {
    return this._isZh() ? 'zh' : 'en';
  }

  _settings() {
    return getUserStore()?.getSettings() || { weekStart: 0, hour12: false, showSeconds: true, themeColor: 'blue' };
  }

  _theme() {
    return APPLE_COLORS[this._settings().themeColor] || APPLE_COLORS.red;
  }

  _schedules() {
    return getUserStore() ? getUserStore().getSchedules() : [];
  }

  _showToast(msg) {
    this.toast = msg;
    const timer = this.spCtx?.api?.timer;
    if (timer?.setTimeout) {
      timer.setTimeout(() => { this.toast = ''; this.requestUpdate(); }, 2400);
    }
    this.requestUpdate();
  }

  _holidayInfo(dateStr) {
    return getHolidayService()?.getHolidayInfo(dateStr) || null;
  }

  /** 指定日期区间内的日程映射：dateStr → [{item, occurrence}] */
  _scheduleMap(fromStr, toStr) {
    const schedules = this._schedules();
    const map = new Map();
    if (!schedules.length) return map;
    const from = parseDate(fromStr);
    const to = parseDate(toStr);
    const list = getScheduleTimeline(schedules, from, 0, Math.max(0, to.getFullYear() - from.getFullYear()));
    for (const row of list) {
      const ds = row.occurrence.dateStr;
      if (ds < fromStr || ds > toStr) continue;
      if (!map.has(ds)) map.set(ds, []);
      map.get(ds).push(row);
    }
    for (const rows of map.values()) {
      rows.sort((a, b) => (a.item.time || '99:99').localeCompare(b.item.time || '99:99'));
    }
    return map;
  }

  // ---------- 视图导航 ----------

  _switchView(mode) {
    this.viewMode = mode;
    if (mode === 'list') this._pendingScrollToday = true;
    if (mode === 'month' || mode === 'week') {
      const d = parseDate(this.selected);
      this.viewYear = d.getFullYear();
      this.viewMonth = d.getMonth() + 1;
    }
    this.requestUpdate();
  }

  _prev() {
    if (this.viewMode === 'year') {
      this.viewYear -= 1;
    } else if (this.viewMode === 'month') {
      const d = new Date(this.viewYear, this.viewMonth - 2, 1);
      this.viewYear = d.getFullYear();
      this.viewMonth = d.getMonth() + 1;
    } else if (this.viewMode === 'week') {
      this._shiftSelected(-7);
    }
    this.requestUpdate();
  }

  _next() {
    if (this.viewMode === 'year') {
      this.viewYear += 1;
    } else if (this.viewMode === 'month') {
      const d = new Date(this.viewYear, this.viewMonth, 1);
      this.viewYear = d.getFullYear();
      this.viewMonth = d.getMonth() + 1;
    } else if (this.viewMode === 'week') {
      this._shiftSelected(7);
    }
    this.requestUpdate();
  }

  _shiftSelected(days) {
    const d = addDays(parseDate(this.selected), days);
    this.selected = formatDate(d);
    this.viewYear = d.getFullYear();
    this.viewMonth = d.getMonth() + 1;
  }

  _goToday() {
    this.now = new Date();
    this.viewYear = this.now.getFullYear();
    this.viewMonth = this.now.getMonth() + 1;
    this.selected = todayStr();
    this.requestUpdate();
  }

  _title() {
    const zh = this._isZh();
    if (this.viewMode === 'year') {
      // 年视图：当前年后附干支年（如「2026年 · 丙午年」）
      const gz = ganzhiYear(this.viewYear);
      const gzTxt = zh ? `${gz.zh}年` : gz.en;
      return gzTxt ? `${this.viewYear}${zh ? '年' : ''} · ${gzTxt}` : `${this.viewYear}${zh ? '年' : ''}`;
    }
    if (this.viewMode === 'month') {
      return zh
        ? `${this.viewYear}年${this.viewMonth}月`
        : new Date(this.viewYear, this.viewMonth - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    if (this.viewMode === 'week') {
      const days = this._weekDates();
      const a = days[0];
      const b = days[days.length - 1];
      if (zh) return `${a.getFullYear()}年${a.getMonth() + 1}月 第 ${weekOfYear(a)} 周`;
      const sameMonth = a.getMonth() === b.getMonth();
      const fmtMonth = (d) => d.toLocaleDateString('en-US', { month: 'long' });
      return sameMonth
        ? `${fmtMonth(a)} ${a.getDate()} – ${b.getDate()}, ${b.getFullYear()}`
        : `${fmtMonth(a)} ${a.getDate()} – ${fmtMonth(b)} ${b.getDate()}`;
    }
    if (this.viewMode === 'list') return this.t('VIEW_SCHEDULE');
    return this.t('VIEW_WEATHER');
  }

  /** 当前选中日期所在周的 7 天 */
  _weekDates() {
    const ws = this._settings().weekStart ?? 0;
    const base = parseDate(this.selected);
    const start = addDays(base, -((base.getDay() - ws + 7) % 7));
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }

  // ---------- 视图：年 ----------

  _renderYearView() {
    const ws = this._settings().weekStart ?? 0;
    const today = todayStr();
    const fromStr = `${this.viewYear}-01-01`;
    const toStr = `${this.viewYear}-12-31`;
    const map = this._scheduleMap(fromStr, toStr);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    return html`
      <div class="card year-card">
        <div class="year-grid">
          ${months.map((m) => {
            const offset = (firstDayWeekday(this.viewYear, m) - ws + 7) % 7;
            const total = daysInMonth(this.viewYear, m);
            const title = this._isZh() ? `${m}月` : EN_MONTH_LONG[m - 1].slice(0, 3);
            return html`
              <button class="year-month" key="ym${m}" @click=${() => { this.viewMonth = m; this.viewMode = 'month'; this.requestUpdate(); }}>
                <div class="ym-title">${title}</div>
                <div class="ym-grid">
                  ${Array.from({ length: offset }, (_, k) => html`<span class="ym-cell empty" key="e${k}"></span>`)}
                  ${Array.from({ length: total }, (_, k) => {
                    const day = k + 1;
                    const ds = `${this.viewYear}-${pad2(m)}-${pad2(day)}`;
                    const isToday = ds === today;
                    const hasEvent = (map.get(ds) || []).length > 0;
                    return html`
                      <span class="ym-cell ${isToday ? 'today' : ''}" key="c${day}" style="${isToday ? `background:${this._theme()}` : ''}">
                        ${hasEvent ? html`<span class="ym-dot" style="${isToday ? 'background:#fff' : `background:${this._theme()}`}"></span>` : ''}
                        <span class="ym-num">${day}</span>
                      </span>
                    `;
                  })}
                </div>
              </button>
            `;
          })}
        </div>
      </div>
    `;
  }

  // ---------- 视图：月 ----------

  _renderWeekdayHeader() {
    const ws = this._settings().weekStart ?? 0;
    const names = [];
    for (let i = 0; i < 7; i++) {
      const idx = (i + ws) % 7;
      names.push(this._isZh() ? WEEK_FULL_ZH[idx] : WEEK_MIN_EN[idx]);
    }
    return html`
      <div class="wd-row">
        ${names.map((n, i) => html`<div class="wd-cell ${(i + ws) % 7 === 0 || (i + ws) % 7 === 6 ? 'weekend' : ''}" key="w${i}">${n}</div>`)}
      </div>
    `;
  }

  _renderMonthView() {
    const cells = getMonthGrid(this.viewYear, this.viewMonth, this._settings().weekStart ?? 0);
    const today = todayStr();
    const firstCell = cells[0].date;
    const lastCell = cells[cells.length - 1].date;
    const map = this._scheduleMap(formatDate(firstCell), formatDate(lastCell));
    return html`
      <div class="card calendar-card grow">
        ${this._renderWeekdayHeader()}
        <div class="month-grid grow">
          ${cells.map((cell, i) => {
            const ds = formatDate(cell.date);
            const info = getDayInfo(ds);
            const holiday = this._holidayInfo(ds);
            const isToday = ds === today;
            const isSelected = ds === this.selected;
            const dayItems = map.get(ds) || [];
            const lunarText = info.solarTerm?.zh || info.festivals[0]?.zh
              || (info.lunar.day === 1 ? info.lunar.monthCN : info.lunar.dayCN);
            return html`
              <button
                class="day-cell ${cell.inMonth ? '' : 'out'} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}"
                key="d${i}"
                @click=${() => { this.selected = ds; this.requestUpdate(); }}
              >
                <span class="day-num ${holiday?.isOffDay || (info.isWeekend && !holiday?.isMakeupWorkday) ? 'rest' : ''}">${cell.date.getDate()}</span>
                <span class="day-lunar ${holiday?.isOffDay ? 'rest' : ''}">${lunarText}</span>
                ${dayItems.length ? html`<span class="dots">${dayItems.slice(0, 3).map((s) => html`<span class="dot" style="background:${APPLE_COLORS[s.item.color] || APPLE_COLORS.red}"></span>`)}</span>` : ''}
              </button>
            `;
          })}
        </div>
      </div>
      ${this._renderDayDetail()}
    `;
  }

  // ---------- 视图：周 ----------

  _renderWeekView() {
    const days = this._weekDates();
    const todayStrV = todayStr();
    const ws = this._settings().weekStart ?? 0;
    const headers = [];
    for (let i = 0; i < 7; i++) {
      const idx = (i + ws) % 7;
      headers.push({ full: this._isZh() ? WEEK_FULL_ZH[idx] : WEEK_FULL_EN[idx], min: WEEK_MIN_EN[idx] });
    }
    const dayStrs = days.map((d) => formatDate(d));
    const map = this._scheduleMap(dayStrs[0], dayStrs[6]);

    /** 按小时分组 */
    const hourly = dayStrs.map((ds) => {
      const rows = map.get(ds) || [];
      const byHour = new Map();
      const allday = [];
      for (const row of rows) {
        if (!row.item.time) { allday.push(row); continue; }
        const h = Number(row.item.time.slice(0, 2));
        if (!Number.isFinite(h)) { allday.push(row); continue; }
        if (!byHour.has(h)) byHour.set(h, []);
        byHour.get(h).push(row);
      }
      return { byHour, allday };
    });

    const hours = Array.from({ length: 24 }, (_, i) => i);

    return html`
      <div class="card week-card">
        <div class="week-head">
          <div class="wk-gutter"></div>
          ${days.map((d, i) => {
            const ds = dayStrs[i];
            const isToday = ds === todayStrV;
            const isSel = ds === this.selected;
            return html`
              <button class="wk-head-cell ${isToday ? 'today' : ''} ${isSel ? 'sel' : ''}" key="wh${i}" @click=${() => { this.selected = ds; this.requestUpdate(); }}>
                <span class="wk-hd-wd" style="${isToday ? `color:${this._theme()}` : ''}">${this._isZh() ? headers[i].full : headers[i].min}</span>
                <span class="wk-hd-day" style="${isToday ? `background:${this._theme()};color:#fff` : ''}">${d.getDate()}</span>
              </button>
            `;
          })}
        </div>

        <div class="wk-allday-row">
          <div class="wk-gutter small">${this.t('MAIN_WEEK_ALLDAY')}</div>
          ${dayStrs.map((ds, i) => html`
            <div class="wk-allday-cell" key="al${i}" @click=${() => this._openEditor('create', null, ds, '')}>
              ${hourly[i].allday.map(({ item }) => html`
                <span class="wk-chip" style="background:${APPLE_COLORS[item.color] || APPLE_COLORS.red}">${SCHEDULE_TYPES[item.type]?.icon || SCHEDULE_TYPES.event.icon} ${item.title}</span>
              `)}
            </div>
          `)}
        </div>

        <div class="week-body">
          ${hours.map((h) => html`
            <div class="wk-row" key="hr${h}">
              <div class="wk-gutter hour">${pad2(h)}:00</div>
              ${dayStrs.map((ds, i) => {
                const rows = hourly[i].byHour.get(h) || [];
                return html`
                  <div class="wk-cell" key="c${h}-${i}" @click=${(e) => {
                    if (e.target.closest('.wk-chip')) return;
                    this._openEditor('create', null, ds, `${pad2(h)}:00`);
                  }}>
                    ${rows.map(({ item }) => html`
                      <div class="wk-block" style="background:${APPLE_COLORS[item.color] || APPLE_COLORS.red}1F;border-left:2.5px solid ${APPLE_COLORS[item.color] || APPLE_COLORS.red}">
                        <span class="wk-block-title">${item.title}</span>
                        <span class="wk-block-time">${item.time}</span>
                      </div>
                    `)}
                  </div>
                `;
              })}
            </div>
          `)}
        </div>
        <div class="hint">${this.t('MAIN_WEEK_ADD_HINT')}</div>
      </div>
    `;
  }

  // ---------- 视图：日程 ----------

  _relLabel(days) {
    if (days === 0) return this.t('MAIN_REL_TODAY');
    return days > 0 ? this.t('MAIN_REL_FUTURE', { n: days }) : this.t('MAIN_REL_PAST', { n: -days });
  }

  /** 日期信息 chips（日详情 / 日程视图共用） */
  _buildChips(dateStr) {
    const info = getDayInfo(dateStr);
    const holiday = this._holidayInfo(dateStr);
    const d = parseDate(dateStr);
    const chips = [];
    chips.push({
      text: this._isZh()
        ? `${info.month}月${info.day}日 周${WEEK_FULL_ZH[info.weekday]}`
        : `${WEEK_FULL_EN[info.weekday]}, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
      accent: false,
    });
    if (info.lunar) chips.push({ text: this._isZh() ? `农历 ${info.lunar.display}` : `Lunar ${info.lunar.month}/${info.lunar.day}`, accent: false });
    if (info.solarTerm) chips.push({ text: this._isZh() ? info.solarTerm.zh : info.solarTerm.en, accent: true });
    for (const f of info.festivals) chips.push({ text: this._isZh() ? f.zh : f.en, accent: true });
    if (holiday?.isOffDay) chips.push({ text: this._isZh() ? `${holiday.nameZh}假期` : `${holiday.nameEn} Holiday`, accent: true });
    if (holiday?.isMakeupWorkday) chips.push({ text: this._isZh() ? `${holiday.nameZh}调休上班` : `${holiday.nameEn} Makeup Workday`, accent: true });
    chips.push({ text: this._isZh() ? `第 ${weekOfYear(d)} 周 · 第 ${dayOfYear(d)} 天` : `Week ${weekOfYear(d)} · Day ${dayOfYear(d)}`, accent: false });
    return chips;
  }

  /**
   * 日程视图「添加栏」：与顶部栏一样固定在滚动区之外（放在 page-head 内），
   * 列表滚动时保持可见。
   */
  _renderListAddBar() {
    const isToday = this.selected === todayStr();
    const chips = this._buildChips(this.selected);
    return html`
      <div class="list-fixed">
        <div class="list-head">
          <div class="detail-title">
            <span class="detail-date">${this._isZh()
              ? `${parseDate(this.selected).getMonth() + 1}月${parseDate(this.selected).getDate()}日`
              : parseDate(this.selected).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span>
            ${isToday ? html`<span class="today-badge" style="background:${this._theme()}">${this.t('MAIN_TODAY')}</span>` : ''}
          </div>
          <div class="list-actions">
            <button class="io-mini-btn" @click=${() => { this._openIO('list'); }}>${this.t('MAIN_IMPORT_EXPORT')}</button>
            <button class="add-btn" style="background:${this._theme()}" @click=${() => this._openEditor('create', null, this.selected, '')}>
              <svg viewBox="0 0 20 20" width="13" height="13"><path d="M10 3v14M3 10h14" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>
              ${this.t('MAIN_ADD_SCHEDULE')}
            </button>
          </div>
        </div>
        <div class="chips">
          ${chips.map((c) => html`<span class="chip ${c.accent ? 'accent' : ''}" style="${c.accent ? `color:${this._theme()};background:${this._theme()}1A` : ''}">${c.text}</span>`)}
        </div>
      </div>
    `;
  }

  _renderScheduleView() {
    const timeline = getScheduleTimeline(this._schedules(), this.now, 3, 5);
    const todayStrV = todayStr();
    return html`
      <div class="list-view">
        <div class="tl-list">
        ${timeline.length === 0 ? html`<div class="agenda-empty">${this.t('MAIN_SCHEDULE_LIST_EMPTY')}</div>` : ''}
        ${(() => {
          let firstUpMarked = false;
          return timeline.map(({ item, occurrence, days }) => {
            const ds = occurrence.dateStr;
            const d = parseDate(ds);
            const wd = this._isZh() ? WEEK_FULL_ZH[d.getDay()] : WEEK_MIN_EN[d.getDay()];
            const past = days < 0;
            const firstUp = !past && !firstUpMarked;
            if (firstUp) firstUpMarked = true;
            return html`
            <div class="tl-row ${past ? 'past' : ''} ${ds === todayStrV ? 'today-row' : ''}" key="${item.id}-${ds}" data-today-row=${ds === todayStrV ? '1' : ''} data-first-up=${firstUp ? '1' : ''} @click=${() => { this.selected = ds; this._openEditor('edit', item); }}>
              <div class="tl-date">
                <span class="tl-d">${this._isZh() ? `${d.getMonth() + 1}月${d.getDate()}日` : `${d.toLocaleDateString('en-US', { month: 'short' })} ${d.getDate()}`}</span>
                <span class="tl-w">${ds.slice(0, 4)} ${wd}</span>
              </div>
              <span class="tl-bar" style="background:${APPLE_COLORS[item.color] || APPLE_COLORS.red}"></span>
              <div class="tl-main">
                <div class="tl-title">${SCHEDULE_TYPES[item.type]?.icon || SCHEDULE_TYPES.event.icon} ${item.title}</div>
                <div class="tl-sub">
                  ${item.time ? html`<span class="tl-time">${item.time}</span>` : ''}
                  <span class="tl-rel ${past ? 'past-text' : ''}" style="${past ? '' : `color:${this._theme()}`}">${this._relLabel(days)}</span>
                </div>
                ${item.note ? html`<div class="tl-note">${item.note}</div>` : ''}
              </div>
            </div>
          `;
          });
        })()}
        </div>
      </div>
    `;
  }

  // ---------- 视图：天气 ----------

  _renderWeatherView() {
    return html`
      <div class="card weather-view">
        <div class="wv-icon">
          <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 18a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.1 9.2 4 4 0 0 0 7 18z"/></svg>
        </div>
        <div class="wv-title">${this.t('MAIN_WEATHER_TITLE')}</div>
        <div class="wv-sub">${this.t('MAIN_WEATHER_SUB')}</div>
        <span class="wv-badge">${this.t('MAIN_WEATHER_BADGE')}</span>
      </div>
    `;
  }

  // ---------- 日详情 ----------

  _renderDayDetail() {
    const info = getDayInfo(this.selected);
    const items = getSchedulesOfDay(this._schedules(), this.selected);
    const holiday = this._holidayInfo(this.selected);
    const isToday = this.selected === todayStr();
    const d = parseDate(this.selected);
    const chips = this._buildChips(this.selected);

    return html`
      <div class="card day-detail">
        <div class="detail-head">
          <div class="detail-title">
            <span class="detail-date">${this._isZh() ? `${info.month}月${info.day}日` : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}</span>
            ${isToday ? html`<span class="today-badge" style="background:${this._theme()}">${this.t('MAIN_TODAY')}</span>` : ''}
          </div>
          <button class="add-btn" style="background:${this._theme()}" @click=${() => this._openEditor('create', null, this.selected, '')}>
            <svg viewBox="0 0 20 20" width="13" height="13"><path d="M10 3v14M3 10h14" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>
            ${this.t('MAIN_ADD_SCHEDULE')}
          </button>
        </div>
        <div class="chips">
          ${chips.map((c) => html`<span class="chip ${c.accent ? 'accent' : ''}" style="${c.accent ? `color:${this._theme()};background:${this._theme()}1A` : ''}">${c.text}</span>`)}
        </div>
        <div class="agenda">
          ${items.length === 0 ? html`<div class="agenda-empty">${this.t('MAIN_NO_SCHEDULE')}</div>` : ''}
          ${items.map(({ item, occurrence }) => {
            const desc = describeSchedule(item, occurrence, this.now, this._lang());
            return html`
              <div class="agenda-item" key="${item.id}" @click=${() => this._openEditor('edit', item)}>
                <span class="agenda-bar" style="background:${APPLE_COLORS[item.color] || APPLE_COLORS.red}"></span>
                <div class="agenda-main">
                  <div class="agenda-title">
                    <span class="type-icon">${SCHEDULE_TYPES[item.type]?.icon || SCHEDULE_TYPES.event.icon}</span>
                    ${item.title}
                  </div>
                  <div class="agenda-sub">
                    ${item.time ? html`<span class="agenda-time">${item.time}</span>` : ''}
                    <span>${desc.sub}</span>
                    ${desc.badge ? html`<span class="agenda-badge">${desc.badge}</span>` : ''}
                    ${desc.lunarMD ? html`<span class="agenda-lunar">${desc.lunarMD}</span>` : ''}
                  </div>
                  ${item.note ? html`<div class="agenda-note">${item.note}</div>` : ''}
                </div>
                <svg class="agenda-chevron" viewBox="0 0 8 13" width="7" height="11"><path d="M1 1l6 5.5L1 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  // ---------- 日期滚轮 ----------

  /** 滚轮三列数据模型（渲染与滚动定位共用） */
  _wheelModel() {
    if (!this.picker) return null;
    const p = this.picker;
    const lang = this._lang();
    const lunarMode = p.mode === 'lunar';
    const years = yearOptions();
    const months = lunarMode ? lunarMonthOptions(p.year) : solarMonthOptions(lang);
    const days = lunarMode ? lunarDayOptions(p.year, p.month, p.leap) : solarDayOptions(p.year, p.month, lang);
    let yi = years.findIndex((o) => o.value === p.year);
    let mi = months.findIndex((o) => o.value === p.month && !!o.leap === !!p.leap);
    let di = days.findIndex((o) => o.value === p.day);
    yi = yi < 0 ? 0 : yi;
    mi = mi < 0 ? 0 : mi;
    di = di < 0 ? days.length - 1 : di;
    return { years, months, days, yi, mi, di, lunarMode };
  }

  _renderWheel(key, items, index, onPick, cyclic = false) {
    if (!items.length) return '';
    const copies = cyclic ? 3 : 1;
    const cols = [];
    for (let c = 0; c < copies; c++) {
      for (let i = 0; i < items.length; i++) {
        cols.push({ item: items[i], i, c });
      }
    }
    return html`
      <div class="pk-col" key="col-${key}">
        <div
          class="pk-window"
          data-pk="${key}"
          data-cyclic="${cyclic ? '1' : '0'}"
          data-count="${items.length}"
          @scroll=${(e) => this._onWheelScroll(e, items, onPick)}
          @wheel=${(e) => this._onWheelStep(e, key, cyclic)}
        >
          <div class="pk-pad"></div>
          ${cols.map(({ item, i, c }) => html`<div class="pk-item ${i === index ? 'active' : ''}" key="pi${c}-${i}">${item.label}</div>`)}
          <div class="pk-pad"></div>
        </div>
        <div class="pk-frame"></div>
      </div>
    `;
  }

  _renderDatePicker() {
    const model = this._wheelModel();
    if (!model) return '';
    const p = this.picker;
    const { years, months, days, yi, mi, di, lunarMode } = model;
    const headers = lunarMode
      ? [this.t('MAIN_PICK_LUNAR_YEAR'), this.t('MAIN_PICK_LUNAR_MONTH'), this.t('MAIN_PICK_LUNAR_DAY')]
      : [this.t('MAIN_PICK_YEAR'), this.t('MAIN_PICK_MONTH'), this.t('MAIN_PICK_DAY')];
    return html`
      <div class="field">
        <label>${this.t('MAIN_FIELD_DATE')}</label>
        <div class="pk-head">
          ${headers.map((h, i) => html`<span class="pk-head-item" key="ph${i}">${h}</span>`)}
        </div>
        <div class="pk-wrap">
          ${this._renderWheel('pkYear', years, yi, (val) => this._pick({ year: val.value }))}
          ${this._renderWheel('pkMonth', months, mi, (val) => this._pick({ month: val.value, leap: !!val.leap }), true)}
          ${this._renderWheel('pkDay', days, di, (val) => this._pick({ day: val.value }), true)}
        </div>
        ${p.mode === 'lunar' ? html`<div class="pk-note">${this.t('MAIN_PICK_REFERENCE', { date: this.editor?.draft?.date || '-' })}</div>` : ''}
      </div>
    `;
  }

  /** 时间三列滚轮（时/分/秒，循环） */
  _renderTimePicker() {
    const t = this.editor?.timePick || { h: 0, m: 0, s: 0 };
    const hours = Array.from({ length: 24 }, (_, i) => ({ value: i, label: pad2(i) }));
    const mins = Array.from({ length: 60 }, (_, i) => ({ value: i, label: pad2(i) }));
    return html`
      <div class="field">
        <label>${this.t('MAIN_FIELD_TIME')}</label>
        <div class="pk-head">
          <span class="pk-head-item">${this.t('MAIN_PICK_HOUR')}</span>
          <span class="pk-head-item">${this.t('MAIN_PICK_MINUTE')}</span>
          <span class="pk-head-item">${this.t('MAIN_PICK_SECOND')}</span>
        </div>
        <div class="pk-wrap">
          ${this._renderWheel('tpHour', hours, t.h, (v) => this._pickTime('h', v.value), true)}
          ${this._renderWheel('tpMin', mins, t.m, (v) => this._pickTime('m', v.value), true)}
          ${this._renderWheel('tpSec', mins, t.s, (v) => this._pickTime('s', v.value), true)}
        </div>
      </div>
    `;
  }

  _pickTime(part, val) {
    if (!this.editor) return;
    const t = { ...this.editor.timePick, [part]: val };
    this.editor = {
      ...this.editor,
      timePick: t,
      draft: { ...this.editor.draft, time: `${pad2(t.h)}:${pad2(t.m)}:${pad2(t.s)}` },
      error: '',
    };
    this.requestUpdate();
  }

  _pick(patch) {
    if (!this.picker) return;
    const next = { ...this.picker, ...patch };
    if (next.mode === 'lunar') {
      // 换年后闰月组合可能不存在，需重新校验
      const opts = lunarMonthOptions(next.year);
      const hasCombo = opts.some((o) => o.value === next.month && !!o.leap === !!next.leap);
      if (!hasCombo) next.leap = false;
      const dayOpts = lunarDayOptions(next.year, next.month, next.leap);
      if (!dayOpts.some((o) => o.value === next.day)) next.day = dayOpts.length;
    } else {
      next.leap = false;
      const total = daysInSolarMonth(next.year, next.month);
      next.day = Math.max(1, Math.min(next.day, total));
    }
    this.picker = next;
    const date = this._pickerToDate(next);
    if (!date) {
      this.editor = { ...this.editor, error: this.t('MAIN_PICK_INVALID') };
      this.requestUpdate();
      return;
    }
    this._setDraft({ date });
  }

  _pickerToDate(p) {
    const src = p || this.picker;
    if (!src) return null;
    if (src.mode === 'lunar') return lunarToSolarDate(src.year, src.month, src.day, src.leap);
    const total = daysInSolarMonth(src.year, src.month);
    const day = Math.max(1, Math.min(src.day, total));
    return `${src.year}-${pad2(src.month)}-${pad2(day)}`;
  }

  _onWheelScroll(e, items, onPick) {
    const el = e.currentTarget;
    const count = Number(el.dataset.count) || items.length;
    const cyclic = el.dataset.cyclic === '1';
    let idx = Math.round(el.scrollTop / PK_ITEM_H);
    let logical = idx;
    if (cyclic) logical = ((idx % count) + count) % count;
    idx = Math.max(0, Math.min(cyclic ? idx : items.length - 1, idx));
    const picked = items[logical] || items[idx];
    if (picked) onPick(picked);
    this._wheelBusy = true;
    this._clearWheelTimer();
    const timer = this.spCtx?.api?.timer;
    if (timer?.setTimeout) {
      this._wheelTimerId = timer.setTimeout(() => {
        this._wheelBusy = false;
        this._wheelTimerId = null;
        // 循环列：滚动静止后把位置悄悄挪回中段拷贝（内容相同，视觉无跳动）
        if (cyclic && el.isConnected) {
          const center = Math.round(el.scrollTop / PK_ITEM_H);
          if (center < count || center >= count * 2) {
            el.scrollTop = (count + logical) * PK_ITEM_H;
          }
        }
        this.requestUpdate();
      }, 240);
    } else {
      this._wheelBusy = false;
    }
  }

  /** 鼠标滚轮：一次只走一格（拦截原生滚动，避免一次跳三格） */
  _onWheelStep(e, key, cyclic) {
    e.preventDefault();
    const el = this.renderRoot.querySelector(`[data-pk="${key}"]`);
    if (!el) return;
    const count = Number(el.dataset.count) || 1;
    const dir = (e.deltaY || 0) > 0 ? 1 : -1;
    let base = Math.round(el.scrollTop / PK_ITEM_H) + dir;
    if (cyclic) {
      // 越界时利用相同内容的拷贝平移回中段，视觉无感
      if (base < count) base += count;
      else if (base >= count * 2) base -= count;
    } else {
      base = Math.max(0, Math.min(count - 1, base));
    }
    el.scrollTop = base * PK_ITEM_H;
  }

  _clearWheelTimer() {
    if (this._wheelTimerId != null && this.spCtx?.api?.timer?.clearTimeout) {
      this.spCtx.api.timer.clearTimeout(this._wheelTimerId);
      this._wheelTimerId = null;
    }
  }

  /** 把滚轮对齐到当前选中项（首次渲染 & 数据变化时） */
  _syncWheels() {
    if (this._wheelBusy || !this.editor) return;
    const targets = {};
    if (this.picker) {
      const model = this._wheelModel();
      if (model) {
        targets.pkYear = model.yi;
        targets.pkMonth = model.mi;
        targets.pkDay = model.di;
      }
    }
    const t = this.editor.timePick;
    if (t) {
      targets.tpHour = t.h;
      targets.tpMin = t.m;
      targets.tpSec = t.s;
    }
    for (const [key, idx] of Object.entries(targets)) {
      const el = this.renderRoot.querySelector(`[data-pk="${key}"]`);
      if (!el) continue;
      const cyclic = el.dataset.cyclic === '1';
      const count = Number(el.dataset.count) || 1;
      const target = (cyclic ? count + idx : idx) * PK_ITEM_H;
      if (Math.abs(el.scrollTop - target) > 2) el.scrollTop = target;
    }
  }

  // ---------- 编辑器（全屏） ----------

  _openEditor(mode, item = null, dateStr = null, time = null) {
    const base = {
      type: 'event',
      title: '',
      date: dateStr || this.selected,
      time: time || '',
      lunar: false,
      yearly: true,
      note: '',
      color: this._settings().themeColor || 'red',
    };
    const draft = item ? { ...item, time: item.time || '' } : base;
    this.picker = this._initPicker(draft);
    // 时间滚轮初始值：已有时间 > 传入时间 > 当前时间
    const timeSrc = draft.time || time || '';
    const parts = timeSrc ? timeSrc.split(':').map(Number) : [this.now.getHours(), this.now.getMinutes(), 0];
    this.editor = {
      mode,
      draft,
      error: '',
      timePick: { h: parts[0] || 0, m: parts[1] || 0, s: parts[2] || 0 },
    };
    this.requestUpdate();
  }

  _initPicker(draft) {
    if (draft.type !== 'event' && draft.lunar) {
      const p = solarToLunarParts(draft.date);
      if (p) return { mode: 'lunar', year: p.year, month: p.month, day: p.day, leap: p.leap };
    }
    const s = splitSolarDate(draft.date);
    if (s) return { mode: 'solar', year: s.year, month: s.month, day: s.day, leap: false };
    const n = new Date();
    return { mode: 'solar', year: n.getFullYear(), month: n.getMonth() + 1, day: n.getDate(), leap: false };
  }

  _closeEditor() {
    this.editor = null;
    this.picker = null;
    this.requestUpdate();
  }

  _setDraft(patch) {
    if (!this.editor) return;
    this.editor = { ...this.editor, draft: { ...this.editor.draft, ...patch }, error: '' };
    this.requestUpdate();
  }

  _toggleLunar() {
    const draft = this.editor.draft;
    const lunar = !draft.lunar;
    let picker = this.picker;
    let date = draft.date;
    if (lunar) {
      const p = solarToLunarParts(draft.date);
      picker = p
        ? { mode: 'lunar', year: p.year, month: p.month, day: p.day, leap: p.leap }
        : { ...this.picker, mode: 'lunar' };
      const converted = this._pickerToDate({ ...picker, mode: 'lunar' });
      if (converted) date = converted;
    } else {
      const parts = splitSolarDate(draft.date);
      picker = parts ? { mode: 'solar', year: parts.year, month: parts.month, day: parts.day, leap: false } : { ...this.picker, mode: 'solar' };
      const converted = this._pickerToDate(picker);
      if (converted) date = converted;
    }
    this.picker = picker;
    this._setDraft({ lunar, date });
  }

  async _saveEditor() {
    const { mode, draft } = this.editor;
    if (!draft.date) {
      this.editor = { ...this.editor, error: this.t('MAIN_PICK_INVALID') };
      this.requestUpdate();
      return;
    }
    const normalized = normalizeSchedule({
      ...draft,
      time: draft.type === 'event' ? (draft.time || null) : null,
    }, this._lang());
    if (!normalized) {
      this.editor = { ...this.editor, error: this.t('MAIN_EDITOR_ERROR_DATE') };
      this.requestUpdate();
      return;
    }
    if (mode === 'create') {
      await getUserStore().addSchedule(normalized);
      this._showToast(this.t('MAIN_TOAST_CREATED'));
    } else {
      await getUserStore().updateSchedule(draft.id, normalized);
      this._showToast(this.t('MAIN_TOAST_UPDATED'));
    }
    this._closeEditor();
  }

  async _deleteEditor() {
    const { draft } = this.editor;
    await getUserStore().removeSchedule(draft.id);
    this._showToast(this.t('MAIN_TOAST_DELETED'));
    this._closeEditor();
  }

  _renderEditor() {
    if (!this.editor) return '';
    const { mode, draft, error } = this.editor;
    const dark = this.spCtx?.darkMode ?? false;
    const theme = this._theme();
    const isEvent = draft.type === 'event';
    const isCountdown = draft.type === 'countdown';

    const typeOptions = [
      { value: 'event', label: this.t('MAIN_TYPE_EVENT'), icon: SCHEDULE_TYPES.event.icon },
      { value: 'birthday', label: this.t('MAIN_TYPE_BIRTHDAY'), icon: SCHEDULE_TYPES.birthday.icon },
      { value: 'anniversary', label: this.t('MAIN_TYPE_ANNIVERSARY'), icon: SCHEDULE_TYPES.anniversary.icon },
      { value: 'countdown', label: this.t('MAIN_TYPE_COUNTDOWN'), icon: SCHEDULE_TYPES.countdown.icon },
    ];

    return html`
      <div class="fullscreen" style="${appleThemeVars(dark)}">
        <div class="fs-nav">
          <button class="nav-btn" @click=${this._closeEditor}>${this.t('MAIN_CANCEL')}</button>
          <span class="nav-title">${mode === 'create' ? this.t('MAIN_EDITOR_NEW') : this.t('MAIN_EDITOR_EDIT')}</span>
          <button class="nav-btn strong" style="color:${theme}" @click=${this._saveEditor}>${this.t('MAIN_SAVE')}</button>
        </div>
        <div class="fs-body">
          <div class="type-grid">
            ${typeOptions.map((t) => html`
              <button class="type-item ${draft.type === t.value ? 'active' : ''}" style="${draft.type === t.value ? `border-color:${theme};color:${theme};background:${theme}14` : ''}" key="${t.value}" @click=${() => this._setDraft({ type: t.value })}>
                <span class="type-icon-lg">${t.icon}</span>
                <span>${t.label}</span>
              </button>
            `)}
          </div>

          <div class="field">
            <label>${this.t('MAIN_FIELD_COLOR')}</label>
            <div class="color-row">
              ${Object.entries(APPLE_COLORS).filter(([k]) => k !== 'gray').map(([key, color]) => html`
                <button class="color-dot ${draft.color === key ? 'selected' : ''}" style="background:${color};color:${color}" key="${key}" aria-label="${key}" @click=${() => this._setDraft({ color: key })}>
                  ${draft.color === key ? html`<svg viewBox="0 0 20 20" width="13" height="13"><path d="M4 10.5l4 4 8-9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}
                </button>
              `)}
            </div>
          </div>

          <div class="field">
            <label>${this.t('MAIN_FIELD_TITLE')}</label>
            <input type="text" .value=${draft.title || ''} maxlength="60" placeholder="${this.t('MAIN_FIELD_TITLE_PLACEHOLDER')}" @input=${(e) => this._setDraft({ title: e.target.value })} />
          </div>

          ${this._renderDatePicker()}

          ${isEvent ? this._renderTimePicker() : ''}

          ${!isEvent ? html`
            ${appleGroup(
              this._isZh() ? '年循环' : 'YEARLY RECURRENCE',
              [
                appleRow({
                  label: this.t('MAIN_FIELD_LUNAR'),
                  sub: this.t('MAIN_FIELD_LUNAR_SUB'),
                  right: appleSwitch(draft.lunar, () => this._toggleLunar(), theme),
                }),
                ...(isCountdown ? [appleRow({
                  label: this.t('MAIN_FIELD_YEARLY'),
                  sub: this.t('MAIN_FIELD_YEARLY_SUB'),
                  last: true,
                  right: appleSwitch(draft.yearly !== false, () => this._setDraft({ yearly: draft.yearly === false }), theme),
                })] : []),
              ],
              this.t('MAIN_FIELD_LUNAR_FOOTER'),
            )}
          ` : ''}

          <div class="field">
            <label>${this.t('MAIN_FIELD_NOTE')}</label>
            <textarea
              rows="3"
              maxlength="300"
              placeholder="${this.t('MAIN_FIELD_NOTE_PLACEHOLDER')}"
              .value=${draft.note || ''}
              @input=${(e) => this._setDraft({ note: e.target.value })}
            ></textarea>
            <div class="note-counter">${(draft.note || '').length}/300</div>
          </div>

          ${error ? html`<div class="form-error">${error}</div>` : ''}

          ${mode === 'edit' ? html`
            <div class="delete-wrap">
              ${appleButton(this.t('MAIN_DELETE'), () => this._deleteEditor(), { color: APPLE_COLORS.red, filled: false })}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // ---------- 设置（全屏） ----------

  async _setSetting(patch) {
    const store = getUserStore();
    if (!store) return;
    await store.updateSettings(patch);
    if (patch.language) {
      const locale = patch.language === 'auto' ? (this.spCtx?.language || 'zh-CN') : patch.language;
      try { await setLocale(locale); } catch { /* ignore */ }
    }
    this.requestUpdate();
  }

  async _refreshHoliday() {
    const hs = getHolidayService();
    if (!hs) return;
    try {
      await hs.forceRefresh();
      this._showToast(this.t('MAIN_TOAST_HOLIDAY_REFRESHED'));
    } catch (e) {
      this._showToast(e?.message === 'REFRESH_TOO_FREQUENT' ? this.t('MAIN_TOAST_REFRESH_LIMIT') : this.t('MAIN_TOAST_REFRESH_FAILED'));
    }
    this.requestUpdate();
  }

  _renderSettings() {
    if (!this.settingsOpen) return '';
    const dark = this.spCtx?.darkMode ?? false;
    const theme = this._theme();
    const s = this._settings();
    const hs = getHolidayService();
    const status = hs ? hs.getStatus() : null;

    const langOptions = [
      { label: this._isZh() ? '跟随系统' : 'Auto', value: 'auto' },
      { label: '中文', value: 'zh-CN' },
      { label: 'English', value: 'en-US' },
    ];

    const fmtTime = (ts) => {
      if (!ts) return this.t('MAIN_NEVER');
      const d = new Date(ts);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    const sourceText = status
      ? (status.source === 'network' || status.source === 'network+fallback'
        ? this.t('MAIN_SOURCE_NETWORK')
        : status.source === 'fallback' ? this.t('MAIN_SOURCE_BUILTIN') : this.t('MAIN_SOURCE_NONE'))
      : this.t('MAIN_SOURCE_NONE');

    return html`
      <div class="fullscreen" style="${appleThemeVars(dark)}">
        <div class="fs-nav">
          <span class="nav-btn invisible"></span>
          <span class="nav-title">${this.t('MAIN_SETTINGS')}</span>
          <button class="nav-btn strong" style="color:${theme}" @click=${() => { this.settingsOpen = false; this.requestUpdate(); }}>${this.t('MAIN_DONE')}</button>
        </div>
        <div class="fs-body">
          ${appleGroup(
            this.t('MAIN_GROUP_GENERAL'),
            [
              appleRow({
                label: this.t('MAIN_SETTING_LANGUAGE'),
                right: appleSegmented(langOptions, s.language, (v) => this._setSetting({ language: v }), theme),
              }),
              appleRow({
                label: this.t('MAIN_SETTING_WEEK_START'),
                right: appleSegmented(
                  [
                    { label: this._isZh() ? '周日' : 'Sun', value: 0 },
                    { label: this._isZh() ? '周一' : 'Mon', value: 1 },
                  ],
                  s.weekStart ?? 0,
                  (v) => this._setSetting({ weekStart: v }),
                  theme,
                ),
              }),
              appleRow({
                label: this.t('MAIN_SETTING_HOUR12'),
                right: appleSwitch(s.hour12, () => this._setSetting({ hour12: !s.hour12 }), theme),
              }),
              appleRow({
                label: this.t('MAIN_SETTING_SHOW_SECONDS'),
                last: true,
                right: appleSwitch(s.showSeconds !== false, () => this._setSetting({ showSeconds: s.showSeconds === false }), theme),
              }),
            ],
          )}

          ${appleGroup(
            this.t('MAIN_GROUP_APPEARANCE'),
            [
              appleRow({
                label: this.t('MAIN_SETTING_THEME'),
                sub: s.themeColor,
                last: true,
                right: html`
                  <div class="theme-dots">
                    ${Object.entries(APPLE_COLORS).filter(([k]) => k !== 'gray').map(([key, color]) => html`
                      <button class="theme-dot ${s.themeColor === key ? 'selected' : ''}" style="background:${color}" key="${key}" aria-label="${key}" @click=${() => this._setSetting({ themeColor: key })}></button>
                    `)}
                  </div>
                `,
              }),
            ],
            this.t('MAIN_GROUP_APPEARANCE_FOOTER'),
          )}

          ${appleGroup(
            this.t('MAIN_GROUP_HOLIDAY_DATA'),
            [
              appleRow({ label: this.t('MAIN_SETTING_HOLIDAY_SOURCE'), sub: sourceText }),
              appleRow({ label: this.t('MAIN_SETTING_HOLIDAY_UPDATED'), sub: status ? fmtTime(status.updatedAt) : '-' }),
              appleRow({
                label: this.t('MAIN_SETTING_HOLIDAY_REFRESH'),
                sub: this.t('MAIN_SETTING_HOLIDAY_REFRESH_SUB'),
                last: true,
                chevron: true,
                onClick: () => this._refreshHoliday(),
              }),
            ],
            this.t('MAIN_GROUP_HOLIDAY_DATA_FOOTER'),
          )}

          ${appleGroup(
            this.t('MAIN_GROUP_DATA'),
            [
              appleRow({
                label: this.t('MAIN_SETTING_IMPORT_EXPORT'),
                sub: this.t('MAIN_SETTING_IMPORT_EXPORT_SUB'),
                chevron: true,
                first: true,
                onClick: () => this._openIO('settings'),
              }),
              appleRow({
                label: this.t('MAIN_SETTING_SCHEDULE_MGR'),
                sub: this.t('MAIN_SETTING_SCHEDULE_MGR_SUB'),
                chevron: true,
                last: true,
                onClick: () => this._openScheduleMgr(),
              }),
            ],
          )}

          ${appleGroup(
            this.t('MAIN_GROUP_WEATHER'),
            [
              appleRow({
                label: this.t('MAIN_SETTING_WEATHER'),
                sub: this.t('MAIN_SETTING_WEATHER_SUB'),
                last: true,
              }),
            ],
            this.t('MAIN_GROUP_WEATHER_FOOTER'),
          )}

          ${appleGroup(
            this.t('MAIN_GROUP_ABOUT'),
            [
              appleRow({ label: this.t('MAIN_SETTING_VERSION'), sub: appConfig.version }),
              appleRow({ label: this.t('MAIN_SETTING_AUTHOR'), sub: appConfig.author }),
              appleRow({ label: this.t('MAIN_SETTING_APP_ID'), sub: appConfig.microAppId }),
              appleRow({ label: this.t('MAIN_SETTING_DATA_SOURCE'), sub: 'chinese-days (MIT)', last: true }),
            ],
          )}
        </div>
      </div>
    `;
  }

  // ---------- 卡片显示模式（信息块模型 v1.24） ----------

  /** 全局默认显示模式（combo=拼接 / single=单独） */
  _cardDisplayMode() {
    return this._settings().displayMode || 'combo';
  }

  /** 全局默认信息块单元（拼接模式允许为空：卡片可以不显示任何内容） */
  _cardBlocksFor(size) {
    return sanitizeBlocks(this._settings().cardBlocks, this._cardDisplayMode(), size);
  }

  /** 全局卡片级置中（内容未填满时整体居中） */
  _cardCenter() {
    const s = this._settings();
    return { h: !!s.cardCenterH, v: !!s.cardCenterV };
  }

  /** 当前待确认的内容 / 样式（无效时回退到第一个单元） */
  _cardPending() {
    const mode = this._cardDisplayMode();
    const blocks = this._cardBlocksFor(this.cardCfgSize || '2x2');
    let c = this.cardCfgPendingContent;
    if (!contentDef(mode, c)) c = (blocks[0] || { c: 'calendar' }).c;
    let s = this.cardCfgPendingStyle;
    if (!styleDef(mode, c, s)) s = blocks.find((b) => b.c === c)?.s || defaultStyleFor(mode, c);
    return { c, s };
  }

  /** 单元完整显示名（内容 · 样式） */
  _cardUnitName(b) {
    const zh = this._isZh();
    const cd = contentDef(this._cardDisplayMode(), b.c);
    const sd = styleDef(this._cardDisplayMode(), b.c, b.s);
    return `${cd ? (zh ? cd.zh : cd.en) : b.c} · ${sd ? (zh ? sd.zh : sd.en) : b.s}`;
  }

  /** 仅样式名（预览后的实例名不再重复显示内容名）；空白单元带序号 */
  _cardStyleName(b) {
    const zh = this._isZh();
    if (b.c === 'blank') return zh ? `空白${b.n || 1}` : `Blank ${b.n || 1}`;
    const sd = styleDef(this._cardDisplayMode(), b.c, b.s);
    return sd ? (zh ? sd.zh : sd.en) : b.s;
  }

  // ---------- 占格调整（v1.29：点击已选样式名修改尺寸） ----------

  _cardCfgSizeKey() {
    return this.cardCfgSize || '2x2';
  }

  /** 打开/关闭某个单元的占格编辑器 */
  _toggleCardSpanEdit(idx) {
    this._cardSpanEdit = (this._cardSpanEdit && this._cardSpanEdit.idx === idx) ? null : { idx };
    this.cardCfgHint = null;
    this.requestUpdate();
  }

  /** 被编辑单元在当前布局中的位置（含网格、是否放得下） */
  _cardSpanInfo() {
    const e = this._cardSpanEdit;
    if (!e) return null;
    const size = this._cardCfgSizeKey();
    const mode = this._cardDisplayMode();
    const blocks = this._cardBlocksFor(size);
    const b = blocks[e.idx];
    if (!b) return null;
    const grid = gridForSize(size);
    const placed = layoutBlocks(blocks, mode, size, grid, this._cardCenter());
    const same = (p) => p && p.c === b.c && p.s === b.s && (Number(p.n) || 0) === (Number(b.n) || 0);
    const target = (same(placed[e.idx]) ? placed[e.idx] : placed.find(same)) || null;
    const occupied = new Set();
    for (const p of placed) {
      if (p === target) continue;
      for (let r = p.pos.row; r < p.pos.row + p.span.rows; r++) {
        for (let c = p.pos.col; c < p.pos.col + p.span.cols; c++) occupied.add(`${r},${c}`);
      }
    }
    return { idx: e.idx, grid, b, target, occupied, mode, size, blocks, isFull: isFullCard(size) };
  }

  _cardResizeSpan(dCols, dRows) {
    const info = this._cardSpanInfo();
    if (!info) return;
    const { b, mode, size } = info;
    const { min, max, minArea } = spanBounds(mode, size, b);
    const cur = blockSpanDef(mode, b).span;
    const cols = Math.min(max.cols, Math.max(min.cols, cur.cols + dCols));
    const rows = Math.min(max.rows, Math.max(min.rows, cur.rows + dRows));
    if (cols === cur.cols && rows === cur.rows) return;
    // v1.40：面积下限（minArea>0，如四样式禁 1×1）校验——单轴下限已退为 1，必须用面积兜底
    if (minArea > 0 && cols * rows < minArea) {
      this._showCardCfgHint(this._isZh()
        ? '占格最小为 1×2 或 2×1（不能调到 1×1）'
        : 'Minimum span is 1×2 or 2×1 (1×1 not allowed)');
      return;
    }
    this._cardApplySpan({ cols, rows });
  }

  /** 点击网格格子：以当前锚点为左上角拉伸到该格 */
  _cardPickSpanCell(row, col) {
    const info = this._cardSpanInfo();
    if (!info || !info.target) return;
    const t = info.target;
    this._cardResizeSpanTo(col - t.pos.col + 1, row - t.pos.row + 1);
  }

  /** 直接设定占格（按可调区间收窄后写入） */
  _cardResizeSpanTo(cols, rows) {
    const info = this._cardSpanInfo();
    if (!info) return;
    const { min, max, minArea } = spanBounds(info.mode, info.size, info.b);
    const c = Math.min(max.cols, Math.max(min.cols, Math.round(cols)));
    const r = Math.min(max.rows, Math.max(min.rows, Math.round(rows)));
    // v1.40：面积下限（禁 1×1）校验——点格拉伸到 1×1 时拒绝并提示
    if (minArea > 0 && c * r < minArea) {
      this._showCardCfgHint(this._isZh()
        ? '占格最小为 1×2 或 2×1（不能调到 1×1）'
        : 'Minimum span is 1×2 or 2×1 (1×1 not allowed)');
      return;
    }
    this._cardApplySpan({ cols: c, rows: r });
  }

  _cardApplySpan(span) {
    const info = this._cardSpanInfo();
    if (!info) return;
    const next = info.blocks.map((x, i) => (i === this._cardSpanEdit.idx ? { ...x, span: { ...span } } : x));
    if (!blocksFit(next, info.mode, info.size)) {
      const g = gridForSize(info.size);
      this._showCardCfgHint(this._isZh()
        ? `空间不足：已放下此单元，最大为 ${g.rows}×${g.cols}（垂直×水平）`
        : `Not enough room: up to ${g.rows}×${g.cols} (V×H) fits on this card`);
      return;
    }
    this.cardCfgHint = null;
    this._setSetting({ cardBlocks: next });
  }

  /** 恢复该样式的默认占格 */
  _cardResetSpan() {
    const info = this._cardSpanInfo();
    if (!info) return;
    const next = info.blocks.map((x, i) => (i === this._cardSpanEdit.idx ? { c: x.c, s: x.s } : x));
    if (!blocksFit(next, info.mode, info.size)) {
      this._showCardCfgHint(this._isZh() ? '空间不足，无法恢复默认占格' : 'Not enough room to restore the default size');
      return;
    }
    this.cardCfgHint = null;
    this._setSetting({ cardBlocks: next });
  }

  /**
   * 切换卡片尺寸（v1.31 · D10）：从 1×FULL 切走时，若某个月日历单元把「单行显示」
   * **显式开启**过，给一次提示——偏好被保留（切回 1×FULL 自动恢复），只是暂不生效。
   * 未显式设置的（含默认 true）不提示，避免噪音。
   */
  _setCardCfgSize(sz) {
    const prev = this.cardCfgSize;
    this.cardCfgSize = sz;
    this.cardCfgPendingContent = null;
    this.cardCfgPendingStyle = null;
    this._cardSpanEdit = null;
    if (prev === '1xfull' && sz !== '1xfull') {
      const paused = this._cardBlocksFor(sz).some((b) => b.c === 'calendar' && b.s === 'month'
        && b.opts && b.opts.singleLine === true);
      if (paused) this._showCardCfgHint(this.t('CARD_SINGLELINE_PAUSED', { size: sz }));
    }
    this.requestUpdate();
  }

  _renderCardSpanEditor() {
    const info = this._cardSpanInfo();
    if (!info) return '';
    const isMonth = info.b.c === 'calendar' && info.b.s === 'month';
    return renderSpanEditor({
      grid: info.grid,
      target: info.target,
      span: info.target ? info.target.span : effectiveSpan(info.mode, info.size, info.b),
      bounds: spanBounds(info.mode, info.size, info.b),
      occupied: info.occupied,
      align: unitAlign(info.mode, info.size, info.b),
      isFull: info.isFull,
      // v1.31 需求 2：月历「单行显示」仅 1×FULL 卡片可用（其他尺寸传 null → 不渲染按钮）
      singleLine: (isMonth && isFullCard(info.size))
        ? unitOpts(info.mode, info.size, info.b).singleLine
        : null,
      // v1.35：简约显示仅 5 个日期样式可用（白名单门控，与当前开关状态无关——否则默认关时按钮不渲染）
      noUnits: (info.b.c === 'time' && NO_UNITS_DATE_STYLES.includes(info.b.s))
        ? unitOpts(info.mode, info.size, info.b).noUnits
        : null,
      name: this._cardStyleName(info.b),
      theme: this._theme(),
      isZh: this._isZh(),
      sizeLabel: info.size,
      onPick: (r, c) => this._cardPickSpanCell(r, c),
      onResize: (dCols, dRows) => this._cardResizeSpan(dCols, dRows),
      onReset: () => this._cardResetSpan(),
      onClose: () => { this._cardSpanEdit = null; this.requestUpdate(); },
      // v1.31 需求 1：卡片级接管的轴 → 单元级开关软禁用（可点，点了给原因 + 解锁）
      alignLocked: { h: this._alignGov.h === 'card', v: this._alignGov.v === 'card' },
      alignDefault: { h: !unitAlignExplicit(info.b), v: !unitAlignExplicit(info.b) },
      alignHint: this.t('CARD_ALIGN_UNIT_HINT'),
      t: (key, vars) => this.t(key, vars),
      onToggleAlign: (axis) => this._toggleCardAlignWithFeedback(axis),
      onUnlock: (axis) => this._unlockCardCenter(axis),
      onFull: () => this._fillCardSpanFull(),
      onToggleSingleLine: () => this._toggleCardSpanSingleLine(),
      onToggleNoUnits: () => this._toggleCardSpanNoUnits(),
    });
  }

  _setCardDisplayMode(v) {
    const size = this.cardCfgSize || '2x2';
    const blocks = sanitizeBlocks(null, v, size);
    this.cardCfgPendingContent = blocks[0].c;
    this.cardCfgPendingStyle = blocks[0].s;
    this.cardCfgHint = null;
    this._cardSpanEdit = null;
    this._setSetting({
      displayMode: v,
      cardBlocks: blocks,
      cardMode: v === 'combo' ? 'combo' : blocks[0].c,
    });
  }

  /** 下拉框：一次仅选择一个显示内容 */
  _setCardPendingContent(key) {
    if (this.cardCfgPendingContent === key) return;
    this.cardCfgPendingContent = key;
    this.cardCfgPendingStyle = defaultStyleFor(this._cardDisplayMode(), key);
    this.cardCfgHint = null;
    this.requestUpdate();
  }

  /** 样式列表：选中一个显示样式（待确认） */
  _setCardPendingStyle(key) {
    this.cardCfgPendingStyle = key;
    this.cardCfgHint = null;
    this.requestUpdate();
    this._scrollCardStripToActive();
  }

  /**
   * 样式预览框：‹ › 切换待确认样式（v1.29）。
   * 在「所有显示内容 × 其样式」的扁平序列上移动，跨过内容边界即切到相邻显示内容。
   */
  _shiftCardPendingStyle(dir) {
    const mode = this._cardDisplayMode();
    const { c, s } = this._cardPending();
    const next = shiftFlatStyle(mode, c, s, dir);
    this.cardCfgPendingContent = next.c;
    this.cardCfgPendingStyle = next.s;
    this.cardCfgHint = null;
    this.requestUpdate();
    this._scrollCardStripToActive();
  }

  /** 单排样式条：把选中项滚到可视中部 */
  _scrollCardStripToActive() {
    requestAnimationFrame(() => {
      const root = this.renderRoot;
      if (!root) return;
      const strip = root.querySelector('.style-opts.card-strip');
      const act = strip && strip.querySelector('.style-opt.active');
      if (!strip || !act || !strip.clientWidth) return;
      const left = act.offsetLeft - (strip.clientWidth - act.offsetWidth) / 2;
      strip.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    });
  }

  /** 「确定」：把待确认的「内容+样式」写入全局默认 */
  _confirmCardStyle() {
    const zh = this._isZh();
    const mode = this._cardDisplayMode();
    const { c, s } = this._cardPending();
    const size = this.cardCfgSize || '2x2';
    if (mode === 'single') {
      this._setSetting({ cardBlocks: [{ c, s }], cardMode: c });
      this._showCardCfgHint(zh ? '已应用该显示样式' : 'Style applied');
      return;
    }
    const cur = this._cardBlocksFor(size);
    // 空白单元可重复添加（靠序号区分），故只对非空白内容查重
    if (c !== 'blank' && cur.some((b) => b.c === c && b.s === s)) {
      this._showCardCfgHint(zh ? '该显示样式已在卡片中' : 'This style is already on the card');
      return;
    }
    // 空间预检：按每个样式的 span 实际占格判断（不再按块数硬限制）
    const next = c === 'blank'
      ? [...cur, { c, s, n: this._cardNextBlankN() }]
      : [...cur, { c, s }];
    if (!blocksFit(next, 'combo', size)) {
      const need = styleSpanDef('combo', c, s).span;
      const grid = gridForSize(size);
      this._showCardCfgHint(zh
        ? `空间不足：此样式需占 ${need.rows}×${need.cols} 格（垂直×水平），${size}（${grid.rows}×${grid.cols} 格）已放不下`
        : `Not enough room: needs ${need.rows}×${need.cols} cells (V×H) — no room left on ${size} (${grid.rows}×${grid.cols})`);
      return;
    }
    this.cardCfgHint = null;
    this._setSetting({ cardBlocks: next });
  }

  /** 拼接模式：点击 × 取消某个样式在卡片上显示（可全部移除 → 卡片不显示内容） */
  _removeCardBlock(idx) {
    if (this._cardDisplayMode() !== 'combo') return;
    const size = this.cardCfgSize || '2x2';
    const cur = this._cardBlocksFor(size);
    this._cardSpanEdit = null;
    this._setSetting({ cardBlocks: cur.filter((_, i) => i !== idx) });
  }

  /** 下一个可用的空白序号（1,2,3… 取最小空缺） */
  _cardNextBlankN() {
    const size = this.cardCfgSize || '2x2';
    const used = new Set(this._cardBlocksFor(size)
      .filter((b) => b.c === 'blank')
      .map((b) => Number(b.n) || 0));
    let cand = 1;
    while (used.has(cand)) cand += 1;
    return cand;
  }

  /** 空白填充：添加一个 1×1 空白单元（可添加多个，仅占位不显示内容） */
  _addCardBlank() {
    const zh = this._isZh();
    const size = this.cardCfgSize || '2x2';
    const cur = this._cardBlocksFor(size);
    const next = [...cur, { c: 'blank', s: 'space', n: this._cardNextBlankN() }];
    if (!blocksFit(next, this._cardDisplayMode(), size)) {
      this._showCardCfgHint(zh ? '空间不足：先缩小其他单元再添加空白' : 'Not enough room: shrink others before adding a blank');
      return;
    }
    this._setSetting({ cardBlocks: next });
  }

  /** 卡片级置中：内容未填满时整体按方向居中 */
  _toggleCardCenter(axis) {
    const s = this._settings();
    this._setSetting(axis === 'h'
      ? { cardCenterH: !s.cardCenterH }
      : { cardCenterV: !s.cardCenterV });
  }

  /** 当前卡片级置中的逐轴治理者（card = 卡片级接管该轴） */
  get _alignGov() {
    return alignGovernor(this._cardCenter());
  }

  /**
   * v1.31 需求 1 · D7：单元级置中改走「软禁用 + 反馈」。
   * 卡片级已接管该轴 → 不写数据，弹提示说明由预览栏接管；
   * 否则执行切换，并在「无空间可居中」时给出一次性提示（D6）。
   */
  _toggleCardAlignWithFeedback(axis) {
    if (this._alignGov[axis] === 'card') {
      this._showCardCfgHint(this.t(axis === 'h' ? 'CARD_ALIGN_LOCKED_H' : 'CARD_ALIGN_LOCKED_V'));
      return;
    }
    const before = layoutSignature(this._cardLaidBlocks());
    this._toggleCardSpanAlign(axis);
    const after = layoutSignature(this._cardLaidBlocks());
    if (before === after) {
      this._showCardCfgHint(this.t(axis === 'h' ? 'CARD_ALIGN_NO_ROOM_H' : 'CARD_ALIGN_NO_ROOM_V'));
      return;
    }
    const { report } = applyAlignmentWithReport(
      autoLayout(this._cardBlocksFor(this._cardCfgSizeKey()), this._cardDisplayMode(),
        this._cardCfgSizeKey(), gridForSize(this._cardCfgSizeKey())),
      this._cardDisplayMode(),
      this._cardCfgSizeKey(),
      gridForSize(this._cardCfgSizeKey()),
      { h: this._alignGov.h === 'unit', v: this._alignGov.v === 'unit' },
    );
    const n = report.groupSize[axis];
    if (n > 1) {
      this._showCardCfgHint(this.t(axis === 'h' ? 'CARD_ALIGN_GROUP_H' : 'CARD_ALIGN_GROUP_V', { count: n - 1 }));
    }
  }

  /**
   * v1.31 需求 1 · D7：「改为单元级控制」——关掉该轴的卡片级接管，并把「接管态当前显示的值」
   * 钉成显式单元级设置。
   * 为什么不是翻转：接管态下按钮显示的是**有效值**（1×FULL 默认 true），若这里直接取反，
   * 用户点一下「看起来是开」的按钮会变成「关」，观感是功能被关掉了。钉住有效值后，
   * 解锁不改变视觉状态，下一次点按才改变它——符合「点它是为了拿到控制权」的意图。
   */
  _unlockCardCenter(axis) {
    const info = this._cardSpanInfo();
    if (info) {
      const cur = unitAlign(info.mode, info.size, info.b);
      this._setCardBlockField({ h: cur.h, v: cur.v }, 'align');
    }
    this._setSetting(axis === 'h' ? { cardCenterH: false } : { cardCenterV: false });
  }

  /** 单元级置中（占格编辑器内）——仅由 _toggleCardAlignWithFeedback / _unlockCardCenter 调用 */
  _toggleCardSpanAlign(axis) {
    const info = this._cardSpanInfo();
    if (!info) return;
    const cur = unitAlign(info.mode, info.size, info.b);
    this._setCardBlockField({
      h: axis === 'h' ? !cur.h : cur.h,
      v: axis === 'v' ? !cur.v : cur.v,
    }, 'align');
  }

  /** 当前尺寸下的实际布局（单元级 + 卡片级置中叠加后的结果） */
  _cardLaidBlocks() {
    const size = this._cardCfgSizeKey();
    return layoutBlocks(
      this._cardBlocksFor(size), this._cardDisplayMode(), size, gridForSize(size), this._cardCenter(),
    );
  }

  /** 1×FULL 卡片：水平填满 */
  _fillCardSpanFull() {
    const info = this._cardSpanInfo();
    if (!info) return;
    this._cardResizeSpanTo(info.grid.cols, blockSpanDef(info.mode, info.b).span.rows);
  }

  /**
   * 月日历单行显示开关。
   * v1.31 · D13：1×FULL 上用户「手动关闭」单行时给一次 2.4s 提示——
   * 非单行月历在 1×FULL 只有 2 行高，日格字号恒为 7.32px（被块高锁死，与占格无关），
   * 不说清楚用户会以为是被改坏了（与 `prefSpan` 回退 2×2 配套，缺一不可）。
   * v1.35：opts 合并写，避免抹掉同单元的 noUnits。
   */
  _toggleCardSpanSingleLine() {
    const info = this._cardSpanInfo();
    if (!info) return;
    const cur = unitOpts(info.mode, info.size, info.b);
    const next = !cur.singleLine;
    this._setCardBlockField({ ...(info.b.opts || {}), singleLine: next }, 'opts');
    if (next === false && isFullCard(info.size)) {
      this._showCardCfgHint(this.t('CARD_SINGLELINE_SMALL_FONT'));
    }
  }

  /**
   * v1.35：简约显示开关（隐藏 年/月/日 单位——横向以 · 分隔，竖向只显示数字）。
   * 默认关闭；仅 5 个日期样式渲染按钮（noUnitsOn 门控），与卡片尺寸无关。
   * 开启时弹一次提示解释形态，关闭不弹。opts 合并写，避免抹掉同单元的 singleLine。
   */
  _toggleCardSpanNoUnits() {
    const info = this._cardSpanInfo();
    if (!info) return;
    const cur = unitOpts(info.mode, info.size, info.b);
    const next = !cur.noUnits;
    this._setCardBlockField({ ...(info.b.opts || {}), noUnits: next }, 'opts');
    if (next) this._showCardCfgHint(this.t('CARD_NO_UNITS_ON'));
  }

  /** 写入单元的附加字段（align/opts），保留 c/s/span/n */
  _setCardBlockField(value, key) {
    const info = this._cardSpanInfo();
    if (!info) return;
    const idx = info.idx;
    const next = info.blocks.map((x, i) => (i === idx ? { ...x, [key]: value } : x));
    this._setSetting({ cardBlocks: next });
  }

  // ---------- 拖拽排序（拼接模式已选样式，全局默认） ----------

  _onCardBlockDragStart(e, idx) {
    this._cardDragIdx = idx;
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', String(idx)); } catch { /* ignore */ }
  }

  _onCardBlockDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drop-target');
  }

  _onCardBlockDragLeave(e) {
    e.currentTarget.classList.remove('drop-target');
  }

  _onCardBlockDrop(e, idx) {
    e.preventDefault();
    e.currentTarget.classList.remove('drop-target');
    const from = this._cardDragIdx;
    this._cardDragIdx = null;
    if (from == null || from === idx) return;
    const size = this.cardCfgSize || '2x2';
    const next = [...this._cardBlocksFor(size)];
    const [moved] = next.splice(from, 1);
    next.splice(idx, 0, moved);
    this._setSetting({ cardBlocks: next });
  }

  _onCardBlockDragEnd() {
    this._cardDragIdx = null;
    const root = this.renderRoot;
    if (root) root.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
    this.requestUpdate();
  }

  _showCardCfgHint(text) {
    this.cardCfgHint = text;
    if (this._cardCfgHintTimer) clearTimeout(this._cardCfgHintTimer);
    this._cardCfgHintTimer = setTimeout(() => {
      this.cardCfgHint = null;
      if (this.isConnected) this.requestUpdate();
    }, 2400);
    this.requestUpdate();
  }

  /** 卡片预览（随显示模式 / 单元 / 主题实时变化） */
  _renderCardPreview(size) {
    const s = this._settings();
    const visual = cardThemeVisual(s.cardTheme, this.spCtx?.darkMode ?? false);
    const bright = Math.min(100, Math.max(30, Number(s.cardBrightness) || 100)) / 100;
    const theme = this._theme();
    const displayMode = this._cardDisplayMode();
    const blocks = this._cardBlocksFor(size);
    // SunPanel 尺寸为「行×列」，预览按 [列,行] 等比缩放（与 widgetConfig 一致）
    const [pvCols, pvRows] = CARD_SIZE_GRID[size] || [2, 2];
    const pvU = Math.min(90, 200 / pvRows, 220 / pvCols);
    const pvW = Math.round(pvU * pvCols);
    const pvH = Math.round(pvU * pvRows);
    const common = {
      visual,
      theme,
      now: this.now,
      isZh: this._isZh(),
      weekStart: s.weekStart ?? 1,
      hour12: s.hour12,
      t: (k) => this.t(k),
    };
    // 卡片内可用区 = 预览框去掉 6% 内边距
    const grid = gridForSize(size);
    const cellW = (pvW * 0.88) / (grid.cols || 1);
    const cellH = (pvH * 0.88) / (grid.rows || 1);
    const inner = displayMode === 'combo'
      ? renderBlocksHTML({
        ...common,
        blocks: layoutBlocks(blocks, 'combo', size, grid, this._cardCenter()),
        grid,
        cellW,
        cellH,
        size,
      })
      : renderInfoBlock({ ...common, content: blocks[0].c, style: blocks[0].s, singleRow: true, size });

    return html`
      <div class="card-preview" style="${visual.bg};filter:brightness(${bright});width:${pvW}px;height:${pvH}px">
        <div class="pv-inner" style="color:${visual.label}">
          <div class="card-mode-wrap">${inner}</div>
        </div>
      </div>
      <style>
        .card-preview {
          border-radius: 16px;
          padding: 6%;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          transition: filter 0.2s, background 0.2s;
        }
        .pv-inner { width: 100%; height: 100%; display: flex; flex-direction: column; min-width: 0; }
        /* 字号一律用 em：拼接块由 JS 按单元格像素内联根字号，实现等比缩放 */
        .card-mode-wrap { flex: 1; min-height: 0; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 12px; }
        .pv-center { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.375em; width: 100%; text-align: center; }
        /* v1.41：text-align 居中换行文字（「今天」折行场景，同 widget.js 注释） */
        /* v1.40 需求 2：宽扁块（像素比 ≥2:1）倒数型双栏布局（数字列 + 文字列） */
        .pv-center.pv-flat { flex-direction: row; align-items: center; justify-content: center; gap: 0.5em; }
        .pv-fnum { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 0 1 auto; }
        .pv-ftext { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.1875em; flex: 0 1 auto; min-width: 0; text-align: center; }
        .pv-col { display: flex; flex-direction: column; gap: 0.3125em; width: 100%; }
        .pv-gap { height: 0.5em; }
        .pv-big { font-size: 1.875em; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; }
        .pv-mid { font-size: 1em; font-weight: 700; line-height: 1.25; }
        /* v1.35：简约显示的间隔圆点（方案 B 自绘，实测单点占位 0.84em） */
        .pv-dot { display:inline-block; width:.28em; height:.28em; border-radius:50%; background:currentColor; margin:0 .28em; vertical-align:.21em; }
        .text-light .pv-dot { box-shadow: 0 1px 2px rgba(0,0,0,0.38); }
        .pv-led { text-shadow: 0 0 12px currentColor, 0 0 3px currentColor; }
        .pv-row2 { font-size: 0.75em; font-weight: 600; }
        .pv-sch-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5em; width: 100%; }
        .pv-sch-name { font-size: 0.75em; font-weight: 600; line-height: 1.2; flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pv-sch-meta { display: flex; flex-direction: column; align-items: flex-end; flex: 0 0 auto; font-size: 0.5em; line-height: 1.2; white-space: nowrap; }
        .pv-sch-line { line-height: 1.25; }
        .pv-sch-date { opacity: 0.95; }
        .pv-sch-time { opacity: 0.8; }
        .pv-sub { font-size: 0.5625em; line-height: 1.3; }
        /* v1.43：块根字号 <10px 时隐藏说明级小字 */
        .pv-tight .pv-sub { display: none; }
        .pv-bar { height: 0.25em; border-radius: 0.125em; overflow: hidden; }
        .pv-fill { height: 100%; border-radius: 0.125em; }
        .pv-chip2 { font-size: 0.6875em; padding: 0.25em 0.625em; border-radius: 0.5em; font-weight: 600; display: inline-flex; gap: 0.375em; align-items: center; }
        .pv-flip { display: inline-flex; gap: 0.25em; align-items: center; }
        .pv-flip-box { font-size: 1.375em; font-weight: 800; padding: 0.25em 0.5em; border-radius: 0.375em; font-variant-numeric: tabular-nums; }
        .pv-ap { font-size: 0.6875em; font-weight: 600; }
        .pv-wk { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.125em; }
        .pv-wk-cell { display: flex; flex-direction: column; align-items: center; border-radius: 0.375em; padding: 0.1875em 0; }
        .pv-wk-d { font-size: 0.75em; font-weight: 600; }
        .pv-wk-w { font-size: 0.5em; }
        /* v1.31：间距统一由 .pv-col 的 gap(.3125em) 提供，不再叠加 margin-top */
        .pv-mini-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.125em; margin-top: 0; }
        /* ---- v1.31 新增：窄高块竖排容器 ---- */
        .pv-vstack { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; gap: 0.1875em; }
        .pv-vstack.t { gap: 0.125em; }
        .pv-vline { font-size: 1.25em; font-weight: 700; line-height: 1.15; white-space: nowrap; font-variant-numeric: tabular-nums; }
        /* v1.35 反馈 1：竖排简约的星期行降为说明级字号，使数字行与无星期样式字号相等 */
        .pv-vline.wk { font-size: 0.7em; }
        .pv-vbig { font-size: 1.875em; font-weight: 800; line-height: 1.1; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .pv-vrow { display: flex; align-items: baseline; justify-content: center; gap: 0.25em; width: 100%; }
        /* ---- v1.31 新增：日历日期标题 ---- */
        .pv-cal-head { text-align: center; color: inherit; line-height: 1.2; }
        .pv-cal-wd { font-size: 0.5625em; font-weight: 600; margin-left: 0.3125em; }
        /* ---- v1.31 新增：周日历竖排（7 天改 7 行） ---- */
        .pv-wkv { display: grid; grid-template-rows: repeat(7, 1fr); grid-template-columns: 1fr; gap: 0.0625em; width: 100%; }
        .pv-wkv-cell { display: flex; align-items: center; justify-content: space-between; padding: 0.125em 0.375em; border-radius: 0.375em; }
        .pv-wkv-d { font-size: 0.75em; font-weight: 600; line-height: 1.2; font-variant-numeric: tabular-nums; }
        .pv-wkv-w { font-size: 0.5625em; line-height: 1.3; text-align: right; }
        /* ---- v1.31 新增：1×1 占格的小卡星期（字号减半） ---- */
        .pv-wd-sm { font-size: 0.9375em; font-weight: 700; line-height: 1.1; }
        .pv-sub-sm { font-size: 0.5em; }
        /* 拼接块内的竖排内容填满块高；月历行高按剩余高度均分，避免 7 行溢出块外 */
        .pv-block > .pv-col { align-self: stretch; flex: 1 1 auto; min-height: 0; }
        .pv-block > .pv-col > .pv-mini-grid { flex: 1 1 auto; min-height: 0; grid-auto-rows: 1fr; }
        .pv-mini-grid > .pv-c { aspect-ratio: auto; min-height: 0; line-height: 1; }
        .pv-c { aspect-ratio: 1; border-radius: 0.25em; display: flex; align-items: center; justify-content: center; font-size: 0.5625em; font-weight: 500; }
        .pv-c.out { opacity: 0.35; }
        .pv-yearcal { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.3125em; }
        .pv-yearcal-m { display: flex; flex-direction: column; gap: 0.125em; }
        .pv-yearcal-t { font-size: 0.5em; font-weight: 700; text-align: center; }
        /* 拼接模式：网格布局（绝对定位，坐标/尺寸由 JS 按 span 百分比内联） */
        .pv-blocks { position: relative; flex: 1; min-height: 0; width: 100%; }
        .pv-block {
          position: absolute;
          box-sizing: border-box;
          padding: 0.1875em;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .pv-single .pv-center { flex-direction: row; flex-wrap: wrap; justify-content: center; gap: 0.5em; }
        /* v1.40：单独模式按卡片尺寸的版式规则（只作用于 .pv-single，不影响拼接模式；
           与 widget / widgetConfig / make-preview / measure.html 五处镜像，改规则必须同步） */
        .pv-single-1x1 .pv-big,
        .pv-single-1x1 .pv-mid,
        .pv-single-1x1 .pv-vbig { font-size: 1.25em; }
        .pv-single-1x1 .pv-sub { display: none; }
        .pv-single-1x2 .pv-center { gap: 0.75em; }
        .pv-single-1x2 .pv-big,
        .pv-single-1x2 .pv-mid,
        .pv-single-1x2 .pv-vbig { font-size: 1.15em; }
        .pv-single-2x1 .pv-center { flex-direction: column; gap: 0.375em; }
        .pv-single-2x1 .pv-big,
        .pv-single-2x1 .pv-mid,
        .pv-single-2x1 .pv-vbig { font-size: 1.1em; }
        .pv-single-2x2 .pv-center { gap: 0.5em; }
        .pv-single-2x4 .pv-center { gap: 0.875em; }
        .pv-single-2x4 .pv-big,
        .pv-single-2x4 .pv-mid,
        .pv-single-2x4 .pv-vbig { font-size: 1.2em; }
        .pv-single-4x4 .pv-big,
        .pv-single-4x4 .pv-mid,
        .pv-single-4x4 .pv-vbig { font-size: 1.25em; }
        .pv-single-4x4 .pv-sub { font-size: 0.6875em; }
        .pv-single-1xfull .pv-center { align-items: center; gap: 1em; }
        .pv-single-1xfull .pv-big,
        .pv-single-1xfull .pv-mid,
        .pv-single-1xfull .pv-vbig { font-size: 1.3em; }
      </style>
    `;
  }

  _renderCardCfg() {
    if (!this.cardCfgOpen) return '';
    const dark = this.spCtx?.darkMode ?? false;
    const theme = this._theme();
    const zh = this._isZh();
    const sizes = ['1x1', '1x2', '2x1', '2x2', '2x4', '4x4', '1xfull'];
    const sizeLabels = {
      '1x1': '1×1', '1x2': '1×2', '2x1': '2×1', '2x2': '2×2',
      '2x4': '2×4', '4x4': '4×4', '1xfull': '1×FULL',
    };
    const size = this.cardCfgSize || '2x2';
    const grid = gridForSize(size);
    const mode = this._cardDisplayMode();
    const isCombo = mode === 'combo';
    const blocks = this._cardBlocksFor(size);
    const laidMap = new Map(
      layoutBlocks(blocks, 'combo', size, gridForSize(size), this._cardCenter()).map((b) => [unitId(b), b]),
    );
    const { c: pendingContent, s: pendingStyle } = this._cardPending();
    const cd = contentDef(mode, pendingContent);
    const contentOptions = displayContents(mode).map((c) => ({
      value: c.key,
      label: `${c.icon} ${zh ? c.zh : c.en}`,
    }));

    // v1.29：实例名只显示样式名；尺寸徽标为「垂直×水平」，点击 chip 可调整占格
    const editIdx = this._cardSpanEdit ? this._cardSpanEdit.idx : -1;
    const chipNodes = blocks.map((b, i) => {
      const hit = laidMap.get(unitId(b));
      const span = hit ? hit.span : effectiveSpan('combo', size, b);
      const over = !hit;
      return html`
      <div
        class="block-chip ${over ? 'overflow' : ''} ${editIdx === i ? 'editing' : ''}"
        key="chip-${i}"
        draggable="true"
        title="${over
          ? (zh ? '当前尺寸放不下此单元，请缩小占格或换更大的卡片尺寸' : 'Does not fit this card size — shrink it or pick a bigger size')
          : (zh ? '点击调整占格；拖动排序；点击 × 取消显示' : 'Tap to resize; drag to reorder; tap × to remove')}"
        @dragstart=${(e) => this._onCardBlockDragStart(e, i)}
        @dragover=${(e) => this._onCardBlockDragOver(e)}
        @dragleave=${(e) => this._onCardBlockDragLeave(e)}
        @drop=${(e) => this._onCardBlockDrop(e, i)}
        @dragend=${() => this._onCardBlockDragEnd()}
        @click=${() => this._toggleCardSpanEdit(i)}
      >
        <span class="chip-grip">⣿</span>
        <span class="chip-name">${this._cardStyleName(b)}</span>
        <span class="chip-span ${over ? 'bad' : ''}">${over ? (zh ? '溢出' : 'N/A') : `${span.rows}×${span.cols}`}</span>
        <button class="chip-x" aria-label="remove" @click=${(e) => { e.stopPropagation(); this._removeCardBlock(i); }}>
          <svg viewBox="0 0 10 10" width="9" height="9"><path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
        </button>
      </div>
    `;
    });

    // 显示样式区：样式选项 + 样式预览框（‹ › 切换 + 序号/总数）
    // v1.35：原独立「显示内容」栏并入此处——标题行之下、样式条之上
    const styleList = cd ? cd.styles : [];
    const styleIdx = Math.max(0, styleList.findIndex((s) => s.key === pendingStyle));
    const curStyle = styleList[styleIdx];
    const curSpan = curStyle ? styleSpanDef(mode, cd.key, curStyle.key).span : { cols: 1, rows: 1 };
    const cfgSettings = this._settings();
    const frameVisual = cardThemeVisual(cfgSettings.cardTheme, dark);
    const frameTextMode = frameVisual.textLight ? 'text-light' : 'text-dark';
    const frameInner = curStyle ? renderInfoBlock({
      content: cd.key,
      style: curStyle.key,
      visual: frameVisual,
      theme,
      now: this.now,
      isZh: zh,
      weekStart: cfgSettings.weekStart ?? 1,
      hour12: cfgSettings.hour12,
      t: (k) => this.t(k),
    }) : '';
    const styleSection = html`
      <div class="style-sec">
        <div class="style-sec-head">
          <span class="style-sec-title">${zh ? '显示样式' : 'Style'}</span>
          <button class="confirm-btn" style="background:${theme}" @click=${this._confirmCardStyle}>${zh ? '确定' : 'Done'}</button>
        </div>
        <div class="style-content-row">
          <span class="style-content-label">${zh ? '显示内容' : 'Content'}</span>
          ${appleSelect(contentOptions, pendingContent, (v) => this._setCardPendingContent(v), theme)}
        </div>
        <div class="style-opts card-strip">
          ${styleList.map((st) => html`
            <button
              class="style-opt ${pendingStyle === st.key ? 'active' : ''}"
              key="s-${st.key}"
              style="${pendingStyle === st.key ? `border-color:${theme};color:${theme}` : ''}"
              @click=${() => this._setCardPendingStyle(st.key)}
            >${zh ? st.zh : st.en}</button>
          `)}
        </div>
        <div class="style-stage">
          <button class="style-nav" aria-label="prev" @click=${() => this._shiftCardPendingStyle(-1)}>
            <svg viewBox="0 0 8 13" width="8" height="13"><path d="M7 1L1 6.5 7 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="style-frame ${frameTextMode}" style="${frameVisual.bg}">
            <div class="card-mode-wrap">${frameInner}</div>
          </div>
          <button class="style-nav" aria-label="next" @click=${() => this._shiftCardPendingStyle(1)}>
            <svg viewBox="0 0 8 13" width="8" height="13"><path d="M1 1l6 5.5L1 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="style-counter">${styleList.length
          ? html`${styleIdx + 1}/${styleList.length}${zh ? ` · ${curStyle.zh}` : ` · ${curStyle.en}`}
            <span class="counter-size">${zh ? '尺寸' : 'size'} ${curSpan.rows}×${curSpan.cols}</span>`
          : ''}</div>
      </div>
    `;

    return html`
      <div class="fullscreen" style="${appleThemeVars(dark)}">
        <div class="fs-nav">
          <span class="nav-btn invisible"></span>
          <span class="nav-title">${this.t('MAIN_CARD_CONTENT_TITLE')}</span>
          <button class="nav-btn strong" style="color:${theme}" @click=${() => { this.cardCfgOpen = false; this.requestUpdate(); }}>${this.t('MAIN_DONE')}</button>
        </div>
        <div class="fs-body">
          <div class="cfg-label">${this.t('CARD_SIZE_LABEL')}</div>
          <div class="size-pills">
            ${sizes.map((sz) => html`
              <button class="size-pill ${sz === size ? 'active' : ''}" style="${sz === size ? `background:${theme};color:#fff;border-color:${theme}` : ''}" key="${sz}" @click=${() => this._setCardCfgSize(sz)}>
                ${sizeLabels[sz]}
              </button>
            `)}
          </div>

          <div class="cfg-label">${this.t('CARD_MODE_LABEL')}</div>
          <div class="mode-tabs">
            <button class="mode-tab ${isCombo ? 'active' : ''}" style="${isCombo ? `border-color:${theme}` : ''}" @click=${() => this._setCardDisplayMode('combo')}>
              <span class="mode-tab-icon">${DISPLAY_MODES.combo.icon}</span>
              <span class="mode-tab-name" style="${isCombo ? `color:${theme}` : ''}">${zh ? DISPLAY_MODES.combo.zh : DISPLAY_MODES.combo.en}</span>
              <span class="mode-tab-sub">${zh ? '一卡多个显示样式' : 'Multiple styles per card'}</span>
            </button>
            <button class="mode-tab ${!isCombo ? 'active' : ''}" style="${!isCombo ? `border-color:${theme}` : ''}" @click=${() => this._setCardDisplayMode('single')}>
              <span class="mode-tab-icon">${DISPLAY_MODES.single.icon}</span>
              <span class="mode-tab-name" style="${!isCombo ? `color:${theme}` : ''}">${zh ? DISPLAY_MODES.single.zh : DISPLAY_MODES.single.en}</span>
              <span class="mode-tab-sub">${zh ? '一卡一个显示样式' : 'One style per card'}</span>
            </button>
          </div>

          ${isCombo ? html`
            <div class="mode-row">
              ${this._renderCardPreview(size)}
              <div class="chips-block">
                <div class="block-chips">${chipNodes}</div>
                ${blocks.length ? '' : html`<div class="chips-empty">${zh ? '卡片当前不显示任何内容' : 'The card shows nothing right now'}</div>`}
                <div class="chip-tools">
                  <button class="chip-tool" @click=${this._addCardBlank}>
                    <svg viewBox="0 0 16 16" width="12" height="12"><rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.5 2.5"/></svg>
                    ${zh ? '空白填充' : 'Add blank'}
                  </button>
                  <button
                    class="chip-tool ${this._cardCenter().h ? 'on' : ''}"
                    style="${this._cardCenter().h ? `border-color:${theme};color:${theme}` : ''}"
                    @click=${() => this._toggleCardCenter('h')}
                  >${zh ? '水平置中' : 'Center H'}</button>
                  <button
                    class="chip-tool ${this._cardCenter().v ? 'on' : ''}"
                    style="${this._cardCenter().v ? `border-color:${theme};color:${theme}` : ''}"
                    @click=${() => this._toggleCardCenter('v')}
                  >${zh ? '垂直置中' : 'Center V'}</button>
                </div>
                <div class="tool-note">${this.t('CARD_CENTER_TAKEOVER_NOTE')}</div>
              </div>
            </div>
            ${this._renderCardSpanEditor()}
          ` : html`
            <div class="mode-preview-wrap">${this._renderCardPreview(size)}</div>
          `}
          ${styleSection}
          ${this.cardCfgHint ? html`<div class="cap-hint">${this.cardCfgHint}</div>` : ''}
          <div class="mode-note">${this.t('CARD_MODE_NOTE')}</div>
        </div>
      </div>
      <style>
        /* 拼接模式：左侧预览 + 右侧已选样式（同一行）；显示内容/显示样式在下方全宽 */
        .mode-row { display: flex; gap: 14px; align-items: center; }
        /* 卡片无内容时的提示 */
        .chips-empty { font-size: 11px; font-weight: 500; color: var(--apple-label-3); padding: 2px 0; }
        /* 预览右侧工具：空白填充 / 水平置中 / 垂直置中 */
        .chip-tools { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .chip-tool {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border: 1.5px solid var(--apple-separator);
          background: var(--apple-card);
          border-radius: 999px;
          padding: 5px 10px;
          font-size: 11px;
          font-weight: 600;
          color: var(--apple-label-2);
          cursor: pointer;
          font-family: inherit;
          white-space: nowrap;
        }
        .chip-tool:active { transform: scale(0.96); }
        .chips-block { flex: 1; min-width: 0; }
        .block-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        /* 单独模式：预览居中，选项在下（与拼接模式排版一致，仅预览位置不同） */
        .mode-preview-wrap { display: flex; justify-content: center; padding: 6px 0 14px; }
        .block-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1.5px solid var(--apple-separator);
          background: var(--apple-card);
          border-radius: 999px;
          padding: 5px 6px 5px 10px;
          font-size: 12px;
          font-weight: 600;
          color: var(--apple-label);
          cursor: grab;
          user-select: none;
          touch-action: none;
        }
        .block-chip.drop-target { border-color: ${theme}; box-shadow: 0 0 0 1px ${theme}; }
        .chip-grip { color: var(--apple-label-3); font-size: 10px; letter-spacing: -2px; }
        .chip-name { white-space: nowrap; }
        /* 占位徽标（列×行）：直观显示每个单元的占格。
           v1.31：color 由 label-3 改为 --apple-label —— 9px 小字显示真实占格数值，
           不适用任何对比度豁免，原 3.14/2.72 两端不达标；改后 16.54/10.81，
           与本迭代新增的「接管 / 默认」角标口径一致。 */
        .chip-span {
          font-size: 9px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          color: var(--apple-label);
          background: var(--apple-fill);
          border-radius: 5px;
          padding: 1px 4px;
          line-height: 1.5;
        }
        .chip-span.bad { color: #fff; background: #FF3B30; }
        .block-chip.overflow { border-style: dashed; opacity: 0.72; }
        /* 正在编辑占格的 chip */
        .block-chip.editing { border-color: ${theme}; box-shadow: 0 0 0 1px ${theme}; }
        .block-chip.editing .chip-name { color: ${theme}; }
        .chip-x {
          border: none;
          background: var(--apple-fill);
          color: var(--apple-label-2);
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0;
          flex-shrink: 0;
        }
        .chip-x:active { transform: scale(0.88); }
        .cap-hint { font-size: 12px; color: var(--apple-red); padding: 0 0 10px; font-weight: 500; }
        /* 卡片级置中开关下方的说明（v1.31 需求 1） */
        .tool-note {
          font-size: 11px; font-weight: 500; color: var(--apple-label-3);
          margin-top: 6px; line-height: 1.4;
        }
        .style-sec { padding: 2px 0 4px; }
        .style-sec-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 2px 0 10px;
        }
        .style-sec-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--apple-label-3);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        /* v1.35：原独立「显示内容」栏并入显示样式区——标题行之下、样式条之上 */
        .style-content-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          background: var(--apple-card);
          border-radius: 10px;
          padding: 10px 12px;
          margin-bottom: 8px;
        }
        .style-content-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--apple-label);
          white-space: nowrap;
        }
        .confirm-btn {
          border: none;
          border-radius: 9px;
          padding: 7px 20px;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          color: #fff;
          cursor: pointer;
          transition: transform 0.15s, opacity 0.15s;
        }
        .confirm-btn:active { transform: scale(0.95); opacity: 0.85; }
        /* v1.29：显示样式名称只占一排，多余的横向滚动（配合左右按钮切换） */
        .style-opts {
          display: flex;
          flex-wrap: nowrap;
          gap: 8px;
          background: var(--apple-card);
          border-radius: 10px;
          padding: 10px 12px;
          overflow-x: auto;
          overflow-y: hidden;
          position: relative;
          scroll-behavior: smooth;
          scrollbar-width: thin;
        }
        .style-opts::-webkit-scrollbar { height: 4px; }
        .style-opts::-webkit-scrollbar-thumb { background: rgba(120,120,128,0.28); border-radius: 2px; }
        .style-opt {
          border: 1.5px solid var(--apple-separator);
          background: var(--apple-card);
          border-radius: 999px;
          padding: 7px 14px;
          font-size: 13px;
          font-weight: 500;
          color: var(--apple-label);
          cursor: pointer;
          font-family: inherit;
          white-space: nowrap;
          flex: 0 0 auto;
          transition: border-color 0.15s, transform 0.1s;
        }
        .style-opt:active { transform: scale(0.95); }
        .style-opt.active { font-weight: 700; }
        /* 样式预览框：‹ › 切换 + 序号/总数 */
        .style-stage {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0 2px;
          margin-top: 10px;
        }
        .style-nav {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: none;
          background: var(--apple-fill);
          color: var(--apple-label-2);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          padding: 0;
        }
        .style-nav:active { opacity: 0.7; }
        .style-frame {
          flex: 1;
          min-width: 0;
          border-radius: 10px;
          padding: 10px 8px;
          min-height: 76px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .style-frame.text-light { text-shadow: 0 1px 2px rgba(0,0,0,0.38); }
        /* 根字号：块内 em 全部按此等比缩放（与卡片渲染共享 em 体系） */
        .style-frame .card-mode-wrap { width: 100%; height: 100%; font-size: 11px; }
        .style-counter {
          text-align: center;
          font-size: 12px;
          font-weight: 600;
          color: var(--apple-label-3);
          padding: 6px 0 2px;
          font-variant-numeric: tabular-nums;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        /* 当前样式的尺寸（垂直×水平） */
        .counter-size {
          font-size: 10px;
          font-weight: 700;
          color: var(--apple-label-2);
          background: var(--apple-fill);
          border-radius: 5px;
          padding: 2px 6px;
          line-height: 1.4;
        }
        /* v1.31 触摸目标统一口径：视觉 min-height 36px + ::after 伪元素把热区撑到 44×44。
           44px 是「热区」要求而非「视觉盒子」要求（WCAG 2.2 SC 2.5.5 / Apple HIG 44pt
           指的都是可点区域；SC 2.5.8 的底线仅 24px），11px 文字配实心 44px 胶囊会显得空旷。
           .se-toggle / .se-actions / .chip-tool 三者必须同步改，否则同面板出现两种高度。 */
        .se-toggle, .se-actions button, .chip-tool {
          position: relative;
          min-height: 36px;
        }
        .se-toggle {
          border: 1.5px solid var(--apple-separator);
          background: transparent;
          color: var(--apple-label-2);
          border-radius: 999px;
          padding: 8px 14px;
          font-size: 11px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          white-space: nowrap;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        /* 热区上下各扩 4px：相邻两行各占 4px → 行间距必须 ≥8px，
           否则上一行按钮底部 2px 点不到（z-index 只决定归属，不消除重叠）。 */
        .se-toggle::after, .se-actions button::after, .chip-tool::after {
          content: '';
          position: absolute;
          left: 0;
          right: 0;
          top: -4px;
          bottom: -4px;
        }
        .se-toggle:active { transform: scale(0.96); }
        /* 只加行距，横向 6px 节奏不变 */
        .se-toggles {
          display: flex;
          flex-wrap: wrap;
          column-gap: 6px;
          row-gap: 8px;
          margin-top: 10px;
        }
        .se-actions {
          display: flex;
          gap: 6px;
          margin-top: 8px;
          position: relative;
          z-index: 1;
        }
        /* 「接管」态：该轴被卡片级覆盖 → 虚线边 + label-3 灰显（浅 3.44 / 深 3.16，
           适用 WCAG 1.4.3 非活动界面组件豁免 ≥3:1）。
           保留可点击（不用 pointer-events:none / disabled）：点了给原因 + 一键解锁。
           !important 用于压过「开」态的内联主题色。 */
        .se-toggle.locked {
          border-style: dashed;
          border-color: var(--apple-label-3) !important;
          color: var(--apple-label-3) !important;
          background: transparent !important;
          cursor: not-allowed;
        }
        /* 角标承载状态语义，不适用豁免（字号 10px 属小字 → 须 ≥4.5:1）：
           --apple-label 对角标自己的 --apple-fill 底（浅 #E4E4E6 / 深 #3D3D41）
           = 16.54 / 10.81 ✅。不用 label-2（对 fill 底深色仅 4.42 ❌）。
           互斥：接管态不显示「默认」角标（此时单元级本就无效）。 */
        .se-tag {
          font-size: 10px;
          font-weight: 700;
          color: var(--apple-label);
          background: var(--apple-fill);
          border-radius: 5px;
          padding: 1px 5px;
          line-height: 1.4;
          white-space: nowrap;
        }
        .se-lock { flex-shrink: 0; opacity: 0.9; }
        /* 单元级置中的副标题：独立元素，放在 .se-toggles 之外 */
        .se-hint {
          font-size: 11px;
          font-weight: 500;
          color: var(--apple-label-3);
          line-height: 1.35;
          margin-top: 6px;
        }
        /* 占格编辑器（v1.29：点击已选样式名展开） */
        .span-editor {
          margin: 10px 0 0;
          background: var(--apple-card);
          border: 1px solid var(--apple-separator);
          border-radius: 12px;
          padding: 10px 12px 12px;
        }
        .se-head { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
        .se-title { font-size: 13px; font-weight: 700; color: var(--apple-label); }
        .se-unit { font-size: 12px; font-weight: 600; color: var(--apple-label-3); }
        .se-close {
          margin-left: auto; border: none; background: var(--apple-fill);
          color: var(--apple-label-2); width: 22px; height: 22px; border-radius: 50%;
          cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 0;
        }
        .se-body { display: flex; gap: 14px; align-items: center; }
        .se-grid { display: grid; gap: 3px; width: 132px; flex-shrink: 0; }
        .se-cell {
          border: 1.5px solid rgba(120,120,128,0.28); border-radius: 3px;
          background: transparent; cursor: pointer; padding: 0;
          aspect-ratio: 1; min-height: 10px;
        }
        .se-cell.on { border-color: transparent; }
        .se-ctrls { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
        .se-row { display: flex; align-items: center; gap: 8px; }
        .se-lab { font-size: 11px; font-weight: 600; color: var(--apple-label-3); width: 26px; flex-shrink: 0; }
        .se-btn {
          width: 26px; height: 26px; border-radius: 8px; border: none;
          background: var(--apple-fill); color: var(--apple-label);
          font-size: 15px; font-weight: 700; line-height: 1; cursor: pointer; padding: 0;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .se-btn:disabled { opacity: 0.35; cursor: default; }
        .se-val { font-size: 13px; font-weight: 700; width: 20px; text-align: center; font-variant-numeric: tabular-nums; }
        .se-size {
          font-size: 11px; font-weight: 700; font-variant-numeric: tabular-nums;
          color: var(--apple-label-2); text-align: center;
        }
        .se-size-h { font-weight: 500; font-size: 9px; color: var(--apple-label-3); }
        .se-warn { font-size: 11px; font-weight: 600; color: var(--apple-red); margin-top: 8px; }
        .se-reset {
          border: 1.5px solid rgba(120,120,128,0.25); background: transparent;
          color: var(--apple-label-2); border-radius: 999px; padding: 4px 12px;
          font-size: 11px; font-weight: 600; font-family: inherit; cursor: pointer;
        }
        .style-frame svg { max-width: 56px; max-height: 56px; }
      </style>
    `;
  }

  // ---------- 导入导出（全屏） ----------

  // ---------- 日程管理（数据管理 → 日程管理） ----------

  _openScheduleMgr() {
    this.scheduleMgrOpen = true;
    this.settingsOpen = false;
    this._mgrConfirm = false;
    this._armedId = null;
    this._armedFrom = null;
    this._pendingRevealId = null;
    this._mgrFocusEl = null;
    this.requestUpdate();
  }

  /** 关闭：回到设置页（从设置进入） */
  _closeScheduleMgr() {
    this.scheduleMgrOpen = false;
    this.settingsOpen = true;
    this._mgrConfirm = false;
    this._armedId = null;
    this._armedFrom = null;
    this._pendingRevealId = null;
    this._mgrFocusEl = null;
    this.requestUpdate();
  }

  /** 管理页列表：按最近发生时间排序 */
  _mgrList() {
    const now = this.now;
    return [...this._schedules()]
      .map((item) => ({ item, next: getNextOccurrence(item, now) }))
      .sort((a, b) => {
        const ta = a.next ? a.next.date.getTime() : Number.MAX_SAFE_INTEGER;
        const tb = b.next ? b.next.date.getTime() : Number.MAX_SAFE_INTEGER;
        if (ta !== tb) return ta - tb;
        return String(a.item.title || '').localeCompare(String(b.item.title || ''));
      })
      .map((x) => x.item);
  }

  _toggleMgrItem(id) {
    if (this._mgrSel.has(id)) this._mgrSel.delete(id);
    else this._mgrSel.add(id);
    this._mgrConfirm = false;
    this.requestUpdate();
  }

  _toggleMgrAll(on) {
    const list = this._mgrList();
    if (on) list.forEach((s) => this._mgrSel.add(s.id));
    else list.forEach((s) => this._mgrSel.delete(s.id));
    this._mgrConfirm = false;
    this.requestUpdate();
  }

  /** 单项删除：先选中该项并进入二次确认（来源标记为 row，取消后清空选中） */
  _armDeleteOne(id, ev = null) {
    this._mgrSel.clear();
    this._mgrSel.add(id);
    if (ev && ev.currentTarget) this._mgrFocusEl = ev.currentTarget;
    this._openMgrConfirm('row', id);
  }

  /**
   * 取消确认：单条来源（行尾 ×）清空选中——该选中是 arm 时自动加的，不该残留；
   * 批量来源保留选中——用户可能只是想再核对。关闭后把焦点还给触发元素。
   */
  _cancelMgrConfirm() {
    if (this._armedFrom === 'row') this._mgrSel.clear();
    this._mgrConfirm = false;
    this._armedId = null;
    this._pendingRevealId = null;
    this.requestUpdate();
    const back = this._mgrFocusEl;
    this._mgrFocusEl = null;
    if (back && back.isConnected && typeof back.focus === 'function') back.focus();
  }

  async _deleteMgrSelected() {
    const ids = [...this._mgrSel].filter((id) => this._schedules().some((s) => s.id === id));
    if (!ids.length) return;
    const n = await getUserStore().removeMany(ids);
    this._mgrSel.clear();
    this._mgrConfirm = false;
    this._armedId = null;
    this._showToast(this.t('MAIN_TOAST_DELETED_MANY', { count: n }));
    this.requestUpdate();
  }

  /**
   * 打开导入导出页。
   * @param {'settings'|'list'} from 入口来源：设置进入时「完成」退回设置页，日程视图进入则退回视图
   */
  _openIO(from = 'settings') {
    this.ioFrom = from;
    this.ioOpen = true;
    if (from === 'settings') this.settingsOpen = false;
    this.requestUpdate();
  }

  /** 关闭导入导出页：从设置进入时回到设置页，不直接跳回视图 */
  _closeIO() {
    this.ioOpen = false;
    if (this.ioFrom === 'settings') this.settingsOpen = true;
    this.requestUpdate();
  }

  /** 日程管理页：可勾选后批量删除，也可单条删除（均需二次确认） */
  _renderScheduleMgr() {
    if (!this.scheduleMgrOpen) return '';
    const dark = this.spCtx?.darkMode ?? false;
    const theme = this._theme();
    const zh = this._isZh();
    const list = this._mgrList();
    const selCount = list.filter((s) => this._mgrSel.has(s.id)).length;
    const allSel = list.length > 0 && selCount === list.length;
    const confirmOpen = !!(this._mgrConfirm && selCount);
    const armedItem = confirmOpen && this._armedFrom === 'row'
      ? (list.find((s) => this._mgrSel.has(s.id)) || null)
      : null;
    return html`
      <div class="fullscreen ${dark ? 'dark' : ''}" style="${appleThemeVars(dark)}" @keydown=${(e) => this._onMgrKeydown(e)}>
        <div class="fs-nav">
          <button class="nav-btn" @click=${this._closeScheduleMgr}>${this.t('MAIN_BACK')}</button>
          <span class="nav-title">${this.t('MAIN_SCHEDULE_MGR_TITLE')}</span>
          <button class="nav-btn strong" style="color:${theme}" @click=${this._closeScheduleMgr}>${this.t('MAIN_DONE')}</button>
        </div>
        <div class="fs-body">
          ${list.length ? html`
            <div class="mgr-bar">
              <button class="mgr-btn" @click=${() => this._toggleMgrAll(!allSel)}>
                ${allSel ? this.t('MAIN_MGR_DESELECT_ALL') : this.t('MAIN_MGR_SELECT_ALL')}
              </button>
              <span class="mgr-count">${this.t('MAIN_MGR_SELECTED', { count: selCount })} / ${this.t('MAIN_MGR_TOTAL', { count: list.length })}</span>
              ${selCount ? html`<button class="mgr-btn danger" @click=${() => { this._mgrConfirm = !this._mgrConfirm; this.requestUpdate(); }}>${this.t('MAIN_MGR_DELETE_SELECTED')}</button>` : ''}
            </div>
          ` : ''}
          ${list.length ? html`
            <div class="mgr-list ${confirmOpen ? 'pad-confirm' : ''}">
              ${list.map((item) => {
                const sel = this._mgrSel.has(item.id);
                const armed = confirmOpen && this._armedId === item.id;
                const color = APPLE_COLORS[item.color] || APPLE_COLORS.red;
                const d = parseDate(item.date);
                const dateTxt = zh
                  ? `${d.getMonth() + 1}月${d.getDate()}日`
                  : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return html`
                <div class="mgr-row ${sel ? 'sel' : ''} ${armed ? 'armed' : ''}" key="mgr-${item.id}" data-mgr-id="${item.id}" @click=${() => this._toggleMgrItem(item.id)}>
                  <span class="mgr-check ${sel ? 'on' : ''}" style="${sel ? `background:${theme};border-color:${theme}` : ''}">
                    ${sel ? html`<svg viewBox="0 0 10 8" width="9" height="7"><path d="M1 4l2.6 2.6L9 1" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}
                  </span>
                  <span class="mgr-dot" style="background:${color}"></span>
                  <div class="mgr-main">
                    <div class="mgr-title">${SCHEDULE_TYPES[item.type]?.icon || SCHEDULE_TYPES.event.icon} ${item.title}</div>
                    <div class="mgr-sub">${dateTxt}${item.lunar ? (zh ? ' · 农历' : ' · Lunar') : ''}${item.time ? ` · ${item.time}` : ''}</div>
                  </div>
                  <button class="mgr-del" aria-label="delete" @click=${(e) => { e.stopPropagation(); this._armDeleteOne(item.id, e); }}>
                    <svg viewBox="0 0 10 10" width="10" height="10"><path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                  </button>
                </div>
              `;
              })}
            </div>
          ` : html`<div class="mgr-empty">${this.t('MAIN_MGR_EMPTY')}</div>`}
        </div>
        ${this._renderMgrConfirm(selCount)}
      </div>
    `;
  }

  /**
   * v1.31 需求 5：删除确认「悬浮栏」。
   * 必须挂在 .fullscreen 上（.fs-body 的兄弟）才能脱离滚动容器，
   * 否则列表一长就得滚到顶部才看得见。
   * 定位一律 position:absolute —— 微应用里 fixed 的包含块会被
   * backdrop-filter / transform 祖先劫持，且不受 .root{overflow:hidden} 裁剪，
   * 会盖到 SunPanel 自身界面上。
   */
  _renderMgrConfirm(selCount) {
    if (!this._mgrConfirm || !selCount) return '';
    const single = selCount === 1 && this._armedFrom === 'row';
    const armedItem = single
      ? (this._schedules().find((s) => this._mgrSel.has(s.id)) || null)
      : null;
    const text = single
      ? this.t('MAIN_MGR_CONFIRM_DELETE_ONE', { title: (armedItem && armedItem.title) || '' })
      : this.t('MAIN_MGR_CONFIRM_DELETE', { count: selCount });
    return html`
      <div class="mgr-scrim" aria-hidden="true" @click=${() => this._cancelMgrConfirm()}></div>
      <div class="mgr-confirm" role="alertdialog" aria-modal="true" aria-labelledby="cf-title">
        <span class="cf-text" id="cf-title">${text}</span>
        <button class="cf-btn cancel" @click=${() => this._cancelMgrConfirm()}>${this.t('MAIN_MGR_CANCEL')}</button>
        <button class="cf-btn danger" @click=${() => this._deleteMgrSelected()}>${this.t('MAIN_MGR_CONFIRM_YES')}</button>
      </div>
    `;
  }

  /** 悬浮确认栏：Esc 取消（iframe 未获焦点时收不到，属降级点） */
  _onMgrKeydown(e) {
    if (!this._mgrConfirm) return;
    const k = e && e.key;
    if (k === 'Escape' || k === 'Esc') {
      if (e.stopPropagation) e.stopPropagation();
      this._cancelMgrConfirm();
    }
  }

  /** 打开确认栏并记录来源；聚焦「取消」（安全默认），关闭后焦点归还触发元素 */
  _openMgrConfirm(from, armedId = null) {
    this._armedFrom = from;
    this._armedId = armedId;
    // 仅单条删除（armedId 非空）需要把该行滚入可视区
    this._pendingRevealId = armedId;
    this._mgrConfirm = true;
    this.requestUpdate();
    const focusCancel = () => {
      if (!this.isConnected) return;
      const el = this.renderRoot && this.renderRoot.querySelector('.cf-btn.cancel');
      if (el && typeof el.focus === 'function') el.focus();
    };
    if (this.updateComplete && typeof this.updateComplete.then === 'function') {
      this.updateComplete.then(focusCancel).catch(() => {});
    } else {
      focusCancel();
    }
  }

  /** 批量删除：进入二次确认（保留已选，取消后不清除） */
  _armBatchDelete() {
    this._openMgrConfirm('batch', null);
  }

  /**
   * v1.31 需求 5：把「待删除行」滚入可视区（悬浮条出现时）。
   * - **不用 `scrollIntoView`**：它会向上冒泡滚动所有可滚动祖先（SunPanel 面板 / 宿主页面），
   *   在 iframe 里会带动外层滚动。改为手动算 `.fs-body.scrollTop`。
   * - 仅当该行未完整可见时才滚动，避免无谓跳动。
   * - `behavior:'smooth'` 在 `prefers-reduced-motion: reduce` 下降级为 `'auto'`。
   */
  _revealArmedRow(id) {
    const root = this.renderRoot;
    if (!root) return;
    const body = root.querySelector('.fs-body');
    const row = root.querySelector(`[data-mgr-id="${id}"]`);
    if (!body || !row) return;
    const rb = row.getBoundingClientRect();
    const bb = body.getBoundingClientRect();
    const pad = 12;
    if (rb.top >= bb.top + pad && rb.bottom <= bb.bottom - pad) return;
    const delta = rb.top - bb.top - (bb.height - rb.height) / 2;
    const top = Math.max(0, body.scrollTop + delta);
    const reduce = typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (typeof body.scrollTo === 'function') {
      try {
        body.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' });
        return;
      } catch { /* 某些环境不支持 options 形式，降级到直接赋值 */ }
    }
    body.scrollTop = top;
  }

  _renderIO() {
    if (!this.ioOpen) return '';
    const dark = this.spCtx?.darkMode ?? false;
    const theme = this._theme();
    const count = this._schedules().length;

    return html`
      <div class="fullscreen" style="${appleThemeVars(dark)}">
        <div class="fs-nav">
          <span class="nav-btn invisible"></span>
          <span class="nav-title">${this.t('MAIN_IO_TITLE')}</span>
          <button class="nav-btn" @click=${() => this._closeIO()}>${this.t('MAIN_DONE')}</button>
        </div>
        <div class="fs-body">
          <div class="io-info">${this.t('MAIN_IO_CURRENT_COUNT', { count })}</div>
          <div class="io-actions">
            ${appleButton(this.t('MAIN_IO_EXPORT'), () => this._exportData(), { color: theme })}
            ${appleButton(this.t('MAIN_IO_EXPORT_ICS'), () => this._exportICal('ics'), { color: theme })}
            ${appleButton(this.t('MAIN_IO_EXPORT_VCS'), () => this._exportICal('vcs'), { color: theme })}
          </div>
          <div class="io-actions">
            ${appleButton(this.t('MAIN_IO_IMPORT'), () => this.renderRoot.querySelector('input[type="file"]')?.click(), { color: theme, filled: false })}
          </div>
          <div class="io-hint">${this.t('MAIN_IO_HINT')}</div>
          <input type="file" accept=".json,.ics,.vcs,.ical,text/calendar,application/json" style="display:none" @change=${this._handleImport} />
        </div>
      </div>
    `;
  }

  /** 下载文件（统一入口） */
  _downloadFile(name, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  _exportData() {
    const store = getUserStore();
    if (!store) return;
    this._downloadFile(`calendar-backup-${todayStr()}.json`, store.exportData(), 'application/json');
    this._showToast(this.t('MAIN_TOAST_EXPORTED'));
  }

  /** 导出 ICS / VCS（variant: 'ics' | 'vcs'） */
  _exportICal(variant) {
    const store = getUserStore();
    if (!store) return;
    const ext = variant === 'vcs' ? 'vcs' : 'ics';
    this._downloadFile(`calendar-${todayStr()}.${ext}`, store.exportICalData(variant), 'text/calendar;charset=utf-8');
    this._showToast(this.t(variant === 'vcs' ? 'MAIN_TOAST_EXPORTED_VCS' : 'MAIN_TOAST_EXPORTED_ICS'));
  }

  async _handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const result = await getUserStore().importData(text);
      if (result.ok) {
        let msg = this.t('MAIN_TOAST_IMPORTED', { count: result.imported });
        if (result.flattened) msg += this.t('MAIN_TOAST_IMPORT_FLATTENED', { count: result.flattened });
        this._showToast(msg);
        this._closeIO();
      } else if (result.error === 'INVALID_JSON') {
        this._showToast(this.t('MAIN_TOAST_IMPORT_BAD_JSON'));
      } else if (result.error === 'EMPTY_ICAL') {
        this._showToast(this.t('MAIN_TOAST_IMPORT_EMPTY_ICAL'));
      } else {
        this._showToast(this.t('MAIN_TOAST_IMPORT_BAD_FORMAT'));
      }
    } catch {
      this._showToast(this.t('MAIN_TOAST_IMPORT_FAILED'));
    }
    e.target.value = '';
    this.requestUpdate();
  }

  // ---------- 主渲染 ----------

  render() {
    const dark = this.spCtx?.darkMode ?? false;
    const theme = this._theme();
    const s = this._settings();
    const nextHoliday = getNextHoliday(getHolidayService(), this.now);
    const nextTerm = getNextSolarTerm(this.now);

    const upcoming = this._schedules()
      .map((item) => ({ item, next: getNextOccurrence(item, this.now) }))
      .filter((x) => x.next)
      .sort((a, b) => diffDays(a.next.date, this.now) - diffDays(b.next.date, this.now))
      .slice(0, 3);

    const stripTime = formatTime(this.now, s.hour12).replace(/(:\d{2})( AM| PM)?$/, (m, sec, suffix) => (s.showSeconds === false ? (suffix || '') : m));

    const viewTabs = [
      { value: 'year', label: this.t('VIEW_YEAR') },
      { value: 'month', label: this.t('VIEW_MONTH') },
      { value: 'week', label: this.t('VIEW_WEEK') },
      { value: 'list', label: this.t('VIEW_SCHEDULE') },
      { value: 'weather', label: this.t('VIEW_WEATHER') },
    ];

    const showNav = this.viewMode === 'year' || this.viewMode === 'month' || this.viewMode === 'week';

    return html`
      <style>
        ${appleStyles.cssText}
        ${appleUiStyles.cssText}
        :host { display: block; height: 100%; }
        .root {
          position: relative;
          height: 100%;
          overflow: hidden;
        }
        .page {
          height: 100%;
          overflow: hidden;
          background: var(--apple-bg);
          color: var(--apple-label);
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC',
            'Helvetica Neue', 'Microsoft YaHei', sans-serif;
          -webkit-font-smoothing: antialiased;
          display: flex;
          flex-direction: column;
          align-items: stretch;
        }
        /* 固定头部：前三栏（顶部栏/今日条/视图切换）始终可见，下方滚动 */
        .page-head {
          flex-shrink: 0;
          position: relative;
          z-index: 20;
          background: var(--apple-bg);
        }
        .page-body {
          flex: 1;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          padding-bottom: 24px;
          display: flex;
          flex-direction: column;
        }
        .page-body.body-year { padding-bottom: 8px; }
        .page-body::-webkit-scrollbar { width: 6px; }
        .page-body::-webkit-scrollbar-thumb { background: rgba(120,120,128,0.3); border-radius: 3px; }

        /* 顶部栏 */
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px 10px;
        }
        .month-title { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
        .nav-btns { display: flex; gap: 6px; align-items: center; }
        .icon-btn {
          border: none;
          background: var(--apple-card);
          border-radius: 8px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--apple-label);
          transition: transform 0.15s;
          padding: 0;
        }
        .icon-btn:active { transform: scale(0.9); }
        .today-btn {
          border: none;
          background: ${theme};
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          border-radius: 8px;
          padding: 6px 12px;
          cursor: pointer;
          font-family: inherit;
        }

        /* 今日信息条 */
        .today-strip {
          margin: 0 12px 10px;
          background: var(--apple-card);
          border-radius: 12px;
          padding: 12px 14px;
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .strip-icon {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: ${theme};
          color: #fff;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          line-height: 1.1;
          flex-shrink: 0;
        }
        .strip-wd { font-size: 10px; font-weight: 600; }
        .strip-day { font-size: 20px; font-weight: 300; }
        .strip-info { flex: 1; min-width: 0; display: flex; align-items: center; gap: 16px; }
        .strip-time {
          font-size: 40px;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.01em;
          line-height: 1.1;
          flex-shrink: 0;
        }
        .strip-extra { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .strip-gz { font-size: 16px; font-weight: 600; color: var(--apple-label); }
        .strip-lunar { font-size: 13px; color: var(--apple-label-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .strip-next { text-align: right; font-size: 11px; color: var(--apple-label-3); line-height: 1.5; }
        .strip-next b { color: ${theme}; font-weight: 600; }

        /* 视图切换 */
        .view-tabs {
          margin: 0 12px 10px;
          display: flex;
          background: var(--apple-fill);
          border-radius: 9px;
          padding: 2px;
          gap: 2px;
        }
        .vt-item {
          flex: 1;
          border: none;
          background: transparent;
          border-radius: 7px;
          padding: 6px 2px;
          font-size: 13px;
          font-weight: 500;
          color: var(--apple-label);
          cursor: pointer;
          font-family: inherit;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .vt-item.active {
          background: var(--apple-card);
          box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12), 0 1px 1px rgba(0, 0, 0, 0.04);
          color: ${theme};
          font-weight: 600;
        }

        /* 通用卡片 */
        .card {
          margin: 0 12px;
          background: var(--apple-card);
          border-radius: 12px;
          padding: 10px;
        }
        .hint { font-size: 11px; color: var(--apple-label-3); padding: 8px 4px 2px; text-align: center; }

        /* 年视图（4 列 × 3 行，自适应高度一次显示全年 12 个月） */
        .year-card {
          height: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          padding: 8px;
        }
        .year-grid {
          flex: 1;
          min-height: 0;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          grid-template-rows: repeat(3, 1fr);
          gap: 0px 20px;
        }
        .year-month {
          border: none;
          background: transparent;
          padding: 8px 6px 6px;
          border-radius: 8px;
          cursor: pointer;
          font-family: inherit;
          text-align: center;
          display: flex;
          flex-direction: column;
          min-height: 0;
          min-width: 0;
          overflow: hidden;
        }
        .year-month:active { background: var(--apple-card-alt); }
        .ym-title { flex-shrink: 0; font-size: 15px; font-weight: 600; color: var(--apple-label-2); margin-bottom: 3px; }
        .ym-grid {
          flex: 1;
          min-height: 0;
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          grid-template-rows: repeat(6, 1fr);
          gap: 7px 3px;
        }
        .ym-cell {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 3px;
          min-height: 0;
          min-width: 0;
        }
        .ym-cell.empty { visibility: hidden; }
        .ym-num { font-size: 13px; color: var(--apple-label-2); line-height: 1; }
        .ym-cell.today { border-radius: 4px; }
        .ym-cell.today .ym-num { color: #fff; font-weight: 700; }
        .ym-dot { position: absolute; bottom: 1px; width: 2.5px; height: 2.5px; border-radius: 50%; }

        /* 月视图（弹性六周，一次完整显示） */
        .calendar-card { padding: 10px; }
        .calendar-card.grow {
          flex: 1 0 auto;
          display: flex;
          flex-direction: column;
        }
        .wd-row { display: grid; grid-template-columns: repeat(7, 1fr); height: 32px; align-items: center; margin-bottom: 4px; flex-shrink: 0; }
        .wd-cell {
          text-align: center;
          font-size: 15px;
          font-weight: 600;
          color: var(--apple-label-3);
          padding: 0;
        }
        .wd-cell.weekend { color: ${theme}; opacity: 0.75; }
        .month-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .month-grid.grow {
          flex: 1;
          grid-template-rows: repeat(6, minmax(48px, 1fr));
        }
        .day-cell {
          border: none;
          background: transparent;
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          cursor: pointer;
          padding: 2px;
          font-family: inherit;
          position: relative;
          transition: background 0.12s;
          min-width: 0;
          min-height: 0;
          overflow: hidden;
        }
        .day-cell:active { background: var(--apple-card-alt); }
        .day-cell.out { opacity: 0.32; }
        .day-cell.selected { box-shadow: inset 0 0 0 2px ${theme}; }
        .day-num { font-size: 28px; font-weight: 500; color: var(--apple-label); line-height: 1.05; }
        .day-num.rest { color: ${theme}; }
        .day-lunar {
          font-size: 12px;
          color: var(--apple-label-3);
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          line-height: 1;
        }
        .day-lunar.rest { color: ${theme}; }
        .day-cell.today { background: ${theme}; }
        .day-cell.today .day-num,
        .day-cell.today .day-lunar { color: #fff; }
        .day-cell.today .dots .dot { background: #fff; }
        .dots { display: flex; gap: 2px; position: absolute; bottom: 3px; }
        .dot { width: 3.5px; height: 3.5px; border-radius: 50%; }

        /* 周视图 */
        .week-card { padding: 8px 8px 4px; }
        .week-head, .wk-allday-row, .wk-row {
          display: grid;
          grid-template-columns: 42px repeat(7, 1fr);
          align-items: stretch;
        }
        .wk-gutter {
          font-size: 9px;
          color: var(--apple-label-3);
          text-align: right;
          padding-right: 4px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }
        .wk-gutter.hour { font-size: 9px; }
        .wk-gutter.small { font-size: 9px; }
        .wk-head-cell {
          border: none;
          background: transparent;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 4px 0 6px;
          cursor: pointer;
          font-family: inherit;
        }
        .wk-head-cell.sel { background: var(--apple-card-alt); border-radius: 8px; }
        .wk-hd-wd { font-size: 10px; color: var(--apple-label-3); font-weight: 600; }
        .wk-hd-day {
          font-size: 15px;
          font-weight: 600;
          color: var(--apple-label);
          min-width: 24px;
          text-align: center;
          border-radius: 50%;
          padding: 1px 0;
        }
        .wk-allday-row {
          border-top: 1px solid var(--apple-separator);
          border-bottom: 1px solid var(--apple-separator);
          padding: 3px 0;
          min-height: 26px;
        }
        .wk-allday-cell {
          display: flex;
          flex-direction: column;
          gap: 1px;
          padding: 0 1px;
          overflow: hidden;
          cursor: pointer;
        }
        .wk-chip {
          font-size: 8px;
          color: #fff;
          border-radius: 3px;
          padding: 1px 3px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .week-body { max-height: 46vh; overflow-y: auto; }
        .week-body::-webkit-scrollbar { width: 5px; }
        .week-body::-webkit-scrollbar-thumb { background: rgba(120,120,128,0.28); border-radius: 3px; }
        .wk-cell {
          border-left: 1px solid var(--apple-separator);
          border-bottom: 1px solid var(--apple-separator);
          min-height: 34px;
          padding: 1px;
          display: flex;
          flex-direction: column;
          gap: 1px;
          cursor: pointer;
          overflow: hidden;
        }
        .wk-block {
          border-radius: 3px;
          padding: 1px 3px;
          font-size: 8px;
          line-height: 1.25;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .wk-block-title { color: var(--apple-label); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .wk-block-time { color: var(--apple-label-3); font-size: 7px; }

        /* 日程列表视图：添加栏在滚动区之外（page-head 内），列表本体滚动 */
        .list-view { display: flex; flex-direction: column; min-height: 0; }
        .list-fixed {
          background: var(--apple-bg);
          padding: 0 12px 6px;
        }
        .list-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding-top: 10px;
          flex-wrap: wrap;
        }
        .tl-list { padding: 0 12px; }
        .list-actions { display: flex; align-items: center; gap: 8px; }
        .io-mini-btn {
          border: none;
          background: var(--apple-card-alt);
          color: ${theme};
          font-size: 12px;
          font-weight: 600;
          border-radius: 8px;
          padding: 6px 12px;
          cursor: pointer;
          font-family: inherit;
          white-space: nowrap;
        }
        .io-mini-btn:active { transform: scale(0.96); }
        .tl-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 0;
          border-top: 1px solid var(--apple-separator);
          cursor: pointer;
        }
        .tl-row:first-child { border-top: none; }
        .tl-row.past { opacity: 0.55; }
        .tl-date {
          width: 54px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          line-height: 1.25;
        }
        .tl-d { font-size: 12px; font-weight: 600; color: var(--apple-label); }
        .tl-w { font-size: 9px; color: var(--apple-label-3); }
        .tl-bar { width: 3.5px; align-self: stretch; border-radius: 2px; flex-shrink: 0; }
        .tl-main { flex: 1; min-width: 0; }
        .tl-title { font-size: 14px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tl-sub { display: flex; gap: 8px; font-size: 11px; color: var(--apple-label-3); margin-top: 2px; }
        .tl-time { font-weight: 600; color: var(--apple-label-2); }
        .tl-rel.past-text { color: var(--apple-label-3); }
        .empty-card { text-align: center; color: var(--apple-label-3); font-size: 13px; padding: 30px 12px; }

        /* 天气视图 */
        .weather-view {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 46px 16px;
          border: 1px dashed var(--apple-separator);
        }
        .wv-icon { color: var(--apple-label-3); }
        .wv-title { font-size: 16px; font-weight: 600; color: var(--apple-label); }
        .wv-sub { font-size: 12px; color: var(--apple-label-3); }
        .wv-badge {
          font-size: 10px;
          font-weight: 600;
          color: var(--apple-label-3);
          background: var(--apple-card-alt);
          border-radius: 5px;
          padding: 3px 8px;
          margin-top: 2px;
        }

        /* 日详情 */
        .day-detail { margin-top: 12px; padding: 14px; flex-shrink: 0; }
        .card + .card { margin-top: 12px; }
        .detail-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .detail-title { display: flex; align-items: center; gap: 8px; }
        .detail-date { font-size: 17px; font-weight: 700; }
        .today-badge {
          font-size: 10px;
          font-weight: 600;
          color: #fff;
          border-radius: 5px;
          padding: 2px 6px;
        }
        .add-btn {
          border: none;
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          border-radius: 8px;
          padding: 6px 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          font-family: inherit;
        }
        .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
        .chip {
          font-size: 11px;
          font-weight: 500;
          color: var(--apple-label-2);
          background: var(--apple-card-alt);
          border-radius: 6px;
          padding: 3px 8px;
        }
        .agenda { display: flex; flex-direction: column; }
        .agenda-empty { font-size: 13px; color: var(--apple-label-3); padding: 8px 0; }
        .agenda-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 0;
          cursor: pointer;
          border-top: 1px solid var(--apple-separator);
        }
        .agenda-item:first-child { border-top: none; }
        .agenda-bar { width: 3.5px; align-self: stretch; border-radius: 2px; flex-shrink: 0; }
        .agenda-main { flex: 1; min-width: 0; }
        .agenda-title { font-size: 14px; font-weight: 500; display: flex; align-items: center; gap: 5px; }
        .type-icon { font-size: 13px; }
        .agenda-sub { display: flex; flex-wrap: wrap; gap: 8px; font-size: 11px; color: var(--apple-label-3); margin-top: 3px; }
        .agenda-time { font-weight: 600; color: var(--apple-label-2); }
        .agenda-badge { color: ${theme}; font-weight: 600; }
        .agenda-lunar { color: var(--apple-label-3); }
        .agenda-note, .tl-note {
          font-size: 11px;
          color: var(--apple-label-3);
          margin-top: 3px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .agenda-chevron { color: var(--apple-label-3); opacity: 0.5; flex-shrink: 0; }

        /* 即将到来 */
        .upcoming-card { padding: 14px; flex-shrink: 0; }
        .upcoming-title { font-size: 13px; font-weight: 600; color: var(--apple-label-2); margin-bottom: 8px; }
        .upcoming-row { display: flex; align-items: center; gap: 8px; font-size: 13px; padding: 5px 0; }
        .upcoming-row .u-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .upcoming-row .u-days { font-size: 11px; color: var(--apple-label-3); font-weight: 600; }

        /* 全屏面板（设置 / 编辑 / 导入导出，挂在 .root 上，独立于 .page 滚动，各自仅一条滚动条） */
        .fullscreen {
          position: absolute;
          inset: 0;
          z-index: 120;
          background: var(--apple-bg);
          color: var(--apple-label);
          display: flex;
          flex-direction: column;
          animation: fs-in 0.28s cubic-bezier(0.32, 0.72, 0, 1);
          overflow: hidden;
        }
        @keyframes fs-in {
          from { transform: translateX(28%); opacity: 0.4; }
          to { transform: translateX(0); opacity: 1; }
        }
        /* v1.31 需求 5：导航栏必须高于遮罩(130) 与悬浮确认栏(140)，
           否则遮罩会吃掉「返回 / 完成」——用户点返回会被当成「取消删除」而不是「关闭页面」。 */
        .fs-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-bottom: 1px solid var(--apple-separator);
          background: var(--apple-bg);
          flex-shrink: 0;
          min-height: 48px;
          position: relative;
          z-index: 150;
        }
        .nav-title { font-size: 16px; font-weight: 600; }
        .nav-btn {
          border: none;
          background: transparent;
          font-size: 15px;
          color: var(--apple-label-2);
          cursor: pointer;
          font-family: inherit;
          padding: 4px 2px;
          min-width: 40px;
        }
        .nav-btn.strong { font-weight: 600; }
        .nav-btn.invisible { visibility: hidden; }
        .fs-body {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }
        .fs-body::-webkit-scrollbar { width: 6px; }
        .fs-body::-webkit-scrollbar-thumb { background: rgba(120,120,128,0.3); border-radius: 3px; }

        /* 编辑器表单 */
        .type-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
        .type-item {
          border: 1.5px solid var(--apple-separator);
          background: var(--apple-card);
          border-radius: 10px;
          padding: 10px 4px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 500;
          color: var(--apple-label);
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
        }
        .type-icon-lg { font-size: 20px; }
        .field { margin-bottom: 16px; }
        .field label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: var(--apple-label-3);
          margin-bottom: 5px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .field input {
          width: 100%;
          border: 1px solid var(--apple-separator);
          background: var(--apple-card);
          border-radius: 8px;
          padding: 9px 11px;
          font-size: 14px;
          color: var(--apple-label);
          font-family: inherit;
          box-sizing: border-box;
        }
        .field input:focus { outline: none; border-color: ${theme}; }
        .field textarea {
          width: 100%;
          border: 1px solid var(--apple-separator);
          background: var(--apple-card);
          border-radius: 8px;
          padding: 9px 11px;
          font-size: 14px;
          color: var(--apple-label);
          font-family: inherit;
          box-sizing: border-box;
          resize: vertical;
          min-height: 84px;
          line-height: 1.5;
        }
        .field textarea:focus { outline: none; border-color: ${theme}; }
        .note-counter { text-align: right; font-size: 11px; color: var(--apple-label-3); margin-top: 4px; }
        .color-row { display: flex; gap: 10px; }
        .color-dot {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          transition: transform 0.15s;
        }
        .color-dot:active { transform: scale(0.85); }
        .color-dot.selected { box-shadow: 0 0 0 2px var(--apple-bg), 0 0 0 4px currentColor; }
        .form-error { font-size: 12px; color: var(--apple-red); margin-bottom: 10px; }
        .delete-wrap { margin-top: 8px; text-align: center; }

        /* 日期滚轮 */
        .pk-head { display: flex; padding: 0 2px 4px; }
        .pk-head-item {
          flex: 1;
          text-align: center;
          font-size: 11px;
          font-weight: 600;
          color: ${theme};
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .pk-wrap {
          position: relative;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          background: var(--apple-card);
          border-radius: 12px;
          overflow: hidden;
        }
        .pk-col { position: relative; }
        .pk-window {
          height: 180px;
          overflow-y: auto;
          scroll-snap-type: y mandatory;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .pk-window::-webkit-scrollbar { display: none; }
        .pk-pad { height: 72px; }
        .pk-item {
          height: 36px;
          scroll-snap-align: center;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          color: var(--apple-label-2);
          transition: color 0.15s;
        }
        .pk-item.active { color: var(--apple-label); font-weight: 600; }
        .pk-frame {
          position: absolute;
          top: 72px;
          left: 2px;
          right: 2px;
          height: 36px;
          border-radius: 8px;
          background: var(--apple-fill);
          pointer-events: none;
        }
        .pk-note {
          margin-top: 6px;
          font-size: 11px;
          color: var(--apple-label-3);
          text-align: center;
        }

        /* 设置项 */
        .theme-dots { display: flex; gap: 7px; }
        .theme-dot {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          padding: 0;
          transition: transform 0.15s;
        }
        .theme-dot:active { transform: scale(0.85); }
        .theme-dot.selected { box-shadow: 0 0 0 2px var(--apple-bg), 0 0 0 4px currentColor; }
        .bright-ctl { display: flex; align-items: center; gap: 7px; width: 190px; }
        .bright-ctl input[type='range'] { flex: 1; accent-color: ${theme}; cursor: pointer; }
        .bright-ico { font-size: 13px; line-height: 1; }

        /* 卡片显示内容页 */
        .cfg-label {
          font-size: 12px;
          font-weight: 600;
          color: var(--apple-label-3);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin: 4px 4px 8px;
        }
        .size-pills { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 18px; }
        .size-pill {
          border: 1.5px solid var(--apple-separator);
          background: var(--apple-card);
          color: var(--apple-label);
          font-size: 13px;
          font-weight: 600;
          border-radius: 9px;
          padding: 7px 14px;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
        }
        .size-pill:active { transform: scale(0.95); }

        /* 显示模式选择 */
        .mode-select-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 4px;
        }
        .mode-select-row .apple-select { flex: 1; }
        .style-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 6px;
        }
        .style-opt {
          border: 1.5px solid var(--apple-separator);
          background: var(--apple-card);
          border-radius: 12px;
          padding: 8px 6px 6px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          font-family: inherit;
          transition: all 0.15s;
        }
        .style-opt.active {
          border-color: ${theme};
          box-shadow: 0 0 0 1px ${theme};
        }
        .style-thumb {
          width: 100%;
          height: 72px;
          border-radius: 8px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--apple-card-alt);
          padding: 4px;
          box-sizing: border-box;
        }
        .style-thumb > * { max-width: 100%; max-height: 100%; }
        .style-name { font-size: 11px; font-weight: 600; color: var(--apple-label); }
        .style-opt.active .style-name { color: ${theme}; }
        .mode-note { font-size: 11px; color: var(--apple-label-3); margin: 6px 4px 2px; line-height: 1.5; }

        /* 导入导出 */
        .io-info { font-size: 14px; color: var(--apple-label-2); margin-bottom: 14px; }
        .io-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; }
        .io-hint { font-size: 12px; color: var(--apple-label-3); line-height: 1.6; }

        /* 日程管理页：批量选择 + 删除 */
        .mgr-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 2px 0 12px;
          flex-wrap: wrap;
        }
        .mgr-count { font-size: 12px; color: var(--apple-label-3); font-weight: 600; margin-left: auto; }
        .mgr-btn {
          border: 1.5px solid var(--apple-separator);
          background: var(--apple-card);
          color: var(--apple-label);
          border-radius: 9px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          white-space: nowrap;
        }
        .mgr-btn:active { transform: scale(0.97); }
        .mgr-btn.danger { border-color: var(--apple-red); color: var(--apple-red); }
        .mgr-btn.danger.solid { background: var(--apple-red); color: #fff; }
        /* v1.31 需求 5：删除确认悬浮栏（挂在 .fullscreen 上，脱离 .fs-body 滚动容器）。
           一律 absolute：微应用中 fixed 的包含块会被 transform/backdrop-filter 祖先劫持，
           且不受 .root{overflow:hidden} 裁剪，会盖住 SunPanel 自身界面。 */
        .mgr-scrim {
          position: absolute;
          inset: 0;
          z-index: 130;
          /* 浅色：叠 #F2F2F7 → #BDBDBD，压暗感明确 */
          background: rgba(0, 0, 0, 0.22);
          animation: cf-fade 0.18s ease both;
        }
        /* 深色 --apple-bg = #000000：纯黑遮罩叠任何 alpha 仍是 #000 → 遮罩等于不存在。
           故深色用 .55 + 一层极淡白色 inset，让列表外的空白区也可感知「已变暗」。
           不用 backdrop-filter：项目主题大量 blur(18px)，会劫持定位且小屏开销高。 */
        .fullscreen.dark .mgr-scrim {
          background: rgba(0, 0, 0, 0.55);
          box-shadow: inset 0 0 0 999px rgba(255, 255, 255, 0.06);
        }
        .mgr-confirm {
          position: absolute;
          left: 12px;
          right: 12px;
          bottom: calc(12px + env(safe-area-inset-bottom, 0px));
          z-index: 140;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          background: var(--apple-card);
          border: 1px solid var(--apple-separator);
          border-radius: 14px;
          padding: 12px 14px;
          box-shadow: 0 8px 28px rgba(0, 0, 0, 0.28);
          animation: cf-in 0.22s cubic-bezier(0.32, 0.72, 0, 1) both;
        }
        /* 浅色靠阴影即可，保持干净；深色下阴影几乎不可见，靠边框「浮起来」 */
        .fullscreen:not(.dark) .mgr-confirm { border-color: transparent; }
        @keyframes cf-in {
          from { transform: translateY(14px); opacity: 0; }
          to { transform: none; opacity: 1; }
        }
        @keyframes cf-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        /* 只关两个容器的动画 —— 绝不能写成「.mgr-confirm *」，
           否则会命中 .cf-btn 的 cf-arm（靠 animation 恢复 pointer-events），
           导致「确认删除」永久不可点。同时显式放开按钮点击兜底。 */
        @media (prefers-reduced-motion: reduce) {
          .mgr-confirm, .mgr-scrim { animation: none; }
          .mgr-confirm .cf-btn { pointer-events: auto; }
        }
        /* 防误触：入场 350ms 内按钮不接受点击（纯 CSS，不依赖 spCtx.api.timer） */
        .mgr-confirm .cf-btn {
          pointer-events: none;
          animation: cf-arm 0s linear 0.35s forwards;
        }
        @keyframes cf-arm { to { pointer-events: auto; } }
        .cf-text {
          flex: 1; min-width: 0;
          font-size: 12px; font-weight: 600; color: var(--apple-label);
          line-height: 1.35;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .cf-btn {
          min-height: 44px;
          border: 1.5px solid var(--apple-separator);
          background: var(--apple-card);
          color: var(--apple-label);
          border-radius: 10px;   /* 同心圆角：容器 14 − 内距 4 */
          padding: 0 16px;
          font-size: 12px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          white-space: nowrap;
        }
        .cf-btn:active { transform: scale(0.97); }
        .cf-btn.cancel { min-width: 88px; }
        .cf-btn.danger {
          min-width: 104px;
          margin-left: auto;
          background: var(--apple-red);
          border-color: var(--apple-red);
          color: #fff;
        }
        /* 悬浮条高 ≈68px + bottom 12px → 92px 才不会压住最后一行 */
        .mgr-list.pad-confirm { padding-bottom: 92px; }
        /* 用 inset shadow 而非 border：不占布局空间，避免行高跳动 */
        .mgr-row.armed { box-shadow: inset 0 0 0 1.5px var(--apple-red); border-radius: 8px; }
        @media (max-width: 320px) {
          .cf-text { flex: 1 1 100%; }
          .cf-btn { flex: 1; }
        }
        .mgr-list { display: flex; flex-direction: column; }
        .mgr-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 4px;
          border-top: 1px solid var(--apple-separator);
          cursor: pointer;
        }
        .mgr-row:first-child { border-top: none; }
        .mgr-row.sel { background: var(--apple-card); border-radius: 8px; }
        .mgr-check {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 1.5px solid var(--apple-separator);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: transparent;
        }
        .mgr-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
        .mgr-main { flex: 1; min-width: 0; }
        .mgr-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--apple-label);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .mgr-sub { font-size: 11px; color: var(--apple-label-3); margin-top: 2px; }
        .mgr-del {
          border: none;
          background: transparent;
          color: var(--apple-label-3);
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0;
          flex-shrink: 0;
        }
        .mgr-del:active { transform: scale(0.9); }
        .mgr-empty {
          font-size: 13px;
          color: var(--apple-label-3);
          text-align: center;
          padding: 24px 0;
        }

        /* Toast */
        .toast {
          position: absolute;
          left: 50%;
          bottom: 28px;
          transform: translateX(-50%);
          background: rgba(0, 0, 0, 0.78);
          color: #fff;
          font-size: 13px;
          font-weight: 500;
          border-radius: 10px;
          padding: 9px 16px;
          z-index: 200;
          animation: toast-in 0.25s ease;
          max-width: 80%;
          text-align: center;
          pointer-events: none;
        }
        @keyframes toast-in {
          from { opacity: 0; transform: translate(-50%, 10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      </style>
      <div class="root" style="${appleThemeVars(dark)}">
        <div class="page">
        <div class="page-head">
        <div class="topbar">
          <div class="month-title">${this._title()}</div>
          <div class="nav-btns">
            ${showNav ? html`
              <button class="icon-btn" aria-label="prev" @click=${this._prev}>
                <svg viewBox="0 0 8 13" width="7" height="11"><path d="M7 1L1 6.5 7 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            ` : ''}
            <button class="today-btn" @click=${this._goToday}>${this.t('MAIN_TODAY')}</button>
            ${showNav ? html`
              <button class="icon-btn" aria-label="next" @click=${this._next}>
                <svg viewBox="0 0 8 13" width="7" height="11"><path d="M1 1l6 5.5L1 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            ` : ''}
            <button class="icon-btn" aria-label="settings" @click=${() => { this.settingsOpen = true; this.requestUpdate(); }}>
              <svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="3"/><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.6 4.6l1.4 1.4M14 14l1.4 1.4M15.4 4.6L14 6M6 14l-1.4 1.4"/></svg>
            </button>
          </div>
        </div>

        <div class="today-strip">
          <div class="strip-icon">
            <span class="strip-wd">${this._isZh() ? WEEK_FULL_ZH[this.now.getDay()] : WEEK_MIN_EN[this.now.getDay()]}</span>
            <span class="strip-day">${this.now.getDate()}</span>
          </div>
          <div class="strip-info">
            <div class="strip-time">${stripTime}</div>
            <div class="strip-extra">
              <div class="strip-gz">${this._stripGzYear()}</div>
              <div class="strip-lunar">${this._stripLunarFest()}</div>
            </div>
          </div>
          <div class="strip-next">
            ${nextHoliday ? html`<div>${this._isZh() ? nextHoliday.nameZh : nextHoliday.nameEn}<br><b>${nextHoliday.days === 0 ? this.t('MAIN_TODAY') : `${nextHoliday.days} ${this.t('MAIN_DAYS')}`}</b></div>` : ''}
            ${nextTerm ? html`<div style="margin-top:4px">${this._isZh() ? nextTerm.zh : nextTerm.en}<br><b>${nextTerm.days === 0 ? this.t('MAIN_TODAY') : `${nextTerm.days} ${this.t('MAIN_DAYS')}`}</b></div>` : ''}
          </div>
        </div>

        <div class="view-tabs">
          ${viewTabs.map((tab) => html`
            <button class="vt-item ${this.viewMode === tab.value ? 'active' : ''}" key="vt-${tab.value}" @click=${() => this._switchView(tab.value)}>${tab.label}</button>
          `)}
        </div>
        ${this.viewMode === 'list' ? this._renderListAddBar() : ''}
        </div>

        <div class="page-body ${this.viewMode === 'year' ? 'body-year' : ''}">
        ${this.viewMode === 'year' ? this._renderYearView() : ''}
        ${this.viewMode === 'month' ? this._renderMonthView() : ''}
        ${this.viewMode === 'week' ? this._renderWeekView() : ''}
        ${this.viewMode === 'list' ? this._renderScheduleView() : ''}
        ${this.viewMode === 'weather' ? this._renderWeatherView() : ''}

        ${this.viewMode === 'month' && upcoming.length ? html`
          <div class="card upcoming-card">
            <div class="upcoming-title">${this.t('MAIN_UPCOMING')}</div>
            ${upcoming.map(({ item, next }) => {
              const days = diffDays(next.date, this.now);
              return html`
                <div class="upcoming-row" key="${item.id}">
                  <span style="width:7px;height:7px;border-radius:50%;background:${APPLE_COLORS[item.color] || APPLE_COLORS.red};flex-shrink:0"></span>
                  <span class="u-title">${SCHEDULE_TYPES[item.type]?.icon || SCHEDULE_TYPES.event.icon} ${item.title}</span>
                  <span class="u-days">${days === 0 ? this.t('MAIN_TODAY') : `${days} ${this.t('MAIN_DAYS')}`}</span>
                </div>
              `;
            })}
          </div>
        ` : ''}
        </div>
        </div>

        ${this._renderEditor()}
        ${this._renderSettings()}
        ${this._renderCardCfg()}
        ${this._renderIO()}
        ${this._renderScheduleMgr()}
        ${this.toast ? html`<div class="toast">${this.toast}</div>` : ''}
      </div>
    `;
  }

  updated() {
    if (!this.renderRoot) return;
    this._syncWheels();
    // v1.31 需求 5：悬浮确认栏出现时，把被删行滚入可视区（只滚一次）
    if (this._pendingRevealId) {
      const id = this._pendingRevealId;
      this._pendingRevealId = null;
      this._revealArmedRow(id);
    }
    if (this._pendingScrollToday && this.viewMode === 'list') {
      // 定位到最近一条未到日程；没有未到日程则保持顶部（已过日程都在列表内，上滑可见）
      const row = this.renderRoot.querySelector('[data-first-up="1"]')
        || this.renderRoot.querySelector('[data-today-row="1"]');
      if (row && row.scrollIntoView) row.scrollIntoView({ block: 'start' });
      this._pendingScrollToday = false;
    }
  }

  /** 干支年（如「丙午年」），今日条时间下方上排 */
  _stripGzYear() {
    const info = getDayInfo(todayStr());
    const gz = info.lunar.yearCyl || '';
    if (!gz) return '';
    return this._isZh() ? `${gz}年` : gz;
  }

  /** 农历（去「农历」前缀）+ 节日节气，今日条时间下方下排 */
  _stripLunarFest() {
    const info = getDayInfo(todayStr());
    const holiday = this._holidayInfo(info.date);
    const parts = [];
    parts.push(this._isZh() ? info.lunar.display : `Lunar ${info.lunar.month}/${info.lunar.day}`);
    if (info.solarTerm) parts.push(this._isZh() ? info.solarTerm.zh : info.solarTerm.en);
    if (info.festivals.length) parts.push(this._isZh() ? info.festivals[0].zh : info.festivals[0].en);
    if (holiday?.isOffDay) parts.push(this._isZh() ? holiday.nameZh : holiday.nameEn);
    return parts.join(' · ');
  }

  static styles = css``;
}
