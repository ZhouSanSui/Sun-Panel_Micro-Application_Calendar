# v1.31 交互与体验规范（Phase 2）

> 范围：需求 1（两级置中优先级模型）、需求 2（月历「单行显示」显示条件）、需求 5（删除确认栏改悬浮）。
> 本文档只产出规范与伪代码，**不改任何代码文件**。落地由 Phase 3（前端）执行。
> 运行环境约束：SunPanel 微应用（iframe / 容器），屏幕小、纯触摸操作；不引入新依赖。

**修订记录**
- v1.0：初稿。
- v1.5：`.chip-span.bad` 候选表补 1′（`#C1121F` 6.22）与红底对比度梯度，供产品挑选；v1.31 实施范围不变。
- v1.4：`.chip-span.bad` follow-up 候选表补齐（方案 1 / 2 / 2′），并写死两条实现禁令：文字不得用 `var(--apple-label)`（深色是白色 → 退回 3.55）、底色不得换成 `var(--apple-red)`（深色 #FF453A → 3.41 更差）。
- v1.3：`.chip-span` 由 follow-up **收进 v1.31 范围**（D14，浅 3.13 / 深 2.70 两端不达标）；`.chip-span.bad`（3.55:1）与 `.chip-grip`（已达标，不动）单列说明。
- v1.2：角标改为 `--apple-label` 字 + `--apple-fill` 底（原 `--apple-label-2` 深色仅 4.43:1）；热区补 `row-gap: 8px`（原 6px 会重叠 2px）；`_revealArmedRow` 的 `behavior` 在 reduced-motion 下降级为 `auto`。
- v1.1：并入 design-architect 评审（视觉数值以 `docs/v131-visual-spec.md` 附录 B 为单一来源）：接管态改用 `label-3` 而非 `opacity`、补「接管优先于默认」角标互斥规则、深色遮罩分层、`.fs-nav` z-index 150、reduced-motion 只关容器并放开按钮点击、补白 84→92px、新增 `_revealArmedRow`、触摸目标口径改为「36px 视觉 + 44px 热区」、`prefSpan` 回退加显式守卫 + 关单行提示。

代码基线（行号随 v1.30 代码）：

| 位置 | 内容 |
|---|---|
| `src/core/user-store.js:189-204` | `CARD_GRID` / `gridForSize`（`1xfull` = 8 列 × 2 行） |
| `src/core/user-store.js:275-312` | `isFullCard` / `unitAlign` / `unitOpts` |
| `src/core/user-store.js:319-374` | `groupByAxis`（并查集）/ `applyAlignment`（单元级置中） |
| `src/core/user-store.js:539-565` | `layoutBlocks`（先 `applyAlignment` 再叠加卡片级置中） |
| `src/components/widgetConfig.js:429-457` | `_toggleCardCenter` / `_toggleSpanAlign` / `_toggleSpanSingleLine` |
| `src/components/widgetConfig.js:642-668` | `_renderSpanEditor`（传 `align`/`isFull`/`singleLine`） |
| `src/components/widgetConfig.js:622-637` | `.chip-tools`（预览栏的卡片级置中开关） |
| `src/components/mainPage.js:1516-1547` | 主页面同名的三个开关 |
| `src/components/mainPage.js:1875-1890` | 主页面 `.chip-tools` |
| `src/components/mainPage.js:2252-2315` | `_renderScheduleMgr`（含 `.mgr-confirm` 确认栏） |
| `src/core/card-mode-render.js:531-603` | `renderSpanEditor`（置中按钮 + 单行显示按钮） |
| `src/components/widget.js:77-80 / 214-228` | `1xfull` 运行时列数 `_fullCols = clamp(round((hostW-24)/90), 4, 10)` |
| `src/components/mainPage.js:2939-2953` | `.fullscreen` = `position:absolute; inset:0; z-index:120` |
| `src/components/mainPage.js:3305-3325` | `.toast` = `position:absolute; bottom:28px; z-index:200`（既有浮层先例） |
| `src/core/apple-ui.js:315-338` | `.apple-sheet-mask` = `position:absolute; inset:0; z-index:100`（既有遮罩先例） |

---

## 1. 需求 1：两级置中（预览栏 卡片级 > 占格编辑器 单元级）

用户原话：「水平、垂直置中的方案麻烦再梳理一下，感觉不灵敏。**预览中的控制权限高于实例调整占格中的权限**。」

术语约定（后续统一使用）：

- **卡片级置中**（card-level）：`cardCenterH` / `cardCenterV`，开关在**预览下方的 chip 工具栏**（`.chip-tools`）。
- **单元级置中**（unit-level）：`block.align = {h, v}`，开关在**占格编辑器**（`renderSpanEditor` 的 `.se-toggles`）。
- **轴**（axis）：水平 = 列方向偏移（`pos.col`），垂直 = 行方向偏移（`pos.row`）。**两轴独立治理**是本模型的核心。

### 1.1 根因诊断

对候选假设逐条核对（结论：4 条候选**全部成立**，另补 2 条代码缺陷）。

#### R1（主因 · 确认）两级置中叠加 → 偏移翻倍 / 贴边

`layoutBlocks`（user-store.js:545-562）**无条件**先跑 `applyAlignment`（单元级），再跑卡片级置中，**同一轴上的偏移被相加**：

```
// 1×FULL（grid 8×2），单个月历单元 span 6×2，落在 (0,0)
applyAlignment : dx = floor((8-6)/2) = 1  → col = 1，区间 [1,7)
cardCenter.h   : bbox 仍是 6 宽 → dx = floor((8-6)/2) = 1  → col = 2，区间 [2,8)
结果：左留白 2、右留白 0 → 内容贴右，用户感知「开了反而跑偏」
```

span 4×2 时更夸张（dx=2 再 +2 → `[4,8)` 完全贴右）。同理 2×2（4×4 网格）垂直方向：单元 dy=1 再 +1 → 下移两格。
**结论：卡片级与单元级在同一轴上必须互斥，否则必然「过冲」。**

#### R2（确认）1×FULL 下 `unitAlign` 默认全 true，开关方向与直觉相反

`unitAlign`（user-store.js:291-298）：未显式设置时，`isFullCard(size)` 为真则 `h = v = true`。
因此在 1×FULL 中：

- 单元级按钮**默认就是「开」**，用户点「开」= 无变化（本来已居中）→ 「不灵敏」；
- 用户点「关」→ `every()`（:349）不成立 → **整行一起弹回左侧**，而不是「只让这个单元靠左」→ 结果与预期相反；
- 且此默认与应用了 `applyAlignment` 的卡片级置中叠加（见 R1）。

#### R3（确认 · 影响极大）预览网格与运行时网格不一致，导致「预览有效、卡片无效」

- 配置页/主页面预览用 `gridForSize('1xfull')` = **固定 8 列**；
- 运行时 `widget.js:214-217` 用 `_fullCols = clamp(round((hostW-24)/90), 4, 10)`，**取值 4~10**。

span 以「格数」存储（如月历默认 6），于是：

| 环境 | 网格列数 | 6 格占比 | dx |
|---|---|---|---|
| 预览 | 8 | 75% | 1（可见） |
| 实际卡片（`_fullCols=6`） | 6 | 100% | 0（**完全无反应**） |
| 实际卡片（`_fullCols=10`） | 10 | 60% | 2（偏移更大） |

**这是「不灵敏」最可能的真实体感来源**：预览里看着动了，卡片上没动。
本迭代的处置见 §1.9 风险 R3（建议登记为 follow-up，最小修复是把预览的 1×FULL 列数也做成可感知/或把 span 存为比例）。

#### R4（确认）组内 bbox 已接近/等于网格 → dx≈0，且代码**静默**跳过

user-store.js:356-357：`if (dx <= 0) continue;` —— 数学上正确，但用户点按钮后**完全没有反馈**，感知为「点了没用」。
1×FULL 尤其常见：所有单元共享同一行带（rows=2）→ 并查集把它们并成**一个组** → bbox 往往就是整行 → dx=0。
**处置：保留数学行为，但必须补反馈**（§1.5）。

#### R5（确认 · 缺陷）偏移量未夹紧，可把单元推出网格

`dx = floor((grid.cols - (c1-c0)) / 2)` 只在 `c0 = 0` 时安全。当组内 bbox 的 `c0 > 0` 且 `c1 < cols` 时会越界：
例：4 列网格中某行带 bbox `[2,4)`（宽 2）→ `dx = 1` → 右边界变 5 → 渲染 `left:75%;width:50%` → 单元一半在卡片外（视觉「消失」）。
**处置：新算法必须夹紧**（§1.4 伪代码 `clamp`）。

