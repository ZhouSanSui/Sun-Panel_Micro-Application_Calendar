/**
 * Apple 风格 UI 组件库（Lit html 片段 + 共享样式）
 * 参考 iOS Setting / Calendar 设计规范
 */
import { html, css } from 'lit';

/** Apple 系统色板 */
export const APPLE_COLORS = {
  red: '#FF3B30',
  orange: '#FF9500',
  yellow: '#FFCC00',
  green: '#34C759',
  teal: '#00C7BE',
  blue: '#007AFF',
  purple: '#AF52DE',
  pink: '#FF2D55',
  gray: '#8E8E93',
};

/** 共享样式（可被各组件 static styles 组合使用） */
export const appleStyles = css`
  :host {
    --apple-red: #FF3B30;
    --apple-bg: #F2F2F7;
    --apple-card: #FFFFFF;
    --apple-card-alt: #EFEFF4;
    --apple-label: #000000;
    --apple-label-2: #3C3C43;
    --apple-label-3: #3C3C4399;
    --apple-separator: #3C3C432E;
    --apple-fill: #78788033;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC',
      'Helvetica Neue', 'Microsoft YaHei', sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  :host([dark]) {
    --apple-bg: #000000;
    --apple-card: #1C1C1E;
    --apple-card-alt: #2C2C2E;
    --apple-label: #FFFFFF;
    --apple-label-2: #EBEBF599;
    --apple-label-3: #EBEBF560;
    --apple-separator: #54545899;
    --apple-fill: #7878805C;
  }
`;

/** 主题 CSS 变量（由 JS 侧 darkMode 驱动，避免依赖宿主是否设置 dark 属性） */
export function appleThemeVars(dark) {
  return dark
    ? '--apple-bg:#000000;--apple-card:#1C1C1E;--apple-card-alt:#2C2C2E;--apple-label:#FFFFFF;--apple-label-2:#EBEBF599;--apple-label-3:#EBEBF560;--apple-separator:#54545899;--apple-fill:#7878805C;--apple-red:#FF453A;'
    : '--apple-bg:#F2F2F7;--apple-card:#FFFFFF;--apple-card-alt:#EFEFF4;--apple-label:#000000;--apple-label-2:#3C3C43;--apple-label-3:#3C3C4399;--apple-separator:#3C3C432E;--apple-fill:#78788033;--apple-red:#FF3B30;';
}

/** iOS 开关 */
export function appleSwitch(checked, onChange, color = APPLE_COLORS.green) {
  return html`
    <button
      class="apple-switch"
      role="switch"
      aria-checked="${checked ? 'true' : 'false'}"
      style="--sw-color:${color}"
      @click=${(e) => { e.stopPropagation(); onChange(!checked); }}
    >
      <span class="apple-switch-knob"></span>
    </button>
  `;
}

/** 分段控制器 */
export function appleSegmented(options, value, onChange, color = APPLE_COLORS.blue) {
  return html`
    <div class="apple-segmented" style="--seg-color:${color}">
      ${options.map((opt) => html`
        <button
          class="seg-item ${value === opt.value ? 'active' : ''}"
          @click=${() => onChange(opt.value)}
        >${opt.label}</button>
      `)}
    </div>
  `;
}

/** 设置分组（inset grouped list） */
export function appleGroup(header, rows, footer = '') {
  return html`
    <div class="apple-group">
      ${header ? html`<div class="apple-group-header">${header}</div>` : ''}
      <div class="apple-group-body">${rows}</div>
      ${footer ? html`<div class="apple-group-footer">${footer}</div>` : ''}
    </div>
  `;
}

