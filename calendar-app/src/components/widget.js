/**
 * 日历微应用 - 小部件组件
 * 支持 1x1 / 1x2 / 2x1 / 2x2 / 2x4 / 4x4 六种尺寸，每种尺寸多种显示模块可配置
 */
import { SunPanelWidgetElement } from '@sun-panel/micro-app';
import { html, css } from 'lit';
import { ensureAppState, getHolidayService, getUserStore, subscribeAppState } from '../core/app-state.js';
import { getSnapshot } from '../core/highlights.js';
import { formatTime, formatDate, todayStr, getMonthGrid, parseDate, addDays, yearProgress, weekOfYear, dayOfYear, diffDays } from '../core/date-utils.js';
import { getDayInfo } from '../core/cd-adapter.js';
import { getSchedulesOfDay, SCHEDULE_TYPES, getNextOccurrence } from '../core/schedule.js';
import { APPLE_COLORS } from '../core/apple-ui.js';
import {
  DEFAULT_WIDGET_CONFIG, CARD_SIZE_MODULES, cardThemeVisual,
  sanitizeBlocks, migrateToBlocks, gridForSize, layoutBlocks,
} from '../core/user-store.js';
import { renderInfoBlock, renderBlocksHTML } from '../core/card-mode-render.js';

const WEEK_SHORT = ['日', '一', '二', '三', '四', '五', '六'];
const WEEK_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export class Widget extends SunPanelWidgetElement {
  static properties = {
    spCtx: { type: Object, attribute: false },
    now: { type: Object, attribute: false },
    snapshot: { type: Object, attribute: false },
    config: { type: Object, attribute: false },
  };

  constructor() {
    super();
    this.now = new Date();
    this.snapshot = null;
    this.config = { ...DEFAULT_WIDGET_CONFIG };
    this._timer = null;
    this._unsub = null;
    this._todayStr = todayStr();
  }

  onInitialized() {
    this._syncCardRadius();
    this._applyConfig();
    // 网格布局：监听宿主尺寸（1×FULL 动态行数 / 运行时降密度 / 字号基准）
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this._measure());
      this._ro.observe(this);
    }
    this._measure();
    ensureAppState(this.spCtx?.api).then(() => {
      this._refresh();
      this._unsub = subscribeAppState(() => {
        this._refresh();
        this.requestUpdate();
      });
      this.requestUpdate();
    });
    // 时钟：必须使用平台 timer（卸载时自动回收）
    const timer = this.spCtx?.api?.timer;
    if (timer?.setInterval) {
      this._timer = timer.setInterval(() => {
        this.now = new Date();
        if (todayStr() !== this._todayStr) {
          this._todayStr = todayStr();
          this._refresh();
        }
        this.requestUpdate();
      }, 1000);
    }
  }

  /** 量宿主尺寸，推导 1×FULL 列数（基准列宽约 90px） */
  _measure() {
    const w = this.clientWidth || 0;
    const h = this.clientHeight || 0;
    if (!w || !h) return;
    this._hostW = w;
    this._hostH = h;
    if (this._cardSize === '1xfull') {
      const availW = Math.max(0, w - 24); // .widget padding 12×2
      this._fullCols = Math.max(4, Math.min(10, Math.round(availW / 90)));
    }
    this.requestUpdate();
  }

  onWidgetInfoChanged(newWidgetInfo) {
    this._applyConfig();
    this._refresh();
    this.requestUpdate();
  }

  onDisconnected() {
    if (this._timer != null && this.spCtx?.api?.timer?.clearInterval) {
      this.spCtx.api.timer.clearInterval(this._timer);
      this._timer = null;
    }
    if (this._ro) {
      this._ro.disconnect();
      this._ro = null;
    }
    if (this._unsub) {
      this._unsub();
      this._unsub = null;
    }
  }

  _applyConfig() {
    const c = this.spCtx?.widgetInfo?.config || {};
    this.config = { ...DEFAULT_WIDGET_CONFIG, ...c };
    // 用户是否为这张卡显式保存过模块配置（决定全局按尺寸配置是否接管）
    this._hasWidgetModules = Array.isArray(c.modules) && c.modules.length > 0;
  }

  /**
   * v1.39 修复「卡片四角灰色线」：运行时把宿主卡片圆角同步给玻璃。
   *
   * 地面真相（CDP 实测 SunPanel 192.168.10.251:13002）：微应用不是 iframe，而是以
   * 自定义元素直接嵌在 `.item-card-content` 里；该宿主 overflow:hidden +
   * border-radius（30 张卡运行时实测全部 20px，inline 只覆盖背景色不改圆角）。
   * 我们的 `.widget` 毛玻璃若半径 > 宿主，两弧之间的透镜区会露出宿主卡片底色
   * （rgba(42,42,42,0.42) 叠面板底色，且该区域没有 backdrop-filter 模糊）→ 四角
   * 贴着圆角出现 1~1.4px 灰线（v1.38 用 22px 实测复现）；若与宿主精确重合，玻璃
   * 自身的 AA 渐变又与宿主裁剪线的 AA 带重叠，用户在 v1.37 的 20px 上实测仍看到
   * 贴角「隐约一点点」浅弧。
   * 因此运行时读取宿主 computed border-top-left-radius 原值写入 --sp-card-radius，
   * `.widget` 的 border-radius 与 clip-path 消费时再减 1px（见样式注释）：玻璃弧
   * 藏进宿主裁剪线内侧，四角既不露宿主底色也不叠双层 AA；宿主圆角为 0（方形卡）
   * 时靠 max(0px, …) 守卫避免负半径令 clip-path 失效、backdrop 渗出直角
   * （v1.33 教训）。读取失败（预览/其他宿主/类名变更）兜底 20px。
   */
  _syncCardRadius() {
    let radius = null;
    try {
      const card = this.closest('.item-card-content');
      if (card) {
        const v = getComputedStyle(card).borderTopLeftRadius;
        if (typeof v === 'string' && /^\d+(\.\d+)?px$/.test(v.trim())) radius = v.trim();
      }
    } catch { /* 跨 shadow 边界 / 预览环境：忽略，走兜底 */ }
    this.style.setProperty('--sp-card-radius', radius || '20px');
  }

  _refresh() {
    this.snapshot = getSnapshot(getHolidayService(), getUserStore(), this.now, this._isZh ? 'zh' : 'en');
  }

  /** 当前渲染尺寸的模块列表（render() 前设置） */
  get _mods() {
    return this._activeMods || this.config.modules;
  }

  // ---------- 工具 ----------

  get _isZh() {
    return (this.spCtx?.language || 'zh-CN').toLowerCase().startsWith('zh');
  }

  get _theme() {
    return APPLE_COLORS[this._card.themeColor] || APPLE_COLORS.blue;
  }

  /** 当前小部件尺寸（SunPanel 注册时决定，固定不变） */
  get _cardSize() {
    return this.spCtx?.widgetInfo?.gridSize || '2x2';
  }

  /**
   * 合并后的卡片设置：每小部件 config 优先，未设置则回退到全局默认（getUserStore）。
   * 实现「每个小部件独立调节」，同时新小部件自动继承全局默认。
   * 旧版数据（无 displayMode 字段）在此自动迁移到「显示内容 + 显示样式」模型。
   */
  get _card() {
    const g = getUserStore()?.getSettings() || {};
    const c = this.config || {};
    const size = this._cardSize;
    let displayMode;
    let blocks;
    if (c.displayMode !== undefined || g.displayMode !== undefined) {
      // 新模型：小部件配置优先，缺失字段回退全局
      displayMode = c.displayMode ?? g.displayMode ?? 'combo';
      blocks = c.cardBlocks ?? g.cardBlocks ?? null;
    } else {
      // 旧模型：按 cardMode/modules 迁移
      const m = migrateToBlocks({
        cardMode: c.cardMode ?? g.cardMode,
        modules: c.modules ?? g.modules,
      });
      displayMode = m.displayMode;
      blocks = m.blocks;
    }
    return {
      themeColor: c.themeColor ?? g.themeColor ?? 'blue',
      cardTheme: c.cardTheme ?? g.cardTheme ?? 'glass-frosted',
      cardBrightness: c.cardBrightness ?? g.cardBrightness ?? 100,
      displayMode,
      cardBlocks: sanitizeBlocks(blocks, displayMode, size),
      cardCenterH: c.cardCenterH ?? g.cardCenterH ?? false,
      cardCenterV: c.cardCenterV ?? g.cardCenterV ?? false,
      weekStart: c.weekStart ?? g.weekStart ?? 1,
      hour12: c.hour12 ?? g.hour12 ?? false,
      showSeconds: c.showSeconds ?? g.showSeconds ?? true,
    };
  }

  /** 当前卡片主题 key（兼容旧版 auto/light/dark） */
  get _cardThemeKey() {
    return this._card.cardTheme;
  }

  /** 文字配色模式：light=浅色文字（深色背景），dark=深色文字（浅色背景） */
  get _themeTextMode() {
    const t = this._cardThemeKey;
    if (t === 'glass-dark' || t === 'neon') return 'light';
    if (t === 'paper') return 'dark';
    return (this.spCtx?.darkMode ?? false) ? 'light' : 'dark';
  }

  /** 卡片有效暗色状态（仅用于布局兼容） */
  get _cardDark() {
    return this._themeTextMode === 'light';
  }

  /** 卡片亮度（30-100 → 0.3-1.0 滤镜） */
  get _brightness() {
    const b = Number(this._card.cardBrightness);
    return Number.isFinite(b) ? Math.min(100, Math.max(30, b)) / 100 : 1;
  }

  /** 卡片背景样式（玻璃 / 渐变 / 纸感） */
  get _cardBgStyle() {
    const vis = cardThemeVisual(this._cardThemeKey, this.spCtx?.darkMode ?? false);
    return vis.bg;
  }

  /** 当前显示模式（combo=拼接 / single=单独） */
  get _displayMode() {
    return this._card.displayMode;
  }

  /**
   * 拼接模式网格（列×行）：
   * - 1×FULL 列数按宿主实际宽度动态计算（基准列宽约 90px，宽扁条）
   * - 其他尺寸按声明网格，若实测单元格 <24px 则对应维度降密度（保底 2）
   */
  get _comboGrid() {
    const g = gridForSize(this._cardSize);
    if (this._cardSize === '1xfull') {
      return this._fullCols ? { cols: this._fullCols, rows: g.rows } : g;
    }
    if (this._hostW && this._hostH) {
      const availW = this._hostW - 24;
      const availH = this._hostH - 24;
      const out = { cols: g.cols, rows: g.rows };
      while (availH / out.rows < 24 && out.rows > 2) out.rows = Math.ceil(out.rows / 2);
      while (availW / out.cols < 24 && out.cols > 2) out.cols = Math.ceil(out.cols / 2);
      return out;
    }
    return g;
  }

  /** 单元格像素宽/高（块内 em 字号的基准；未量到尺寸时给经验值） */
  get _cellW() {
    const g = this._comboGrid;
    if (!this._hostW) return 40;
    return Math.max(1, (this._hostW - 24) / g.cols);
  }

  get _cellH() {
    const g = this._comboGrid;
    if (!this._hostH) return 40;
    return Math.max(1, (this._hostH - 24) / g.rows);
  }

  /** 当前生效的堆叠单元（拼接=按运行时网格布局 [{c,s,span,pos}]；单独=[{c,s}]） */
  get _blocks() {
    const list = this._card.cardBlocks;
    if (this._displayMode !== 'combo') return list;
    return layoutBlocks(list, 'combo', this._cardSize, this._comboGrid, {
      h: !!this._card.cardCenterH,
      v: !!this._card.cardCenterV,
    });
  }

  /** 当前尺寸应显示的模块（一般模式）：每小部件独立配置 > 尺寸默认 */
  _modulesForSize(size) {
    if (Array.isArray(this.config.modules) && this.config.modules.length) return this.config.modules;
    return CARD_SIZE_MODULES[size] || CARD_SIZE_MODULES['2x2'];
  }

  get _label() { return this._themeTextMode === 'light' ? '#F5F5F7' : '#1D1D1F'; }
  get _label2() { return this._themeTextMode === 'light' ? '#C7C7CC' : '#86868B'; }
  get _label3() { return this._themeTextMode === 'light' ? '#8E8E93' : '#AEAEB2'; }
  get _cardBg() { return this._themeTextMode === 'light' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.06)'; }

  _weekdayShort(date) {
    return this._isZh ? `周${WEEK_SHORT[date.getDay()]}` : WEEK_EN[date.getDay()];
  }

  _openMain() {
    this.spCtx?.api?.window.open({
      componentName: 'calendar-main',
      title: this.t('MAIN_PAGE_TITLE'),
    });
  }

  _fmtDate(date) {
    const m = date.getMonth() + 1;
    const d = date.getDate();
    return this._isZh ? `${m}月${d}日` : `${date.toLocaleDateString('en-US', { month: 'short' })} ${d}`;
  }

  _festivalLine(dayInfo) {
    const holiday = this.snapshot?.dayInfo ? this._holidayInfo(this.snapshot.dayInfo.date) : null;
    const parts = [];
    if (dayInfo.solarTerm) parts.push(this._isZh ? dayInfo.solarTerm.zh : dayInfo.solarTerm.en);
    for (const f of dayInfo.festivals) {
      parts.push(this._isZh ? f.zh : f.en);
    }
    if (holiday) parts.push(this._isZh ? holiday.nameZh : holiday.nameEn);
    return parts.slice(0, 2).join(' · ') || '';
  }

  _holidayInfo(dateStr) {
    return getHolidayService()?.getHolidayInfo(dateStr) || null;
  }

  // ---------- 子渲染器 ----------

  /** 时间（大） */
  _renderTime(big = false, extraClass = '') {
    if (!this._mods.includes('time')) return '';
    const showSec = this.config.showSeconds;
    const text = showSec ? formatTime(this.now, this.config.hour12) : formatTime(this.now, this.config.hour12).replace(/:\d{2}/, '');
    return html`<div class="time ${big ? 'time-big' : ''} ${extraClass}" style="color:${this._label}">${text}</div>`;
  }

  /** 时间（紧凑：不含秒，用于窄/扁卡片） */
  _renderTimeCompact(extraClass = '') {
    if (!this._mods.includes('time')) return '';
    const text = formatTime(this.now, this.config.hour12).replace(/:\d{2}(\s?(AM|PM))?$/, '$1');
    return html`<div class="time ${extraClass}" style="color:${this._label}">${text}</div>`;
  }

  /** 日期行 */
  _renderDate() {
    if (!this._mods.includes('date')) return '';
    return html`<div class="date-line" style="color:${this._label2}">${this._fmtDate(this.now)} ${this._weekdayShort(this.now)}</div>`;
  }

  /** 农历 + 节日节气 */
  _renderLunar() {
    const dayInfo = this.snapshot?.dayInfo;
    if (!dayInfo) return '';
    const parts = [];
    if (this._mods.includes('lunar')) {
      parts.push(this._isZh ? dayInfo.lunar.display : `Lunar ${dayInfo.lunar.month}/${dayInfo.lunar.day}`);
    }
    if (this._mods.includes('festival')) {
      const f = this._festivalLine(dayInfo);
      if (f) parts.push(f);
    }
    if (!parts.length) return '';
    return html`<div class="lunar-line" style="color:${this._theme}">${parts.join(' · ')}</div>`;
  }

  /** 临近日程列表 */
  _renderScheduleList(limit = 3) {
    if (!this._mods.includes('schedule')) return '';
    const list = (this.snapshot?.nextSchedules || []).slice(0, limit);
    if (!list.length) {
      return html`<div class="muted-line" style="color:${this._label3}">${this.t('WIDGET_NO_SCHEDULE')}</div>`;
    }
    return html`
      <div class="schedule-list">
        ${list.map((s) => html`
          <div class="schedule-row" key="${s.item.id}">
            <span class="schedule-dot" style="background:${APPLE_COLORS[s.item.color] || APPLE_COLORS.red}"></span>
            <span class="schedule-title" style="color:${this._label}">${s.item.title}</span>
            <span class="schedule-sub" style="color:${this._label2}">${s.desc.sub}</span>
          </div>
        `)}
      </div>
    `;
  }

  /** 下个节假日倒数 */
  _renderNextHoliday() {
    if (!this._mods.includes('holiday')) return '';
    const h = this.snapshot?.nextHoliday;
    if (!h) return '';
    return html`
      <div class="holiday-chip" style="background:${this._cardBg};color:${this._label2}">
        <span style="color:${this._theme}">${this._isZh ? h.nameZh : h.nameEn}</span>
        <span>${h.days === 0 ? this.t('WIDGET_TODAY') : `${this.t('WIDGET_IN')} ${h.days} ${this.t('WIDGET_DAYS')}`}</span>
      </div>
    `;
  }

  /** 下个节气 */
  _renderNextTerm() {
    if (!this._mods.includes('festival')) return '';
    const t = this.snapshot?.nextSolarTerm;
    if (!t) return '';
    return html`
      <div class="term-chip" style="color:${this._label2}">
        <span style="color:${this._label}">${this._isZh ? t.zh : t.en}</span>
        <span>${t.days === 0 ? this.t('WIDGET_TODAY') : `${this.t('WIDGET_IN')} ${t.days} ${this.t('WIDGET_DAYS')}`}</span>
      </div>
    `;
  }

  /** 今年进度 */
  _renderProgress() {
    if (!this._mods.includes('progress')) return '';
    const p = this.snapshot?.yearProgress ?? 0;
    const doy = this.snapshot?.dayOfYear ?? 0;
    const year = this.now.getFullYear();
    return html`
      <div class="progress-wrap">
        <div class="progress-labels" style="color:${this._label3}">
          <span>${year} ${this.t('WIDGET_YEAR_PROGRESS')}</span>
          <span>${p.toFixed(1)}%</span>
        </div>
        <div class="progress-bar" style="background:${this._cardBg}">
          <div class="progress-fill" style="width:${p}%;background:${this._theme}"></div>
        </div>
        <div class="progress-labels" style="color:${this._label3}">
          <span>${this.t('WIDGET_DAY_OF_YEAR')} ${doy} ${this.t('WIDGET_DAYS')}</span>
        </div>
      </div>
    `;
  }

  /** 迷你月视图（4x4） */
  _renderMonthMini() {
    const now = this.now;
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const cells = getMonthGrid(y, m, 0);
    const store = getUserStore();
    const schedules = store ? store.getSchedules() : [];
    const todayStrV = todayStr();
    const headText = this._isZh
      ? `${y} 年 ${m} 月`
      : new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    return html`
      <div class="mini-cal">
        <div class="mini-cal-head" style="color:${this._label}">${headText}</div>
        <div class="mini-grid">
          ${WEEK_EN.map((w, i) => html`<div class="mini-wd" key="wd${i}" style="color:${this._label3}">${this._isZh ? WEEK_SHORT[i] : w}</div>`)}
          ${cells.map((cell, i) => {
            const ds = formatDate(cell.date);
            const dayInfo = getDayInfo(ds);
            const isToday = ds === todayStrV;
            const dayItems = getSchedulesOfDay(schedules, ds);
            const hasEvent = dayItems.length > 0;
            const isHoliday = this._holidayInfo(ds)?.isOffDay;
            const showLunar = cell.inMonth && (dayInfo.lunar.day === 1 || dayInfo.solarTerm || dayInfo.festivals.length > 0);
            return html`
              <div class="mini-cell ${cell.inMonth ? '' : 'out'} ${isToday ? 'today' : ''}" key="c${i}" style="${isToday ? `background:${this._theme}` : ''}">
                <span class="mini-num" style="color:${isToday ? '#fff' : cell.inMonth ? this._label : this._label3}">${cell.date.getDate()}</span>
                ${showLunar ? html`<span class="mini-lunar" style="color:${isToday ? 'rgba(255,255,255,0.85)' : this._theme}">${dayInfo.solarTerm ? dayInfo.solarTerm.zh : dayInfo.festivals[0]?.zh || dayInfo.lunar.display.slice(0, 2)}</span>` : ''}
                ${hasEvent && !isToday ? html`<span class="mini-dot" style="background:${this._theme}"></span>` : ''}
              </div>
            `;
          })}
        </div>
      </div>
    `;
  }

  // ---------- 尺寸渲染 ----------

  /** 1x1：仅显示距离最近的日程 */
  _renderNextCountdown() {
    if (!this._mods.includes('schedule')) {
      return html`
        <div class="cd-box">
          <div class="cd-days sm" style="color:${this._label}">${this.now.getDate()}</div>
          <div class="cd-unit" style="color:${this._label2}">${this._weekdayShort(this.now)}</div>
        </div>
      `;
    }
    const list = this.snapshot?.nextSchedules || [];
    if (!list.length) {
      return html`<div class="cd-empty" style="color:${this._label3}">${this.t('WIDGET_NO_SCHEDULE')}</div>`;
    }
    const { item, days } = list[0];
    const color = APPLE_COLORS[item.color] || APPLE_COLORS.red;
    const title = `${SCHEDULE_TYPES[item.type]?.icon || ''} ${item.title}`;
    return html`
      <div class="cd-box">
        ${days === 0
          ? html`<div class="cd-days today-flag" style="color:${color}">${this.t('WIDGET_TODAY')}</div>`
          : html`
            <div class="cd-days" style="color:${this._label}">${days}</div>
            <div class="cd-unit" style="color:${this._label2}">${this.t('WIDGET_DAYS')}</div>
          `}
        <div class="cd-title" style="color:${this._label2}">${title}</div>
        <span class="cd-bar" style="background:${color}"></span>
      </div>
    `;
  }

  render1x1() {
    return html`
      <div class="s1x1">
        ${this._renderNextCountdown()}
      </div>
    `;
  }

  /** 1x2（宽扁）：显示时间 */
  render1x2() {
    return html`
      <div class="s1x2">
        <div class="col-center">
          ${this._renderTimeCompact('time-wide')}
          ${this._renderDate()}
          ${this._renderLunar()}
        </div>
      </div>
    `;
  }

  /** 2x1（窄高）：竖线分隔 + 时间 */
  render2x1() {
    return html`
      <div class="s2x1">
        <span class="vline" style="background:${this._theme}"></span>
        <div class="right">
          ${this._renderTimeCompact('time-sm')}
          ${this._renderDate()}
          ${this._renderLunar()}
        </div>
      </div>
    `;
  }

  render2x2() {
    return html`
      <div class="s2x2">
        <div class="head-row">
          <div class="head-info">
            ${this._renderDate()}
            ${this._renderLunar()}
            ${this._renderTime(false, 'time-md')}
          </div>
        </div>
        <div class="divider" style="background:${this._cardBg}"></div>
        ${this._renderScheduleList(2)}
        <div class="chips">
          ${this._renderNextHoliday()}
          ${this._renderNextTerm()}
        </div>
      </div>
    `;
  }

  render2x4() {
    return html`
      <div class="s2x4">
        <div class="head-row">
          <div class="head-info">
            ${this._renderTime(true)}
            ${this._renderDate()}
            ${this._renderLunar()}
          </div>
        </div>
        ${this._renderScheduleList(3)}
        ${this._renderNextHoliday()}
        ${this._renderNextTerm()}
        ${this._renderProgress()}
      </div>
    `;
  }

  render4x4() {
    return html`
      <div class="s4x4">
        <div class="head-row">
          <div class="head-info">
            ${this._renderTime(true)}
            ${this._renderDate()}
            ${this._renderLunar()}
          </div>
          ${this._renderNextHoliday()}
        </div>
        ${this._mods.includes('minical') ? this._renderMonthMini() : ''}
        ${this._renderScheduleList(4)}
        ${this._renderProgress()}
      </div>
    `;
  }

  /** 1xFULL（宽 1 格 × 高占满整列）：时间/日期/农历/最近日程 竖排 */
  render1xfull() {
    return html`
      <div class="s1xfull">
        <div class="head-info">
          ${this._renderTime(false, 'time-lg')}
          ${this._renderDate()}
          ${this._renderLunar()}
        </div>
        <div class="divider" style="background:${this._cardBg}"></div>
        <div class="full-list">
          ${this._renderScheduleList(5)}
          ${this._renderNextHoliday()}
          ${this._renderNextTerm()}
        </div>
      </div>
    `;
  }

  render() {
    const theme = this._theme;
    const bright = this._brightness;
    const bg = this._cardBgStyle;
    const bgStyle = `${bg}${bright < 1 ? `;filter:brightness(${bright})` : ''}`;
    const visual = cardThemeVisual(this._cardThemeKey, this.spCtx?.darkMode ?? false);
    const common = {
      visual,
      theme,
      now: this.now,
      isZh: this._isZh,
      weekStart: this._card.weekStart ?? 1,
      hour12: this._card.hour12 ?? false,
      t: (k) => this.t(k),
    };
    const blocks = this._blocks;
    // 信息块模型：拼接=一卡多块（网格布局）；单独=整卡渲染唯一信息块（一行排列）
    const inner = this._displayMode === 'combo'
      ? renderBlocksHTML({ ...common, blocks, grid: this._comboGrid, cellW: this._cellW, cellH: this._cellH, size: this._cardSize })
      : renderInfoBlock({ ...common, content: blocks[0].c, style: blocks[0].s, singleRow: true, size: this._cardSize });
    return html`
      <div class="widget ${this._themeTextMode === 'light' ? 'text-light' : 'text-dark'}" style="${bgStyle}" @click=${this._openMain}>
        <div class="card-mode-wrap">${inner}</div>
      </div>
    `;
  }

  static styles = css`
      :host {
        display: block;
        height: 100%;
        width: 100%;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC',
          'Helvetica Neue', 'Microsoft YaHei', sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      .widget {
        height: 100%;
        width: 100%;
        box-sizing: border-box;
        padding: 12px;
        cursor: pointer;
        /* v1.32 需求 7：毛玻璃的 backdrop-filter 模糊区域是矩形，元素自身没有圆角时
           会在卡片四角圆角外露出直角。overflow:hidden 裁子元素，clip-path 额外裁掉
           合成层渗出的滤镜边缘（仅靠 border-radius 在部分浏览器仍会渗）。
           圆角值走 --sp-card-radius：v1.39 起由 _syncCardRadius() 在运行时按宿主
           .item-card-content 的 computed 圆角写入；此处再减 1px——玻璃弧藏进宿主
           20px 裁剪线内侧 1px，让我们自己的抗锯齿淡出发生在宿主底色的 AA 带之内，
           可见边缘只剩宿主单层 AA（精确重合时两层 AA 叠加，用户在 v1.37 的 20px
           上实测看到「隐约一点点」的贴角浅弧）。max(0px, …) 守卫保证方形卡
           （宿主 0px）不会算出负半径导致 clip-path 失效、backdrop 渗出直角。
           20px 仅为读取失败时的兜底（SunPanel 宿主默认圆角，CDP 实测）。 */
        border-radius: max(0px, calc(var(--sp-card-radius, 20px) - 1px));
        overflow: hidden;
        isolation: isolate;
        clip-path: inset(0 round max(0px, calc(var(--sp-card-radius, 20px) - 1px)));
        display: flex;
        flex-direction: column;
        user-select: none;
      }
      .widget:active { opacity: 0.85; }
      /* 浅色文字（深色/玻璃/渐变背景）叠加细微阴影，保证可读性 */
      .widget.text-light { text-shadow: 0 1px 2px rgba(0, 0, 0, 0.38); }
      .widget.text-dark { text-shadow: none; }

      /* 1x1：最近日程倒计时 */
      .s1x1 { flex: 1; min-width: 0; }
      .cd-box {
        height: 100%;
        width: 100%;
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 1px;
        padding-bottom: 5px;
        min-width: 0;
      }
      .cd-days { font-size: 30px; font-weight: 700; line-height: 1.05; font-variant-numeric: tabular-nums; }
      .cd-days.sm { font-size: 24px; }
      .cd-days.today-flag { font-size: 17px; font-weight: 700; }
      .cd-unit { font-size: 10px; font-weight: 600; margin-top: 1px; }
      .cd-title {
        font-size: 10px;
        font-weight: 500;
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        margin-top: 3px;
      }
      .cd-bar {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        bottom: 0;
        width: 34px;
        height: 3px;
        border-radius: 2px;
      }
      .cd-empty { height: 100%; display: flex; align-items: center; justify-content: center; font-size: 11px; }

      /* 通用文本 */
      .time { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: 0.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .time-big { font-size: 34px; font-weight: 700; }
      .time-md { font-size: 20px; }
      .time-lg { font-size: 28px; font-weight: 700; }
      .time-wide { font-size: 24px; font-weight: 700; }
      .time-sm { font-size: 14px; }
      .date-line { font-size: 12px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .lunar-line { font-size: 11px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }
      .muted-line { font-size: 11px; }
      .col-center { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; }

      /* 1x2 */
      .s1x2 { flex: 1; }

      /* 2x1（窄高）：竖线 + 时间 */
      .s2x1 { flex: 1; display: flex; align-items: stretch; gap: 6px; min-width: 0; }
      .vline {
        width: 3px;
        border-radius: 2px;
        flex-shrink: 0;
        align-self: stretch;
      }
      .s2x1 .right { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 4px; }
      .s2x1 .right .date-line,
      .s2x1 .right .lunar-line { white-space: normal; line-height: 1.3; }

      /* 头部行 */
      .head-row { display: flex; align-items: center; gap: 10px; }
      .head-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
      .head-info .time { text-align: left; }
      .divider { height: 1px; margin: 10px 0; border-radius: 1px; }

      /* 2x2 */
      .s2x2 { flex: 1; display: flex; flex-direction: column; }
      .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: auto; padding-top: 8px; }
      .holiday-chip, .term-chip {
        display: inline-flex; align-items: center; gap: 5px;
        font-size: 10px; font-weight: 500;
        padding: 3px 8px; border-radius: 8px;
      }

      /* 日程列表 */
      .schedule-list { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
      .schedule-row { display: flex; align-items: center; gap: 7px; font-size: 12px; }
      .schedule-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
      .schedule-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
      .schedule-sub { flex-shrink: 0; font-size: 10px; }

      /* 2x4 */
      .s2x4 { flex: 1; display: flex; flex-direction: column; }
      .s2x4 .head-row { margin-bottom: 4px; }

      /* 1xFULL（宽 1 格 × 高占满） */
      .s1xfull { flex: 1; display: flex; flex-direction: column; min-height: 0; }
      .s1xfull .head-info { flex-shrink: 0; }
      .s1xfull .divider { margin: 10px 0; }
      .full-list { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
      .full-list .schedule-list { flex: 1; min-height: 0; overflow: hidden; }

      /* 4x4 */
      .s4x4 { flex: 1; display: flex; flex-direction: column; gap: 10px; }
      .mini-cal { background: transparent; }
      .mini-cal-head { font-size: 13px; font-weight: 600; margin-bottom: 6px; }
      .mini-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
      .mini-wd { font-size: 9px; text-align: center; font-weight: 600; padding: 2px 0; }
      .mini-cell {
        position: relative;
        aspect-ratio: 1;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        border-radius: 6px;
        min-height: 0;
      }
      .mini-cell.today { }
      .mini-num { font-size: 11px; font-weight: 500; line-height: 1.1; }
      .mini-lunar { font-size: 7px; line-height: 1; margin-top: 1px; max-width: 100%; overflow: hidden; }
      .mini-dot { position: absolute; bottom: 2px; width: 3px; height: 3px; border-radius: 50%; }
      .mini-cell.out { opacity: 0.35; }

      /* 进度条 */
      .progress-wrap { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; }
      .progress-labels { display: flex; justify-content: space-between; font-size: 9px; font-weight: 500; }
      .progress-bar { height: 5px; border-radius: 3px; overflow: hidden; }
      .progress-fill { height: 100%; border-radius: 3px; transition: width 0.4s; }

      /* 卡片显示模式（非「一般模式」） */
      .card-mode-wrap { flex: 1; min-height: 0; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 16px; }

      /* 显示模式通用样式（与卡片预览共享渲染逻辑，类名保持一致）。
         字号一律用 em：以 16px 为基准，拼接块由 JS 按单元格像素内联设置根字号，实现等比缩放 */
      .pv-center { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.375em; width: 100%; text-align: center; }
      /* v1.41：text-align 居中换行文字——倒数事件为「今天」时主文字（两个汉字）超出窄块宽度折行，
         fit-content 溢出后盒子占满整行，折行行默认起点对齐致左贴边；单字符（如 4）收缩不受影响 */
      /* v1.40 需求 2：宽扁块（像素比 ≥2:1）倒数型双栏布局（数字列 + 文字列） */
      .pv-center.pv-flat { flex-direction: row; align-items: center; justify-content: center; gap: 0.5em; }
      .pv-fnum { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 0 1 auto; }
      .pv-ftext { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.1875em; flex: 0 1 auto; min-width: 0; text-align: center; }
      .pv-col { display: flex; flex-direction: column; gap: 0.3125em; width: 100%; }
      .pv-gap { height: 0.5em; }
      .pv-big { font-size: 1.875em; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; }
      .pv-mid { font-size: 1em; font-weight: 700; line-height: 1.25; }
      /* v1.35：简约显示的间隔圆点（方案 B 自绘，实测单点占位 0.84em；text-shadow 由 .text-light 继承不到背景圆，用 box-shadow 补） */
      .pv-dot { display:inline-block; width:.28em; height:.28em; border-radius:50%; background:currentColor; margin:0 .28em; vertical-align:.21em; }
      .text-light .pv-dot { box-shadow: 0 1px 2px rgba(0, 0, 0, 0.38); }
      .pv-led { text-shadow: 0 0 12px currentColor, 0 0 3px currentColor; }
      .pv-row2 { font-size: 0.75em; font-weight: 600; }
      .pv-sch-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5em; width: 100%; }
      .pv-sch-name { font-size: 0.75em; font-weight: 600; line-height: 1.2; flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .pv-sch-meta { display: flex; flex-direction: column; align-items: flex-end; flex: 0 0 auto; font-size: 0.5em; line-height: 1.2; white-space: nowrap; }
        .pv-sch-line { line-height: 1.25; }
      .pv-sch-date { opacity: 0.95; }
      .pv-sch-time { opacity: 0.8; }
      .pv-sub { font-size: 0.5625em; line-height: 1.3; }
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
      /* 单独模式：整卡内容一行排列 */
      .pv-single .pv-center { flex-direction: row; flex-wrap: wrap; justify-content: center; gap: 0.5em; }
      /* v1.40：单独模式按卡片尺寸的版式规则（只作用于 .pv-single，不影响拼接模式；
         与 mainPage / widgetConfig / make-preview / measure.html 五处镜像，改规则必须同步） */
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
    `;
}
