/**
 * 日历微应用 - 卡片配置页面（Apple Settings 风格）
 * 每个小部件独立配置：显示模式（拼接/单独 + 内容与样式）、卡片主题、亮度、外观、时间。
 * 配置结果写入该小部件的 config（api.widget.save），实现「每个小部件、每种尺寸可单独调节」。
 *
 * v1.24 信息块模型：
 * - 拼接模式（combo）：一卡多个「内容+样式」单元，横向一排显示，数量受尺寸容量限制；
 * - 单独模式（single）：一卡仅一个单元，整卡一行排列；
 * - 「显示模式」为进入下级页面的按钮；该页固定栏：左侧「显示模式」（拼接时带预览），
 *   右侧「‹返回」「保存」，固定不随滑动滚动；
 * - 显示内容收敄为一个下拉框（一次仅选一个）；显示样式首栏带「确定」按钮，确认后写入卡片；
 * - 拼接模式固定栏右侧展示已选样式：可上下拖拽排序，点击 × 取消在卡片上显示；
 * - 保存按钮只把当前信息保存到内存临时区；关闭窗口或点击主页「保存小部件」才实际写入。
 */
import { SunPanelPageElement } from '@sun-panel/micro-app';
import { html, css } from 'lit';
import {
  APPLE_COLORS, appleStyles, appleUiStyles, appleThemeVars, appleSwitch, appleSegmented,
  appleGroup, appleRow, appleSelect,
} from '../core/apple-ui.js';
import {
  CARD_THEMES, cardThemeVisual,
  DISPLAY_MODES, displayContents, contentDef, styleDef, defaultStyleFor,
  sanitizeBlocks, migrateToBlocks,
  gridForSize, layoutBlocks, blocksFit, styleSpanDef, autoLayout,
  blockSpanDef, effectiveSpan, spanBounds, shiftFlatStyle,
  unitAlign, unitOpts, unitId, isFullCard, unitAlignExplicit,
  alignGovernor, applyAlignmentWithReport, layoutSignature, NO_UNITS_DATE_STYLES,
} from '../core/user-store.js';
import { renderInfoBlock, renderBlocksHTML, renderSpanEditor } from '../core/card-mode-render.js';
import { getUserStore } from '../core/app-state.js';

export class WidgetConfig extends SunPanelPageElement {
  static properties = {
    spCtx: { type: Object, attribute: false },
    widgetInfo: { type: Object, attribute: false },
    themeColor: { type: String },
    hour12: { type: Boolean },
    showSeconds: { type: Boolean },
    weekStart: { type: Number },
    cardTheme: { type: String },
    cardBrightness: { type: Number },
    displayMode: { type: String },
    cardBlocks: { type: Array, attribute: false },
    cardCenterH: { type: Boolean },
    cardCenterV: { type: Boolean },
    colorPickerOpen: { type: Boolean },
    modePageOpen: { type: Boolean },
    capHint: { type: String },
    pendingContent: { type: String },
    pendingStyle: { type: String },
  };

  constructor() {
    super();
    this._now = new Date();
    this._timer = null;
    this._hintTimer = null;
    this._draft = null;    // 临时区：模式页「保存」仅写入此处，不落盘
    this._dragIdx = null;  // 正在拖拽的样式索引
    this._origKey = '';    // 进入时的初始状态指纹（变更检测）
    this._spanEdit = null; // 占格编辑器：{ idx } | null（尺寸编辑的数据直接落在 cardBlocks[idx].span）
  }

  onInitialized({ widgetInfo }) {
    this.widgetInfo = widgetInfo;
    const g = getUserStore()?.getSettings() || {};
    const c = widgetInfo?.config || {};
    const merge = (k, d) => (c[k] !== undefined && c[k] !== null ? c[k] : (g[k] !== undefined ? g[k] : d));
    const size = this._size;
    // 显示模式（信息块模型）：新字段直接读取；旧字段（cardMode/modules）自动迁移
    let displayMode;
    let blocks;
    if (c.displayMode !== undefined || g.displayMode !== undefined) {
      displayMode = c.displayMode ?? g.displayMode ?? 'combo';
      blocks = c.cardBlocks ?? g.cardBlocks ?? null;
    } else {
      const m = migrateToBlocks({
        cardMode: c.cardMode ?? g.cardMode,
        modules: c.modules ?? g.modules,
      });
      displayMode = m.displayMode;
      blocks = m.blocks;
    }
    this.displayMode = displayMode;
    this.cardBlocks = sanitizeBlocks(blocks, displayMode, size);
    // 待确认的「显示内容 + 显示样式」：默认取当前第一个单元（卡片可以为空，故需兜底）
    const first = this.cardBlocks[0] || { c: 'calendar', s: 'month' };
    this.pendingContent = first.c;
    this.pendingStyle = first.s;
    this.cardCenterH = c.cardCenterH ?? g.cardCenterH ?? false;
    this.cardCenterV = c.cardCenterV ?? g.cardCenterV ?? false;
    this.themeColor = merge('themeColor', 'blue');
    this.hour12 = c.hour12 ?? g.hour12 ?? false;
    this.showSeconds = c.showSeconds ?? g.showSeconds ?? true;
    this.weekStart = merge('weekStart', 1);
    this.cardTheme = merge('cardTheme', 'glass-frosted');
    this.cardBrightness = merge('cardBrightness', 100);
    this.colorPickerOpen = false;
    this.modePageOpen = false;
    this.capHint = null;
    this._origKey = this._stateKey();
    this._startTimer();
    this.requestUpdate();
  }

  onDisconnected() {
    this._stopTimer();
    if (this._hintTimer) {
      clearTimeout(this._hintTimer);
      this._hintTimer = null;
    }
    // 关闭窗口：临时区中的数据尽力实际写入（异步，尽力而为）
    if (this._draft) {
      const displayMode = this._draft.displayMode;
      const blocks = sanitizeBlocks(this._draft.cardBlocks, displayMode, this._size);
      try {
        this.spCtx?.api?.widget.save({
          ...this.widgetInfo,
          config: {
            ...(this.widgetInfo?.config || {}),
            displayMode,
            cardBlocks: blocks,
            cardMode: displayMode === 'combo' ? 'combo' : blocks[0].c,
          },
        });
      } catch { /* 忽略落盘失败 */ }
      this._draft = null;
    }
  }

  _startTimer() {
    const timer = this.spCtx?.api?.timer;
    if (timer?.setInterval) {
      this._timer = timer.setInterval(() => {
        this._now = new Date();
        // 拖拽进行中不重渲染（避免 DOM 重建中断拖拽）
        if (this.isConnected && this._dragIdx == null) this.requestUpdate();
      }, 1000);
    }
  }

  _stopTimer() {
    if (this._timer != null && this.spCtx?.api?.timer?.clearInterval) {
      this.spCtx.api.timer.clearInterval(this._timer);
      this._timer = null;
    }
  }

  get _size() {
    return this.widgetInfo?.gridSize || '2x2';
  }

  /**
   * 尺寸 → [列数, 行数]。
   * 注意 SunPanel 尺寸命名为 [行]x[列]：1x2=1 行 2 列（宽扁）、2x1=2 行 1 列（窄高）、
   * 2x4=2 行 4 列（宽）；1xfull=1 行高 × 水平占满整行（横向 FULL，预览按 4 列近似）。
   */
  _sizeGrid() {
    const s = this._size;
    if (s === '1xfull') return [4, 1];
    const m = s.match(/^(\d+)x(\d+)$/);
    return m ? [Number(m[2]), Number(m[1])] : [2, 2];
  }

