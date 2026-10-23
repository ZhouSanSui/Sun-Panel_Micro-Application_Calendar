# 项目约定汇编（面向接手者）

> 从历次迭代的工作记忆中整理，已剔除被后续版本取代的旧决策。
> 若与本文件的历史描述冲突，以**当前代码 + 视觉规格 + 版本台账**为准。

## 一、产品与架构

- SunPanel 微应用：小部件（7 种规格）+ 完整日历页；两种显示模式：
  - **拼接模式（combo）**：一卡多块，块 = `{内容, 样式}` + 可选占格/对齐/显示选项
  - **单独模式（single）**：整卡一块，按卡片尺寸套用不同版式（`pv-single-<size>`）
- 渲染核心 `src/core/card-mode-render.js` 被三端复用（widget / mainPage / widgetConfig）。
- **共享 CSS 真源**：所有 `.pv-*` 规则只写在 `src/core/card-mode-styles.js`（导出 `CARD_MODE_CSS`）；
  三组件（widget / mainPage / widgetConfig）与脚本（`make-preview.mjs` / `audit-single.mjs`）以**插值**引用，
  手工拷贝已删（`make-defaults-preview.mjs` / `audit-matrix.mjs` 收编中；`measure.html` 只保留文字标定所需规则）。
  **规则只写真源，镜像由插值 + 校验保证**，不要再手工同步；漏同步会被 `npm run check:css`
  与 test-render 的插值断言抓到（P0 修复的来龙去脉见 `docs/v131-visual-spec.md` ⑨）。

## 二、尺寸与网格

- SunPanel `gridSize` 是「行×列」：`1x2` 宽扁、`2x1` 窄高、`1xfull` 一行高横向占满。
- 卡片内部网格 `CARD_GRID`：SunPanel 一格 = 内部 2×2 细网格（1x1=2×2、2x2=4×4、2x4=8×4、4x4=8×8）。
- 运行时列数由 `comboGridFor(size, w, h)` 决定：
  - 1×FULL：`clamp(4, 10, round((w-24)/90))`
  - 其它：单元格 <24px 时按维度降密度（保底 2）
- 预览/审计/运行时**必须共用** `comboGridFor`，否则三处排版不一致。

## 三、布局与占格

- 布局不持久化：只存单元列表，渲染时 `layoutBlocks()` 现算。
- `span` 是绝对格数覆盖；`prefSpan` 给出尺寸感知的建议占格；`minSpan`/`minArea` 是下限。
- 面积下限（`minArea: 2`）：`hms`、`dateFullWeekday`、节日、节气、距放假、最近日程 —— 禁 1×1。
- 宽扁（flat）判定：块宽 ≥ 2×块高（像素比）；倒数型四样式另加「占格 rows===1 且块宽>块高」的意图判定。
- 窄高（tall）判定：块高 ≥ 2×块宽（像素比，不用格数）。

## 四、对齐（置中）

- 卡片级 `cardCenterH/V` = 该轴的默认；单元级 `align` = 单块覆盖。
- **v1.43 起取消「接管/锁定」**：单元级开关始终可点；卡片级开着时点它 = 把该轴移交给单元（先钉住当前值再翻转），并提示「已切换为单元级控制」。
- 无空间时提示「空间不足，已尽量居中」；位移有 160ms 过渡（`prefers-reduced-motion: no-preference` 下才加）。

## 五、排版与文案规则

- 块内全 `em`，字号由 `fitFontU` 从块像素反推；`CONTENT_FIT` 改动必须用 `measure.html` 实测回写。
- 日期样式：`年月日 / 年月 / 月日 / 月日星期 / 年月日星期`
  - 每个「数值+单位」是 `.pv-seg`（`white-space: nowrap`），段间 `<wbr>` 才换行
  - 块宽 <150px 自动两位年（`26年`），宽块四位（`2026年`）
- 块根字号 <10px（典型 48px 小块）→ `.pv-tight` 隐藏 `.pv-sub`，避免 5px 不可读副标题。
- 单独模式字号基准随尺寸：1×1 16 / 1×2 17 / 2×1 17 / 2×2 22 / 2×4 26 / 4×4 34 / 1×FULL 18（px）。
- 1×FULL 的月历默认单行（`singleLine`），按宽度动态天数；显式关闭时占格回退 2×2。

## 六、交互纪律

- 浮层：**禁 `position: fixed`**；挂 `.fullscreen` 下用 `absolute`。z-index：`.fs-nav 150 > confirm 140 > scrim 130`。
- 滚动定位：禁 `scrollIntoView`（会冒泡滚动宿主），手算 `scrollTop`。
- 触摸目标：36px 视觉 + `::after` 撑 44×44 热区；靠动画恢复 `pointer-events` 的按钮，`reduced-motion` 下必须显式放开。
- 提示统一走 `_showHint` / `_showCardCfgHint`（有节流，勿重复刷屏）。

## 七、宿主嵌入（已实测，别再猜）

- 微应用**不是 iframe**：宿主用自定义元素 + open shadow root 同文档嵌入，`.widget` 被 `.item-card-content`（`overflow:hidden` + 20px 圆角）裁剪。
- 玻璃圆角：`_syncCardRadius()` 读宿主 computed 圆角写 `--sp-card-radius`，`.widget` 用 `max(0px, calc(变量 - 1px))`。
- 边缘/圆角类问题不要再往 iframe/跨域方向排查。

## 八、版本与发布

规则全文见 `docs/VERSIONS.md`：
- 只有明确「归档 / 小归档」才升版本，其余算「修改」
- 正式版第三位沿用最后一次 beta 的打包日（只去 `-beta`）
- 归档/小归档重新打包 + push main + Release；修改只本地提交
- Beta 号与正式版号不互推，回溯靠台账
- **发布前工作区必须干净**：`release.mjs --execute` 先跑 `git status --porcelain`，有未提交改动即退出——
  避免「版本号进了 git、源码只在工作区」的不可回溯状态；bump 后 `config/app.config.js` /
  `package.json` / `app.json` 三处版本一并提交
- **check:css / check:version 进门禁清单**：`npm run check:css`（`.pv-*` 选择器镜像一致性）与
  `npm run check:version`（三处版本号一致）与 lint、test-layout、test-render 并列，改渲染 / 改版本前后必须跑
  （release.mjs 侧强制的是「工作区干净」，两个 check 靠主动跑，勿省）

## 九、已知遗留 / 待办

- 矩阵审计中仍有 **30 个「次要文字 <5.5px」**的组合（364 组合实测「次要注意 30」，多为 48px 小块），属「是否允许该组合」的产品决策，未收紧。
- 英文日期未做分段（仍用本地化整串），中文已按 `.pv-seg` 处理。
- `_showHint` 尚未支持「撤销」动作参数。
- 卡片级置中在主页是全局、部件配置是部件级，两处口径已并存但未合并。