#### R6（确认）「组内全部标记才居中」过严

user-store.js:349 / 362 的 `idxs.every(...)`：

- 非 1×FULL 尺寸（默认 false）：用户给一个单元点「开」，同组其他单元仍是 false → 不居中 → **点了没反应**；
- 1×FULL：全 true 时已居中，点「关」→ 整组失去居中 → 反应方向相反。

#### 结论汇总

| 假设 | 结论 |
|---|---|
| 卡片级与单元级叠加 → 开了没效果 / 偏移过头 | ✅ 成立（R1，主因） |
| 1×FULL 默认全 true → 关掉一个，同行仍居中 → 混乱 | ✅ 成立（R2） |
| 「组内全部标记才居中」过严 → 点了没反应 | ✅ 成立（R6，且与 R2 叠加） |
| 组内宽度接近 grid → dx≈0 → 感知没反应 | ✅ 成立（R4，需补反馈而非改数学） |
| 补充：预览/运行时网格不一致 | ✅ 新增（R3） |
| 补充：偏移未夹紧 → 单元被推出卡片 | ✅ 新增（R5，缺陷） |

### 1.2 决策：优先级模型 —— **逐轴接管（per-axis override），忽略而非改写**

> 用户要求：「预览栏的卡片级置中 > 占格编辑器里的单元级置中」。

**决策 D1（推荐）：每个轴独立决定治理者；卡片级开 → 该轴由卡片级独占，单元级在该轴上被「忽略（override）」。**

```js
governor = {
  h: cardCenter.h ? 'card' : 'unit',
  v: cardCenter.v ? 'card' : 'unit',
}
```

逐轴组合示例：

| cardCenterH | cardCenterV | 水平由谁决定 | 垂直由谁决定 |
|---|---|---|---|
| 0 | 0 | 单元级 | 单元级 |
| 1 | 0 | **卡片级** | 单元级（仍可用） |
| 0 | 1 | 单元级（仍可用） | **卡片级** |
| 1 | 1 | **卡片级** | **卡片级** |

**为什么选「忽略」而不是另外两个候选：**

| 候选 | 评价 |
|---|---|
| A. 忽略单元级（override，不写数据） | ✅ **推荐**。可逆（关掉卡片级立刻恢复单元级效果）、不破坏用户数据、允许「卡片级管水平 + 单元级管垂直」的混合用法、实现只需在 `applyAlignment` 前按轴 gate 一次。 |
| B. 把单元级全部置为 true | ❌ 否决。会写用户数据；关掉卡片级后无法还原原来的单元设置（不可逆）；且「全 true」在 R6 语义下等价于整组居中，失去单元级差异。 |
| C. 单元级只允许「取消」 | ❌ 否决。语义最难解释（「取消」是取消单元级还是取消卡片级？），且与用户「预览栏权限更高」的表述不一致。 |

**D2：与「1×FULL 默认开启单元级置中」是否冲突？——不冲突，且是本模型的直接收益。**
二者之所以冲突，是因为当前代码把它们**相加**；改成分轴互斥后：

- 卡片级 H 关：1×FULL 单元级默认 true → 行为与 v1.30 一致（存量用户视觉不变）；
- 卡片级 H 开：单元级 H（含 1×FULL 的默认 true）在该轴被完全忽略 → 不再叠加、不再过冲；
- 不需要改 `unitAlign` 的默认值，也不需要迁移数据。

**D3：不要在 1×FULL 新建卡片时默认打开 `cardCenterH`。**
1×FULL 的单元级默认已经是 true（视觉已居中），再默认打开卡片级只会让用户一进设置就「失去单元级控制权」，加剧困惑。保持 `cardCenterH/V` 默认 `false`（现状，user-store.js:22-23）。

### 1.3 决策：卡片级关闭时，单元级如何更「灵敏」

**决策 D4：把组内判定条件从 `every`（全部）放宽为 `some`（任一）。**

```js
// 旧：idxs.every(i => unitAlign(...)[axis])
// 新：idxs.some(i => unitAlign(...)[axis])
```

理由：

1. 单元级置中在几何上**只能作用于整组**（一个单元的 span 就是它的盒子，在自身盒子内居中是恒等操作），所以它本质是「让本单元所在的**行带/列带**居中」——「至少一个成员要求居中」是最贴近的自然语义；
2. `false` 在非 1×FULL 尺寸下来自默认，语义是「**未要求**」而非「**必须靠左**」，因此它不该拥有一票否决权；
3. `every` 导致最常见的失败路径（用户第一次点「开」）静默无反应，这是「不灵敏」的直接来源。

**边界情况（同组两个单元意见不一致）规范：**

| 场景 | 行为 | 用户可见反馈 |
|---|---|---|
| 同组 A=true、B=false | 整组居中（`true` 胜） | 提示「已与同行 1 个单元一起居中」（`CARD_ALIGN_GROUP_H`） |
| 同组 A=false、B=false（默认） | 不居中 | — |
| 用户把 B 从 false 点成 true | 整组居中（立刻可见） | 同上 |
| 用户把 A 从 true 点成 false，B 仍 true | **仍居中**（B 还在要求） | 提示同上，明确告诉用户「因为同行还有单元要求居中」 |
| 用户希望「某个单元靠左、另一个居中」 | 不支持（几何上同一行带只能整体居中） | 提示引导：用「空白填充」占位，或把该单元改到别的行/列再单独居中 |

> 说明：把语义从「本单元居中」改为「本单元所在行带/列带居中」必须在 UI 上讲清楚（§1.5 的副标题文案 + 分组提示），否则会出现新的误解。

**决策 D5：所有偏移必须夹紧，禁止把单元推出网格。**

```js
dx = Math.min(Math.max(dx, -c0), grid.cols - c1);   // 保证 0 ≤ c0+dx 且 c1+dx ≤ cols
```

**决策 D6：`dx === 0`（无空间）时必须给反馈，不能静默。**
在 widgetConfig / mainPage 的开关处比较「切换前后的布局指纹」，若完全一致则弹一次 2.4s 提示（复用既有 `_showHint` / `_showCardCfgHint`），文案见 §1.6。

### 1.4 计算顺序与伪代码（新）

