// 自动生成的共享样式单一真源 —— 请勿手改结构，改这里即可。
// 来源：src/components/widget.js 的 .pv-* 基础规则（与 mainPage / widgetConfig 逐字一致）。
// 目的：7 处 CSS 镜像收敇为 1 处，避免预览与线上样式漂移。
// 校验：node scripts/check-css-mirror.mjs
export const CARD_MODE_CSS = `
.pv-center { display: flex; flex-direction: column; align-items: safe center; justify-content: safe center; gap: 0.375em; width: 100%; text-align: center; }
.pv-center.pv-flat { flex-direction: row; align-items: safe center; justify-content: safe center; gap: 0.5em; }
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
.pv-vstack { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; gap: 0.1875em; container-type: inline-size; }
.pv-vstack.t { gap: 0.125em; }
.pv-vline { font-size: 1.25em; font-weight: 700; line-height: 1.15; white-space: nowrap; font-variant-numeric: tabular-nums; }
.pv-vline.wk { font-size: 0.7em; }
/* v3.8：窄高卡竖排行的「宽度自适应」—— 行内文字比容器宽时按容器宽度缩字号，
   而不是让它折行（折行会把「26年10月 / 21日」变成 3 排，与预览不一致）。
   --w = 该行文字的固有宽度（em，按自身字号），100cqw = 竖排容器的内容宽。 */
.pv-vline.fit { font-size: min(1.25em, calc(100cqw / var(--w, 4))); }
.pv-vline.wk.fit { font-size: min(0.7em, calc(100cqw / var(--w, 4))); }
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
        align-items: safe center;
        justify-content: safe center;
        overflow: hidden;
      }
@media (prefers-reduced-motion: no-preference) { .pv-block { transition: left 0.16s ease, top 0.16s ease; } }
/* v2.7：单独模式整卡根容器 = 与 .pv-block 同构（绝对定位块由内联样式给出尺寸，这里只补盒模型与居中） */
.pv-single { box-sizing: border-box; padding: 0.1875em; display: flex; flex-direction: column; align-items: safe center; justify-content: safe center; width: 100%; height: 100%; overflow: hidden; }
/* v3.10：col 被 stretch 撑满整高后，内部默认 flex-start 会让内容贴顶 —— 2×1 这类高瘦卡
   上就表现为「内容全挤在上三分之一、下面大片空白」。这里统一垂直居中；靠 flex:1 撑满的
   子块（年格阵/周格/月历）本来就吃满剩余高度，居中不改变它们的排版。 */
.pv-single > .pv-col { align-self: stretch; flex: 1 1 auto; min-height: 0; justify-content: center; }
.pv-single .pv-center { flex-direction: row; flex-wrap: wrap; justify-content: center; gap: 0.5em; }
.pv-single-1x1 .pv-big, .pv-single-1x1 .pv-mid, .pv-single-1x1 .pv-vbig { font-size: 1.25em; }
.pv-single-1x1 .pv-sub { display: none; }
.pv-single-1x2 .pv-center { gap: 0.75em; }
.pv-single-1x2 .pv-big, .pv-single-1x2 .pv-mid, .pv-single-1x2 .pv-vbig { font-size: 1.15em; }
.pv-single-2x1 .pv-center { flex-direction: column; gap: 0.375em; }
.pv-single-2x1 .pv-big, .pv-single-2x1 .pv-mid, .pv-single-2x1 .pv-vbig { font-size: 1.1em; }
.pv-single-2x2 .pv-center { gap: 0.5em; }
.pv-single-2x4 .pv-center { gap: 0.875em; }
.pv-single-2x4 .pv-big, .pv-single-2x4 .pv-mid, .pv-single-2x4 .pv-vbig { font-size: 1.2em; }
.pv-single-4x4 .pv-big, .pv-single-4x4 .pv-mid, .pv-single-4x4 .pv-vbig { font-size: 1.25em; }
.pv-single-4x4 .pv-sub { font-size: 0.6875em; }
.pv-single-1xfull .pv-center { align-items: center; gap: 1em; }
.pv-single-1xfull .pv-big, .pv-single-1xfull .pv-mid, .pv-single-1xfull .pv-vbig { font-size: 1.3em; }
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
/* v3.8：格阵的列数/行数/格边长改由渲染层按块内可用几何（em）择优后内联
   （--cols/--rows + grid-template-columns/rows 的 em 轨道）。
   旧写法把分母写死成 31 列 / 12 行、再用容器查询算格边 → 1×FULL（宽扁）按「高/12」
   封顶成几个像素的细线，大卡上的月/周/日格阵又被固定列数摊在一角（看着稀疏）。
   现在轨道本身就是正方形 em 尺寸，格子铺满轨道即可；整组由 justify/align-content 居中。 */
.pv-yg-grid { flex: 1 1 auto; min-height: 0; width: 100%; display: grid; gap: 0.1em; justify-content: center; align-content: center; overflow: hidden;
  --cols: 31; --rows: 12;
  grid-template-columns: repeat(31, minmax(0, 1fr)); grid-template-rows: repeat(12, minmax(0, 1fr)); }
.pv-yg-grid i { border-radius: 0.12em; background: currentColor; opacity: 0.13;
  width: 100%; height: 100%; }
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
.pv-wg2-row { flex: 1 1 auto; min-height: 0; width: 100%; display: flex; gap: 0.1em; }
.pv-wg2-cell { flex: 1 1 0; min-width: 0; padding: 0.1em 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.1em; border-radius: 0.22em; background: color-mix(in srgb, currentColor 9%, transparent); overflow: hidden; }
.pv-wg2-cell span { font-size: 0.5em; line-height: 1.2; }
/* v3.10：数字原来 0.9375em —— 7 列均分后每列只有约 1.1 个字宽，「20/21/22」直接叠在一起
   （用户报 2×1 变形）。压到 0.72em + 等宽数字，两位数字宽 ≈1.0em < 列宽。 */
.pv-wg2-cell b { font-size: 0.72em; line-height: 1.1; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; }
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
/* v3.10 1×FULL：dualZone 原样是「上时间 / 横分割线 / 下日期+星期」的方形卡版式，横条卡上
   分割线被拉成 1386px 横贯全宽、星期被甩到最右边（用户报「变形」）→ 改为竖线分隔的横排。 */
.pv-single-1xfull .pv-dz { flex-direction: row; align-items: center; justify-content: center; gap: 0.55em; }
.pv-single-1xfull .pv-dz-rule { flex: 0 0 auto; width: 0.07em; height: 2.1em; margin: 0; }
.pv-single-1xfull .pv-dz-date { flex: 0 0 auto; flex-direction: column; align-items: flex-start; justify-content: center; gap: 0.12em; }

/* ===== v2.9 图像化样式（单独模式，"样式设置"可改主色 / 文案 / 目标日） ===== */
/* ringClock：环形刻度钟（60 刻度 + 当日比例弧 + 时针/分针 + 时间窗） */
.pv-rc { width: 100%; height: 100%; align-items: center; justify-content: center; gap: 0.2em; }
/* v3.10：环形指示器容器的尺寸纪律 ——
   ① 不能用 aspect-ratio + width:100%：宽扁卡（1×FULL）上「高=宽」会顶出卡片，竖高卡上又会把
      下方图例/说明挤出内容盒（实测 1×1 图例被挤到卡片外 9px）。
   ② 不能用 flex:1 + min-height:0 的百分比高度链：宿主未给确定高度时整条链塌成 0，SVG 0×0
      什么都不显示（用户报「指针/四环不显示」即此因）。
   取法：容器弹性占满「剩余空间」，SVG 绝对铺满容器，靠 viewBox + 默认 preserveAspectRatio
   （xMidYMid meet）自动居中保持正方 —— 既不抢高，也不会塌成 0。 */
.pv-rc-ring { position: relative; width: 100%; flex: 1 1 auto; min-height: 0; min-width: 0; display: flex; align-items: center; justify-content: center; }
.pv-rc-ring svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
/* 时间数字放在环外下方：环内任何位置都会被 44 半径的进度弧穿过，只有环外是干净区 */
.pv-rc-time { flex: 0 0 auto; font-size: 0.72em; font-weight: 700; letter-spacing: 0.02em; font-variant-numeric: tabular-nums; white-space: nowrap; line-height: 1; }
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
.pv-cp { width: 100%; height: 100%; align-items: center; justify-content: center; gap: 0.4em; overflow: hidden; }
.pv-single-1x1 .pv-cp-row, .pv-single-2x1 .pv-cp-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.15em 0.5em; }
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
.pv-mb { width: 100%; height: 100%; justify-content: center; gap: 0.3em; overflow: hidden; }
/* v3.10 1×FULL：原来 4 条挤成一行，标签(1.7em)+百分比(3.1em) 两个定宽块吃掉大半，
   真实卡（1386×347 / 51.7px 基准）上进度条只剩 ≈50px，等于没有条 → 改 2×2 并让两侧
   定宽块各自按内容收窄。 */
.pv-single-1xfull .pv-mb { flex-direction: row; flex-wrap: wrap; align-content: center; align-items: center; gap: 0.45em 1.4em; }
.pv-single-1xfull .pv-mb-row { flex: 1 1 calc(50% - 0.7em); min-width: 0; }
.pv-single-1xfull .pv-mb-k { width: auto; min-width: 1.1em; }
.pv-single-1xfull .pv-mb-v { width: auto; }
.pv-mb-row { display: flex; align-items: center; gap: 0.4em; }
.pv-mb-k { flex: 0 0 auto; width: 1.7em; font-size: 0.56em; }
.pv-mb-bar { flex: 1 1 auto; height: 0.5em; border-radius: 999px; background: currentColor; opacity: 0.14; overflow: hidden; }
.pv-mb-bar i { display: block; height: 100%; border-radius: inherit; }
.pv-mb-v { flex: 0 0 auto; width: 3.1em; text-align: right; font-size: 0.62em; font-variant-numeric: tabular-nums; }

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

/* v3.11：补 align-items/text-align —— 单独模式里 .pv-single > .pv-col 被 stretch 撑满整宽，
   缺这两条时标题与尾行会贴左边（用户截图 1×1 巨型天数「倒计时」在左上角）。 */
.pv-bd { justify-content: center; align-items: center; text-align: center; gap: 0.1em; width: 100%; }
.pv-bd-title { font-size: 0.5em; letter-spacing: 0.1em; opacity: 0.72; white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.pv-bd-num { font-size: 2.2em; font-weight: 800; line-height: 0.95; font-variant-numeric: tabular-nums; }
.pv-bd-num small { font-size: 0.34em; font-weight: 600; margin-left: 0.1em; }
.pv-bd-tail { font-size: 0.42em; letter-spacing: 0.06em; opacity: 0.6; white-space: nowrap; }
.pv-single-1x1 .pv-bd-num { font-size: 1.9em; }
.pv-single-1x1 .pv-bd-tail { display: none; }
.pv-single-2x4 .pv-bd-num, .pv-single-4x4 .pv-bd-num { font-size: 2.8em; }

.pv-rp { justify-content: center; gap: 0.3em; width: 100%; height: 100%; min-height: 0; }
/* 同 .pv-rc-ring 的尺寸纪律：弹性占满剩余高度，SVG 靠 preserveAspectRatio 居正方 */
.pv-rp-ring { position: relative; width: 100%; flex: 1 1 auto; min-height: 0; min-width: 0; display: flex; align-items: center; justify-content: center; }
.pv-rp-ring svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.pv-rp-pct { font-size: 0.95em; font-weight: 700; font-variant-numeric: tabular-nums; }
.pv-rp-legend { display: flex; flex-wrap: wrap; gap: 0.34em 0.6em; justify-content: center; font-size: 0.4em; opacity: 0.8; }
.pv-rp-legend span { display: inline-flex; align-items: center; gap: 0.24em; white-space: nowrap; }
.pv-rp-legend i { width: 0.5em; height: 0.5em; border-radius: 999px; display: block; }
.pv-single-1xfull .pv-rp { flex-direction: row; align-items: center; gap: 0.6em; }
/* 1×FULL 横排：环固定 5.2em 见方（此处必须显式给高，容器已不再用 aspect-ratio）。
   v3.11：4em 在真实卡（1387×347 / 基准 51.7px）上环直径仅 207px，整卡看着空 —— 抬到 5.2em。 */
.pv-single-1xfull .pv-rp-ring { flex: 0 0 5.2em; width: 5.2em; height: 5.2em; }
.pv-single-1xfull .pv-rp { gap: 0.9em; }
.pv-single-1xfull .pv-rp-legend { font-size: 0.46em; gap: 0.4em 0.9em; }
/* v3.11 1×FULL ringClock：原来是「环在上、时间在下」的方卡版式，横条卡上环被限高到 ≈2em、
   两侧全是空的。改成横排：环固定 5.2em 见方（不能留 width:100% —— 横排里 100% 宽会把
   时间挤出卡片右侧），时间放大贴右侧。 */
.pv-single-1xfull .pv-rc { flex-direction: row; align-items: center; gap: 0.7em; }
.pv-single-1xfull .pv-rc-ring { flex: 0 0 5.2em; width: 5.2em; height: 5.2em; }
.pv-single-1xfull .pv-rc-time { font-size: 1.6em; }
/* v3.11 1×FULL yearBars：12 根竖条原本长到 347px 卡高，像 12 根柱子；改成
   「左侧条带 + 右侧年度读数」的横排，把 1387px 的横向空间用起来。 */
.pv-single-1xfull .pv-yb { flex-direction: row; align-items: center; gap: 0.7em; }
.pv-single-1xfull .pv-yb-bars { flex: 1 1 auto; min-width: 0; height: 3.4em; }
.pv-single-1xfull .pv-yb-foot { flex: 0 0 auto; flex-direction: column; align-items: flex-end; gap: 0.06em; }
/* v3.11 1×FULL dial：表盘本身已经吃满卡高（实测 ≈73%），不再改排布；只把读数放大一档，
   免得 1387px 宽的横条里「80%」小得像注脚。 */
.pv-single-1xfull .pv-gl-val { font-size: 1.05em; bottom: 0; }
.pv-single-1xfull .pv-gl-cap { font-size: 0.56em; }

.pv-hy-wrap { width: 100%; height: 100%; padding: 0.34em; box-sizing: border-box; }
.pv-hy { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 0.14em; width: 100%; height: 100%; opacity: 0.92; }
.pv-hy b { display: grid; grid-auto-rows: minmax(0, 1fr); gap: 0.08em; min-height: 0; }
/* v3.8：热力图格子铺满当月的列宽（原来是「按行高取方块 + 列内居中」，
   列比格子宽时整列右侧留一大片空白 —— 大卡上看起来非常稀疏）。
   现在宽度 = 100% 列宽、高度 = 1fr 行高，12 个月份列整块铺满卡片。 */
.pv-hy i { display: block; border-radius: 0.06em; background: currentColor; opacity: 0.04;
  width: 100%; height: 100%;
  align-self: stretch; justify-self: stretch; }
.pv-hy i.on { opacity: 0.13; }
.pv-hy i.now { opacity: 0.95; }
/* v2.11 仪图/文字/进度新增：时光倒计时列表、指针与半环仪表、格阵粒度与形状 */
.pv-ls { display: flex; flex-direction: column; gap: 0.34em; width: 100%; justify-content: center; }
.pv-ls-row { display: grid; grid-template-columns: 1fr auto auto; align-items: baseline; gap: 0.4em; font-size: 0.62em; line-height: 1.2; }
.pv-ls-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pv-ls-days { font-size: 1.5em; font-weight: 700; line-height: 1; }
.pv-ls-days small { font-size: 0.42em; font-weight: 500; margin-left: 0.12em; }
.pv-ls-date { font-size: 0.72em; opacity: 0.55; font-variant-numeric: tabular-nums; }
.pv-gl { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.3em; overflow: hidden; }
/* 同 .pv-rc-ring 的尺寸纪律：弹性占满剩余高度，SVG 靠 preserveAspectRatio 居正方 */
.pv-gl-dial { position: relative; display: flex; align-items: center; justify-content: center; width: 100%; flex: 1 1 auto; min-height: 0; min-width: 0; }
.pv-gl-dial svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; overflow: hidden; }
.pv-gl-val { position: absolute; left: 50%; bottom: 0.1em; transform: translateX(-50%); font-size: 0.72em; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.pv-gl-cap { font-size: 0.46em; opacity: 0.6; }
.pv-sg { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.25em; }
.pv-sg-wrap { position: relative; display: flex; align-items: flex-end; justify-content: center; flex: 1 1 auto; min-height: 0; width: 100%; }
.pv-sg-wrap svg { height: 100%; width: auto; max-width: 100%; }
.pv-sg-val { position: absolute; left: 50%; bottom: 2%; transform: translateX(-50%); font-size: 0.92em; font-weight: 700; font-variant-numeric: tabular-nums; }
.pv-sg-cap { font-size: 0.46em; opacity: 0.6; }
.pv-yg-grid.dot i { border-radius: 50%; }
/* ===== v3.1 新增：节日卡 / 假期倒计时 / 年电量 ===== */
.pv-fe { width: 100%; height: 100%; align-items: center; justify-content: center; gap: 0.2em; }
.pv-fe-top { flex: 0 0 auto; display: flex; justify-content: center; }
.pv-fe-gap { font-size: 0.46em; font-weight: 700; color: #fff; padding: 0.2em 0.7em; border-radius: 1em; letter-spacing: 0.02em; white-space: nowrap; }
.pv-fe-name { font-size: 1.32em; font-weight: 800; line-height: 1.15; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.pv-fe-date { font-size: 0.52em; opacity: 0.6; font-variant-numeric: tabular-nums; }
.pv-single-1x2 .pv-fe-name, .pv-single-2x1 .pv-fe-name { font-size: 1.05em; }
.pv-single-2x4 .pv-fe-name, .pv-single-4x4 .pv-fe-name { font-size: 1.5em; }
.pv-hd { width: 100%; height: 100%; align-items: center; justify-content: center; gap: 0.12em; }
.pv-hd-days { font-size: 1.9em; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; display: flex; align-items: baseline; gap: 0.08em; justify-content: center; }
.pv-hd-days small { font-size: 0.32em; font-weight: 600; opacity: 0.75; }
.pv-hd-name { font-size: 0.62em; font-weight: 700; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.pv-hd-date { font-size: 0.48em; opacity: 0.55; font-variant-numeric: tabular-nums; }
.pv-single-1x2 .pv-hd-days, .pv-single-2x1 .pv-hd-days, .pv-single-1xfull .pv-hd-days { font-size: 1.35em; }

/* ===== v3.11 方卡/窄高卡专用样式：今日大数字 / 小月历 / 竖排时间 / 分层进度条 ===== */
/* dayNum：日数独占视觉重心。方形卡与窄高卡都不存在「横向长文本」，天然不会被裁。 */
.pv-dn { width: 100%; height: 100%; align-items: center; justify-content: center; gap: 0.06em; }
.pv-dn-num { font-size: 3.4em; font-weight: 800; line-height: 0.98; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
.pv-dn-sub { font-size: 0.56em; font-weight: 600; letter-spacing: 0.02em; white-space: nowrap; }
.pv-single-2x1 .pv-dn-num { font-size: 4em; }
.pv-single-1x2 .pv-dn-num { font-size: 2.6em; }
/* miniMonth：表头 + 星期行 + 7 列固定网格；行高用 1fr 均分剩余高度，1×1 上刚好铺满 */
.pv-mm { width: 100%; height: 100%; gap: 0.16em; justify-content: center; }
.pv-mm-head { flex: 0 0 auto; font-size: 0.46em; font-weight: 700; letter-spacing: 0.04em; white-space: nowrap; }
.pv-mm-wd { flex: 0 0 auto; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 0.06em; font-size: 0.38em; font-weight: 700; text-align: center; line-height: 1.2; }
.pv-mm-wd i { font-style: normal; }
.pv-mm-grid { flex: 1 1 auto; min-height: 0; display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); grid-auto-rows: minmax(0, 1fr); gap: 0.06em; }
.pv-mm-c { display: flex; align-items: center; justify-content: center; font-size: 0.44em; font-weight: 600; line-height: 1; border-radius: 0.26em; font-variant-numeric: tabular-nums; }
.pv-mm-c.out { opacity: 0.26; }
.pv-single-2x4 .pv-mm-c { font-size: 0.56em; }
/* stackTime：三行竖排，按高度均分 */
.pv-skt { width: 100%; height: 100%; justify-content: center; align-items: center; gap: 0.12em; }
.pv-skt-row { display: flex; align-items: baseline; gap: 0.14em; line-height: 1; }
.pv-skt-row b { font-size: 1.9em; font-weight: 800; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
.pv-skt-row i { font-size: 0.5em; font-style: normal; opacity: 0.7; }
.pv-single-2x1 .pv-skt-row b { font-size: 2.3em; }
/* 窄高卡：三行按高度均分铺满，而不是挤在中间一小块 */
.pv-single-2x1 .pv-skt { justify-content: space-evenly; gap: 0; }
.pv-single-2x2 .pv-skt-row b { font-size: 2.2em; }
/* stackBars：四行横条按高度均分（space-evenly），窄高卡不挤、方卡不散 */
.pv-sb { width: 100%; height: 100%; justify-content: space-evenly; gap: 0.2em; }
.pv-sb-row { display: flex; align-items: center; gap: 0.4em; flex: 0 1 auto; }
.pv-sb-k { flex: 0 0 auto; width: 1.1em; font-size: 0.6em; font-weight: 700; text-align: center; }
.pv-sb-bar { flex: 1 1 auto; min-width: 0; height: 0.42em; border-radius: 999px; background: color-mix(in srgb, currentColor 14%, transparent); overflow: hidden; }
.pv-sb-bar i { display: block; height: 100%; border-radius: inherit; }
.pv-sb-v { flex: 0 0 auto; width: 2.6em; text-align: right; font-size: 0.62em; font-weight: 700; font-variant-numeric: tabular-nums; }
.pv-bt { width: 100%; height: 100%; align-items: center; justify-content: center; gap: 0.28em; }
.pv-bt-head { display: flex; align-items: baseline; justify-content: space-between; width: 100%; font-size: 0.5em; font-weight: 600; }
/* v3.10：width:100% + 两侧 0.13em 边框（默认 content-box）会让电池壳比卡片宽 0.26em —— 审计在
   1×2/2×1/2×2/2×4/4×4/1×FULL 六档都报横向溢出。改 border-box。 */
.pv-bt-body { box-sizing: border-box; position: relative; width: 100%; flex: 0 1 auto; height: 0.9em; border: 0.13em solid; border-radius: 0.28em; overflow: hidden; display: flex; align-items: stretch; }
.pv-bt-body i { display: block; border-radius: 0.14em; }
.pv-bt-body u { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(0, 0, 0, 0.28); }
.pv-bt-nub { width: 0.2em; height: 0.3em; border-radius: 0 0.06em 0.06em 0; flex: 0 0 auto; align-self: center; margin-left: -0.03em; }
.pv-single-1x2 .pv-bt, .pv-single-1xfull .pv-bt { gap: 0.2em; }
.pv-single-4x4 .pv-bt-body { height: 1.2em; }
`;