  _isZh() {
    return (this.spCtx?.language || 'zh-CN').toLowerCase().startsWith('zh');
  }

  _t(key, zh, en) {
    return this._isZh() ? zh : en;
  }

  /** 当前模式页状态指纹（用于检测未暂存修改） */
  _stateKey() {
    return `${this.displayMode}|${JSON.stringify(this.cardBlocks)}`;
  }

  /** 已选样式的完整显示名（内容 · 样式） */
  _unitName(b) {
    const isZh = this._isZh();
    const cd = contentDef(this.displayMode, b.c);
    const sd = styleDef(this.displayMode, b.c, b.s);
    return `${cd ? (isZh ? cd.zh : cd.en) : b.c} · ${sd ? (isZh ? sd.zh : sd.en) : b.s}`;
  }

  /** 仅样式名（预览后的实例名不再重复显示内容名）；空白单元带序号 */
  _styleName(b) {
    const isZh = this._isZh();
    if (b.c === 'blank') return isZh ? `空白${b.n || 1}` : `Blank ${b.n || 1}`;
    const sd = styleDef(this.displayMode, b.c, b.s);
    return sd ? (isZh ? sd.zh : sd.en) : b.s;
  }

  _blockNames() {
    return this.cardBlocks.map((b) => this._unitName(b)).join(' / ');
  }

  // ---------- 显示模式交互 ----------

  _setDisplayMode(v) {
    if (this.displayMode === v) return;
    this.displayMode = v;
    // 切换模式时单元重置为该模式默认（避免跨模式无效组合）
    this.cardBlocks = sanitizeBlocks(null, v, this._size);
    this.cardCenterH = false;
    this.cardCenterV = false;
    this.pendingContent = this.cardBlocks[0].c;
    this.pendingStyle = this.cardBlocks[0].s;
    this.capHint = null;
    this._spanEdit = null;
    this.requestUpdate();
  }

  /** 下拉框：一次仅选择一个显示内容 */
  _setPendingContent(key) {
    if (this.pendingContent === key) return;
    this.pendingContent = key;
    this.pendingStyle = defaultStyleFor(this.displayMode, key);
    this.capHint = null;
    this.requestUpdate();
  }

  /** 样式列表：选中一个显示样式（待确认） */
  _setPendingStyle(key) {
    this.pendingStyle = key;
    this.capHint = null;
    this.requestUpdate();
    this._scrollStripToActive();
  }

  /**
   * 样式预览框：左右切换待确认的样式（v1.29）。
   * 在「所有显示内容 × 其样式」的扁平序列上移动，到达边界即切到相邻显示内容。
   */
  _shiftPendingStyle(dir) {
    const next = shiftFlatStyle(this.displayMode, this.pendingContent, this.pendingStyle, dir);
    this.pendingContent = next.c;
    this.pendingStyle = next.s;
    this.capHint = null;
    this.requestUpdate();
    this._scrollStripToActive();
  }

  /** 单排样式条：把选中项滚到可视中部（避免它藏在横向滚动区外） */
  _scrollStripToActive() {
    requestAnimationFrame(() => {
      const root = this.renderRoot;
      if (!root) return;
      const strip = root.querySelector('.style-opts');
      const act = strip && strip.querySelector('.style-opt.active');
      if (!strip || !act || !strip.clientWidth) return;
      const left = act.offsetLeft - (strip.clientWidth - act.offsetWidth) / 2;
      strip.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
    });
  }

  // ---------- 占格调整（v1.29：点击已选样式名修改尺寸） ----------

  /** 打开/关闭某个单元的占格编辑器 */
  _toggleSpanEdit(idx) {
    if (this._spanEdit && this._spanEdit.idx === idx) {
      this._spanEdit = null;
    } else {
      this._spanEdit = { idx };
      this.capHint = null;
    }
    this.requestUpdate();
  }

  _closeSpanEdit() {
    this._spanEdit = null;
    this.requestUpdate();
  }

  /** 单元在当前布局中的落位（含其他单元占用的格子；放不下时 target=null） */
  _spanTargetInfo() {
    const e = this._spanEdit;
    if (!e) return null;
    const b = this.cardBlocks[e.idx];
    if (!b) return null;
    const size = this._size;
    const grid = gridForSize(size);
    const placed = layoutBlocks(this.cardBlocks, this.displayMode, size, grid, this._cardCenter);
    const same = (p) => p && p.c === b.c && p.s === b.s && (Number(p.n) || 0) === (Number(b.n) || 0);
    const target = (same(placed[e.idx]) ? placed[e.idx] : placed.find(same)) || null;
    const occupied = new Set();
    for (const p of placed) {
      if (p === target) continue;
      for (let r = p.pos.row; r < p.pos.row + p.span.rows; r++) {
        for (let c = p.pos.col; c < p.pos.col + p.span.cols; c++) occupied.add(`${r},${c}`);
      }
    }
    return { idx: e.idx, grid, b, target, occupied, size, isFull: isFullCard(size) };
  }

  get _cardCenter() {
    return { h: !!this.cardCenterH, v: !!this.cardCenterV };
  }

  /** 步进调整占格（dCols/dRows 为 ±1） */
  _resizeSpan(dCols, dRows) {
    const info = this._spanTargetInfo();
    if (!info) return;
    const { b } = info;
    const { min, max, minArea } = spanBounds(this.displayMode, this._size, b);
    const cur = blockSpanDef(this.displayMode, b).span;
    const cols = Math.min(max.cols, Math.max(min.cols, cur.cols + dCols));
    const rows = Math.min(max.rows, Math.max(min.rows, cur.rows + dRows));
    if (cols === cur.cols && rows === cur.rows) return;
    // v1.40：面积下限（minArea>0，如四样式禁 1×1）校验
    if (minArea > 0 && cols * rows < minArea) {
      this._showHint(this._t(
        't', '占格最小为 1×2 或 2×1（不能调到 1×1）',
        'Minimum span is 1×2 or 2×1 (1×1 not allowed)',
      ));
      return;
    }
    this._applySpan({ cols, rows });
  }

  /** 点击网格格子：以当前锚点为左上角，直接拉伸到该格 */
  _pickSpanCell(row, col) {
    const info = this._spanTargetInfo();
    if (!info || !info.target) return;
    const t = info.target;
    this._resizeSpanTo(col - t.pos.col + 1, row - t.pos.row + 1);
  }

  /** 直接设定占格（按可调区间收窄后写入） */
  _resizeSpanTo(cols, rows) {
    const info = this._spanTargetInfo();
    if (!info) return;
    const { min, max, minArea } = spanBounds(this.displayMode, info.size, info.b);
    const c = Math.min(max.cols, Math.max(min.cols, Math.round(cols)));
    const r = Math.min(max.rows, Math.max(min.rows, Math.round(rows)));
    // v1.40：面积下限（禁 1×1）校验——点格拉伸到 1×1 时拒绝并提示
    if (minArea > 0 && c * r < minArea) {
      this._showHint(this._t(
        't', '占格最小为 1×2 或 2×1（不能调到 1×1）',
        'Minimum span is 1×2 or 2×1 (1×1 not allowed)',
      ));
      return;
    }
    this._applySpan({ cols: c, rows: r });
  }