```js
// ---------- 新增/调整的核心函数（user-store.js） ----------

/** 逐轴治理者：卡片级开启即接管该轴 */
export function alignGovernor(cardCenter) {
  return {
    h: cardCenter && cardCenter.h ? 'card' : 'unit',
    v: cardCenter && cardCenter.v ? 'card' : 'unit',
  };
}

/** 单元是否「显式」设置过置中（用于 UI 区分「默认」与「用户设置」） */
export function unitAlignExplicit(b) {
  return b && b.align && typeof b.align === 'object' ? { h: !!b.align.h, v: !!b.align.v } : null;
}

/**
 * 单元级置中（只在未被卡片级接管的轴上执行）。
 * @param {object} opts {h,v} 该轴是否由单元级治理；mode:'any'；clamp:true
 * @returns {{ layout, report }} report 用于 UI 反馈：
 *   { skipped:{h:boolean,v:boolean}, noRoom:{h,v}, groupSize:{h,v}, clamped:{h,v} }
 */
export function applyAlignmentWithReport(layout, displayMode, size, grid, opts = {}) {
  const govH = opts.h !== false;                 // 默认开启（向后兼容旧签名）
  const govV = opts.v !== false;
  const out = layout.map((b) => ({ ...b, pos: { col: b.pos.col, row: b.pos.row } }));
  const report = {
    skipped: { h: !govH, v: !govV }, noRoom: { h: false, v: false },
    groupSize: { h: 0, v: 0 }, clamped: { h: false, v: false },
  };

  // ---- 水平：共享「行带」的组 ----
  if (govH) {
    for (const idxs of groupByAxis(layout, 'row')) {
      if (!idxs.some((i) => unitAlign(displayMode, size, layout[i]).h)) continue;   // D4: any
      report.groupSize.h = Math.max(report.groupSize.h, idxs.length);
      let c0 = Infinity; let c1 = 0;
      for (const i of idxs) {
        c0 = Math.min(c0, layout[i].pos.col);
        c1 = Math.max(c1, layout[i].pos.col + layout[i].span.cols);
      }
      let dx = Math.floor((grid.cols - (c1 - c0)) / 2);
      dx = Math.min(Math.max(dx, -c0), grid.cols - c1);      // D5: clamp，永不越界
      if (dx !== Math.floor((grid.cols - (c1 - c0)) / 2)) report.clamped.h = true;
      if (dx === 0) { report.noRoom.h = true; continue; }     // D6: 反馈而非静默
      for (const i of idxs) out[i].pos.col = layout[i].pos.col + dx;
    }
  }
  // ---- 垂直：共享「列带」的组（同理，按 grid.rows / pos.row） ----
  if (govV) { /* …对称实现… */ }
  return { layout: out, report };
}

/** 向后兼容包装：仅返回 layout */
export function applyAlignment(layout, displayMode, size, grid) {
  return applyAlignmentWithReport(layout, displayMode, size, grid).layout;
}

/** 卡片级置中（从 layoutBlocks 抽出，便于单测）；只做被接管的轴 */
export function applyCardCenter(layout, grid, on) {
  if (!on || (!on.h && !on.v) || !layout.length) return layout;
  let c0 = Infinity; let c1 = 0; let r0 = Infinity; let r1 = 0;
  for (const b of layout) {
    c0 = Math.min(c0, b.pos.col); c1 = Math.max(c1, b.pos.col + b.span.cols);
    r0 = Math.min(r0, b.pos.row); r1 = Math.max(r1, b.pos.row + b.span.rows);
  }
  let dx = on.h ? Math.floor((grid.cols - (c1 - c0)) / 2) : 0;
  let dy = on.v ? Math.floor((grid.rows - (r1 - r0)) / 2) : 0;
  dx = Math.min(Math.max(dx, -c0), grid.cols - c1);
  dy = Math.min(Math.max(dy, -r0), grid.rows - r1);
  if (!dx && !dy) return layout;
  return layout.map((b) => ({ ...b, pos: { col: b.pos.col + dx, row: b.pos.row + dy } }));
}

/** 布局指纹：用于「点了没反应」检测 */
export function layoutSignature(laid) {
  return (laid || []).map((b) => `${b.pos.col},${b.pos.row},${b.span.cols},${b.span.rows}`).join('|');
}

/** 渲染入口（新顺序） */
export function layoutBlocks(list, displayMode, size, gridOverride, cardCenter) {
  if (displayMode === 'single' || !Array.isArray(list) || !list.length) return list || [];
  const grid = gridOverride || gridForSize(size);
  const base = autoLayout(list, displayMode, size, grid)
    .map((b) => (singleLineOn(displayMode, size, b) ? { ...b, opts: { singleLine: true } } : b)); // 见需求 2
  const gov = alignGovernor(cardCenter);
  // ① 单元级：仅在未被接管的轴上（互斥，不再叠加）
  const { layout: aligned } = applyAlignmentWithReport(base, displayMode, size, grid, {
    h: gov.h === 'unit',
    v: gov.v === 'unit',
  });
  // ② 卡片级：仅在接管的轴上，整体 bbox 居中
  return applyCardCenter(aligned, grid, { h: gov.h === 'card', v: gov.v === 'card' });
}
```

调用方（widgetConfig / mainPage）的开关伪代码：

```js
_toggleAlignWithFeedback(axis) {
  const gov = alignGovernor(this._cardCenter);
  if (gov[axis] === 'card') {                       // 被接管 → 软禁用 + 说明
    this._showHint(this._t('t',
      axis === 'h' ? '卡片级水平置中已开启，单元级水平置中由预览栏接管'
                   : '卡片级垂直置中已开启，单元级垂直置中由预览栏接管',
      axis === 'h' ? 'Card-level H centering is on — per-unit H centering is handled by the preview bar'
                   : 'Card-level V centering is on — per-unit V centering is handled by the preview bar'));
    return;                                          // 不写数据
  }
  const before = layoutSignature(this._laidBlocks());
  this._toggleSpanAlign(axis);                       // 原有写入逻辑
  const after  = layoutSignature(this._laidBlocks());
  if (before === after) {
    // 无视觉变化 → 说明原因（行/列已占满）
    this._showHint(this._t('t', axis === 'h' ? CARD_ALIGN_NO_ROOM_H_ZH : CARD_ALIGN_NO_ROOM_V_ZH, …));
  } else if (groupSize > 1) {
    this._showHint(/* CARD_ALIGN_GROUP_H / _V，带 {count} */);
  }
}
```

### 1.5 UI 反馈规范（让用户理解「卡片级覆盖单元级」）

**决策 D7：软禁用（soft-disable），不用原生 `disabled`。**

| 位置 | 卡片级该轴 OFF | 卡片级该轴 ON |
|---|---|---|
| chip 工具栏「水平置中」 | 常态按钮 | 高亮（`.on`）+ `title/aria-describedby` = `CARD_CENTER_TAKEOVER_NOTE` |
| 占格编辑器「水平置中」 | 常态开关；未显式设置时加「默认」角标（`CARD_ALIGN_DEFAULT_TAG`） | `class="locked"` + `aria-disabled="true"`（**保留可点击**）→ 点击弹提示 `CARD_ALIGN_LOCKED_H`，提示内提供行动「改为单元级控制」（`CARD_ALIGN_UNLOCK`，点了就关掉 `cardCenterH` 并顺带执行本次点击意图） |

为什么不是真 `disabled`：真禁用是死胡同（用户点了没反应，又不知道去哪改），违反「状态可见 + 帮助用户识别/恢复错误」两条启发式。软禁用保留点击 → 给出原因 + 一键解锁。

#### `.se-toggle` 四态视觉数值（与 design-architect 附录 B 对齐，单一来源）

| 态 | 边框 | 背景 | 文字 | 角标 |
|---|---|---|---|---|
| 关 / 默认关 | `1.5px solid var(--apple-separator)` | transparent | `--apple-label-2` | 无 |
| 开 | `1.5px solid ${theme}` | `${theme}1A` | `${theme}` | 无（可选前置 9×9 ✓，`aria-hidden`） |
| 默认（`b.align` 未显式设置） | 同「关」 | transparent | `--apple-label-2` | 「默认」：`10px/700`、**字 `var(--apple-label)`、底 `var(--apple-fill)`**、`radius 5px`、`padding 1px 5px`，置于文字右侧 |
| 接管 | `1.5px dashed var(--apple-separator)` | transparent | `--apple-label-3` | 「接管」（同上规格）+ 12×12 锁 svg（`aria-hidden="true"`） |

- **不用整体 `opacity` 做灰显**：`opacity:.45` 实测仅 2.40:1，`.60` 才 3.44:1，且叠加计算不可控。接管态文字/边框直接取 `var(--apple-label-3)`（浅 3.44:1 / 深 3.16:1）。

**对比度分档（两处口径不同，别混用）：**

| 元素 | 取色 | 浅 | 深 | 口径 |
|---|---|---|---|---|
| 接管态主文字 + 虚线边框 | `--apple-label-3` | 3.44 | 3.16 | ≥3:1 —— 该控件是 `aria-disabled` 的非活动组件，适用 WCAG 1.4.3「非活动界面组件」豁免 |
| 「接管」「默认」角标 | **字 `var(--apple-label)` + 底 `var(--apple-fill)`** | **16.53** | **10.78** | ≥4.5:1 —— 角标承载状态语义，**不豁免** |

- 角标必须**对自己的 `--apple-fill` 底**算对比度，不是对卡片底。实测三方案：`--apple-fill` + `--apple-label` = 16.53/10.78 ✅；transparent + `--apple-label-2` = 10.94/5.94 ✅（更安静的备选）；**`--apple-fill` + `--apple-label-2` = 8.61/4.43 ❌ 深色差 0.07 未达标**；`--apple-fill` + `--apple-label-3` = 3.13 ❌。
- 采用「`--apple-fill` 底 + `--apple-label` 字」还有一个附加收益：接管态主文字是灰的（3.44/3.16），角标是清晰的（16.53/10.78），**视觉上正好表达「状态语义不能被灰掉」**。
- **互斥规则**：「默认」与「接管」是两个独立维度，1×FULL 上会同时命中（`b.align` 未显式设置 + 卡片级开启）。**接管态优先：接管时不再显示「默认」角标**——此时单元级设置本就无效，「默认」是纯噪音。
- `cursor: not-allowed`；**不加** `pointer-events: none`（要能点出提示）。
- 触摸目标见 §4（36px 视觉 + 44px 热区）。

**占格编辑器线框要点（`renderSpanEditor` 参数扩展）：**