/** 设置行：label + 右侧控件；clickable 显示 chevron（固定 div，Lit 动态标签会导致事件绑定失效） */
export function appleRow({ label, sub, right, onClick, chevron = false, danger = false, first = false, last = false }) {
  return html`
    <div
      class="apple-row ${onClick ? 'clickable' : ''} ${danger ? 'danger' : ''} ${first ? 'row-first' : ''} ${last ? 'row-last' : ''}"
      role="${onClick ? 'button' : 'none'}"
      @click=${onClick || undefined}
    >
      <div class="apple-row-main">
        <span class="apple-row-label">${label}</span>
        ${sub ? html`<span class="apple-row-sub">${sub}</span>` : ''}
      </div>
      <div class="apple-row-right">
        ${right || ''}
        ${chevron ? html`<svg class="apple-chevron" viewBox="0 0 8 13" width="8" height="13"><path d="M1 1l6 5.5L1 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}
      </div>
    </div>
  `;
}

/** Apple 风格弹层（底部 sheet） */
export function appleSheet(open, title, content, onClose, cancelLabel = '取消') {
  if (!open) return '';
  return html`
    <div class="apple-sheet-mask" @click=${(e) => { if (e.target.classList.contains('apple-sheet-mask')) onClose(); }}>
      <div class="apple-sheet">
        <div class="apple-sheet-grabber"></div>
        <div class="apple-sheet-header">
          <button class="sheet-btn cancel" @click=${onClose}>${cancelLabel}</button>
          <span class="sheet-title">${title}</span>
          <span class="sheet-btn-placeholder"></span>
        </div>
        <div class="apple-sheet-body">${content}</div>
      </div>
    </div>
  `;
}

/** 主按钮 */
export function appleButton(label, onClick, { color = APPLE_COLORS.red, filled = true, small = false, disabled = false } = {}) {
  return html`
    <button
      class="apple-btn ${filled ? 'filled' : 'plain'} ${small ? 'small' : ''}"
      style="--btn-color:${color}"
      ?disabled=${disabled}
      @click=${onClick}
    >${label}</button>
  `;
}

/** 下拉选择器（替代分段按钮的紧凑选项） */
export function appleSelect(options, value, onChange, color = APPLE_COLORS.blue) {
  return html`
    <div class="apple-select" style="--sel-color:${color}">
      <select class="apple-select-el" .value=${value} @change=${(e) => onChange(e.target.value)}>
        ${options.map((opt) => html`<option value="${opt.value}" ?selected=${opt.value === value}>${opt.label}</option>`)}
      </select>
      <svg class="apple-select-chevron" viewBox="0 0 8 13" width="8" height="13"><path d="M1 1l6 5.5L1 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
  `;
}

/** 组件样式（供 appleStyles 之外补充） */
export const appleUiStyles = css`
  .apple-switch {
    position: relative;
    width: 51px;
    height: 31px;
    border-radius: 16px;
    border: none;
    background: var(--apple-fill);
    cursor: pointer;
    transition: background 0.25s;
    flex-shrink: 0;
    padding: 0;
  }
  .apple-switch[aria-checked='true'] { background: var(--sw-color); }
  .apple-switch-knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 27px;
    height: 27px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.15), 0 1px 1px rgba(0, 0, 0, 0.16);
    transition: transform 0.25s;
  }
  .apple-switch[aria-checked='true'] .apple-switch-knob { transform: translateX(20px); }

  .apple-segmented {
    display: inline-flex;
    background: var(--apple-fill);
    border-radius: 9px;
    padding: 2px;
    gap: 2px;
  }
  .seg-item {
    border: none;
    background: transparent;
    border-radius: 7px;
    padding: 5px 14px;
    font-size: 13px;
    font-weight: 500;
    color: var(--apple-label);
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }
  .seg-item.active {
    background: var(--apple-card);
    box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12), 0 1px 1px rgba(0, 0, 0, 0.04);
  }

  .apple-group { margin: 0 0 22px; }
  .apple-group-header {
    font-size: 13px;
    color: var(--apple-label-3);
    text-transform: uppercase;
    margin: 0 16px 7px;
    letter-spacing: 0.04em;
  }
  .apple-group-body {
    background: var(--apple-card);
    border-radius: 10px;
    margin: 0 12px;
    overflow: hidden;
  }
  .apple-group-footer {
    font-size: 12px;
    color: var(--apple-label-3);
    margin: 7px 16px 0;
    line-height: 1.45;
  }
  .apple-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    padding: 11px 14px;
    border: none;
    background: transparent;
    font-size: 15px;
    color: var(--apple-label);
    text-align: left;
    font-family: inherit;
    min-height: 44px;
    box-sizing: border-box;
    position: relative;
  }
  .apple-row.clickable { cursor: pointer; }
  .apple-row.clickable:active { background: var(--apple-card-alt); }
  .apple-row + .apple-row::before {
    content: '';
    position: absolute;
    top: 0;
    left: 14px;
    right: 0;
    height: 1px;
    background: var(--apple-separator);
    transform: scaleY(0.5);
  }
  .apple-row-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .apple-row-label { font-size: 15px; }
  .apple-row-sub { font-size: 12px; color: var(--apple-label-3); line-height: 1.35; }
  .apple-row-right { display: flex; align-items: center; gap: 6px; flex-shrink: 0; color: var(--apple-label-3); }
  .apple-row.danger .apple-row-label { color: var(--apple-red); }
  .apple-chevron { color: var(--apple-label-3); opacity: 0.5; }

  .apple-btn {
    border: none;
    border-radius: 10px;
    padding: 10px 22px;
    font-size: 15px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.2s;
    background: var(--btn-color);
    color: #fff;
  }
  .apple-btn:active { transform: scale(0.97); opacity: 0.85; }
  .apple-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .apple-btn.plain {
    background: transparent;
    color: var(--btn-color);
  }
  .apple-btn.small { padding: 6px 14px; font-size: 13px; border-radius: 8px; }

  .apple-select {
    position: relative;
    display: inline-flex;
    align-items: center;
    min-width: 130px;
  }
  .apple-select-el {
    appearance: none;
    -webkit-appearance: none;
    border: 1px solid var(--apple-separator);
    background: var(--apple-card);
    color: var(--apple-label);
    border-radius: 9px;
    padding: 7px 30px 7px 12px;
    font-size: 14px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    width: 100%;
    box-sizing: border-box;
  }
  .apple-select-el:focus { outline: none; border-color: var(--sel-color); }
  .apple-select-chevron {
    position: absolute;
    right: 10px;
    color: var(--apple-label-3);
    opacity: 0.6;
    pointer-events: none;
  }

  .apple-sheet-mask {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 100;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    backdrop-filter: blur(2px);
  }
  .apple-sheet {
    background: var(--apple-bg);
    border-radius: 12px 12px 0 0;
    width: 100%;
    max-height: 88%;
    display: flex;
    flex-direction: column;
    animation: sheet-up 0.28s cubic-bezier(0.32, 0.72, 0, 1);
    overflow: hidden;
  }
  @keyframes sheet-up {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  .apple-sheet-grabber {
    width: 36px;
    height: 5px;
    border-radius: 3px;
    background: var(--apple-fill);
    margin: 8px auto 2px;
    flex-shrink: 0;
  }
  .apple-sheet-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px 12px;
    border-bottom: 1px solid var(--apple-separator);
    flex-shrink: 0;
  }
  .sheet-title { font-size: 16px; font-weight: 600; color: var(--apple-label); }
  .sheet-btn {
    border: none;
    background: transparent;
    font-size: 15px;
    color: var(--apple-red);
    cursor: pointer;
    font-family: inherit;
    padding: 4px 0;
  }
  .sheet-btn.cancel { color: var(--apple-label-3); }
  .sheet-btn.confirm { font-weight: 600; }
  .sheet-btn-placeholder { width: 32px; }
  .apple-sheet-body { overflow-y: auto; padding: 16px; flex: 1; }
`;

/** 主题色工具 */
export function withAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 苹果日历图标（纯 CSS/SVG 实现，动态显示当天） */
export function appleCalendarIcon({ weekday, day, color = APPLE_COLORS.red, size = 48 }) {
  return html`
    <div class="cal-icon" style="--icon-color:${color};width:${size}px;height:${size}px;">
      <div class="cal-icon-top">${weekday}</div>
      <div class="cal-icon-num" style="font-size:${Math.round(size * 0.52)}px;">${day}</div>
    </div>
  `;
}

/** 图标样式（widget 使用） */
export const calendarIconStyles = css`
  .cal-icon {
    border-radius: 22.5%;
    background: var(--apple-card, #fff);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    flex-shrink: 0;
  }
  .cal-icon-top {
    background: var(--icon-color);
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    text-align: center;
    padding: 1.5px 0;
    letter-spacing: 0.02em;
    line-height: 1.2;
  }
  .cal-icon-num {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 300;
    color: #000;
    line-height: 1;
  }
  :host([dark]) .cal-icon { background: #2C2C2E; }
  :host([dark]) .cal-icon-num { color: #fff; }
`;