  /** 写入占格覆盖（含空间预检，放不下则给出提示并保持原样） */
  _applySpan(span) {
    const e = this._spanEdit;
    if (!e || !this.cardBlocks[e.idx]) return;
    const next = this.cardBlocks.map((x, i) => (i === e.idx ? { ...x, span: { ...span } } : x));
    if (!blocksFit(next, this.displayMode, this._size)) {
      const grid = gridForSize(this._size);
      this._showHint(this._t(
        't',
        `空间不足：已放下此单元，最大为 ${grid.rows}×${grid.cols}（垂直×水平）`,
        `Not enough room: up to ${grid.rows}×${grid.cols} (V×H) fits on this card`,
      ));
      return;
    }
    this.cardBlocks = next;
    this.capHint = null;
    this.requestUpdate();
  }

  /** 恢复该样式的默认占格 */
  _resetSpan() {
    const e = this._spanEdit;
    if (!e || !this.cardBlocks[e.idx]) return;
    const next = this.cardBlocks.map((x, i) => (i === e.idx ? { c: x.c, s: x.s } : x));
    if (!blocksFit(next, this.displayMode, this._size)) {
      this._showHint(this._t('t', '空间不足，无法恢复默认占格', 'Not enough room to restore the default size'));
      return;
    }
    this.cardBlocks = next;
    this.capHint = null;
    this.requestUpdate();
  }

  /** 「确定」：把待确认的「内容+样式」写入卡片 */
  _confirmStyle() {
    const c = this.pendingContent;
    const s = this.pendingStyle;
    if (!c || !s) return;
    if (this.displayMode === 'single') {
      this.cardBlocks = [{ c, s }];
      this._showHint(this._t('t', '已应用该显示样式', 'Style applied'));
      this.requestUpdate();
      return;
    }
    // 空白单元可重复添加（靠序号区分），故只对非空白内容查重
    const dup = c !== 'blank' && this.cardBlocks.some((b) => b.c === c && b.s === s);
    if (dup) {
      this._showHint(this._t('t', '该显示样式已在卡片中', 'This style is already on the card'));
      return;
    }
    // 空间预检：按每个样式的 span 实际占格判断（不再按块数硬限制）
    const next = c === 'blank'
      ? [...this.cardBlocks, { c, s, n: this._nextBlankN() }]
      : [...this.cardBlocks, { c, s }];
    if (!blocksFit(next, 'combo', this._size)) {
      const need = styleSpanDef('combo', c, s).span;
      const grid = gridForSize(this._size);
      this._showHint(this._t(
        't',
        `空间不足：此样式需占 ${need.rows}×${need.cols} 格（垂直×水平），${this._size}（${grid.rows}×${grid.cols} 格）已放不下`,
        `Not enough room: needs ${need.rows}×${need.cols} cells (V×H) — no room left on ${this._size} (${grid.rows}×${grid.cols})`,
      ));
      return;
    }
    this.capHint = null;
    this.cardBlocks = next;
    this.requestUpdate();
  }

  /** 拼接模式：点击 × 取消某个样式在卡片上显示（可全部移除，卡片即不显示内容） */
  _removeBlock(idx) {
    if (this.displayMode !== 'combo') return;
    this.cardBlocks = this.cardBlocks.filter((_, i) => i !== idx);
    this._spanEdit = null;
    this.requestUpdate();
  }

  /** 下一个可用的空白序号（1,2,3… 取最小空缺） */
  _nextBlankN() {
    const used = new Set(this.cardBlocks.filter((b) => b.c === 'blank').map((b) => Number(b.n) || 0));
    let cand = 1;
    while (used.has(cand)) cand += 1;
    return cand;
  }

  /** 空白填充：添加一个 1×1 的空白单元（不显示内容，仅占位；可添加多个） */
  _addBlank() {
    const next = [...this.cardBlocks, { c: 'blank', s: 'space', n: this._nextBlankN() }];
    if (!blocksFit(next, 'combo', this._size)) {
      this._showHint(this._t('t', '空间不足：先缩小其他单元再添加空白', 'Not enough room: shrink others before adding a blank'));
      return;
    }
    this.cardBlocks = next;
    this.capHint = null;
    this.requestUpdate();
  }

  /** 卡片级置中：内容未填满时整体按方向居中 */
  _toggleCardCenter(axis) {
    if (axis === 'h') this.cardCenterH = !this.cardCenterH;
    else this.cardCenterV = !this.cardCenterV;
    this.requestUpdate();
  }

  /** 当前卡片级置中的逐轴治理者（card = 卡片级接管该轴） */
  get _alignGov() {
    return alignGovernor(this._cardCenter);
  }

  /**
   * v1.31 需求 1 · D7：单元级置中改走「软禁用 + 反馈」。
   * 卡片级已接管该轴 → 不写数据，弹提示说明由预览栏接管；
   * 否则执行切换，并在「无空间可居中」时给出一次性提示（D6，避免静默无反应）。
   */
  _toggleAlignWithFeedback(axis) {
    // v1.43：同 mainPage —— 卡片级开着该轴时点单元开关，先把该轴移交给单元再切换。
    let switched = false;
    if (this._alignGov[axis] === 'card') {
      this._unlockCardCenter(axis);
      switched = true;
    }
    const before = layoutSignature(this._laidBlocks());
    this._toggleSpanAlign(axis);
    const after = layoutSignature(this._laidBlocks());
    if (before === after) {
      this._showHint(this.t(axis === 'h' ? 'CARD_ALIGN_NO_ROOM_H' : 'CARD_ALIGN_NO_ROOM_V'));
      return;
    }
    const { report } = applyAlignmentWithReport(
      autoLayout(this.cardBlocks, this.displayMode, this._size, gridForSize(this._size)),
      this.displayMode,
      this._size,
      gridForSize(this._size),
      { h: this._alignGov.h === 'unit', v: this._alignGov.v === 'unit' },
    );
    if (report.clamped[axis]) {
      this._showHint(this.t('CARD_ALIGN_CLAMPED'));
      return;
    }
    if (switched) {
      this._showHint(this.t('CARD_ALIGN_SWITCHED'));
      return;
    }
    const n = report.groupSize[axis];
    if (n > 1) {
      this._showHint(this.t(axis === 'h' ? 'CARD_ALIGN_GROUP_H' : 'CARD_ALIGN_GROUP_V', { count: n - 1 }));
    }
  }

  /**
   * v1.31 需求 1 · D7：「改为单元级控制」——关掉该轴的卡片级接管，
   * 并把「接管态当前显示的有效值」钉成显式单元级设置（理由见 mainPage 同名方法：
   * 解锁不应翻转视觉状态，否则用户点一下「看起来是开」的按钮会变成「关」）。
   */
  _unlockCardCenter(axis) {
    const info = this._spanTargetInfo();
    if (info) {
      const cur = unitAlign(this.displayMode, this._size, info.b);
      this._setBlockField(info.idx, { align: { h: cur.h, v: cur.v } });
    }
    if (axis === 'h') this.cardCenterH = false;
    else this.cardCenterV = false;
    this.requestUpdate();
  }