```
┌ 调整占格 · 月日历                        ✕ ┐
│  [ 8×2 网格示意（点击拉伸） ]  垂直 − 2 +   │
│                                水平 − 6 +   │
│                                6×2 垂直×水平 │
├─ .se-toggles ───────────────────────────────┤
│  [水平置中 默认]  [垂直置中]  [单行显示]     │   ← 卡片级 H 开时：[水平置中 🔒接管] 虚线边 + label-3
├─ .se-hint（独立元素，不在 .se-toggles 内）──┤
│  按所在行/列整组居中                         │
├─ .se-actions ───────────────────────────────┤
│  [自适应]  [FULL]                            │
└─────────────────────────────────────────────┘
```

`.se-toggles` 布局约束（需求 2 隐藏「单行显示」后生效）：

1. **保持左对齐**，不改 `space-between` / `center`——否则 1×FULL 出现第三个按钮时整行跳动；
2. `margin-top: 10px` 固定，不随子元素数量变化；
3. **不加占位元素**（隐藏即消失，不留空位）。

副标题 `alignHint` 用独立元素放在 `.se-toggles` **之外**：

```css
.se-hint { font-size:11px; font-weight:500; color:var(--apple-label-3); line-height:1.35; margin-top:6px; }
```

### 1.6 需求 1 需要的字段与方法名

| 类型 | 名称 | 说明 |
|---|---|---|
| 新增导出 | `alignGovernor(cardCenter)` | 返回 `{h:'card'\|'unit', v:'card'\|'unit'}` |
| 新增导出 | `applyAlignmentWithReport(...)` | 带 `report` 的单元级置中 |
| 新增导出 | `applyCardCenter(layout, grid, on)` | 卡片级居中（抽出） |
| 新增导出 | `layoutSignature(laid)` | 变化检测 |
| 新增导出 | `unitAlignExplicit(b)` | `b.align` 原样（可为 null） |
| 保留 | `unitAlign` / `applyAlignment` / `isFullCard` / `normalizeAlign` | 语义不变，`applyAlignment` 内部改为 `some` + clamp |
| 修改 | `layoutBlocks` | 按 §1.4 新顺序 |
| 组件方法 | `_toggleAlignWithFeedback(axis)`（widgetConfig / mainPage 各一份） | 取代直接调用 `_toggleSpanAlign` |
| 组件方法 | `_unlockCardCenter(axis)` | 「改为单元级控制」：关 `cardCenter[axis]` 并立即应用本次单元级意图 |
| 传给 `renderSpanEditor` | `alignLocked: {h,v}`、`alignDefault: {h,v}`、`onUnlock(axis)` | 新增参数；`align`、`singleLine` 保持 |
| 传给 `renderSpanEditor` | `alignHint`（副标题文案） | 「按所在行/列整组居中」 |

### 1.7 需求 1 新文案

命名遵循现有 `CARD_*` / `MAIN_MGR_*` 风格。占格编辑器现有文案是内联 `isZh ? '…' : '…'`，新文案**建议登记进 `locales/zh-CN.js` / `en-US.js` 的 `CARD_*` 段**（与 `CARD_MODE_NOTE` 同段），组件内用 `this.t('CARD_…')`；若前端为赶工走内联 `_t('t', zh, en)`，key 名仍按此表保留，便于后续回收。

| key | zh-CN | en-US |
|---|---|---|
| `CARD_ALIGN_LOCKED_H` | 卡片级水平置中已开启，单元级水平置中由预览栏接管 | Card-level H centering is on — per-unit H centering is handled by the preview bar |
| `CARD_ALIGN_LOCKED_V` | 卡片级垂直置中已开启，单元级垂直置中由预览栏接管 | Card-level V centering is on — per-unit V centering is handled by the preview bar |
| `CARD_ALIGN_UNLOCK` | 改为单元级控制 | Use per-unit control |
| `CARD_ALIGN_NO_ROOM_H` | 此行已占满，水平置中无可用空间 | This row is full — no room to center horizontally |
| `CARD_ALIGN_NO_ROOM_V` | 此列已占满，垂直置中无可用空间 | This column is full — no room to center vertically |
| `CARD_ALIGN_GROUP_H` | 已与同行 {count} 个单元一起居中 | Centered with {count} unit(s) in the same row |
| `CARD_ALIGN_GROUP_V` | 已与同列 {count} 个单元一起居中 | Centered with {count} unit(s) in the same column |
| `CARD_ALIGN_DEFAULT_TAG` | 默认 | Default |
| `CARD_ALIGN_UNIT_HINT` | 按所在行/列整组居中 | Centers the whole row/column band |
| `CARD_CENTER_TAKEOVER_NOTE` | 开启后接管占格编辑器中的单元级置中 | When on, it overrides per-unit centering in the resize editor |

### 1.8 需求 1 验收清单（供 Phase 3 自检脚本）

1. `layoutBlocks(..., cardCenter={h:true,v:false})` 结果中，任一单元的**总水平偏移 ≤ `floor((cols - bboxW)/2)`**（杜绝 R1 翻倍）。
2. 任何布局输出满足 `0 ≤ b.pos.col` 且 `b.pos.col + b.span.cols ≤ grid.cols`（行同理）——覆盖 R5。
3. 单元级：组内任一 `align.h === true` 即整组居中（覆盖 R6）；组内全 false 则不居中。
4. 卡片级 H 开启时，修改任一单元 `align.h` **不改变渲染结果**（覆盖 R2）。
5. 关闭卡片级后，单元级设置**原样恢复**（数据未被改写）。
6. 单元级切换导致 `layoutSignature` 不变时，一定出现一次提示（覆盖 R4）。

### 1.9 遗留风险（本迭代不修，需登记）

- **R3 预览/运行时网格不一致**：1×FULL 预览列数常量 8，运行时 `_fullCols ∈ [4,10]`，而 span 以绝对格数存储 → 预览与实物不一致，是「不灵敏」的残余来源。建议 follow-up：① 预览栏 1×FULL 显示「实际列数按面板宽度计算」的说明；或 ② 把 1×FULL 的 span 存为「列数比例」并在两端各自换算。
- **`.chip-span.bad`（「溢出」态）不达标（白字 3.55:1）**：`mainPage.js:1958` / `widgetConfig.js:1132` 的 `.chip-span.bad { color:#fff; background:#FF3B30 }`，实测白字仅 **3.55:1**（9px 文本需 4.5:1）。**不在 v1.31 改**——改品牌红需产品确认。三个候选（实测值，`#FF3B30` 是硬编码、深浅同值，故与主题无关）：

  | # | 方案 | 浅 | 深 | 判定 |
  |---|---|---|---|---|
  | 1 | 底色改 `#D70015` + 白字 | 5.38 | 5.38 | ✅ **推荐**：一条规则同时满足深浅、不依赖变量、保留「白字红底」错误态惯例 |
  | 1′ | 底色改 `#C1121F` + 白字 | 6.22 | 6.22 | ✅ 备选：产品若嫌 `#D70015` 偏暗或余量不够，用这档（余量更大） |
  | 2 | 保留 `#FF3B30` + 文字硬编码 `#000` | 5.92 | 5.92 | ✅ 可行（绕开「改品牌红」的产品确认，但需确认深色下红底黑字观感） |
  | 2′ | 保留 `#FF3B30` + 文字 `#1C1C1E` | 4.80 | 4.80 | ✅ 可行但余量小（刚过 4.5） |
  | ❌ | 红字 + `--apple-fill` 底 | 2.79 | 3.05 | **已作废**：比现状更差，红字不能用在灰底上 |
  | ⚠️ | 文字写 `var(--apple-label)` | 5.92 | **3.55** | **陷阱**：`--apple-label` 深色下是**白色**，会退回现状，等于没改 |

  **两条实现禁令（写死，否则改了等于没改）：**
  1. 走方案 2 / 2′ 时，文字颜色**必须硬编码近黑**（`#000` 或 `#1C1C1E`），**绝不能写 `var(--apple-label)`**——后者深色模式是白色，对比度退回 3.55。
  2. **不要把硬编码的 `#FF3B30` 换成 `var(--apple-red)`**：`--apple-red` 深色下是 `#FF453A`，白字在上面只有 **3.41:1**，比现状更差。若要换变量，必须同步确认该变量在深色下的取值。

  附：白字在红底上的对比度梯度（供产品挑选时参考）——`#FF3B30` 3.55 ❌ → `#FF453A` 3.41 ❌ → `#D70015` 5.38 ✅ → `#C1121F` 6.22 ✅。**越往右余量越大，但都需产品确认"改品牌红"**。
