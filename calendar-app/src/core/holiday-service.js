/**
 * 节假日数据服务
 * 策略：应用级 dataNode 缓存 → 网络拉取（jsDelivr / chinese-days）→ 内置兜底数据
 * 刷新节奏：自动刷新间隔 24 小时；手动刷新至少间隔 60 秒
 */
import { FALLBACK_HOLIDAYS } from './holiday-fallback.js';

const DATA_URL = (year) => `https://cdn.jsdelivr.net/npm/chinese-days@latest/dist/years/${year}.json`;
const AUTO_REFRESH_INTERVAL = 24 * 60 * 60 * 1000; // 24h
const MANUAL_MIN_INTERVAL = 60 * 1000; // 手动刷新最小间隔

export class HolidayService {
  /** @param {Object} api spCtx.api */
  constructor(api) {
    this.api = api;
    /** @type {Map<string, {holidays:Object, workdays:Object, inLieuDays:Object}>} */
    this.years = new Map();
    this.meta = { updatedAt: 0, source: 'none', lastError: '' };
    this.ready = false;
    this._refreshing = null;
    this._listeners = [];
  }

  /** 数据变化订阅（组件重渲染用） */
  onChange(fn) {
    this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter((f) => f !== fn);
    };
  }

  _emit() {
    for (const fn of this._listeners) {
      try { fn(); } catch { /* 忽略监听器异常 */ }
    }
  }

  /** 初始化：读缓存 → 兜底 → 按需刷新 */
  async init() {
    if (this.ready) return;
    this._loadFallback();
    await this._loadCache();
    this.ready = true;
    await this.refreshIfNeeded();
  }

  _loadFallback() {
    for (const [year, data] of Object.entries(FALLBACK_HOLIDAYS)) {
      if (!this.years.has(year)) this.years.set(year, data);
    }
  }

  async _loadCache() {
    if (!this.api?.dataNode?.app) return;
    try {
      const cachedMeta = await this.api.dataNode.app.getByKey('holidayCache', 'meta');
      if (cachedMeta && typeof cachedMeta === 'object') {
        this.meta = { ...this.meta, ...cachedMeta };
      }
      const currentYear = new Date().getFullYear();
      for (const y of [currentYear - 1, currentYear, currentYear + 1]) {
        const data = await this.api.dataNode.app.getByKey('holidayCache', `y-${y}`);
        if (data && data.holidays) this.years.set(String(y), data);
      }
    } catch { /* 无权限或读取失败时静默使用兜底数据 */ }
  }

  /** 自动刷新：距上次刷新超过 24h 才执行 */
  async refreshIfNeeded() {
    if (!this.ready) return;
    const now = Date.now();
    if (this.meta.updatedAt && now - this.meta.updatedAt < AUTO_REFRESH_INTERVAL) return;
    if (this._refreshing) return this._refreshing;
    this._refreshing = this._doRefresh().finally(() => { this._refreshing = null; });
    return this._refreshing;
  }

  /** 手动强制刷新（60s 冷却） */
  async forceRefresh() {
    const now = Date.now();
    if (this.meta.manualAt && now - this.meta.manualAt < MANUAL_MIN_INTERVAL) {
      throw new Error('REFRESH_TOO_FREQUENT');
    }
    if (this._refreshing) return this._refreshing;
    this._refreshing = this._doRefresh(true).finally(() => { this._refreshing = null; });
    return this._refreshing;
  }

  async _doRefresh(manual = false) {
    if (!this.api?.network?.request) return;
    const currentYear = new Date().getFullYear();
    const targets = [currentYear, currentYear + 1];
    let success = 0;
    for (const year of targets) {
      try {
        const resp = await this.api.network.request({
          request: { targetUrl: DATA_URL(year), method: 'GET' },
        });
        // 兼容 axios 风格响应与裸 JSON
        const data = resp?.data ?? resp;
        if (data && data.holidays) {
          this.years.set(String(year), {
            holidays: data.holidays,
            workdays: data.workdays || {},
            inLieuDays: data.inLieuDays || {},
          });
          success++;
          try {
            await this.api.dataNode.app.setByKey('holidayCache', `y-${year}`, this.years.get(String(year)));
          } catch { /* 缓存写入失败不影响使用 */ }
        }
      } catch (e) {
        this.meta.lastError = String(e?.message || e);
      }
    }
    if (success > 0) {
      this.meta.updatedAt = Date.now();
      this.meta.source = 'network';
      if (manual) this.meta.manualAt = Date.now();
      try {
        await this.api.dataNode.app.setByKey('holidayCache', 'meta', {
          updatedAt: this.meta.updatedAt,
          source: 'network',
          manualAt: this.meta.manualAt || 0,
        });
      } catch { /* 忽略 */ }
      this._emit();
    }
  }

  /** 获取某年份节假日数据 */
  getYearData(year) {
    return this.years.get(String(year)) || null;
  }

  /**
   * 获取某日期的官方节假日信息
   * @returns {{nameZh:string, nameEn:string, days:number, isOffDay:boolean, isMakeupWorkday:boolean, isInLieu:boolean}|null}
   */
  getHolidayInfo(dateStr) {
    const year = dateStr.slice(0, 4);
    const data = this.years.get(year);
    if (!data) return null;
    const parse = (raw) => {
      if (!raw) return null;
      const parts = String(raw).split(',');
      return { nameEn: parts[0] || '', nameZh: parts[1] || parts[0] || '', days: Number(parts[2] || 0) };
    };
    const holiday = parse(data.holidays?.[dateStr]);
    if (holiday) {
      return { ...holiday, isOffDay: true, isMakeupWorkday: false, isInLieu: !!data.inLieuDays?.[dateStr] };
    }
    const makeup = parse(data.workdays?.[dateStr]);
    if (makeup) {
      return { ...makeup, isOffDay: false, isMakeupWorkday: true, isInLieu: true };
    }
    return null;
  }

  /** 是否休息日（含周末与法定节假日，排除调休上班） */
  isRestDay(dateStr) {
    const h = this.getHolidayInfo(dateStr);
    if (h?.isMakeupWorkday) return false;
    if (h?.isOffDay) return true;
    const d = new Date(dateStr.slice(0, 4), Number(dateStr.slice(5, 7)) - 1, Number(dateStr.slice(8, 10)));
    return d.getDay() === 0 || d.getDay() === 6;
  }

  /** 数据状态（设置界面展示） */
  getStatus() {
    const source = this.meta.source === 'network'
      ? (this.years.size > 3 ? 'network+fallback' : 'network')
      : (this.years.size > 0 ? 'fallback' : 'none');
    return {
      updatedAt: this.meta.updatedAt,
      source,
      lastError: this.meta.lastError || '',
      yearCount: this.years.size,
    };
  }
}