  /** 单元级置中（占格编辑器内）——仅由 _toggleAlignWithFeedback / _unlockCardCenter 调用 */
  _toggleSpanAlign(axis) {
    const info = this._spanTargetInfo();
    if (!info) return;
    const cur = unitAlign(this.displayMode, this._size, info.b);
    const next = { h: axis === 'h' ? !cur.h : cur.h, v: axis === 'v' ? !cur.v : cur.v };
    this._setBlockField(info.idx, { align: next });
  }

  /** 1×FULL 卡片：水平方向填满 */
  _fillSpanFull() {
    const info = this._spanTargetInfo();
    if (!info) return;
    this._resizeSpanTo(info.grid.cols, blockSpanDef(this.displayMode, info.b).span.rows);
  }

  /**
   * 月日历单行显示开关。
   * v1.31 · D13：1×FULL 上手动关闭单行时给一次提示（理由见 mainPage 同名方法）。
   * v1.35：opts 合并写，避免抹掉同单元的 noUnits。
   */
  _toggleSpanSingleLine() {
    const info = this._spanTargetInfo();
    if (!info) return;
    const cur = unitOpts(this.displayMode, this._size, info.b);
    const next = !cur.singleLine;
    this._setBlockField(info.idx, { opts: { ...(info.b.opts || {}), singleLine: next } });
    if (next === false && isFullCard(info.size)) {
      this._showHint(this.t('CARD_SINGLELINE_SMALL_FONT'));
    }
  }

  /**
   * v1.35：简约显示开关（隐藏 年/月/日 单位——横向以 · 分隔，竖向只显示数字）。
   * 默认关闭；仅 5 个日期样式渲染按钮（noUnitsOn 门控），与卡片尺寸无关。
   * 开启时弹一次提示解释形态，关闭不弹（与单行显示「只提示反默认方向」节奏对称）。
   * opts 合并写，避免抹掉同单元的 singleLine。
   */
  _toggleSpanNoUnits() {
    const info = this._spanTargetInfo();
    if (!info) return;
    const cur = unitOpts(this.displayMode, this._size, info.b);
    const next = !cur.noUnits;
    this._setBlockField(info.idx, { opts: { ...(info.b.opts || {}), noUnits: next } });
    if (next) this._showHint(this.t('CARD_NO_UNITS_ON'));
  }

  /** 写入单元的附加字段（align/opts），保留 c/s/span/n */
  _setBlockField(idx, patch) {
    const next = this.cardBlocks.map((x, i) => (i === idx ? { ...x, ...patch } : x));
    this.cardBlocks = next;
    this.requestUpdate();
  }

  // ---------- 拖拽排序（拼接模式已选样式） ----------

  _onBlockDragStart(e, idx) {
    this._dragIdx = idx;
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', String(idx)); } catch { /* ignore */ }
  }