- **已达标、不要动**：`.chip-grip`（⣿ 拖拽手柄，`--apple-label-3`）属非文本图形，适用 WCAG 1.4.11 的 ≥3:1，现状浅 3.44 / 深 3.16 **已达标**。
- **`cardCenterH/V` 在 mainPage 是全局设置**（`_setSetting`，非按尺寸），而 widgetConfig 是每部件配置。同一开关跨尺寸生效，可能与用户「我只想把 1×FULL 居中」的预期不符。本迭代不动，登记。

---

## 2. 需求 2：月历「单行显示」按钮只在 1×FULL 显示

用户原话：「月日历中单行显示按钮只在 2×FULL 卡片中显示，其他卡片中的月日历不显示单行显示按钮。」
（用户口中的「2×FULL」= 尺寸 key `'1xfull'`，即 1 行高 × 横向占满的宽扁条。）

### 2.1 现状与根因

- `widgetConfig.js:655` / `mainPage.js:1375`：`singleLine: isMonth ? unitOpts(...).singleLine : null` —— **只要内容是月日历就传布尔值**，与尺寸无关；
- `card-mode-render.js:592`：`singleLine === null || undefined ? '' : toggle(...)` —— 收到布尔值就渲染按钮 → **所有尺寸的月日历都显示该按钮**；
- `unitOpts`（user-store.js:307-312）：`isMonth && isFullCard(size)` 为真时默认 `true`，否则默认 `false`；但**已显式存储的 `opts.singleLine = true` 在任何尺寸都会被原样返回**，进而在 `layoutBlocks`（:544）里生效。

### 2.2 决策

**D8：显示条件 = `isMonth && isFullCard(size)`（即 `size === '1xfull'`）。**
（按钮隐藏后的 `.se-toggles` 布局约束：保持左对齐、`margin-top` 固定、不加占位元素，详见 §1.5。）

```js
// widgetConfig._renderSpanEditor / mainPage._renderCardSpanEditor
const isMonth = info.b.c === 'calendar' && info.b.s === 'month';
singleLine: (isMonth && isFullCard(info.size)) ? unitOpts(mode, info.size, info.b).singleLine : null,
```
`renderSpanEditor` 的渲染判断（`null/undefined` 才隐藏）保持不变，无需改 `card-mode-render.js`。

**D9：数据兼容 —— 保留 `opts.singleLine`，但只在 1×FULL 生效（不生效 ≠ 清零）。**

新增判定函数，渲染路径一律走它：

```js
/** 月历「单行显示」是否真正生效：仅 1×FULL */
export function singleLineOn(displayMode, size, b) {
  return isFullCard(size) && !!unitOpts(displayMode, size, b).singleLine;
}
```
`layoutBlocks` 把 `unitOpts(...).singleLine` 换成 `singleLineOn(...)`；`_toggleSpanSingleLine` / `_toggleCardSpanSingleLine` 仍用 `unitOpts`（按钮只在 1×FULL 出现，读写一致）。

理由：

1. **可逆**：用户从 1×FULL 切到 2×2 再切回来，偏好自动恢复（见 D10）；清零会静默丢弃用户设置。
2. **与既有策略一致**：`span` 覆盖在换尺寸时也是「保留 + 按网格收窄」而非清除（`autoLayout` user-store.js:446-448），单行显示沿用同一哲学，认知负担最低。
3. **不在渲染期写数据**：清零需要在 `sanitize/layout` 阶段回写 store，属副作用渲染，容易触发无限更新与持久化抖动。

**D10：切走 / 切回的行为**

| 操作 | 行为 |
|---|---|
| 1×FULL（单行=true）→ 改成 2×2 | 按钮隐藏，`singleLine` 保留但不生效；**若该单元是显式设置的 true**，弹一次轻量提示 `CARD_SINGLELINE_PAUSED`（2.4s，复用 `_showCardCfgHint` / `_showHint`）。默认（未显式设置）的不提示，避免噪音。 |
| 2×2 → 切回 1×FULL | 按钮重新出现，若曾显式设为 true 则**自动恢复为开**；无需提示。 |
| 非 1×FULL 下改卡片尺寸（2×2 → 4×4） | 无提示（按钮本就不在） |

**D11：不做阻断式确认弹窗。** 尺寸切换是高频操作，任何 modal 都会打断配置流；用一次性 hint 足够。

### 2.3 1×FULL 关闭单行后的占格（`prefSpan` 回退）

`prefSpan`（user-store.js:219-225）对 1×FULL 的月日历固定给 `cols = min(6, 2+4) = 6`，与 `singleLine` 无关。design-architect 已核算（1×FULL `cellW=105, cellH=48`，`month` fit `{w:6.8,h:7.0}`）：

| 占格 | 块像素 | u | 日格字号 | 日格物理宽 |
|---|---|---|---|---|
| 6×2（现状） | 630×96 | 13.02 | **7.32px** | ≈90px（宽扁） |
| 2×2（回退） | 210×96 | 13.02 | **7.32px** | ≈30px（近正方） |
| 8×2 | 840×96 | 13.02 | 7.32px | ≈120px |

**结论：`u` 被块高 96px 锁死，字号与占格宽度无关**——1×FULL 只有 2 行高，非单行月历的日格字号恒为 7.32px，这是尺寸限制而非 `prefSpan` 缺陷。回退到 2×2 **不提升字号**，但日格从 90px 宽的扁矩形变为 30px 近正方，留白更少、观感更好。

**决策 D13：两件事一起做，缺一不可。**

1. `prefSpan` 在 1×FULL 月历且 **`opts.singleLine === false`（必须显式设置，默认值不算）** 时回退样式声明值 `2×2`。加此守卫是为了不动存量用户（1×FULL 默认 `singleLine = true`，仍走 6×2）。
2. 用户在 1×FULL **手动关闭**单行时，用 D6 的 `_showHint` 给一次 2.4s 提示：告知「1×FULL 高度有限，非单行月历字号较小」。

仅做 hint 不做回退 → 用户看到 90px 宽的扁日格仍会觉得难看；仅做回退不做 hint → 用户不知道字号是尺寸所限，会以为是被改坏了。

### 2.4 需求 2 需要的字段与方法名

| 类型 | 名称 |
|---|---|
| 新增导出 | `singleLineOn(displayMode, size, b)` |
| 修改 | `layoutBlocks`（用 `singleLineOn`） |
| 修改 | `widgetConfig._renderSpanEditor` / `mainPage._renderCardSpanEditor`（`singleLine` 传参加 `isFullCard(size)`） |
| 保留 | `unitOpts` / `normalizeOpts` / `_toggleSpanSingleLine` / `_toggleCardSpanSingleLine` |

### 2.5 需求 2 新文案

| key | zh-CN | en-US |
|---|---|---|
| `CARD_SINGLELINE_ONLY_FULL` | 「单行显示」仅 1×FULL 卡片可用 | "One line" is only available on 1×FULL cards |
| `CARD_SINGLELINE_PAUSED` | 已切到 {size}：月日历「单行显示」暂不生效，切回 1×FULL 自动恢复 | Switched to {size}: "one line" is paused — it returns automatically on 1×FULL |

### 2.6 需求 2 验收清单

1. 尺寸 ∈ {1x1, 1x2, 2x1, 2x2, 2x4, 4x4} 且单元为 `calendar:month` 时，占格编辑器**不出现**「单行显示」按钮。
2. 尺寸 = `1xfull` 时出现，且状态与 `opts.singleLine` 一致（未设置时显示「开」）。
3. 在 1×FULL 设为 true 后改成 2×2：`renderBlocksHTML` 传入的 `opts` **不含** `singleLine`（即 `singleLineOn === false`），但 store 中 `opts.singleLine` 仍为 `true`。
4. 再切回 1×FULL：按钮恢复为「开」，预览立即单行。

---

## 3. 需求 5：删除确认栏改为悬浮栏

用户原话：「点击日程后方的 ×，在上方弹出的确定删除栏要作为悬浮栏显示出来，现在显示在所有日程的最上方，要滑动到最上方才可以看到。」

现状：`mainPage.js:2278-2284`，`.mgr-confirm` 渲染在 `.fs-body` 内、`.mgr-bar` 之下、`.mgr-list` 之上；`.fs-body` 是滚动容器（:2977-2981）→ 列表长时必须滚到顶部才可见。

