// 自动生成的共享样式单一真源 —— 请勿手改结构，改这里即可。
// 来源：src/components/widget.js 的 .pv-* 基础规则（与 mainPage / widgetConfig 逐字一致）。
// 目的：7 处 CSS 镜像收敇为 1 处，避免预览与线上样式漂移。
// 校验：node scripts/check-css-mirror.mjs
export const CARD_MODE_CSS = `
.pv-center { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.375em; width: 100%; text-align: center; }
.pv-center.pv-flat { flex-direction: row; align-items: center; justify-content: center; gap: 0.5em; }
.pv-fnum { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 0 1 auto; }
.pv-ftext { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.1875em; flex: 0 1 auto; min-width: 0; text-align: center; }
.pv-col { display: flex; flex-direction: column; gap: 0.3125em; width: 100%; }
.pv-gap { height: 0.5em; }
.pv-big { font-size: 1.875em; font-weight: 800; line-height: 1.1; font-variant-numeric: tabular-nums; }
.pv-mid { font-size: 1em; font-weight: 700; line-height: 1.25; }
.pv-seg { white-space: nowrap; }
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
.pv-mini-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.125em; margin-top: 0; }
.pv-vstack { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; gap: 0.1875em; }
.pv-vstack.t { gap: 0.125em; }
.pv-vline { font-size: 1.25em; font-weight: 700; line-height: 1.15; white-space: nowrap; font-variant-numeric: tabular-nums; }
.pv-vline.wk { font-size: 0.7em; }
.pv-vbig { font-size: 1.875em; font-weight: 800; line-height: 1.1; white-space: nowrap; font-variant-numeric: tabular-nums; }
.pv-vrow { display: flex; align-items: baseline; justify-content: center; gap: 0.25em; width: 100%; }
.pv-cal-head { text-align: center; color: inherit; line-height: 1.2; }
.pv-cal-wd { font-size: 0.5625em; font-weight: 600; margin-left: 0.3125em; }
.pv-wkv { display: grid; grid-template-rows: repeat(7, 1fr); grid-template-columns: 1fr; gap: 0.0625em; width: 100%; }
.pv-wkv-cell { display: flex; align-items: center; justify-content: space-between; padding: 0.125em 0.375em; border-radius: 0.375em; }
.pv-wkv-d { font-size: 0.75em; font-weight: 600; line-height: 1.2; font-variant-numeric: tabular-nums; }
.pv-wkv-w { font-size: 0.5625em; line-height: 1.3; text-align: right; }
.pv-wd-sm { font-size: 0.9375em; font-weight: 700; line-height: 1.1; }
.pv-sub-sm { font-size: 0.5em; }
.pv-block > .pv-col { align-self: stretch; flex: 1 1 auto; min-height: 0; }
.pv-block > .pv-col > .pv-mini-grid { flex: 1 1 auto; min-height: 0; grid-auto-rows: 1fr; }
.pv-mini-grid > .pv-c { aspect-ratio: auto; min-height: 0; line-height: 1; }
.pv-c { aspect-ratio: 1; border-radius: 0.25em; display: flex; align-items: center; justify-content: center; font-size: 0.5625em; font-weight: 500; }
.pv-c.out { opacity: 0.35; }
.pv-yearcal { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.3125em; }
.pv-yearcal-m { display: flex; flex-direction: column; gap: 0.125em; }
.pv-yearcal-t { font-size: 0.5em; font-weight: 700; text-align: center; }
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
/* v2.7：单独模式整卡根容器 = 与 .pv-block 同构（绝对定位块由内联样式给出尺寸，这里只补盒模型与居中） */
.pv-single { box-sizing: border-box; padding: 0.1875em; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%; overflow: hidden; }
.pv-single > .pv-col { align-self: stretch; flex: 1 1 auto; min-height: 0; }
.pv-single .pv-center { flex-direction: row; flex-wrap: wrap; justify-content: center; gap: 0.5em; }
.pv-single-1x1 .pv-vbig { font-size: 1.25em; }
.pv-single-1x1 .pv-sub { display: none; }
.pv-single-1x2 .pv-center { gap: 0.75em; }
.pv-single-1x2 .pv-vbig { font-size: 1.15em; }
.pv-single-2x1 .pv-center { flex-direction: column; gap: 0.375em; }
.pv-single-2x1 .pv-vbig { font-size: 1.1em; }
.pv-single-2x2 .pv-center { gap: 0.5em; }
.pv-single-2x4 .pv-center { gap: 0.875em; }
.pv-single-2x4 .pv-vbig { font-size: 1.2em; }
.pv-single-4x4 .pv-vbig { font-size: 1.25em; }
.pv-single-4x4 .pv-sub { font-size: 0.6875em; }
.pv-single-1xfull .pv-center { align-items: center; gap: 1em; }
.pv-single-1xfull .pv-vbig { font-size: 1.3em; }
.pv-single-1x1 { font-size: 16px; }
.pv-single-1x2 { font-size: 17px; }
.pv-single-2x1 { font-size: 17px; }
.pv-single-2x2 { font-size: 22px; }
.pv-single-2x4 { font-size: 26px; }
.pv-single-4x4 { font-size: 34px; }
.pv-single-1xfull { font-size: 18px; }
/* v2.6 硬约束：块内内容只在本块内裁切，绝不外溢压到相邻单元（与 .card-mode-wrap 的整卡裁切双层兜底） */
.pv-block { overflow: hidden; }
/* v2.5 单独模式整卡三段式：顶栏 + 主内容 + 底部进度条；格阵为绝对定位纹理 */
/* 窄块「今天」半号主字：避免 2 字折行把总高顶出一行 */
.pv-big-sm { font-size: 0.9375em; }
/* ===== v2.7 单独模式新增「显示样式」（用户可在配置页 chip 中点选） ===== */
/* 年进度格阵：365/366 格，min 格宽 0.42em 决定列数，格间距 0.16em；今日格用主题色实心 */
.pv-yg { width: 100%; height: 100%; gap: 0.3em; align-items: stretch; }
.pv-yg-head { flex: 0 0 auto; display: flex; align-items: baseline; justify-content: space-between; font-size: 0.5em; line-height: 1.25; }
.pv-yg-head b { font-weight: 800; }
/* 31 列固定 = 每个月一列宽度的视觉隐喻；365/366 自然折成 12 行，行高由 aspect-ratio 定 */
.pv-yg-grid { flex: 1 1 auto; min-height: 0; width: 100%; display: grid; grid-template-columns: repeat(31, minmax(0, 1fr)); gap: 0.1em; align-content: center; overflow: hidden; }
.pv-yg-grid i { aspect-ratio: 1 / 1; border-radius: 0.12em; background: currentColor; opacity: 0.13; }
.pv-yg-grid i.on { opacity: 0.34; }
.pv-yg-grid i.now { opacity: 1; }
/* 年月条阵：12 根竖条（过去满高、当月按日进度、未来留空），底部年度百分比 */
.pv-yb { width: 100%; height: 100%; gap: 0.28em; align-items: stretch; }
.pv-yb-bars { flex: 1 1 auto; min-height: 0; width: 100%; display: flex; align-items: flex-end; gap: 0.3em; }
.pv-yb-bars b { display: flex; flex: 1 1 0; align-items: flex-end; height: 100%; border-radius: 0.16em; background: currentColor; opacity: 0.09; }
.pv-yb-bars b i { display: block; width: 100%; border-radius: inherit; background: currentColor; opacity: 0.34; }
.pv-yb-bars b.cur { opacity: 0.12; }
.pv-yb-bars b.cur i { opacity: 0.85; }
.pv-yb-foot { flex: 0 0 auto; display: flex; align-items: baseline; justify-content: space-between; font-size: 0.5em; line-height: 1.25; }
.pv-yb-foot b { font-weight: 800; font-size: 1.5em; }
/* 周进度格：7 格（星期 + 日期），已过格加深、今天格用主题色实心 */
.pv-wg2 { width: 100%; height: 100%; gap: 0.3em; align-items: stretch; }
.pv-wg2-row { flex: 1 1 auto; min-height: 0; width: 100%; display: flex; gap: 0.2em; }
.pv-wg2-cell { flex: 1 1 0; min-width: 0; padding: 0.12em 0.05em; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.12em; border-radius: 0.22em; background: color-mix(in srgb, currentColor 9%, transparent); }
.pv-wg2-cell span { font-size: 0.44em; line-height: 1.2; }
.pv-wg2-cell b { font-size: 0.9375em; line-height: 1.1; font-weight: 800; }
.pv-wg2-cell.on { background: color-mix(in srgb, currentColor 16%, transparent); }
.pv-wg2-cell.now { background: transparent; }
.pv-wg2-foot { flex: 0 0 auto; font-size: 0.5em; line-height: 1.25; text-align: right; }
.pv-wg2-foot b { font-weight: 800; }
/* 双区时间：上时间大字 → 细分隔线 → 下日期 + 星期 */
.pv-dz { width: 100%; height: 100%; gap: 0.22em; align-items: stretch; justify-content: center; }
.pv-dz-time { flex: 0 0 auto; font-size: 2em; font-weight: 800; line-height: 1.05; letter-spacing: 0.01em; font-variant-numeric: tabular-nums; }
.pv-dz-rule { flex: 0 0 auto; height: 0.07em; border-radius: 0.035em; background: currentColor; opacity: 0.3; margin: 0.04em 0.02em; }
.pv-dz-date { flex: 0 0 auto; display: flex; align-items: baseline; justify-content: space-between; gap: 0.4em; font-size: 0.5em; line-height: 1.3; }
.pv-dz-date b { font-weight: 800; }

/* ===== v2.9 图像化样式（单独模式，"样式设置"可改主色 / 文案 / 目标日） ===== */
/* ringClock：环形刻度钟（60 刻度 + 当日比例弧 + 中心时间） */
.pv-rc { width: 100%; height: 100%; align-items: center; justify-content: center; }
.pv-rc-ring { position: relative; width: 100%; height: 100%; flex: 1 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center; }
.pv-rc-ring svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.pv-rc-time { font-size: 0.78em; font-weight: 700; letter-spacing: 0.02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
/* dotClock：数码管 */
.pv-dc { width: 100%; height: 100%; align-items: center; justify-content: center; gap: 0.2em; }
.pv-dc-dots { display: flex; gap: 0.16em; justify-content: center; width: auto; max-width: 100%; }
.pv-dc-dots i { width: 0.16em; aspect-ratio: 1 / 1; border-radius: 50%; background: currentColor; }
.pv-dc-time { font-size: 1.1em; font-weight: 800; letter-spacing: 0.08em; font-variant-numeric: tabular-nums; text-shadow: 0 0 0.16em currentColor, 0 0 0.02em currentColor; }
.pv-dc-date { font-size: 0.5em; letter-spacing: 0.04em; }
.pv-single-2x4 .pv-dc-time { font-size: 1.6em; }
.pv-single-4x4 .pv-dc-time { font-size: 1.8em; }
/* boldClock：粗体大字 + 主色色块 */
.pv-bc { width: 100%; height: 100%; flex-direction: row; align-items: center; justify-content: center; gap: 0.4em; }
.pv-bc-nums { display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 0.22em; padding: 0.18em 0.28em; line-height: 0.95; }
.pv-bc-nums b { color: #111; font-size: 1.5em; font-weight: 900; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.pv-single-1x1 .pv-bc-nums b { font-size: 1.1em; }
.pv-bc-side { display: flex; flex-direction: column; align-items: flex-start; gap: 0.16em; font-size: 0.5em; }
/* capsule：胶囊倒计时 */
.pv-cp { width: 100%; height: 100%; align-items: center; justify-content: center; gap: 0.4em; }
.pv-cp-pill { border: 1px solid currentColor; border-radius: 999px; padding: 0.12em 0.7em; font-size: 0.56em; letter-spacing: 0.04em; white-space: nowrap; }
.pv-cp-row { display: flex; align-items: baseline; justify-content: center; gap: 0.36em; }
.pv-cp-cell { display: flex; align-items: baseline; gap: 0.1em; }
.pv-cp-cell b { font-size: 1.1em; font-weight: 800; font-variant-numeric: tabular-nums; }
.pv-cp-cell i { font-size: 0.46em; font-style: normal; }
/* targetDay：目标倒计时卡 */
.pv-tg { width: 100%; height: 100%; align-items: center; justify-content: center; gap: 0.22em; }
.pv-tg-title { font-size: 0.6em; font-weight: 700; letter-spacing: 0.02em; }
.pv-tg-pre, .pv-tg-unit { font-size: 0.5em; }
.pv-tg-days { font-size: 2.1em; font-weight: 900; line-height: 1; font-variant-numeric: tabular-nums; }
.pv-tg-date { font-size: 0.46em; letter-spacing: 0.03em; }
/* multiBars：多条进度 */
.pv-mb { width: 100%; height: 100%; justify-content: center; gap: 0.3em; }
.pv-mb-row { display: flex; align-items: center; gap: 0.4em; }
.pv-mb-k { flex: 0 0 auto; width: 1.6em; font-size: 0.5em; }
.pv-mb-bar { flex: 1 1 auto; height: 0.5em; border-radius: 999px; background: currentColor; opacity: 0.14; overflow: hidden; }
.pv-mb-bar i { display: block; height: 100%; border-radius: inherit; }
.pv-mb-v { flex: 0 0 auto; width: 3.1em; text-align: right; font-size: 0.46em; font-variant-numeric: tabular-nums; }

/* ===== v2.10 新增样式：极简条钟 / 文字时钟 / 巨型天数 / 四环进度 / 年热力图 ===== */
.pv-st { justify-content: center; gap: 0.18em; width: 100%; }
.pv-st-time { font-size: 2.1em; font-weight: 200; letter-spacing: 0.02em; line-height: 1; font-variant-numeric: tabular-nums; }
.pv-st-rule { width: 1.6em; height: 0.12em; border-radius: 999px; opacity: 0.9; }
.pv-st-date { font-size: 0.5em; letter-spacing: 0.08em; opacity: 0.7; white-space: nowrap; }
.pv-single-1xfull .pv-st { flex-direction: row; align-items: center; gap: 0.5em; }
.pv-single-1xfull .pv-st-rule { width: 0.12em; height: 1.4em; }
.pv-single-2x4 .pv-st-time { font-size: 2.6em; }
.pv-single-4x4 .pv-st-time { font-size: 3.2em; }

.pv-wc { justify-content: center; gap: 0.22em; width: 100%; }
.pv-wc-main { font-size: 1.35em; font-weight: 300; letter-spacing: 0.06em; line-height: 1.15; text-align: center; }
.pv-wc-sub { font-size: 0.48em; letter-spacing: 0.14em; opacity: 0.62; white-space: nowrap; }
.pv-single-2x4 .pv-wc-main { font-size: 2.1em; }
.pv-single-4x4 .pv-wc-main { font-size: 2.4em; }
.pv-single-1xfull .pv-wc { flex-direction: row; align-items: baseline; gap: 0.6em; }
.pv-single-1xfull .pv-wc-main { font-size: 1.5em; }

.pv-bd { justify-content: center; gap: 0.1em; width: 100%; }
.pv-bd-title { font-size: 0.5em; letter-spacing: 0.1em; opacity: 0.72; white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.pv-bd-num { font-size: 2.2em; font-weight: 800; line-height: 0.95; font-variant-numeric: tabular-nums; }
.pv-bd-num small { font-size: 0.34em; font-weight: 600; margin-left: 0.1em; }
.pv-bd-tail { font-size: 0.42em; letter-spacing: 0.06em; opacity: 0.6; white-space: nowrap; }
.pv-single-1x1 .pv-bd-num { font-size: 1.9em; }
.pv-single-1x1 .pv-bd-tail { display: none; }
.pv-single-2x4 .pv-bd-num, .pv-single-4x4 .pv-bd-num { font-size: 2.8em; }

.pv-rp { justify-content: center; gap: 0.3em; width: 100%; }
.pv-rp-ring { position: relative; flex: 1 1 auto; min-height: 0; width: 100%; display: flex; align-items: center; justify-content: center; }
.pv-rp-ring svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.pv-rp-pct { font-size: 0.95em; font-weight: 700; font-variant-numeric: tabular-nums; }
.pv-rp-legend { display: flex; flex-wrap: wrap; gap: 0.34em 0.6em; justify-content: center; font-size: 0.4em; opacity: 0.8; }
.pv-rp-legend span { display: inline-flex; align-items: center; gap: 0.24em; white-space: nowrap; }
.pv-rp-legend i { width: 0.5em; height: 0.5em; border-radius: 999px; display: block; }
.pv-single-1xfull .pv-rp { flex-direction: row; align-items: center; gap: 0.6em; }
.pv-single-1xfull .pv-rp-ring { flex: 0 0 4em; width: 4em; }

.pv-hy-wrap { width: 100%; height: 100%; padding: 0.34em; box-sizing: border-box; }
.pv-hy { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 0.14em; width: 100%; height: 100%; opacity: 0.92; }
.pv-hy b { display: grid; grid-auto-rows: minmax(0, 1fr); gap: 0.08em; min-height: 0; }
.pv-hy i { display: block; width: 100%; height: 100%; border-radius: 0.06em; background: currentColor; opacity: 0.04; }
.pv-hy i.on { opacity: 0.13; }
.pv-hy i.now { opacity: 0.95; }
/* v2.11 仪图/文字/进度新增：时光倒计时列表、指针与半环仪表、格阵粒度与形状 */
.pv-ls { display: flex; flex-direction: column; gap: 0.34em; width: 100%; justify-content: center; }
.pv-ls-row { display: grid; grid-template-columns: 1fr auto auto; align-items: baseline; gap: 0.4em; font-size: 0.62em; line-height: 1.2; }
.pv-ls-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pv-ls-days { font-size: 1.5em; font-weight: 700; line-height: 1; }
.pv-ls-days small { font-size: 0.42em; font-weight: 500; margin-left: 0.12em; }
.pv-ls-date { font-size: 0.72em; opacity: 0.55; font-variant-numeric: tabular-nums; }
.pv-gl { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.3em; }
.pv-gl-dial { position: relative; display: flex; align-items: center; justify-content: center; flex: 1 1 auto; min-height: 0; width: 100%; }
.pv-gl-dial svg { height: 100%; width: auto; max-width: 100%; overflow: visible; }
.pv-gl-val { position: absolute; left: 50%; bottom: 3%; transform: translateX(-50%); font-size: 0.72em; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.pv-gl-cap { font-size: 0.46em; opacity: 0.6; }
.pv-sg { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.25em; }
.pv-sg-wrap { position: relative; display: flex; align-items: flex-end; justify-content: center; flex: 1 1 auto; min-height: 0; width: 100%; }
.pv-sg-wrap svg { height: 100%; width: auto; max-width: 100%; }
.pv-sg-val { position: absolute; left: 50%; bottom: 2%; transform: translateX(-50%); font-size: 0.92em; font-weight: 700; font-variant-numeric: tabular-nums; }
.pv-sg-cap { font-size: 0.46em; opacity: 0.6; }
.pv-yg-w7 { grid-template-columns: repeat(7, minmax(0, 1fr)); }
.pv-yg-h24 { grid-template-columns: repeat(12, minmax(0, 1fr)); }
.pv-yg-grid.dot i { border-radius: 50%; }

`;
