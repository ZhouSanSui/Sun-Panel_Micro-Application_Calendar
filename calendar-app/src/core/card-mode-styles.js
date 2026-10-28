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
.pv-row2 { font-size: 0.82em; font-weight: 600; }
.pv-sch-row { display: flex; align-items: center; justify-content: space-between; gap: 0.5em; width: 100%; }
.pv-sch-name { font-size: 0.75em; font-weight: 600; line-height: 1.2; flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pv-sch-meta { display: flex; flex-direction: column; align-items: flex-end; flex: 0 0 auto; font-size: 0.5em; line-height: 1.2; white-space: nowrap; }
.pv-sch-line { line-height: 1.25; }
.pv-sch-date { opacity: 0.95; }
.pv-sch-time { opacity: 0.8; }
.pv-sub { font-size: 0.66em; line-height: 1.3; }
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
.pv-single-1x1 { font-size: 17px; }
.pv-single-1x2 { font-size: 19px; }
.pv-single-2x1 { font-size: 19px; }
.pv-single-2x2 { font-size: 22px; }
.pv-single-2x4 { font-size: 26px; }
.pv-single-4x4 { font-size: 34px; }
.pv-single-1xfull { font-size: 20px; }
/* v2.6 硬约束：块内内容只在本块内裁切，绝不外溢压到相邻单元（与 .card-mode-wrap 的整卡裁切双层兜底） */
.pv-block { overflow: hidden; }
/* v2.5 单独模式整卡三段式：顶栏 + 主内容 + 底部进度条；格阵为绝对定位纹理 */
/* 窄块「今天」半号主字：避免 2 字折行把总高顶出一行 */
.pv-big-sm { font-size: 0.9375em; }
/* ===== v2.7 单独模式新增「显示样式」（用户可在配置页 chip 中点选） ===== */
/* 年进度格阵：365/366 格，格边长由 CSS 从容器真实尺寸推出，JS 只给 --cols/--rows 两个整数 */
.pv-yg { width: 100%; height: 100%; gap: 0.3em; align-items: stretch; }
.pv-yg-head { flex: 0 0 auto; display: flex; align-items: baseline; justify-content: space-between; font-size: 0.5em; line-height: 1.2; }
.pv-yg-head b { font-weight: 800; }
/* v3.12：格阵区独立成 body 并开启 container-type:size ——
   这样 100cqw / 100cqh 拿到的是**格阵区的真实像素**，而不是 JS 用设计基准预测出来的 em 值。
   头部高度由 CSS 自己决定（flex:0 0 auto），格阵区 flex:1 取剩余 → 改头部字号不会挤坏格阵。 */
.pv-yg-body { flex: 1 1 auto; min-height: 0; width: 100%; display: flex; align-items: center; justify-content: center; container-type: size; }
/* v3.12：格边长由 --cell 单标量同时定义行/列轨道 → 格子恒正方形，且
   总宽 = cols×cell + (cols−1)×gap ≤ 100cqw 恒成立 → **永远不会越界被裁**。
   --cols/--rows 由 JS 按「卡片宽高比 × 粒度」查表给出（都是整数）；--gap/--cap 按粒度给。
   旧写法是 JS 内联「grid-template-columns: repeat(cols, X em)」的固定 em 轨道，
   真实卡片一旦小于设计基准就必然溢出 → 用户截图的裁切。 */
.pv-yg-grid { display: grid; gap: var(--gap, 0.05em); justify-content: center; align-content: center; overflow: hidden;
  --cols: 31; --rows: 12; --gap: 0.05em; --cap: 0.90em;
  --cell: min(
    calc((100cqw - (var(--cols) - 1) * var(--gap)) / var(--cols)),
    calc((100cqh - (var(--rows) - 1) * var(--gap)) / var(--rows)),
    var(--cap)
  );
  grid-template-columns: repeat(var(--cols), var(--cell));
  grid-template-rows: repeat(var(--rows), var(--cell)); }
/* 粒度专属的间距与格边长上限（--cap 生效时格阵会小于内容盒 → 只留白、不溢出）
   v3.13：年 gap 0.10 → 0.05em。年格阵动辄 20~42 列，gap 占比高达 19%，
   收窄后 2×2/2×4/4×4/1×FULL 的格子分别涨 10%/8%/7%/15%（实测回写）。
   月/日 gap 0.16 → 0.10em：这两档改一排后列数变多（月 31 / 日 24），
   间距占比同样偏高；7×5 / 6×4 的老形状也顺带涨 3~5%。 */
.pv-yg-grid { --gap: 0.05em; }
.pv-yg-grid.m { --gap: 0.10em; --cap: 1.60em; }
.pv-yg-grid.w { --gap: 0.14em; --cap: 1.60em; }
.pv-yg-grid.d { --gap: 0.10em; --cap: 2.00em; }
/* 圆角改百分比，使大小卡上的格子圆角视觉一致（替代旧的 0.12em） */
.pv-yg-grid i { border-radius: 20%; background: currentColor; opacity: 0.13;
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
.pv-yb-foot { flex: 0 0 auto; display: flex; align-items: baseline; justify-content: space-between; font-size: 0.62em; line-height: 1.25; }
.pv-yb-foot b { font-weight: 800; font-size: 1.5em; }
/* 周进度格：7 格（星期 + 日期），已过格加深、今天格用主题色实心 */
.pv-wg2 { width: 100%; height: 100%; gap: 0.3em; align-items: stretch; }
.pv-wg2-row { flex: 1 1 auto; min-height: 0; width: 100%; display: flex; gap: 0.1em; }
.pv-wg2-cell { flex: 1 1 0; min-width: 0; padding: 0.1em 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.1em; border-radius: 0.22em; background: color-mix(in srgb, currentColor 9%, transparent); overflow: hidden; }
.pv-wg2-cell span { font-size: 0.62em; line-height: 1.2; }
/* v3.10：数字原来 0.9375em —— 7 列均分后每列只有约 1.1 个字宽，「20/21/22」直接叠在一起
   （用户报 2×1 变形）。压到 0.72em + 等宽数字，两位数字宽 ≈1.0em < 列宽。 */
.pv-wg2-cell b { font-size: 0.86em; line-height: 1.1; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -0.03em; }
.pv-wg2-cell.on { background: color-mix(in srgb, currentColor 16%, transparent); }
.pv-wg2-cell.now { background: transparent; }
.pv-wg2-foot { flex: 0 0 auto; font-size: 0.66em; line-height: 1.25; text-align: right; }
.pv-wg2-foot b { font-weight: 800; font-size: 1.3em; }
/* 双区时间：上时间大字 → 细分隔线 → 下日期 + 星期 */
.pv-dz { width: 100%; height: 100%; gap: 0.22em; align-items: stretch; justify-content: center; }
.pv-dz-time { flex: 0 0 auto; font-size: 2em; font-weight: 800; line-height: 1.05; letter-spacing: 0.01em; font-variant-numeric: tabular-nums; }
.pv-dz-rule { flex: 0 0 auto; height: 0.07em; border-radius: 0.035em; background: currentColor; opacity: 0.3; margin: 0.04em 0.02em; }
.pv-dz-date { flex: 0 0 auto; display: flex; align-items: baseline; justify-content: space-between; gap: 0.4em; font-size: 0.66em; line-height: 1.3; }
.pv-dz-date b { font-weight: 800; }
/* v3.10 1×FULL：dualZone 原样是「上时间 / 横分割线 / 下日期+星期」的方形卡版式，横条卡上
   分割线被拉成 1386px 横贯全宽、星期被甩到最右边（用户报「变形」）→ 改为竖线分隔的横排。
   v3.12：后半段（日期块 .pv-dz-date）加大一倍 0.5em → 1.0em；分隔线随右块增高；
   容器改 space-evenly —— 时间落在卡的 1/4 处、日期落在 3/4 处，不再挤在中间一小块。 */
.pv-single-1xfull .pv-dz { flex-direction: row; align-items: center; justify-content: center; gap: 2.4em; }
.pv-single-1xfull .pv-dz-rule { flex: 0 0 auto; width: 0.07em; height: 2.8em; margin: 0; }
.pv-single-1xfull .pv-dz-date { flex: 0 0 auto; flex-direction: column; align-items: flex-start; justify-content: center; gap: 0.12em; font-size: 1.2em; }

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
/* v3.12：DOM 拆成 left / right 两栏（基础版仍是竖排，1×FULL 才改横排） */
.pv-dc { width: 100%; height: 100%; align-items: center; justify-content: center; gap: 0.2em; }
.pv-dc-left { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.2em; }
.pv-dc-right { display: flex; flex-direction: column; align-items: center; justify-content: center; }
.pv-dc-dots { display: flex; gap: 0.16em; justify-content: center; width: auto; max-width: 100%; }
.pv-dc-dots i { width: 0.16em; aspect-ratio: 1 / 1; border-radius: 50%; background: currentColor; }
.pv-dc-time { font-size: 1.3em; font-weight: 800; letter-spacing: 0.08em; font-variant-numeric: tabular-nums; text-shadow: 0 0 0.16em currentColor, 0 0 0.02em currentColor; }
.pv-dc-date { font-size: 0.62em; letter-spacing: 0.04em; white-space: nowrap; }
.pv-single-2x4 .pv-dc-time { font-size: 1.6em; }
.pv-single-4x4 .pv-dc-time { font-size: 1.8em; }
/* boldClock：粗体大字 + 主色色块 */
.pv-bc { width: 100%; height: 100%; flex-direction: row; align-items: center; justify-content: center; gap: 0.4em; }
.pv-bc-nums { display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 0.22em; padding: 0.18em 0.28em; line-height: 0.95; }
.pv-bc-nums b { color: #111; font-size: 1.5em; font-weight: 900; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.pv-single-1x1 .pv-bc-nums b { font-size: 1.1em; }
.pv-bc-side { display: flex; flex-direction: column; align-items: flex-start; gap: 0.16em; font-size: 0.62em; }
/* capsule：胶囊倒计时 */
/* v3.12：DOM 拆成 left（倒计时格）/ right（标题胶囊），基础版竖排、1×FULL 横排 */
.pv-cp { width: 100%; height: 100%; align-items: center; justify-content: center; gap: 0.4em; overflow: hidden; }
.pv-cp-left { display: flex; flex-direction: column; align-items: center; justify-content: center; }
.pv-cp-right { display: flex; flex-direction: column; align-items: center; justify-content: center; }
.pv-single-1x1 .pv-cp-row, .pv-single-2x1 .pv-cp-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.15em 0.5em; }
.pv-cp-pill { border: 1px solid currentColor; border-radius: 999px; padding: 0.12em 0.7em; font-size: 0.56em; letter-spacing: 0.04em; white-space: nowrap; }
.pv-cp-row { display: flex; align-items: baseline; justify-content: center; gap: 0.36em; }
.pv-cp-cell { display: flex; align-items: baseline; gap: 0.1em; }
.pv-cp-cell b { font-size: 1.3em; font-weight: 800; font-variant-numeric: tabular-nums; }
.pv-cp-cell i { font-size: 0.56em; font-style: normal; }
/* targetDay：目标倒计时卡 */
/* v3.12：DOM 拆成 left（天数组）/ right（标题 + 目标日），基础版竖排、1×FULL 横排 */
.pv-tg { width: 100%; height: 100%; align-items: center; justify-content: center; gap: 0.22em; }
.pv-tg-left { display: flex; flex-direction: column; align-items: center; justify-content: center; }
.pv-tg-right { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.1em; }
.pv-tg-title { font-size: 0.6em; font-weight: 700; letter-spacing: 0.02em; }
.pv-tg-pre, .pv-tg-unit { font-size: 0.5em; }
.pv-tg-days { font-size: 2.5em; font-weight: 900; line-height: 1; font-variant-numeric: tabular-nums; }
.pv-tg-date { font-size: 0.66em; letter-spacing: 0.03em; white-space: nowrap; }
/* multiBars：多条进度 */
.pv-mb { width: 100%; height: 100%; justify-content: center; gap: 0.3em; overflow: hidden; }
/* v3.10 1×FULL：原来 4 条挤成一行，标签(1.7em)+百分比(3.1em) 两个定宽块吃掉大半，
   真实卡（1386×347 / 51.7px 基准）上进度条只剩 ≈50px，等于没有条 → 改 2×2 并让两侧
   定宽块各自按内容收窄。
   v3.12：5 项要 2 列 × 3 行（末格空），行宽固定 50% − 沟槽/2；行内标签与数值仍按内容收窄，
   条才有足够长度（5.861em 高的横条里，单列 5 行会把条拉成 24em 的细线，读起来不像分组）。
   落单的末行（第 5 项）显式跨两列 —— flex-wrap 下 flex-grow 会把它拉成整行宽，
   与其它 4 行的 50% 宽不一致；grid + :last-child:nth-child(odd) 让「5 项跨整行、
   4 项各占半行」都确定可控。 */
.pv-single-1xfull .pv-mb { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.4em 1.6em; align-content: space-evenly; align-items: center; }
.pv-single-1xfull .pv-mb-row:last-child:nth-child(odd) { grid-column: 1 / -1; }
.pv-single-1xfull .pv-mb-k { width: auto; min-width: 1.1em; }
.pv-single-1xfull .pv-mb-v { width: auto; }
.pv-mb-row { display: flex; align-items: center; gap: 0.4em; }
/* v3.12：标签框加宽到 2.2em —— 「生命」是 2 个汉字 = 1.12em 根，原 1.7em 框（0.95em 根）
   装不下 → 文字换行 → 该行高度变成其他行的 1.8 倍 → 5 行放不下被裁（用户截图实锤）。 */
.pv-mb-k { flex: 0 0 auto; width: 2.2em; font-size: 0.56em; white-space: nowrap; }
.pv-mb-bar { flex: 1 1 auto; height: 0.5em; border-radius: 999px; background: currentColor; opacity: 0.14; overflow: hidden; min-width: 0; }
.pv-mb-bar i { display: block; height: 100%; border-radius: inherit; }
/* v3.12：数值框加宽到 3.4em + nowrap —— 原 3.1em 框（1.92em 根）装不下「100%」（1.70em 根）+ 余量，
   「%」被裁。整数百分比后 3.4em 留约 24% 余量。 */
.pv-mb-v { flex: 0 0 auto; width: 3.4em; text-align: right; font-size: 0.62em; font-variant-numeric: tabular-nums; white-space: nowrap; }

/* ===== v2.10 新增样式：极简条钟 / 文字时钟 / 巨型天数 / 四环进度 / 年热力图 ===== */
.pv-st { justify-content: center; gap: 0.18em; width: 100%; }
.pv-st-time { font-size: 2.1em; font-weight: 200; letter-spacing: 0.02em; line-height: 1; font-variant-numeric: tabular-nums; }
.pv-st-rule { width: 1.6em; height: 0.12em; border-radius: 999px; opacity: 0.9; }
.pv-st-date { font-size: 0.64em; letter-spacing: 0.08em; opacity: 0.7; white-space: nowrap; }
.pv-single-1xfull .pv-st { flex-direction: row; align-items: center; justify-content: center; gap: 2.4em; }
/* v3.12：后半段（日期行 .pv-st-date）加大一倍 0.5em → 1.0em；分隔线随日期行增高 */
.pv-single-1xfull .pv-st-rule { width: 0.12em; height: 1.6em; }
.pv-single-1xfull .pv-st-date { font-size: 1.2em; letter-spacing: 0.02em; }
.pv-single-2x4 .pv-st-time { font-size: 2.6em; }
.pv-single-4x4 .pv-st-time { font-size: 3.2em; }

.pv-wc { justify-content: center; gap: 0.22em; width: 100%; }
.pv-wc-main { font-size: 1.35em; font-weight: 300; letter-spacing: 0.06em; line-height: 1.15; text-align: center; }
.pv-wc-sub { font-size: 0.6em; letter-spacing: 0.14em; opacity: 0.62; white-space: nowrap; }
.pv-single-2x4 .pv-wc-main { font-size: 2.1em; }
.pv-single-4x4 .pv-wc-main { font-size: 2.4em; }
/* v3.12：后半段（副行 .pv-wc-sub）加大一倍 0.48em → 0.96em；
   align-items 从 baseline 改 center —— 副行放大后 baseline 对齐会让主字下沉。 */
.pv-single-1xfull .pv-wc { flex-direction: row; align-items: center; justify-content: center; gap: 2.4em; }
.pv-single-1xfull .pv-wc-main { font-size: 1.7em; }
.pv-single-1xfull .pv-wc-sub { font-size: 1.12em; letter-spacing: 0.06em; }

/* v3.11：补 align-items/text-align —— 单独模式里 .pv-single > .pv-col 被 stretch 撑满整宽，
   缺这两条时标题与尾行会贴左边（用户截图 1×1 巨型天数「倒计时」在左上角）。 */
.pv-bd { justify-content: center; align-items: center; text-align: center; gap: 0.1em; width: 100%; }
.pv-bd-title { font-size: 0.62em; letter-spacing: 0.1em; opacity: 0.72; white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
.pv-bd-num { font-size: 2.2em; font-weight: 800; line-height: 0.95; font-variant-numeric: tabular-nums; }
.pv-bd-num small { font-size: 0.34em; font-weight: 600; margin-left: 0.1em; }
.pv-bd-tail { font-size: 0.52em; letter-spacing: 0.06em; opacity: 0.6; white-space: nowrap; }
.pv-single-1x1 .pv-bd-num { font-size: 1.9em; }
.pv-single-1x1 .pv-bd-tail { display: none; }
.pv-single-2x4 .pv-bd-num, .pv-single-4x4 .pv-bd-num { font-size: 2.8em; }

.pv-rp { justify-content: center; gap: 0.3em; width: 100%; height: 100%; min-height: 0; }
/* 同 .pv-rc-ring 的尺寸纪律：弹性占满剩余高度，SVG 靠 preserveAspectRatio 居正方 */
.pv-rp-ring { position: relative; width: 100%; flex: 1 1 auto; min-height: 0; min-width: 0; display: flex; align-items: center; justify-content: center; }
.pv-rp-ring svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.pv-rp-pct { font-size: 0.95em; font-weight: 700; font-variant-numeric: tabular-nums; }
.pv-rp-legend { display: flex; flex-wrap: wrap; gap: 0.34em 0.6em; justify-content: center; font-size: 0.52em; opacity: 0.8; }
.pv-rp-legend span { display: inline-flex; align-items: center; gap: 0.24em; white-space: nowrap; }
.pv-rp-legend i { width: 0.5em; height: 0.5em; border-radius: 999px; display: block; }
.pv-single-1xfull .pv-rp { flex-direction: row; align-items: center; justify-content: center; gap: 2.4em; }
/* 1×FULL 横排：环高度驱动见方（v3.16 改，原因见下）。
   v3.16：真实 1×FULL 卡仅 76px 高（内容区 50px，CDP 多视口实测）——旧值 5.2em
   在 root 11.3px 下 = 58.8px，上下各溢 4px 被宿主 overflow:hidden 裁掉（audit CLIP）。
   5.2em 是 v3.11 按想当然的「1387×347」定的，那两个数从来不是面板真实尺寸
   （1386.88×346.72 是 SunPanel 配置弹窗里的大预览卡，不是面板上的卡）。
   改为 height:100% + aspect-ratio：环永远不超容器，卡片变高时等比放大。 */
.pv-single-1xfull .pv-rp-ring { flex: 0 0 auto; height: 100%; width: auto; aspect-ratio: 1 / 1; }
/* v3.12：后半段（图例 .pv-rp-legend）加大一倍 0.46em → 0.92em，
   并从 4 行竖排改成 2 列 × 2 行网格（图例块高 ≈2.6em，在 5.861em 的卡内放得下）。 */
.pv-single-1xfull .pv-rp-legend { font-size: 0.92em; display: grid; grid-template-columns: repeat(2, auto); gap: 0.3em 0.9em; justify-content: start; }
/* v3.11 1×FULL ringClock：原来是「环在上、时间在下」的方卡版式，横条卡上环被限高到 ≈2em、
   两侧全是空的。改成横排：环高度驱动见方（v3.16 改，同 .pv-rp-ring——5.2em 固定值按
   想当然的 1387×347 定，真实 1×FULL 仅 76px 高会上下各溢 4px 被裁），时间放大贴右侧。
   v3.12：后半段（时间读数 .pv-rc-time）加大一倍 1.6em → 3.2em；容器改 space-evenly。 */
.pv-single-1xfull .pv-rc { flex-direction: row; align-items: center; justify-content: center; gap: 2.4em; }
.pv-single-1xfull .pv-rc-ring { flex: 0 0 auto; height: 100%; width: auto; aspect-ratio: 1 / 1; }
.pv-single-1xfull .pv-rc-time { font-size: 3.4em; letter-spacing: 0; }
/* v3.11 1×FULL yearBars：12 根竖条原本长到 347px 卡高，像 12 根柱子；改成
   「左侧条带 + 右侧年度读数」的横排，把 1387px 的横向空间用起来。 */
.pv-single-1xfull .pv-yb { flex-direction: column; align-items: stretch; justify-content: center; gap: 0.45em; }
.pv-single-1xfull .pv-yb-bars { flex: 1 1 auto; min-width: 0; min-height: 0; width: 100%; height: auto; }
.pv-single-1xfull .pv-yb-foot { flex: 0 0 auto; flex-direction: row; justify-content: space-between; align-items: baseline; width: 100%; gap: 0.3em; font-size: 0.7em;
.pv-single-1xfull .pv-yb-foot b { font-size: 1.6em; } }
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
/* v3.12：DOM 拆成 left（节日名 + 日期）/ right（状态徽标），基础版竖排、1×FULL 横排 */
.pv-fe-left { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.06em; min-width: 0; }
.pv-fe-right { display: flex; flex-direction: column; align-items: center; justify-content: center; }
.pv-fe-top { flex: 0 0 auto; display: flex; justify-content: center; }
.pv-fe-gap { font-size: 0.46em; font-weight: 700; color: #fff; padding: 0.2em 0.7em; border-radius: 1em; letter-spacing: 0.02em; white-space: nowrap; }
.pv-fe-name { font-size: 1.32em; font-weight: 800; line-height: 1.15; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.pv-fe-date { font-size: 0.52em; opacity: 0.6; font-variant-numeric: tabular-nums; }
.pv-single-1x2 .pv-fe-name, .pv-single-2x1 .pv-fe-name { font-size: 1.05em; }
.pv-single-2x4 .pv-fe-name, .pv-single-4x4 .pv-fe-name { font-size: 1.5em; }
/* v3.12：DOM 拆成 left（假期天数）/ right（假期名 + 日期），基础版竖排、1×FULL 横排 */
.pv-hd { width: 100%; height: 100%; align-items: center; justify-content: center; gap: 0.12em; }
.pv-hd-left { display: flex; flex-direction: column; align-items: center; justify-content: center; }
.pv-hd-right { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.06em; min-width: 0; }
.pv-hd-days { font-size: 1.9em; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; display: flex; align-items: baseline; gap: 0.08em; justify-content: center; }
.pv-hd-days small { font-size: 0.32em; font-weight: 600; opacity: 0.75; }
.pv-hd-name { font-size: 0.7em; font-weight: 700; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.pv-hd-date { font-size: 0.56em; opacity: 0.55; font-variant-numeric: tabular-nums; }
.pv-single-1x2 .pv-hd-days, .pv-single-2x1 .pv-hd-days, .pv-single-1xfull .pv-hd-days { font-size: 1.35em; }
/* v3.20：holidayNext 在 1×1 上采用 pv-hd 排版，补全小卡字号（避免沿用大卡基准被裁） */
.pv-single-1x1 .pv-hd { gap: 0.08em; }
.pv-single-1x1 .pv-hd-days { font-size: 1.6em; }
.pv-single-1x1 .pv-hd-name { font-size: 0.59em; }
.pv-single-1x1 .pv-hd-date { font-size: 0.56em; }

/* ===== v3.12：1×FULL 的五款「改为左右结构」 =====
   通则：左栏 = 主视觉（数字 / 主体文字），右栏 = 辅助信息（状态 / 标题 / 日期）。
   容器 justify-content: space-between → 两块贴卡片左右边缘，中间留白成为「沟槽」而非「空洞」。
   左栏宽度上限 = 内容宽的 46%（1×FULL 内容宽 25.961em → 11.94em）；
   右栏内部上下堆叠且右对齐（贴在卡片右缘，右对齐才不会在边缘留一道无意义的内缩）。 */
/* v3.13：1×FULL 的左右两栏由「贴卡片左右缘」改为「紧凑居中」—— 用户原话
   「两侧内容尽量归中显示」。做法统一成 justify-content:center 加固定大 gap：
   space-between / space-evenly 会把内容推到边缘，center 加 gap 让两栏紧紧聚在中间，
   剩余空间由 center 均分到卡片两侧（视觉上就是一组居中的内容，而不是两条贴边的带子）。
   gap 取 2.4em：1×FULL 内容宽 25.961em，两栏各约 46%（≈12em），2.4em 沟槽下仍留
   ≈2.5em 居中余量；再加大就会开始压缩栏内内容（flex:0 1 auto 允许收缩）。 */
.pv-single-1xfull .pv-dc, .pv-single-1xfull .pv-cp,
.pv-single-1xfull .pv-fe, .pv-single-1xfull .pv-tg,
.pv-single-1xfull .pv-hd {
  flex-direction: row; align-items: center; justify-content: center; gap: 2.4em;
}
.pv-single-1xfull .pv-dc-left, .pv-single-1xfull .pv-cp-left,
.pv-single-1xfull .pv-fe-left, .pv-single-1xfull .pv-tg-left,
.pv-single-1xfull .pv-hd-left { flex: 0 1 auto; max-width: 46%; min-width: 0; align-items: flex-start; }
.pv-single-1xfull .pv-dc-right, .pv-single-1xfull .pv-cp-right,
.pv-single-1xfull .pv-fe-right, .pv-single-1xfull .pv-tg-right,
.pv-single-1xfull .pv-hd-right { flex: 0 1 auto; max-width: 46%; min-width: 0; align-items: flex-end; }
/* 各款的字号与内部对齐 */
.pv-single-1xfull .pv-dc-left { align-items: center; }
.pv-single-1xfull .pv-dc-dots { width: 100%; justify-content: flex-start; }
.pv-single-1xfull .pv-dc-time { font-size: 1.9em; }
.pv-single-1xfull .pv-dc-date { font-size: 0.95em; }
.pv-single-1xfull .pv-cp-left { align-items: center; }
.pv-single-1xfull .pv-cp-row { display: flex; flex-wrap: nowrap; gap: 0.3em; }
.pv-single-1xfull .pv-cp-pill { font-size: 0.7em; }
.pv-single-1xfull .pv-fe-name { font-size: 1.8em; text-align: right; }
.pv-single-1xfull .pv-fe-date { font-size: 0.85em; text-align: right; }
.pv-single-1xfull .pv-fe-gap { font-size: 0.8em; }
.pv-single-1xfull .pv-tg-left { align-items: center; }
.pv-single-1xfull .pv-tg .pv-center { flex-direction: row; flex-wrap: nowrap; gap: 0.24em; }
.pv-single-1xfull .pv-tg-days { font-size: 3.2em; }
.pv-single-1xfull .pv-tg-pre, .pv-single-1xfull .pv-tg-unit { font-size: 0.5em; }
.pv-single-1xfull .pv-tg-title { font-size: 0.9em; text-align: right; }
.pv-single-1xfull .pv-tg-date { font-size: 0.85em; text-align: right; }
.pv-single-1xfull .pv-hd-days { font-size: 2.6em; }
.pv-single-1xfull .pv-hd-name { font-size: 0.9em; text-align: right; }
.pv-single-1xfull .pv-hd-date { font-size: 0.7em; text-align: right; }

/* ===== v3.11 方卡/窄高卡专用样式：今日大数字 / 小月历 / 竖排时间 / 分层进度条 ===== */
/* dayNum：日数独占视觉重心。方形卡与窄高卡都不存在「横向长文本」，天然不会被裁。 */
.pv-dn { width: 100%; height: 100%; align-items: center; justify-content: center; gap: 0.06em; }
.pv-dn-num { font-size: 3.4em; font-weight: 800; line-height: 0.98; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
/* v3.17：0.56 → 0.6em —— 2×1 root 9.5px（dayNum 补 fit 条目后）下 0.56em 仅 5.3px，
   贴可读底线；0.6em = 5.7px。行宽 0.6×6≈3.6em < fit w4.9 ✓ */
.pv-dn-sub { font-size: 0.74em; font-weight: 600; letter-spacing: 0.02em; white-space: nowrap; }
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
.pv-skt-row b { font-size: 2.1em; font-weight: 800; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
.pv-skt-row i { font-size: 0.62em; font-style: normal; opacity: 0.7; }
.pv-single-2x1 .pv-skt-row b { font-size: 2.3em; }
/* 窄高卡：三行按高度均分铺满，而不是挤在中间一小块 */
.pv-single-2x1 .pv-skt { justify-content: space-evenly; gap: 0; }
.pv-single-2x2 .pv-skt-row b { font-size: 2.2em; }
/* stackBars：四行横条按高度均分（space-evenly），窄高卡不挤、方卡不散 */
.pv-sb { width: 100%; height: 100%; justify-content: space-evenly; gap: 0.2em; }
.pv-sb-row { display: flex; align-items: center; gap: 0.4em; flex: 0 1 auto; }
.pv-sb-k { flex: 0 0 auto; width: 1.1em; font-size: 0.74em; font-weight: 700; text-align: center; }
.pv-sb-bar { flex: 1 1 auto; min-width: 0; height: 0.42em; border-radius: 999px; background: color-mix(in srgb, currentColor 14%, transparent); overflow: hidden; }
.pv-sb-bar i { display: block; height: 100%; border-radius: inherit; }
.pv-sb-v { flex: 0 0 auto; width: 2.6em; text-align: right; font-size: 0.76em; font-weight: 700; font-variant-numeric: tabular-nums; }
.pv-bt { width: 100%; height: 100%; align-items: center; justify-content: center; gap: 0.28em; }
.pv-bt-head { display: flex; align-items: baseline; justify-content: space-between; width: 100%; font-size: 0.62em; font-weight: 600; }
.pv-bt-head b { font-size: 1.35em; font-weight: 800; }
/* v3.10：width:100% + 两侧 0.13em 边框（默认 content-box）会让电池壳比卡片宽 0.26em —— 审计在
   1×2/2×1/2×2/2×4/4×4/1×FULL 六档都报横向溢出。改 border-box。 */
.pv-bt-body { box-sizing: border-box; position: relative; width: 100%; flex: 0 1 auto; height: 0.9em; border: 0.13em solid; border-radius: 0.28em; overflow: hidden; display: flex; align-items: stretch; }
.pv-bt-body i { display: block; border-radius: 0.14em; }
.pv-bt-body u { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(0, 0, 0, 0.28); }
.pv-bt-nub { width: 0.2em; height: 0.3em; border-radius: 0 0.06em 0.06em 0; flex: 0 0 auto; align-self: center; margin-left: -0.03em; }
.pv-single-1x2 .pv-bt, .pv-single-1xfull .pv-bt { gap: 0.2em; }
.pv-single-4x4 .pv-bt-body { height: 1.2em; }

/* ===== v3.12：专为 1×1 方卡 / 2×1 窄高卡新设计的 8 款样式 =====
   排版铁律（docs/v312-visual-spec.md §8）：
   1×1 内容盒 6.6em 见方 → 1 个主数字（≤3.4em）+ 极少量辅助；
   2×1 内容盒仅 6.52em 宽 → 任何横排长文本都不可行，一律纵向堆叠（每行 ≤ 4 字）。 */

/* ① lunarDate 农历日（1×1）：三行竖排 —— 干支年 / 农历日大字 / 公历
   1×1 内容盒 = 6.61em 见方。农历日「廿三」2 字 × 2.6em ≈ 5.2em ✓；「三十」同宽。
   最坏「廿三」3 字宽的情况不存在（农历日最多 3 字如「廿三」），按 3 字 × 2.6em = 7.8em 会超，
   故字号取 2.2em（3 字 ≈ 6.6em，刚好卡边）。 */
.pv-ld { width: 100%; height: 100%; align-items: center; justify-content: center; gap: 0.14em; }
.pv-ld-top { font-size: 0.72em; font-weight: 700; white-space: nowrap; }
.pv-ld-day { font-size: 2.2em; font-weight: 800; line-height: 1.05; letter-spacing: 0.02em; white-space: nowrap; }
.pv-ld-bot { font-size: 0.7em; white-space: nowrap; }
/* v3.13：1×1 只留「农历」小标 + 农历日大字 —— 用户实测三行全被裁（内容盒仅 6.6em 见方），
   要求「只显示一个有效信息」。农历日恒 ≤2 字（初一…三十），2.8em × 2 = 5.6em < 6.6em ✓，
   字号反而比三行版更大更醒目。更大卡片才显示干支年/公历两行。
   v3.14：用户仍报 1×1 被裁。本地按真实尺寸（346.72、根字号 46.23px）实测四款均无溢出
   （em 几何上不可能溢出：所有尺寸的字号/可用空间同比缩放），判断是面板缓存了旧包。
   但仍加两道结构性保险，让「被裁」在任何宿主尺寸下都不可能发生：
     ① max-width:100% + overflow:hidden 兜住极端窄宿主；
     ② 主数字改用 clamp() 以「容器宽度」为上限，而不是只靠 em 估算。 */
.pv-single-1x1 .pv-ld { gap: 0.1em; max-width: 100%; overflow: hidden; }
.pv-single-1x1 .pv-ld-top, .pv-single-1x1 .pv-ld-bot { display: none; }
.pv-single-1x1 .pv-ld-day { font-size: 2.8em; line-height: 1; max-width: 100%; overflow: hidden; }

/* ② dayStack 日时堆叠（1×1）：左列 4 行时刻 + 右列巨大「日」
   1×1 内容盒 6.61em 宽。左列「HH:MM」在 0.36em 字号下 ≈ 5 字 × 0.2em = 1.9em；
   右列「日」3em 字号下两位数字 ≈ 2×0.6×3 = 3.6em。3.6 + 1.9 + 沟槽 0.5 = 6.0em ✓ */
.pv-ds { width: 100%; height: 100%; flex-direction: row; align-items: center; justify-content: center; gap: 0.4em; }
.pv-ds-left { flex: 0 1 auto; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 0.14em; }
.pv-ds-row { display: flex; align-items: baseline; gap: 0.08em; font-variant-numeric: tabular-nums; letter-spacing: 0; white-space: nowrap; }
.pv-ds-row b { font-size: 0.64em; font-weight: 700; }
.pv-ds-row i { font-size: 0.64em; font-style: normal; opacity: 0.6; }
.pv-ds-right { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; }
.pv-ds-day { font-size: 3em; font-weight: 800; line-height: 1; letter-spacing: -0.04em; font-variant-numeric: tabular-nums; }
/* v3.13：1×1 只留巨大「日」数字 —— 左侧 4 行「时:分」读数在 346px 方卡上挤成裁切。
   用户要求「只显示一个有效信息」。两位数字 3.4em ≈ 4.1em < 6.6em ✓。
   v3.14：补 max-width/overflow 结构性保险（同 lunarDate，理由见上）。 */
.pv-single-1x1 .pv-ds { gap: 0; max-width: 100%; overflow: hidden; }
.pv-single-1x1 .pv-ds-left { display: none; }
.pv-single-1x1 .pv-ds-day { font-size: 3.4em; max-width: 100%; overflow: hidden; }
/* v3.20：2×1 日时堆叠改为上下结构（大「日」在上、4 行时刻在下） */
.pv-single-2x1 .pv-ds { flex-direction: column; gap: 0.3em; }
.pv-single-2x1 .pv-ds-right { order: -1; }
.pv-single-2x1 .pv-ds-left { align-items: center; gap: 0.12em; }
.pv-single-2x1 .pv-ds-day { font-size: 3.4em; }

/* ③ tallClock 竖向大钟（2×1）：超大时分（主行）+ 次级秒（次行）+ 当日进度条 + 日期
   2×1 内容盒 = 6.52em 宽（= 305px @ 46.78px 根字号）。
   「14:05」5 个字符，数字宽 ≈ 0.55em、冒号 ≈ 0.28em → 总宽 ≈ 0.55×4 + 0.28 = 2.48em。
   要在 6.52em 内留 1em 余量 → 字号 ≤ (6.52−1)/2.48 = 2.2em。取 2.2em。
   秒单独一行（1.1em），形成「主行超大 + 次行次级」的层级。 */
.pv-tc { width: 100%; height: 100%; align-items: center; justify-content: center; gap: 0.3em; }
.pv-tc-time { display: flex; align-items: baseline; gap: 0.02em; white-space: nowrap; letter-spacing: -0.04em; }
.pv-tc-time b { font-size: 2.2em; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
.pv-tc-time i { font-size: 2.2em; font-weight: 700; font-style: normal; line-height: 1; font-variant-numeric: tabular-nums; }
.pv-tc-sec { display: flex; align-items: baseline; gap: 0.14em; font-size: 1.3em; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
.pv-tc-sec em { font-size: 0.55em; font-weight: 600; font-style: normal; }
.pv-tc-bar { width: 100%; height: 0.16em; border-radius: 999px; background: color-mix(in srgb, currentColor 16%, transparent); overflow: hidden; }
.pv-tc-bar i { display: block; height: 100%; border-radius: inherit; }
.pv-tc-date { font-size: 0.74em; white-space: nowrap; }

/* ④ weekColumn 竖向星期条（2×1）：7 行，每行「星期字 + 大日期数字」，今天整行高亮 */
.pv-wc2 { width: 100%; height: 100%; align-items: stretch; justify-content: center; gap: 0.14em; }
.pv-wc2-head { flex: 0 0 auto; font-size: 0.56em; font-weight: 700; }
.pv-wc2-list { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 0.06em; }
.pv-wc2-row { flex: 1 1 0; min-height: 0; display: flex; align-items: center; justify-content: space-between; padding: 0 0.3em; border-radius: 0.2em; }
.pv-wc2-row span { font-size: 0.6em; font-weight: 700; }
.pv-wc2-row b { font-size: 1.1em; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }

/* ⑤ nextUp 下一件事（1×1）：剩余时间大数字 + 事件名 + 相对时间
/* v3.14：schedule.nextUp 已全尺寸移除（用户「显示的逻辑我没有太明白」），CSS 一并删除。
   想看「下一件事」请用 targetDay（可关联日程，语义更直白）。 */

/* ⑥ schedule.festivalDay 节日节假日（v3.14，1×1 为主）
   用户要求「字体尽可能小别被裁切」—— 全部字号压到 0.34~0.56em。
   宽度账（1×1 内容盒 ≈ 6.6em）：最宽行「节日 寒衣节 11/09」
   = 标签 2×0.34 + 名称 3×0.56 + 日期 5×0.22 + 沟槽 2×0.26 ≈ 3.7em，余量 > 40%。
   名称最长 4 字（如「劳动节」类节日 / 「腊八节」），4×0.56 = 2.24em，整行仍 ≈ 4.4em。 */
.pv-fd { width: 100%; height: 100%; align-items: center; justify-content: center; gap: 0.14em; }
.pv-fd-row { display: flex; align-items: baseline; gap: 0.26em; white-space: nowrap; }
.pv-fd-k { font-size: 0.5em; font-weight: 700; opacity: 0.75; }
.pv-fd-v { font-size: 0.64em; font-weight: 800; letter-spacing: 0.01em; }
.pv-fd-d { font-size: 0.56em; font-weight: 600; font-variant-numeric: tabular-nums; }
.pv-fd-rule { width: 2.4em; height: 1px; background: currentColor; opacity: 0.16; flex: 0 0 auto; }
/* 大卡上适度放大（仍远小于其它款，保持「小字信息条」的定位） */
/* v3.17：1×1/2×1 隐藏「节日/假期」标签 k —— 卡宽仅 50px，「节日 寒衣节 14 天」
   一行排开需 4.8em（中文字形系数致实测大于几何和），k 本身 0.44em 只有 4px
   本就不可读。按「1×1 极简靠尺寸类裁剪」惯例隐藏后行宽降到 v+d≈3.6em，
   根字号 9.3 → 11.7px，主信息 v/d 反大到 6.6/5.6px（CONTENT_FIT w 5.0→3.9）。
   1×2 保留 k（h 方向 root 15.7，k 0.44em = 6.9px 可读）。 */
.pv-single-1x1 .pv-fd-k, .pv-single-2x1 .pv-fd-k { display: none; }
.pv-single-1x2 .pv-fd-v, .pv-single-2x1 .pv-fd-v { font-size: 0.68em; }
/* v3.18：1×1 的名称 / 天数两行再放大一轮（用户诉求：上下字体都偏小）。
   实测账（root 11.7px、pv-fd 盒 45.6px）：放大前行宽 = v 19.9 + 沟槽 3.04 + d 14.2 = 37.1px
   （= 3.17em），离 CONTENT_FIT 的保底线 3.9em 还有余量 —— **只要不超过 fit.w，root 就不变、
   字是真变大**。取值 v 0.65 / d 0.56 后行宽 = 23.1 + 3.04 + 16.6 ≈ 42.7px（3.65em，余量 6.4%）。
   早已核查最坏组合：全年节日名最长 3 字（33 个里 29 个三字），倒计时最大 30 天（两位），
   故「寒衣节 14 天」即最宽情况。 */
.pv-single-1x1 .pv-fd-v { font-size: 0.65em; }
.pv-single-1x1 .pv-fd-d { font-size: 0.59em; }

/* ⑦ festivalNext / holidayNext（v3.19）：节日、节假日拆成两张独立卡。
   原 festivalDay 把两行信息挤在一张卡 —— 1×1（内容盒仅 50px）为塞下不得不隐藏「节日/假期」
   标签，用户要求「放开显示」。拆开后一张卡只有一个信息：标签不用再 hidden，
   名称独占可用宽度，实测名称字号是 festivalDay 的约两倍（7.6 → 12px 级，见下 em 初值）。
   三行竖排 = 标签 / 名称 / 天数；pv-col 自带 column + gap 0.3125em + center，此处只补横向居中。
   v / d 用 flex:0 1 auto + min-width:0：名称过长时由 fitFontU 的 root 缩放兜住，不横向溢出。 */
.pv-fnx { width: 100%; height: 100%; align-items: center; }
.pv-fnx-k { flex: 0 0 auto; font-size: 0.62em; font-weight: 700; opacity: 0.85; white-space: nowrap; }
.pv-fnx-v { flex: 0 1 auto; min-width: 0; max-width: 100%; font-size: 1.05em; font-weight: 800; line-height: 1.08; white-space: nowrap; }
.pv-fnx-d { flex: 0 0 auto; font-size: 0.72em; font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }

/* ⑥ verticalList 纵向日程表（2×1）：每行「时间（左）+ 事件名（右）」 */
.pv-vl { width: 100%; height: 100%; align-items: stretch; justify-content: center; gap: 0.14em; }
.pv-vl-head { flex: 0 0 auto; font-size: 0.66em; font-weight: 700; }
.pv-vl-list { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 0.1em; }
.pv-vl-row { flex: 1 1 0; min-height: 0; display: flex; align-items: center; gap: 0.4em; border-bottom: 0.06em solid color-mix(in srgb, currentColor 12%, transparent); }
.pv-vl-row span { flex: 0 0 auto; font-size: 0.62em; font-variant-numeric: tabular-nums; }
.pv-vl-row b { flex: 1 1 auto; min-width: 0; font-size: 0.86em; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pv-vl-next { flex: 0 0 auto; font-size: 0.54em; font-weight: 700; white-space: nowrap; }

/* ⑦ dayRing 日环进度（1×1）：单环 + 环内大百分比 + 底部时刻
   v3.14：环形尺寸改用 min(3.4em, 100%) —— 极端窄宿主下 3.4em 的固定值会顶出内容盒，
   配合 flex:0 1 auto（可收缩）与 max-width，让「被裁」在结构上不可能发生。 */
.pv-dr { width: 100%; height: 100%; align-items: center; justify-content: center; gap: 0.16em; max-width: 100%; overflow: hidden; }
.pv-dr-ring { position: relative; width: min(3.4em, 100%); height: min(3.4em, 100%); flex: 0 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center; }
.pv-dr-ring svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.pv-dr-pct { font-size: 1.1em; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.pv-dr-time { font-size: 0.6em; white-space: nowrap; max-width: 100%; overflow: hidden; }
/* v3.18：1×1 环下「今日 HH:MM」0.5 → 0.66em（5.99 → 7.9px，+32%），原值低于可读底线。
   高度是这个样式的硬约束（pv-dr 盒 45.5px = ring 36.5 + time 行盒 7.2 + gap，余量仅 1.8px），
   **flex:0 0 auto 是关键**：time 默认 flex-shrink:1，会被容器高度压缩 —— 0.5em 时
   scrollHeight 8 > 盒高 7.2、0.66em 时 10 > 8.6，配合 overflow:hidden 会把中文字上下缘
   切掉 1~1.4px（用户最反感的那种「看得出的裁切」）。改为不可压缩后字完整显示，
   压缩量全部转给 ring（已是 flex:0 1 auto）：ring 高 36.5 → 约 33.6px（-8%，圆按 min 边缩放）。
   这是必要的交换：要让字变大且不被裁，环只能变小；ring 再小就得牺牲 1.1em 的 pct 了。
   宽度不是问题：time 行 29.3 → 38.6px << 45.5px。 */
.pv-single-1x1 .pv-dr-time { font-size: 0.72em; flex: 0 0 auto; }

/* ⑧ lifeBar 生命刻度尺（2×1）：20 个刻度块，已过的填主色
   刻度尺本身是「竖向的一列窄条」—— 宽度只占卡宽的一部分（60%），居中；
   20 个块竖排，每块高 ≈ 0.28em，间距 0.06em，总高 ≈ 6.8em，在 13.9em 里够用。 */
.pv-lb { width: 100%; height: 100%; align-items: center; justify-content: center; gap: 0.14em; }
/* v3.17：0.52 → 0.56em —— 2×1 root 10.1px 下 0.52em = 5.25px 差阈值 0.25px；
   0.56em = 5.66px 达标。行宽「生命进度 15%」0.56em≈3.9em < fit w4.6 ✓ */
.pv-lb-head { flex: 0 0 auto; font-size: 0.68em; font-weight: 700; white-space: nowrap; }
.pv-lb-scale { flex: 1 1 auto; min-height: 0; width: 60%; max-width: 3.2em; display: flex; flex-direction: column; gap: 0.06em; }
.pv-lb-scale i { flex: 1 1 0; min-height: 0; display: block; border-radius: 0.08em; background: color-mix(in srgb, currentColor 16%, transparent); }
.pv-lb-scale i.on { opacity: 1; }
/* v3.17：0.42 → 0.56em —— 2×1 root 10.1px 下 0.42em 仅 4.2px；0.54em=5.45px
   仍差阈值 0.05px，0.56em=5.66px 达标。行宽「已过 18 / 120 岁」0.56em≈4.0em < fit w4.6 ✓ */
.pv-lb-foot { flex: 0 0 auto; font-size: 0.68em; white-space: nowrap; }

/* v3.21：1×2 单独模式字号批量微调（用户请求）—— 全部以 .pv-single-1x2 作用域覆盖，
   不改基础值与其它尺寸专属覆盖，避免误伤 2×2/4×4/1×FULL。1em = 19px 基准（px 为 19px 基准换算）。 */
.pv-single-1x2 .pv-ds-row b,
.pv-single-1x2 .pv-ds-row i { font-size: 0.68em; }                       /* dayStack 左行 12.2→13 */
.pv-single-1x2 .pv-dz-date { font-size: 0.68em; }                       /* dualZone 日期 12.5→13 */
.pv-single-1x2 .pv-dc-time { font-size: 2em; }                          /* dotClock 时 24.7→38 */
.pv-single-1x2 .pv-dc-date { font-size: 0.68em; }                       /* dotClock 日期 11.8→13 */
.pv-single-1x2 .pv-bc-nums b { font-size: 2em; }                        /* boldClock 数字 28.5→38 */
.pv-single-1x2 .pv-bc-side { font-size: 0.68em; }                       /* boldClock 侧标 11.8→13 */
.pv-single-1x2 .pv-st-date { font-size: 0.68em; }                       /* stripeClock 日期 12.2→13 */
.pv-single-1x2 .pv-wc-main { font-size: 2em; }                          /* wordClock 主 25.7→38 */
.pv-single-1x2 .pv-wc-sub { font-size: 0.68em; }                        /* wordClock 副 11.4→13 */
.pv-single-1x2 .pv-dn-num { font-size: 4em; line-height: 0.9; }        /* dayNum 数字 → ≈37px（line-height 0.9 腾出副放大空间）*/
.pv-single-1x2 .pv-dn-sub { font-size: 1.4em; }                         /* dayNum 副 → ≈13px（em×u9.3）*/
.pv-single-1x2 .pv-cp { gap: 0.14em; }                                  /* capsule 数字↔标题间距 -5px（0.4→0.14em）*/
.pv-single-1x2 .pv-cp-pill { font-size: 0.68em; }                       /* capsule 标题 10.6→13 */
.pv-single-1x2 .pv-cp-cell i { font-size: 0.68em; }                     /* capsule 单位 10.6→13 */
.pv-single-1x2 .pv-tg-title { font-size: 0.84em; }                      /* targetDay 标题 11.4→16 */
.pv-single-1x2 .pv-tg-pre,
.pv-single-1x2 .pv-tg-unit { font-size: 0.68em; }                       /* targetDay 单位 9.5→13 */
.pv-single-1x2 .pv-tg-days { font-size: 2.1em; }                        /* targetDay 天 47.5→40 */
.pv-single-1x2 .pv-tg-date { font-size: 0.68em; }                       /* targetDay 日期 12.5→13 */
.pv-single-1x2 .pv-fd-k { font-size: 0.68em; }                         /* festivalDay 标 9.5→13（1×2 显示标签）*/
.pv-single-1x2 .pv-fd-v { font-size: 0.84em; }                         /* festivalDay 名 12.9→16（覆盖既有 0.68em）*/
.pv-single-1x2 .pv-fd-d { font-size: 0.68em; }                         /* festivalDay 天数 10.6→13 */
.pv-single-1x2 .pv-fnx-k { font-size: 0.68em; }                        /* festivalNext 标 11.8→13 */
.pv-single-1x2 .pv-hd-date { font-size: 0.68em; }                       /* holidayNext 日期 10.6→13 */
.pv-single-1x2 .pv-yb-foot { font-size: 0.68em; }                       /* yearBars 脚 11.8→13 */
.pv-single-1x2 .pv-yb-foot b { font-size: 0.79em; }                     /* yearBars 年度% 28.5→15 */
.pv-single-1x2 .pv-wg2-foot { font-size: 0.68em; }                      /* weekGrid 脚 12.5→13 */
.pv-single-1x2 .pv-wg2-foot b { font-size: 0.79em; }                    /* weekGrid 周% 24.7→15 */
.pv-single-1x2 .pv-bt-head { font-size: 0.68em; }                       /* battery 头 11.8→13 */
.pv-single-1x2 .pv-sg-cap { font-size: 0.68em; }                        /* semiGauge 标 8.7→13 */

/* v3.21b：1×2 二次微调（用户请求）—— 覆盖 v3.21 同名规则。1em = 19px 基准。 */
.pv-single-1x2 .pv-wc-main { font-size: 1.35em; }                       /* wordClock 主 38→25.7（回退基础值）*/
.pv-single-1x2 .pv-sg-cap { font-size: 0.46em; }                        /* semiGauge 标 13→8.7（回退基础值）*/
.pv-single-1x2 .pv-ds-row b,
.pv-single-1x2 .pv-ds-row i { font-size: 0.79em; }                      /* dayStack 左行 13→15 */
.pv-single-1x2 .pv-ds-left { gap: 0.06em; }                            /* dayStack 左行四排字行间距收紧（基础 0.14em）*/
.pv-single-1x2 .pv-tg-pre,
.pv-single-1x2 .pv-tg-unit { font-size: 0.79em; }                      /* targetDay 单位 13→15 */
.pv-single-1x2 .pv-tg-date { font-size: 0.79em; }                       /* targetDay 日期 13→15 */
.pv-single-1x2 .pv-cp { gap: 0.3em; overflow: visible; }               /* 标题↔时间间距 +5px（0.05→0.3em）；去掉自身裁剪 + 取消上移避免顶边裁切 */
.pv-single-1x2 .pv-cp-cell { line-height: 1; }                          /* 收紧单元格行高，消除行盒余白避免内容过高 */
.pv-single-1x2 .pv-cp-pill { line-height: 1; padding: 0.08em 0.6em; }   /* 胶囊行高收紧 + 收窄内边距腾出 +5px 间距空间 */
.pv-single-1x2 .pv-dc { gap: 0.28em; }                                  /* dotClock 时间↔日期 视觉间距 ≈12px */
.pv-single-1x2 .pv-dc-time { line-height: 1; }                          /* 行高恢复，避免字形重叠 */
.pv-single-1x2 .pv-dc-date { line-height: 1; margin-top: 0; }           /* 取消上提，间距交给 gap 控制 */
.pv-single-1x2 .pv-yb-foot span { font-size: 1em; }                   /* yearBars 「今年」≈13px（相对 foot 0.68em）*/
.pv-single-1x2 .pv-yb-foot b { font-size: 1em; }                      /* yearBars 年度% ≈13px */
.pv-single-1x2 .pv-wg2-foot span { font-size: 1em; }                  /* weekGrid 「本周」≈13px（相对 foot 0.68em）*/
.pv-single-1x2 .pv-wg2-foot b { font-size: 1em; }                     /* weekGrid 周% ≈13px */
.pv-single-1x2 .pv-wg2-foot { display: flex; justify-content: space-between; align-items: baseline; text-align: left; }  /* 本周移至最左，与今年一致 */
`;