### 3.1 三方案取舍

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| **A. 居中浮层（modal-like）** | 中断感最强、防误删最强、焦点唯一 | 小屏上几乎全屏遮挡，被删条目的上下文（标题/日期）被盖住；与本项目 Apple 轻量风格不符；需额外焦点陷阱 | 备选（留给将来「需输入确认」的强破坏操作） |
| **B. 顶部 sticky** | DOM 位置改动最小，`position:sticky; top:0` 一行即可 | 顶部远离拇指（小屏单手操作困难，误点率上升）；占用列表首屏；「悬浮」感弱，用户仍需在顶部找它；与用户「悬浮栏」的表述不完全一致 | 不推荐 |
| **C. 底部悬浮条** ✅ | 拇指热区、与既有 `.toast`（bottom, z-index 200）视觉层级一致；不遮挡列表中被删条目的上下文；可加轻遮罩支持「点空白取消」；滑入动画自然 | 悬浮条可能落在刚点过的 × 的**手指位置**上（有连击误删风险 → 用 §3.4 的入场延迟化解） | **推荐** |

**决策 D12：底部悬浮条 + 轻遮罩，单条删除与「删除所选」复用同一组件。**

### 3.2 结构要点（线框）

```
.fullscreen  (position:absolute; inset:0; z-index:120)
├─ .fs-nav                          （不变）
├─ .fs-body                         （滚动区；列表在此）
│   ├─ .mgr-bar                     （全选 / 计数 / 删除所选）
│   └─ .mgr-list                    （显示悬浮栏时 padding-bottom:84px）
├─ .mgr-scrim        ← 新增         （absolute; inset:0; z-index:130；点空白取消）
└─ .mgr-confirm      ← 从 .fs-body 移出，成为 .fullscreen 的直接子节点
    ├─ .cf-text   「确认删除日程「{title}」？此操作不可撤销。」
    ├─ .cf-btn.cancel   「取消」      （左，plain）
    └─ .cf-btn.danger   「确认删除」  （右，实心红，min-height 44px）
```

关键点：**`.mgr-confirm` 必须是 `.fullscreen` 的直接子节点、`.fs-body` 的兄弟**，而不是 `.fs-body` 的后代——这样才能脱离滚动容器。

### 3.3 定位方案：**务必不要用 `position: fixed`**

这是本需求最大的实现坑（微应用 ≠ 整页）。逐条理由：

1. **包含块会被祖先劫持**：`position: fixed` 的包含块是**最近的带 `transform` / `filter` / `backdrop-filter` / `will-change` / `contain:paint` / `perspective` 的祖先**。本项目卡片主题大量使用 `backdrop-filter: blur(18px)`（`cardThemeVisual`，user-store.js:644-646），SunPanel 宿主面板也可能带 `transform` 做缩放/动画 → 一旦命中，`fixed` 会相对那个祖先定位，位置完全错乱。
2. **iframe 语义**：即便运行在 iframe 内，`fixed` 相对的是 iframe 视口；宿主对 iframe 做缩放或外层滚动时（iOS Safari 已见漂移），悬浮栏会跟着飘，且可能盖到宿主 UI 上。
3. **越界不受控**：`fixed` 元素不受 `.root { overflow: hidden }` 裁剪，可能绘制到微应用容器之外，遮挡 SunPanel 自身界面，宿主也无法用 `z-index` 约束它。
4. **与既有实现不一致**：项目内所有浮层（`.toast`、`.apple-sheet-mask`）都用 `position: absolute`，无一处 `fixed`（已全局搜索确认）。保持一致，降低维护成本。

**推荐实现（纯 CSS，无新依赖）：**

```css
/* —— 层级：.fs-nav 150 > 悬浮条 140 > 遮罩 130 > .fs-body 内容 —— */
.fs-nav { position: relative; z-index: 150; }   /* 必须！否则遮罩吃掉返回/完成（见 3.3.1） */

.mgr-scrim {
  position: absolute; inset: 0; z-index: 130;
  background: rgba(0,0,0,0.22);          /* 浅色：叠 #F2F2F7 → #BDBDBD，压暗感明确 */
  animation: cf-fade .18s ease both;     /* 不加 backdrop-filter：小屏性能 + 避免包含块问题 */
}
/* 深色下背景是 #000000，纯黑遮罩对背景无效（叠任何 alpha 仍是 #000），需分项处理 */
.fullscreen.dark .mgr-scrim {
  background: rgba(0,0,0,0.55);
  box-shadow: inset 0 0 0 999px rgba(255,255,255,0.06);  /* 抬亮空白区，让"变暗"在空区域也可感知 */
}
.mgr-confirm {
  position: absolute;                     /* 相对 .fullscreen（已 position:absolute） */
  left: 12px; right: 12px;
  bottom: calc(12px + env(safe-area-inset-bottom, 0px));
  z-index: 140;                           /* 高于 .fs-body 内容，低于 .fs-nav(150) 与 .toast(200) */
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  background: var(--apple-card);
  border: 1px solid var(--apple-separator); /* 深色下 box-shadow 几乎不可见，靠边框"浮起来" */
  border-radius: 14px;
  padding: 12px 14px;
  box-shadow: 0 8px 28px rgba(0,0,0,0.28);
  animation: cf-in .22s cubic-bezier(0.32,0.72,0,1) both;
}
.fullscreen:not(.dark) .mgr-confirm { border-color: transparent; }  /* 浅色靠阴影即可，保持干净 */

.cf-text {
  flex: 1; min-width: 0;
  font-size: 12px; font-weight: 600; color: var(--apple-label);
  line-height: 1.35;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.cf-btn { border-radius: 10px; min-height: 44px; }   /* 10 = 容器 14 − 内距 4，同心 */
.cf-btn.cancel { min-width: 88px; }                   /* 复用 .mgr-btn 基础样式 */
.cf-btn.danger { border: 1.5px solid var(--apple-red); } /* 复用 .mgr-btn.danger.solid；补边框，否则比左键矮 3px */

@media (max-width: 320px) {
  .cf-text { flex: 1 1 100%; }   /* 文案独占首行，两个按钮各 flex:1 —— 无需决策堆叠顺序 */
  .cf-btn  { flex: 1; }
}
@keyframes cf-in  { from { transform: translateY(14px); opacity: 0 } to { transform: none; opacity: 1 } }
@keyframes cf-fade{ from { opacity: 0 } to { opacity: 1 } }

/* 防误触：入场 350ms 内按钮不接受点击（见 §3.4） */
.mgr-confirm .cf-btn { pointer-events: none; animation: cf-arm 0s linear .35s forwards }
@keyframes cf-arm { to { pointer-events: auto } }

/* reduced-motion：只关两个容器，且必须显式放开按钮点击（见 3.3.3） */
@media (prefers-reduced-motion: reduce) {
  .mgr-confirm, .mgr-scrim { animation: none; }
  .mgr-confirm .cf-btn { pointer-events: auto; }
}
```

#### 3.3.1 坑：遮罩不能吃掉导航栏（必须修）

`.fs-nav`（返回 / 完成）当前**没有 `position` 与 `z-index`**，而 `.mgr-scrim` 是 `inset:0; z-index:130` 的定位元素 → 遮罩会盖住导航栏，用户点「返回」先命中遮罩 → 变成「取消」而不是「关闭页面」，§3.4 里「返回 / 完成 关闭页面并复位 `_mgrConfirm`」这条取消路径直接失效。
**修法**：`.fs-nav { position:relative; z-index:150 }`（高于悬浮条 140）。导航栏既可用也不被压暗，语义也正确。

#### 3.3.2 坑：深色模式遮罩不可见（必须修）

深色 `--apple-bg` = `#000000`，黑色遮罩叠在任何 alpha 上仍是 `#000` → 若只用 `.22`（甚至 `.55`），**背景区完全没有变化**，用户察觉不到进入了「待确认」态。
**修法**：按 `dark` 给 `.fullscreen` 加 class（`mainPage.js:2262` 已调 `appleThemeVars(dark)`，同位追加即可），深色遮罩用 `rgba(0,0,0,.55)` + `inset 0 0 0 999px rgba(255,255,255,.06)`。实测深色下条目正文 `#FFF` 经 55% 黑遮罩后对比度仍有 4.43:1 —— **可读但明显变暗**，正是我们要的「压暗但保留上下文」；白色 inset 让列表之外的空白区也可感知（不用 `backdrop-filter`，规避 §3.3 的包含块问题）。浅色保持 `.22`。