  _onBlockDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drop-target');
  }

  _onBlockDragLeave(e) {
    e.currentTarget.classList.remove('drop-target');
  }

  _onBlockDrop(e, idx) {
    e.preventDefault();
    e.currentTarget.classList.remove('drop-target');
    const from = this._dragIdx;
    this._dragIdx = null;
    if (from == null || from === idx) return;
    const next = [...this.cardBlocks];
    const [moved] = next.splice(from, 1);
    next.splice(idx, 0, moved);
    this.cardBlocks = next;
    this.requestUpdate();
  }

  _onBlockDragEnd() {
    this._dragIdx = null;
    const root = this.renderRoot;
    if (root) root.querySelectorAll('.drop-target').forEach((el) => el.classList.remove('drop-target'));
    this.requestUpdate();
  }

  _showHint(text) {
    this.capHint = text;
    if (this._hintTimer) clearTimeout(this._hintTimer);
    this._hintTimer = setTimeout(() => {
      this.capHint = null;
      if (this.isConnected) this.requestUpdate();
    }, 2400);
    this.requestUpdate();
  }

  _renderColorPicker() {
    if (!this.colorPickerOpen) return '';
    return html`
      <div class="color-grid">
        ${Object.entries(APPLE_COLORS).filter(([k]) => k !== 'gray').map(([key, color]) => html`
          <button
            class="color-swatch ${this.themeColor === key ? 'selected' : ''}"
            style="background:${color}"
            aria-label="${key}"
            @click=${() => { this.themeColor = key; this.colorPickerOpen = false; this.requestUpdate(); }}
          >
            ${this.themeColor === key ? html`<svg viewBox="0 0 20 20" width="14" height="14"><path d="M4 10.5l4 4 8-9" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}
          </button>
        `)}
      </div>
    `;
  }

  // ---------- 预览渲染 ----------

  /** 模式页预览框（第三栏）：按当前尺寸宽高比渲染卡片外观，大小等比例缩小一倍 */
  _renderPreviewBox() {
    const dark = this.spCtx?.darkMode ?? false;
    const theme = APPLE_COLORS[this.themeColor] || APPLE_COLORS.blue;
    const visual = cardThemeVisual(this.cardTheme, dark);
    const isZh = this._isZh();
    const [cols, rows] = this._sizeGrid();
    const u = Math.min(64, 140 / rows, 220 / cols);
    const w = Math.round(u * cols);
    const h = Math.round(u * rows);
    const textMode = visual.textLight ? 'text-light' : 'text-dark';
    const common = {
      visual,
      theme,
      now: this._now,
      isZh,
      weekStart: this.weekStart,
      hour12: this.hour12,
      t: (k) => this.t(k),
    };
    const blocks = sanitizeBlocks(this.cardBlocks, this.displayMode, this._size);
    const grid = gridForSize(this._size);
    // 单元格像素宽/高：预览框按尺寸网格等比缩小，作为块内 em 字号的基准
    const cellW = (w - 14) / (grid.cols || 1);
    const cellH = (h - 14) / (grid.rows || 1);
    const inner = this.displayMode === 'combo'
      ? renderBlocksHTML({
        ...common,
        blocks: layoutBlocks(blocks, 'combo', this._size, grid, this._cardCenter),
        grid,
        cellW,
        cellH,
        size: this._size,
      })
      : renderInfoBlock({ ...common, content: blocks[0].c, style: blocks[0].s, singleRow: true, size: this._size });
    return html`
      <div class="pv-size-box mode-pv ${textMode}" style="${visual.bg};width:${w}px;height:${h}px;">
        <div class="card-mode-wrap">${inner}</div>
      </div>
    `;
  }

  /** 当前尺寸下的实际布局（单元级 + 卡片级置中叠加后的结果） */
  _laidBlocks() {
    return layoutBlocks(
      this.cardBlocks, this.displayMode, this._size, gridForSize(this._size), this._cardCenter,
    );
  }

  /**
   * 拼接模式：预览后方的已选样式（可拖拽排序 / 点击名称改尺寸 / 点击 × 取消显示）。
   * v1.29：实例名只显示样式名（不再重复显示内容名）；尺寸徽标为「垂直×水平」，可点击修改。
   */
  _renderBlockChips() {
    if (this.displayMode !== 'combo') return '';
    const editIdx = this._spanEdit ? this._spanEdit.idx : -1;
    const grid = gridForSize(this._size);
    const laid = new Map(
      layoutBlocks(this.cardBlocks, 'combo', this._size, grid, this._cardCenter).map((b) => [unitId(b), b]),
    );
    return html`
      <div class="block-chips">
        ${this.cardBlocks.map((b, i) => {
      const hit = laid.get(unitId(b));
      const span = hit ? hit.span : effectiveSpan('combo', this._size, b);
      const over = !hit;
      return html`
          <div
            class="block-chip ${over ? 'overflow' : ''} ${editIdx === i ? 'editing' : ''}"
            key="chip-${i}"
            draggable="true"
            title="${over
          ? this._t('t', '当前尺寸放不下此单元，请缩小占格或换更大的卡片尺寸', 'Does not fit this card size — shrink it or pick a bigger size')
          : this._t('t', '点击调整占格；拖动排序；点击 × 取消显示', 'Tap to resize; drag to reorder; tap × to remove')}"
            @dragstart=${(e) => this._onBlockDragStart(e, i)}
            @dragover=${(e) => this._onBlockDragOver(e)}
            @dragleave=${(e) => this._onBlockDragLeave(e)}
            @drop=${(e) => this._onBlockDrop(e, i)}
            @dragend=${() => this._onBlockDragEnd()}
            @click=${() => this._toggleSpanEdit(i)}
          >
            <span class="chip-grip">⣿</span>
            <span class="chip-name">${this._styleName(b)}</span>
            <span class="chip-span ${over ? 'bad' : ''}">${over ? this._t('t', '溢出', 'N/A') : `${span.rows}×${span.cols}`}</span>
            <button
              class="chip-x"
              aria-label="remove"
              @click=${(e) => { e.stopPropagation(); this._removeBlock(i); }}
            >
              <svg viewBox="0 0 10 10" width="9" height="9"><path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
            </button>
          </div>
        `;
    })}
        ${this.cardBlocks.length ? '' : html`<div class="chips-empty">${this._t('t', '卡片当前不显示任何内容', 'The card shows nothing right now')}</div>`}
      </div>
      <div class="chip-tools">
        <button class="chip-tool" @click=${this._addBlank}>
          <svg viewBox="0 0 16 16" width="12" height="12"><rect x="1.5" y="1.5" width="13" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2.5 2.5"/></svg>
          ${this._t('t', '空白填充', 'Add blank')}
        </button>
        <button
          class="chip-tool ${this.cardCenterH ? 'on' : ''}"
          style="${this.cardCenterH ? `border-color:${APPLE_COLORS[this.themeColor] || APPLE_COLORS.blue};color:${APPLE_COLORS[this.themeColor] || APPLE_COLORS.blue}` : ''}"
          @click=${() => this._toggleCardCenter('h')}
        >${this._t('t', '水平置中', 'Center H')}</button>
        <button
          class="chip-tool ${this.cardCenterV ? 'on' : ''}"
          style="${this.cardCenterV ? `border-color:${APPLE_COLORS[this.themeColor] || APPLE_COLORS.blue};color:${APPLE_COLORS[this.themeColor] || APPLE_COLORS.blue}` : ''}"
          @click=${() => this._toggleCardCenter('v')}
        >${this._t('t', '垂直置中', 'Center V')}</button>
      </div>
      <div class="tool-note">${this.t('CARD_CENTER_TAKEOVER_NOTE')}</div>
    `;
  }

  /** 占格编辑器（v1.29）：标题 + 卡片网格示意 + 垂直/水平步进 + 自适应 */
  _renderSpanEditor() {
    const info = this._spanTargetInfo();
    if (!info) return '';
    const theme = APPLE_COLORS[this.themeColor] || APPLE_COLORS.blue;
    const isMonth = info.b.c === 'calendar' && info.b.s === 'month';
    return renderSpanEditor({
      grid: info.grid,
      target: info.target,
      span: info.target ? info.target.span : effectiveSpan(this.displayMode, info.size, info.b),
      bounds: spanBounds(this.displayMode, info.size, info.b),
      occupied: info.occupied,
      align: unitAlign(this.displayMode, info.size, info.b),
      isFull: info.isFull,
      // v1.31 需求 2：月历「单行显示」仅 1×FULL 卡片可用（其他尺寸传 null → 不渲染按钮）
      singleLine: (isMonth && isFullCard(info.size))
        ? unitOpts(this.displayMode, info.size, info.b).singleLine
        : null,
      // v1.35：简约显示仅 5 个日期样式可用（白名单门控，与当前开关状态无关——否则默认关时按钮不渲染）
      noUnits: (info.b.c === 'time' && NO_UNITS_DATE_STYLES.includes(info.b.s))
        ? unitOpts(this.displayMode, info.size, info.b).noUnits
        : null,
      theme,
      name: this._styleName(info.b),
      isZh: this._isZh(),
      sizeLabel: info.size,
      onPick: (r, c) => this._pickSpanCell(r, c),
      onResize: (dCols, dRows) => this._resizeSpan(dCols, dRows),
      onReset: () => this._resetSpan(),
      onClose: () => this._closeSpanEdit(),
      // v1.31 需求 1：卡片级接管的轴 → 单元级开关软禁用（可点，点了给原因 + 解锁）
      // v1.43：去掉接管/锁定，单元级开关始终可点（点击即移交该轴）
      alignLocked: { h: false, v: false },
      alignDefault: { h: !unitAlignExplicit(info.b), v: !unitAlignExplicit(info.b) },
      alignHint: this.t('CARD_ALIGN_UNIT_HINT'),
      t: (key, vars) => this.t(key, vars),
      onToggleAlign: (axis) => this._toggleAlignWithFeedback(axis),
      onFull: () => this._fillSpanFull(),
      onToggleSingleLine: () => this._toggleSpanSingleLine(),
      onToggleNoUnits: () => this._toggleSpanNoUnits(),
    });
  }

  /**
   * 显示样式：首栏标题 + 最右「确定」按钮；内容下拉框（v1.35 起由独立「显示内容」栏并入此处）；
   * 样式选项；样式预览框（‹ › 切换 + 序号/总数）。
   */
  _renderStyleSection(theme) {
    const isZh = this._isZh();
    const cd = contentDef(this.displayMode, this.pendingContent);
    if (!cd) return '';
    const list = cd.styles;
    const idx = Math.max(0, list.findIndex((s) => s.key === this.pendingStyle));
    const cur = list[idx];
    const dark = this.spCtx?.darkMode ?? false;
    const visual = cardThemeVisual(this.cardTheme, dark);
    const textMode = visual.textLight ? 'text-light' : 'text-dark';
    const frameInner = renderInfoBlock({
      content: cd.key,
      style: cur.key,
      visual,
      theme,
      now: this._now,
      isZh,
      weekStart: this.weekStart,
      hour12: this.hour12,
      t: (k) => this.t(k),
    });
    const frameSpan = styleSpanDef(this.displayMode, cd.key, cur.key).span;
    return html`
      <div class="style-sec">
        <div class="style-sec-head">
          <span class="style-sec-title">${this._t('t', '显示样式', 'Style')}</span>
          <button class="confirm-btn" style="background:${theme}" @click=${this._confirmStyle}>
            ${this._t('t', '确定', 'Done')}
          </button>
        </div>
        <div class="style-content-row">
          <span class="style-content-label">${this._t('t', '显示内容', 'Content')}</span>
          ${appleSelect(
      displayContents(this.displayMode).map((c) => ({ value: c.key, label: `${c.icon} ${isZh ? c.zh : c.en}` })),
      this.pendingContent,
      (v) => this._setPendingContent(v),
      theme,
    )}
        </div>
        <div class="style-strip-wrap">
          <div class="style-opts">
            ${list.map((s) => html`
              <button
                class="style-opt ${this.pendingStyle === s.key ? 'active' : ''}"
                key="s-${s.key}"
                style="${this.pendingStyle === s.key ? `border-color:${theme};color:${theme}` : ''}"
                @click=${() => this._setPendingStyle(s.key)}
              >${isZh ? s.zh : s.en}</button>
            `)}
          </div>
        </div>
        <div class="style-stage">
          <button class="style-nav" aria-label="prev" @click=${() => this._shiftPendingStyle(-1)}>
            <svg viewBox="0 0 8 13" width="8" height="13"><path d="M7 1L1 6.5 7 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div class="style-frame ${textMode}" style="${visual.bg}">
            <div class="card-mode-wrap">${frameInner}</div>
          </div>
          <button class="style-nav" aria-label="next" @click=${() => this._shiftPendingStyle(1)}>
            <svg viewBox="0 0 8 13" width="8" height="13"><path d="M1 1l6 5.5L1 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="style-counter">
          ${idx + 1}/${list.length}${isZh ? ` · ${cur.zh}` : ` · ${cur.en}`}
          <span class="counter-size">${isZh ? '尺寸' : 'size'} ${frameSpan.rows}×${frameSpan.cols}</span>
        </div>
      </div>
    `;
  }

  // ---------- 保存 ----------

  /** 模式页「保存」：仅写入内存临时区，不落盘 */
  _saveDraft() {
    this._draft = {
      displayMode: this.displayMode,
      cardBlocks: this.cardBlocks.map((b) => ({ ...b })),
    };
    this._showHint(this._t('t', '已暂存到临时区', 'Saved to temp area'));
  }

  /** 模式页「返回」：有未暂存修改时自动补入临时区，防止丢失 */
  _backToMain() {
    if (!this._draft && this._stateKey() !== this._origKey) {
      this._draft = {
        displayMode: this.displayMode,
        cardBlocks: this.cardBlocks.map((b) => ({ ...b })),
      };
    }
    this.modePageOpen = false;
    this._spanEdit = null;
    this.requestUpdate();
  }

  /** 主页「保存小部件」：合并临时区后实际写入并关闭窗口 */
  async _save() {
    const size = this._size;
    const displayMode = this._draft?.displayMode ?? this.displayMode;
    const blocks = sanitizeBlocks(this._draft?.cardBlocks ?? this.cardBlocks, displayMode, size);
    await this.spCtx.api.widget.save({
      ...this.widgetInfo,
      config: {
        themeColor: this.themeColor,
        hour12: this.hour12,
        showSeconds: this.showSeconds,
        weekStart: this.weekStart,
        cardTheme: this.cardTheme,
        cardBrightness: this.cardBrightness,
        displayMode,
        cardBlocks: blocks,
        cardMode: displayMode === 'combo' ? 'combo' : blocks[0].c,
        cardCenterH: !!this.cardCenterH,
        cardCenterV: !!this.cardCenterV,
      },
    });
    this._draft = null;
    this.spCtx.api.window.close();
  }

  // ---------- 页面渲染 ----------

  _renderMainPage() {
    const isZh = this._isZh();
    const dark = this.spCtx?.darkMode ?? false;
    const theme = APPLE_COLORS[this.themeColor] || APPLE_COLORS.red;
    const colorNamesZh = { red: '日历红', orange: '橘色', yellow: '黄色', green: '绿色', teal: '青色', blue: '蓝色', purple: '紫色', pink: '粉色', gray: '灰色' };
    const colorNamesEn = { red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green', teal: 'Teal', blue: 'Blue', purple: 'Purple', pink: 'Pink', gray: 'Gray' };
    const themeOptions = Object.entries(CARD_THEMES).map(([key, t]) => ({ value: key, label: isZh ? t.zh : t.en }));
    const weekOptions = [
      { value: 1, label: isZh ? '周一' : 'Monday' },
      { value: 0, label: isZh ? '周日' : 'Sunday' },
      { value: 6, label: isZh ? '周六' : 'Saturday' },
    ];
    const modeDef = DISPLAY_MODES[this.displayMode] || DISPLAY_MODES.combo;

    return html`
      <div class="cfg-bar">
        <span class="cfg-bar-title">${this._t('t', '卡片设置', 'Widget Settings')}</span>
        <button class="bar-btn save" style="background:${theme}" @click=${this._save}>
          ${this.widgetInfo?.id !== 0 ? this.t('WIDGET_CONFIG_BUTTON_SAVE') : this.t('WIDGET_CONFIG_BUTTON_CREATE')}
        </button>
      </div>
      <div class="subtitle">${this._t('t', '以下设置仅对该小部件生效，可与其他小部件（含同尺寸）互不相同。', 'Settings apply to this widget only and can differ from other widgets (even of the same size).')}</div>

      ${appleGroup(
        this._t('t', '显示模式', 'DISPLAY MODE'),
        [
          appleRow({
            label: this._t('t', '模式', 'Mode'),
            sub: this._t('t', `${modeDef.zh} · ${this._blockNames()}`, `${modeDef.en} · ${this._blockNames()}`),
            first: true,
            last: true,
            chevron: true,
            onClick: () => { this.modePageOpen = true; this.requestUpdate(); },
            right: html`<span class="row-mode-tag" style="color:${theme}">${isZh ? modeDef.zh : modeDef.en}</span>`,
          }),
        ],
        this._t('t', '拼接模式：一卡多个显示样式（数量随尺寸而定）；单独模式：一卡仅一个。点击进入「显示模式」页面调整。', 'Combo: multiple styles per card (count depends on size). Single: one per card. Tap to open the Display Mode page.'),
      )}

      ${appleGroup(
        this._t('t', '卡片外观', 'CARD APPEARANCE'),
        [
          appleRow({
            label: this._t('t', '卡片主题', 'Card Theme'),
            sub: isZh ? CARD_THEMES[this.cardTheme]?.zh : CARD_THEMES[this.cardTheme]?.en,
            first: true,
            right: appleSelect(themeOptions, this.cardTheme, (v) => { this.cardTheme = v; this.requestUpdate(); }, theme),
          }),
          appleRow({
            label: this._t('t', '卡片亮度', 'Card Brightness'),
            sub: `${this.cardBrightness}%`,
            right: html`<input type="range" class="bright-slider" min="30" max="100" value="${this.cardBrightness}" @input=${(e) => { this.cardBrightness = Number(e.target.value); this.requestUpdate(); }} />`,
          }),
          appleRow({
            label: this._t('t', '主题色', 'Theme Color'),
            sub: isZh ? colorNamesZh[this.themeColor] : colorNamesEn[this.themeColor],
            chevron: !this.colorPickerOpen,
            onClick: () => { this.colorPickerOpen = !this.colorPickerOpen; this.requestUpdate(); },
            right: html`<span style="width:18px;height:18px;border-radius:50%;background:${theme};display:inline-block"></span>`,
          }),
          this.colorPickerOpen ? html`<div style="padding:4px 14px 14px">${this._renderColorPicker()}</div>` : '',
        ],
      )}

      ${appleGroup(
        this._t('t', '时间', 'TIME'),
        [
          appleRow({
            label: this._t('t', '一周起始日', 'Week Starts On'),
            first: true,
            right: appleSelect(weekOptions, this.weekStart, (v) => { this.weekStart = Number(v); this.requestUpdate(); }, theme),
          }),
          appleRow({
            label: this._t('t', '时间格式', 'Time Format'),
            right: appleSegmented(
              [
                { label: '24h', value: false },
                { label: '12h', value: true },
              ],
              this.hour12,
              (v) => { this.hour12 = v; this.requestUpdate(); },
              theme,
            ),
          }),
          appleRow({
            label: this._t('t', '显示秒', 'Show Seconds'),
            last: true,
            right: appleSwitch(
              this.showSeconds,
              () => { this.showSeconds = !this.showSeconds; this.requestUpdate(); },
              theme,
            ),
          }),
        ],
      )}

      <div class="size-hint">
        ${this._t('t', '支持尺寸：1×1 / 1×2 / 2×1 / 2×2 / 2×4 / 4×4 / 1×FULL。卡片主题与显示模式也可在「主页面 → 设置」中设为全局默认，新卡片将自动继承。', 'Sizes: 1×1 / 1×2 / 2×1 / 2×2 / 2×4 / 4×4 / 1×FULL. Card theme & display mode can also be set as global defaults in Main Page → Settings; new widgets inherit them.')}
      </div>
    `;
  }

  _renderModePage() {
    const isZh = this._isZh();
    const dark = this.spCtx?.darkMode ?? false;
    const theme = APPLE_COLORS[this.themeColor] || APPLE_COLORS.red;
    const isCombo = this.displayMode === 'combo';

    const previewBox = this._renderPreviewBox();
    const styleSection = this._renderStyleSection(theme);

    return html`
      <div class="mode-bar">
        <div class="mode-bar-row">
          <span class="mode-bar-title">${this._t('t', '显示模式', 'Display Mode')}</span>
          <div class="mode-bar-actions">
            <button class="bar-btn back" @click=${this._backToMain}>
              <svg viewBox="0 0 8 13" width="8" height="13"><path d="M7 1L1 6.5 7 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              ${this._t('t', '返回', 'Back')}
            </button>
            <button class="bar-btn save" style="background:${theme}" @click=${this._saveDraft}>
              ${this._t('t', '保存', 'Save')}
            </button>
          </div>
        </div>
      </div>

      <div class="mode-tabs">
        <button class="mode-tab ${isCombo ? 'active' : ''}" style="${isCombo ? `border-color:${theme}` : ''}" @click=${() => this._setDisplayMode('combo')}>
          <span class="mode-tab-icon">${DISPLAY_MODES.combo.icon}</span>
          <span class="mode-tab-name" style="${isCombo ? `color:${theme}` : ''}">${isZh ? DISPLAY_MODES.combo.zh : DISPLAY_MODES.combo.en}</span>
          <span class="mode-tab-sub">${this._t('t', '一卡多个显示样式', 'Multiple styles per card')}</span>
        </button>
        <button class="mode-tab ${!isCombo ? 'active' : ''}" style="${!isCombo ? `border-color:${theme}` : ''}" @click=${() => this._setDisplayMode('single')}>
          <span class="mode-tab-icon">${DISPLAY_MODES.single.icon}</span>
          <span class="mode-tab-name" style="${!isCombo ? `color:${theme}` : ''}">${isZh ? DISPLAY_MODES.single.zh : DISPLAY_MODES.single.en}</span>
          <span class="mode-tab-sub">${this._t('t', '一卡一个显示样式', 'One style per card')}</span>
        </button>
      </div>

      ${isCombo ? html`
        <div class="mode-row">
          ${previewBox}
          <div class="chips-block">
            ${this._renderBlockChips()}
          </div>
        </div>
        ${this._renderSpanEditor()}
      ` : html`
        <div class="mode-preview-wrap">${previewBox}</div>
      `}
      ${styleSection}
      ${this.capHint ? html`<div class="cap-hint">${this.capHint}</div>` : ''}

      <div class="mode-note">
        ${isCombo
          ? this._t('t', '拼接模式：选择内容与样式后点「确定」加入卡片；点击预览后方的样式名称可调整占格与置中；「空白填充」可添加只占位不显示的空白单元；卡片可清空全部内容。', 'Combo: pick a content & style, then tap Done. Tap a style name after the preview to resize or center it. "Add blank" inserts a spacer that shows nothing. A card can be emptied completely.')
          : this._t('t', '单独模式：整卡仅显示一个显示样式，选择后点击「确定」应用。', 'Single: the whole card shows one style only. Pick one and tap Done to apply.')}
      </div>
    `;
  }

  render() {
    const dark = this.spCtx?.darkMode ?? false;
    const theme = APPLE_COLORS[this.themeColor] || APPLE_COLORS.red;
    return html`
      <style>
        ${appleStyles.cssText}
        ${appleUiStyles.cssText}
        :host { display: block; height: 100%; }
        .page {
          height: 100%;
          overflow-y: auto;
          background: var(--apple-bg);
          color: var(--apple-label);
        }
        .page::-webkit-scrollbar { width: 6px; }
        .page::-webkit-scrollbar-thumb { background: rgba(120,120,128,0.3); border-radius: 3px; }
        .subtitle {
          font-size: 13px;
          color: var(--apple-label-3);
          padding: 0 24px 14px;
          line-height: 1.5;
        }
        .color-grid {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 10px;
          padding: 4px 2px 2px;
        }
        .color-swatch {
          width: 30px;
          height: 30px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.15s;
          padding: 0;
        }
        .color-swatch:active { transform: scale(0.88); }
        .color-swatch.selected { box-shadow: 0 0 0 2.5px var(--apple-card), 0 0 0 5px currentColor; }
        .row-mode-tag { font-size: 14px; font-weight: 600; }
        .size-hint {
          font-size: 12px;
          color: var(--apple-label-3);
          padding: 0 24px 16px;
          line-height: 1.5;
        }
        .bright-slider {
          -webkit-appearance: none;
          appearance: none;
          width: 150px;
          height: 4px;
          border-radius: 2px;
          background: rgba(120,120,128,0.32);
          outline: none;
        }
        .bright-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px; height: 18px; border-radius: 50%;
          background: ${theme}; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
        .bright-slider::-moz-range-thumb {
          width: 18px; height: 18px; border: none; border-radius: 50%;
          background: ${theme}; cursor: pointer;
        }

        /* 固定栏（主页 / 显示模式页共用）：不随滑动滚动 */
        .cfg-bar {
          position: sticky;
          top: 0;
          z-index: 30;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 20px 10px;
          background: var(--apple-bg);
        }
        .cfg-bar-title { font-size: 26px; font-weight: 700; letter-spacing: -0.02em; }
        .bar-btn {
          border: none;
          border-radius: 9px;
          padding: 8px 16px;
          font-size: 14px;
          font-weight: 600;
          font-family: inherit;
          color: #fff;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          transition: transform 0.15s, opacity 0.15s;
          flex-shrink: 0;
        }
        .bar-btn:active { transform: scale(0.95); opacity: 0.85; }
        .bar-btn.back {
          background: var(--apple-fill);
          color: var(--apple-label);
        }

        /* 显示模式页固定栏 */
        .mode-bar {
          position: sticky;
          top: 0;
          z-index: 30;
          background: var(--apple-bg);
          padding: 10px 12px 8px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .mode-bar-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .mode-bar-title { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; }
        .mode-bar-actions { margin-left: auto; display: flex; gap: 8px; align-items: center; }

        /* 第三栏：拼接=左（预览+已选样式）/ 右（显示选项上下排）；单独=预览居中 */
        /* 拼接模式：左侧预览 + 右侧已选样式（同一行）；显示内容/显示样式在下方全宽 */
        .mode-row { display: flex; gap: 14px; align-items: center; padding: 2px 16px 0; }
        .chips-block { flex: 1; min-width: 0; }

        /* 已选样式 chips（可拖拽排序 / 点击 × 取消） */
        .block-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .block-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1.5px solid rgba(120,120,128,0.25);
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
        .block-chip:active { cursor: grabbing; }
        .block-chip.drop-target { border-color: ${theme}; box-shadow: 0 0 0 1px ${theme}; }
        .chip-grip { color: var(--apple-label-3); font-size: 10px; letter-spacing: -2px; }
        .chip-name { white-space: nowrap; }
        /* 占位徽标（列×行）：让用户直观看到每个单元的占格。
           v1.31：color 由 label-3 改为 --apple-label（3.14/2.72 → 16.54/10.81），
           与新增角标口径一致；本轮不动 .chip-span.bad（涉及品牌红，需产品确认）。 */
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
        /* 卡片无内容时的提示 */
        .chips-empty {
          font-size: 11px;
          font-weight: 500;
          color: var(--apple-label-3);
          padding: 2px 0;
        }
        /* 预览右侧工具：空白填充 / 水平置中 / 垂直置中 */
        .chip-tools { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .chip-tool {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border: 1.5px solid rgba(120,120,128,0.25);
          background: var(--apple-card);
          border-radius: 999px;
          padding: 5px 10px;
          font-size: 11px;
          font-weight: 600;
          color: var(--apple-label-2);
          cursor: pointer;
          font-family: inherit;
          white-space: nowrap;
          transition: border-color 0.15s, transform 0.1s;
        }
        .chip-tool:active { transform: scale(0.96); }

        /* 占格编辑器（v1.29：点击已选样式名展开） */
        .span-editor {
          margin: 10px 16px 0;
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
        /* v1.31 触摸目标统一口径：视觉 min-height 36px + ::after 伪元素把热区撑到 44×44。
           （44px 是「热区」要求而非「视觉盒子」要求：WCAG 2.2 SC 2.5.5 / Apple HIG 44pt
             指的都是可点区域，SC 2.5.8 的底线仅 24px；11px 文字配实心 44px 胶囊会显得空旷。）
           .se-toggle / .se-actions / .chip-tool 三者必须同步，否则同面板出现两种高度。 */
        .se-toggle, .se-actions button, .chip-tool {
          position: relative;
          min-height: 36px;
        }
        .se-toggle {
          border: 1.5px solid rgba(120,120,128,0.25);
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
        /* 热区上下各扩 4px → 相邻两行各占 4px，行间距须 ≥8px 才不重叠
           （z-index 只决定重叠那 2px 归谁，不能消除重叠） */
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
           = 16.54 / 10.81 ✅。不用 label-2（对 fill 底深色仅 4.42 ❌）。 */
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

        /* 模式切换 tabs */
        .mode-tabs {
          display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
          padding: 4px 16px 4px;
        }
        .mode-tab {
          display: flex; flex-direction: column; align-items: center; gap: 3px;
          padding: 12px 6px; border-radius: 12px;
          border: 1.5px solid rgba(120,120,128,0.25);
          background: var(--apple-card);
          cursor: pointer; font-family: inherit;
          transition: border-color 0.15s, transform 0.1s;
        }
        .mode-tab:active { transform: scale(0.97); }
        .mode-tab-icon { font-size: 20px; line-height: 1; }
        .mode-tab-name { font-size: 13px; font-weight: 700; color: var(--apple-label); }
        .mode-tab-sub { font-size: 10px; color: var(--apple-label-3); }
        .cap-hint {
          font-size: 12px; color: var(--apple-red);
          padding: 0 24px 10px; font-weight: 500;
        }
        .mode-note {
          font-size: 12px; color: var(--apple-label-3);
          padding: 4px 24px 28px; line-height: 1.55;
        }
        /* 卡片级置中开关下方的说明（v1.31 需求 1） */
        .tool-note {
          font-size: 11px; font-weight: 500; color: var(--apple-label-3);
          margin-top: 6px; line-height: 1.4;
        }

        /* 预览框（大小等比例缩小一倍） */
        .pv-size-box {
          margin: 0 auto;
          border-radius: 10px;
          padding: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.10);
          box-sizing: content-box;
          flex-shrink: 0;
        }
        .mode-preview-wrap { display: flex; justify-content: center; padding: 6px 16px 10px; }
        .pv-size-box.text-light { text-shadow: 0 1px 2px rgba(0,0,0,0.38); }
        /* 单独模式根字号：拼接模式下块级根字号由 JS 按单元格像素内联覆盖 */
        .pv-size-box .card-mode-wrap { width: 100%; height: 100%; font-size: 12px; }

        /* 显示样式区：首栏标题 + 最右「确定」 */
        .style-sec { margin: 0 12px 6px; }
        .style-sec-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 2px 2px 10px;
        }
        .style-sec-title {
          font-size: 13px;
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
        .style-strip-wrap { margin: 0 0 2px; }
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
          border: 1.5px solid rgba(120,120,128,0.25);
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

        /* 样式预览框（‹ › 切换 + 序号/总数） */
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
        .style-frame svg { max-width: 56px; max-height: 56px; }

        .card-mode-wrap { flex: 1; min-height: 0; width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; font-size: 16px; }

        /* 显示模式通用样式（与卡片渲染共享渲染逻辑，类名保持一致）。
           字号一律用 em：以 16px 为基准，拼接块由 JS 按单元格像素内联设置根字号，实现等比缩放 */
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
        @media (prefers-reduced-motion: no-preference) { .pv-block { transition: left 0.16s ease, top 0.16s ease; } }
        /* 单独模式：整卡内容一行排列 */
        .pv-single .pv-center { flex-direction: row; flex-wrap: wrap; justify-content: center; gap: 0.5em; }
        /* v1.40：单独模式按卡片尺寸的版式规则（只作用于 .pv-single，不影响拼接模式；
           与 widget / mainPage / make-preview / measure.html 五处镜像，改规则必须同步） */
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
        /* v1.43：单独模式字号基准随卡片尺寸放大（16px 基准在大卡上显得过小） */
        .pv-single-1x1 { font-size: 16px; }
        .pv-single-1x2 { font-size: 17px; }
        .pv-single-2x1 { font-size: 17px; }
        .pv-single-2x2 { font-size: 22px; }
        .pv-single-2x4 { font-size: 26px; }
        .pv-single-4x4 { font-size: 34px; }
        .pv-single-1xfull { font-size: 18px; }
        .pv-size-box svg { max-width: 80%; max-height: 80%; }
      </style>
      <div class="page" style="${appleThemeVars(dark)}">
        ${this.modePageOpen ? this._renderModePage() : this._renderMainPage()}
      </div>
    `;
  }

  static styles = css``;
}