#### 3.3.3 坑：`prefers-reduced-motion` 会让按钮永久点不动（必须修）

`cf-arm` 靠 `animation` 恢复 `pointer-events`。若 reduced-motion 的 `animation: none` 命中到 `.cf-btn`（写成 `.mgr-confirm *` 或全局），按钮**永远不可点**，破坏性操作直接卡死。
**修法**：reduced-motion 的关闭规则**只作用于 `.mgr-confirm` 与 `.mgr-scrim` 两个容器**，并在该分支显式补 `.mgr-confirm .cf-btn { pointer-events: auto }` 兜底。

**为什么这样能规避 fixed 的所有坑**：`.fullscreen` 是 `position:absolute; inset:0`，是明确的包含块；悬浮栏随全屏面板一起出现/消失，天然被 `.root { overflow:hidden }` 裁剪，永远不越出微应用；`.fs-body` 滚动时它不动。

### 3.4 交互规范

| 项 | 规范 |
|---|---|
| 遮罩 | **要**，但只用 22% 轻遮罩（保持列表可读，用户能再确认一次删的是哪几条）。点击遮罩 = 取消 |
| 点空白取消 | ✅ 遮罩点击取消；另：`.fs-nav` 的「返回」「完成」关闭页面时一并复位 `_mgrConfirm`；Esc 键取消（iframe 内仅在获得焦点时生效，属降级点，非唯一取消途径） |
| 确认/取消位置 | 左 = `取消`（`MAIN_MGR_CANCEL`，plain，`min-width:88px`）；右 = `确认删除`（`MAIN_MGR_CONFIRM_YES`，实心红 `var(--apple-red)`，`min-height:44px`）。遵循「破坏性动作在右、取消在左」的平台习惯 |
| **防误触（重要）** | 悬浮条从底部滑入时可能正好落在用户刚点过的 × 的指尖下 → 用 CSS `animation: cf-arm 0s linear .35s forwards` 在入场 350ms 内禁用按钮点击（纯 CSS，不依赖 `spCtx.api.timer`）。**reduced-motion 下必须显式放开**（§3.3.3） |
| 被删行可见性 | 单条 × 触发时给该行加 `.armed`（`box-shadow: inset 0 0 0 1.5px var(--apple-red)`，不用 border 以避免行高跳动）；**若该行不在视口内，悬浮条出现的同时把它滚到可视区中央**（见下方 `_revealArmedRow`）——否则「让用户看清删的是哪一条」的目的落空 |
| 与「批量删除所选」复用 | ✅ 复用同一组件与同一状态 `this._mgrConfirm`（现状两者已共用该状态，`_armDeleteOne` 只做「清空选中 → 选中该条 → armed」）。差异仅文案：`selCount === 1` → `MAIN_MGR_CONFIRM_DELETE_ONE`（带标题）；`> 1` → `MAIN_MGR_CONFIRM_DELETE`（带 count） |
| 取消后选中态 | 单条取消 → 清空 `_mgrSel`（该选中是 arm 时自动加的，不该残留）；批量取消 → 保留 `_mgrSel`（用户可能只是想再核对） |
| 窄屏 / 极窄屏 | `flex-wrap: wrap`；文案 `flex:1; min-width:0`，最多 2 行后省略；按钮不换行、不缩小到 44px 以下；`≤300px` 时按钮两行堆叠（取消在上、确认在下） |
| 滚动表现 | 悬浮栏在 `.fs-body` 之外 → 滚动列表时固定不动；显示期间给 `.mgr-list` 加 `padding-bottom: 92px`（悬浮条高 ≈68px + bottom 12px，84px 会让最后一行仍被压住），避免最后一行被永久遮挡 |
| 入场时定位被删行 | 单条删除时把该行滚到可视区中央。**用 `.fs-body.scrollTop` 手动计算，不要用 `scrollIntoView`**——后者会向上冒泡滚动宿主（SunPanel 面板/页面）的滚动容器，在 iframe 里可能带动外层滚动。仅在行未完整可见时才滚动： |

```js
_revealArmedRow(id) {
  const root = this.renderRoot; if (!root) return;
  const body = root.querySelector('.fs-body');
  const row = root.querySelector(`[data-mgr-id="${id}"]`);   // .mgr-row 需新增 data-mgr-id
  if (!body || !row) return;
  const rb = row.getBoundingClientRect(); const bb = body.getBoundingClientRect();
  const pad = 12;
  if (rb.top >= bb.top + pad && rb.bottom <= bb.bottom - pad) return;   // 已完整可见则不动
  const delta = rb.top - bb.top - (bb.height - rb.height) / 2;
  const top = Math.max(0, body.scrollTop + delta);
  const smooth = !window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (body.scrollTo) body.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
  else body.scrollTop = top;                                                                  // 降级
}
```
（`behavior: 'smooth'` 在 `prefers-reduced-motion` 下必须降级为 `'auto'`，否则与 §3.3 关动画的决定自相矛盾。）
| 动画 | 滑入 0.22s（与既有 `fs-in` / `sheet-up` 同曲线）+ 遮罩淡入 0.18s；`prefers-reduced-motion` 下关闭 |
| 无需自动消失 | 删除是破坏性操作，不做定时自动取消（避免用户正要点时它消失）；必须显式取消/确认 |

### 3.5 状态机

```
idle ──点击行尾 ×──▶ armed(single, sel={id})      ──确认──▶ deleting ──▶ idle + toast(MAIN_TOAST_DELETED_MANY)
idle ──点击「删除所选」(selCount≥1)──▶ armed(batch) ──确认──▶ deleting ──▶ idle + toast
armed ──取消 / 点遮罩 / Esc / 返回 / 完成 / 选择变化 / 全选切换 / 列表变空──▶ idle
```

复位 `_mgrConfirm = false` 的触发点（前端需全部覆盖）：`_cancelMgrConfirm`、`_deleteMgrSelected`、`_toggleMgrItem`、`_toggleMgrAll`、`_openScheduleMgr`、`_closeScheduleMgr`、以及 `selCount === 0` 的渲染短路（现有 `this._mgrConfirm && selCount` 判断保留）。

### 3.6 无障碍要点

- `.mgr-confirm` 加 `role="alertdialog"`、`aria-modal="true"`、`aria-labelledby="cf-title"`；
- 打开时把焦点移到**「取消」**（安全默认），并在关闭后把焦点还给触发元素（行尾 × 或「删除所选」按钮）；
- 遮罩区 `aria-hidden="true"`（它只是点击层）；
- 文案要含「此操作不可撤销」（现有 `MAIN_MGR_CONFIRM_DELETE` 已有，新增的单条文案同样保留）。

### 3.7 需求 5 需要的字段与方法名

| 类型 | 名称 | 说明 |
|---|---|---|
| 新增（或就地改造） | `_renderMgrConfirm()` | 从 `_renderScheduleMgr` 中抽出，返回悬浮条 + 遮罩；由 `_renderScheduleMgr` 在 `.fs-body` **之后**调用 |
| 新增 | `_armedId`（或复用 `_mgrSel` 大小为 1 的判断） | 单条删除时给对应行加 `.armed` |
| 修改 | `_armDeleteOne(id)` | 增加：`this._armedFrom = 'row'`（区分单条/批量，决定取消后是否清空选中）；armed 后在 `updated()` 调 `_revealArmedRow(id)` |
| 新增 | `_revealArmedRow(id)` | 仅在行未完整可见时滚动 `.fs-body`（见 §3.4 代码块） |
| 修改 | `.mgr-row` | 新增 `data-mgr-id="${item.id}"`（供 `_revealArmedRow` 定位） |
| 修改 | `.fullscreen` | 追加 `class="fullscreen ${dark ? 'dark' : ''}"`，供深色遮罩分支使用（§3.3.2） |
| 修改 | `_cancelMgrConfirm()` | 单条来源时清空 `_mgrSel` |
| 样式 | `.fs-nav{z-index:150}` / `.mgr-scrim` / `.mgr-confirm`（新定位）/ `.cf-text` / `.cf-btn` / `.mgr-row.armed` | 删除旧的 `.mgr-confirm`（block 流 + `margin-bottom`）样式 |

### 3.8 需求 5 新文案

| key | zh-CN | en-US |
|---|---|---|
| `MAIN_MGR_CONFIRM_DELETE_ONE` | 确认删除日程「{title}」？此操作不可撤销。 | Delete "{title}"? This cannot be undone. |

其余沿用：`MAIN_MGR_CONFIRM_DELETE`（{count}）、`MAIN_MGR_CONFIRM_YES`、`MAIN_MGR_CANCEL`、`MAIN_TOAST_DELETED_MANY`。

### 3.9 需求 5 验收清单

1. `.mgr-confirm` 在 DOM 中是 `.fullscreen` 的直接子节点，**不在** `.fs-body` 内。
2. 全局无 `position: fixed`（`grep -rn "position: *fixed" src` 为空）。
3. 列表滚动到任意位置时，点击任一行的 × → 悬浮条**无需滚动即可见**；被删行若原本不在视口内，会自动滚入可视区。
4. 遮罩点击 = 取消；取消后单条来源的选中被清空、批量来源的选中保留。
5. **点「返回」关闭的是页面**（不是取消）——验证 `.fs-nav` 的 z-index 高于遮罩（§3.3.1）。
6. **深色模式下遮罩可见**：切到深色，列表区明显变暗、空白区也可感知（§3.3.2）。
7. 悬浮条按钮 `min-height ≥ 44px`；`env(safe-area-inset-bottom)` 生效；`.mgr-list` 补白 92px 后最后一行不被遮挡。
8. **`prefers-reduced-motion: reduce` 下按钮仍可点击**（§3.3.3）——这是最容易被回归掉的断言，务必写进自检。

---

## 4. 通用：小屏 / 响应式 / 无障碍清单（三条需求共用）

**小屏触摸（最小 1×1 ≈ 120px，全页也远小于桌面浏览器）**

- **触摸目标（v1.31 统一口径，回应 design-architect 的偏离申请）**：**视觉 ≥36px + 伪元素热区撑到 44px**，而不是实心 44px。

  ```css
  .se-toggle, .se-actions button, .chip-tool { position: relative; min-height: 36px; }
  .se-toggle { padding: 8px 14px; }
  .se-toggle::after, .se-actions button::after, .chip-tool::after {
    content: ''; position: absolute; left: 0; right: 0; top: -4px; bottom: -4px;
  }
  /* 热区上下各扩 4px → 行间距必须 ≥8px 才不重叠（z-index 只决定归属，不消除重叠） */
  .se-toggles { column-gap: 6px; row-gap: 8px; }   /* 原来是 gap:6px，行间会重叠 2px */
  .se-actions { position: relative; z-index: 1; }   /* 兜底：重叠区归按钮自己 */
  ```
  - **为什么**：44px 是「热区」要求，不是「视觉盒子」要求（WCAG 2.2 SC 2.5.5 AAA / Apple HIG 44pt 说的都是可点区域；SC 2.5.8 的底线只有 24px）。11px 文字配实心 44px 胶囊会显得空旷，且会让同面板其他 26px 控件严重不齐。
  - **一致性约束（必须一起做）**：`.se-actions`（自适应 / FULL）**也要同步**改成 36px 视觉 + 44px 热区，否则同面板出现 36 与 26 两种高度，比原来更糟。预览栏 `.chip-tool` 同样处理（改动不可见，只加热区）。
  - **热区重叠防护（两件事都要做）**：`::after` 上下各扩 4px → 相邻两行各占 4px，**行间距必须 ≥8px 才不重叠**。现状 `.se-toggles { gap: 6px }` 会重叠 2px，而 `z-index` 只决定这 2px 归谁（会让上一行 `.se-toggle` 底部 2px 点不到），**不消除重叠**。故：① `.se-toggles` 改 `column-gap: 6px; row-gap: 8px`（只加行距，横向 6px 节奏保持不变）；② `.se-actions { position: relative; z-index: 1 }` 兜底。`.se-actions` 的 `margin-top: 8px` 恰好够，不用动。
  - 悬浮条按钮是唯一例外：**实心 `min-height: 44px`**（破坏性操作，不玩热区技巧）。
- 交互反馈必须「可感知」：任何开关（尤其置中类）若未产生布局变化，必须有一次提示（D6）——小屏上用户看不到细微位移，「静默无反应」会被判定为 bug。
- 提示统一复用 `_showHint` / `_showCardCfgHint`（2.4s 自动消失），**不新增 modal**。
- 悬浮元素一律 `position: absolute` + 依赖既有定位祖先；`bottom` 用 `calc(12px + env(safe-area-inset-bottom, 0px))`。

**响应式**

- 悬浮条与 chip 工具栏均用 `flex-wrap: wrap`，文本区 `flex:1; min-width:0` 并允许换行省略；不做断点式重排（微应用宽度变化连续，断点不可靠）。
- 1×FULL 预览/运行时的列数差异见 §1.9 R3（本迭代登记）。

**无障碍（a11y）**

- 新增按钮都有 `aria-label`（锁图标 `aria-hidden="true"`）。
- 软禁用用 `aria-disabled="true"` **而非** `disabled`，保证读屏能聚焦并播报原因；视觉上用 `.locked` 灰显 + 虚线边框（对比度 ≥ 3:1 于背景）。
- 悬浮确认条：`role="alertdialog"` + `aria-modal="true"` + 焦点默认落在「取消」。
- **D14：既有占格徽标 `.chip-span` 一并修（收进 v1.31）**。它用 `color: var(--apple-label-3)` + `background: var(--apple-fill)`，实测 **浅 3.13:1 / 深 2.70:1，两端都不达标**（只算浅色会低估）。理由：① 改动是 `mainPage.js:1948-1957` 与 `widgetConfig.js:1122-1131` **两份各 1 行 `color`**，风险≈0；② 它显示的是真实占格数值（`${rows}×${cols}` / 「溢出」），不适用任何豁免，且字号 9px 比新角标的 10px 还小；③ 它与新增的「接管」/「默认」角标在同一块面板相邻位置，留一个 2.70 的徽标在 16.53 的角标旁边是**本迭代自己引入的观感不一致**。改法同角标：`color: var(--apple-label)`（16.53/10.78）。
- 色彩不是唯一信息通道：置中按钮的「开 / 接管 / 默认」三态需同时用**边框样式（实线 / 虚线）+ 角标文字**（「接管」「默认」）表达，照顾色弱用户。
- 接管态主文字用 `--apple-label-3`（浅 3.44:1 / 深 3.16:1），适用 WCAG 1.4.3「非活动界面组件」豁免；**角标文字不豁免，用 `--apple-label-2`**（浅 10.94:1 / 深 5.94:1）。
- 热区扩展用的 `::after` 是纯装饰，不参与焦点与读屏（`content:''` 的伪元素不进无障碍树），无需 `aria-hidden`。
- 文案带 `{count}` / `{title}` / `{size}` 占位符时，英文需正确处理单复数（现有 `MAIN_MGR_TOTAL` 用 `schedule(s)` 的写法可沿用）。

**降级方案**

| 能力 | 不可用时降级 |
|---|---|
| `env(safe-area-inset-*)` | 不支持时按 `0` 处理（`calc(12px + 0px)`），不影响布局 |
| `prefers-reduced-motion` | 关闭滑入动画，改为直接显示 |
| Esc 取消 | iframe 未获焦点时收不到 → 仍有遮罩点击 / 返回 / 完成三条取消路径 |
| `backdrop-filter` | 不使用（遮罩只用半透明色） |

---

## 5. 交付给 Phase 3 的落地顺序建议

1. `user-store.js`：`alignGovernor` / `applyAlignmentWithReport`（`some` + clamp）/ `applyCardCenter` / `layoutSignature` / `singleLineOn` / `unitAlignExplicit` + `layoutBlocks` 新顺序（**纯函数，先补单测**）。
2. `card-mode-render.js`：`renderSpanEditor` 接收 `alignLocked` / `alignDefault` / `onUnlock`，渲染 `.locked` 态与副标题。
3. `widgetConfig.js` + `mainPage.js`：两处开关改走 `_toggleAlignWithFeedback`；两处 `singleLine` 传参加 `isFullCard`；两处 chip 工具栏加 `CARD_CENTER_TAKEOVER_NOTE`。
4. `mainPage.js`：`_renderScheduleMgr` 拆出 `_renderMgrConfirm` 并挪到 `.fs-body` 外 + 遮罩 + `.armed` 高亮。
5. `locales/zh-CN.js` / `en-US.js`：补 §1.7 / §2.5 / §3.8 的 key。
6. 自检脚本追加 §1.8 / §2.6 / §3.9 的断言（重点是「无 `position:fixed`」与「偏移不越界/不翻倍」）。
