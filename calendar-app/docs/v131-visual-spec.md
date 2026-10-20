# v1.31 视觉与排版规范（Phase 1）

范围：需求 6（月日样式）、需求 4（日历日期标题）、需求 7（窄高竖排）、需求 8（小卡年与星期）。
本文只产出规范与数值，**不修改任何代码**。落地以文末「附录 A：需新增/修改的 key 与常量清单」为准。

---

## 0. 共同约束与既有刻度（先对齐，后面所有 em 都以此为基准）

### 0.1 既有字号刻度（`widget.js` / `mainPage.js` / `widgetConfig.js` 三处 CSS 必须同步）

| class | font-size | weight | line-height | 用途 |
| --- | --- | --- | --- | --- |
| `.pv-big` | 1.875em | 800 | 1.1 | 大数字（时/分/年/星期） |
| `.pv-mid` | 1em | 700 | 1.25 | 日期长串 |
| `.pv-row2` | 0.75em | 600 | — | 月历表头 / 日程行 |
| `.pv-sub` | 0.5625em | — | 1.3 | 副标题（年/月/单位） |
| `.pv-ap` | 0.6875em | 600 | — | AM/PM |
| `.pv-wk-d` | 0.75em | 600 | — | 周历日期数字 |
| `.pv-wk-w` | 0.5em | — | — | 周历星期字 |
| `.pv-c` | 0.5625em | 500 | — | 月历日格 |

容器 gap：`.pv-center` 0.375em、`.pv-col` 0.3125em。块内边距 `FIT_PAD = 0.1875em`（双侧共 0.375em）。

### 0.2 反推公式（不要绕过）

```
u = fitFontU(blockW, blockH, fit)
  = min( blockH / (fit.h·n + 0.375),  n·blockW / (fit.w + slack + 0.375·2n) )
slack = fit.wrap ? 1 : 0        // 换行余量，竖排一律不声明 wrap
u ∈ [7, 40]，wrap 且 u<9 时按 n=2 重算
blockW = span.cols × cellW；blockH = span.rows × cellH
```

### 0.3 实测得到的字符宽度模型（用于推导本文所有 w/h，落地前须用 `scripts/measure.html` 复核）

- `.pv-mid` 级（weight 700，tabular）：数字 **0.616em**、中文字（年月日）**1.0em**、空格 0.28em。
  校验：`2026年10月18日` = 8×0.616 + 3×1.0 = **7.93em**（实测 7.93 ✓，声明 8.1，余量 +2%）。
  校验：`10月18日 周日` = 6×0.616 + 2×1.0 + 0.28 + 2×1.0 = **6.97em**（实测 6.77 ✓，声明 6.9）。
- `.pv-big` 级（weight 800，tabular）：数字 **0.62em**、`:` 0.35em。
  校验：`14:05` = 4×0.62×1.875 + 0.35×1.875 = **5.31em**（声明 5.3 ✓）；
  `14:05:09` = 6×0.62×1.875 + 2×0.35×1.875 = **8.30em**（声明 8.3 ✓）。
- 中文 CJK 在 weight 800 下宽度 ≈ 1.0em（相对该行 font-size）。

**声明惯例：实测值 + 2%~8%，不做 20% 的过度保守（会让字号偏小）。** 竖排 key 因是新形态，统一多留 5%~10%，落地实测后再收紧。

### 0.4 各尺寸的单元格像素（用于判定与验算，来自 `scripts/make-preview.mjs` 的用例）

| 卡片 | 网格(列×行) | cellW×cellH | 备注 |
| --- | --- | --- | --- |
| 1×1 | 2×2 | 48 × 48 | |
| 1×2 | 4×2 | 57 × 48 | |
| 2×1 | 2×4 | 48 × 57 | |
| 2×2 | 4×4 | 57 × 57 | |
| 2×4 | 8×4 | 61.5 × 57 | |
| 4×4 | 8×8 | 61.5 × 61.5 | |
| 1×FULL | (4~10)×2 | 84~106 × 48 | 列数运行时按实测宽度算 |

> **关键事实：cellW ≠ cellH**（1×FULL 是 105×48，差 2.19 倍）。这是需求 7 判定必须用像素而非格数的根本原因。

---

## 1. 需求 6 — 新增显示样式「月日」

### 1.1 决策

| 项 | 结论 |
| --- | --- |
| key | **`dateMonthDay`** |
| 中文名 / 英文名 | `月日` / `M/D` |
| 所属 | `COMBO_CONTENTS` → `time.styles` |
| 默认 span | `{ cols: 2, rows: 1 }` |
| minSpan | **不声明**（与 `dateFull`/`dateWeekday`/`dateFullWeekday` 一致：文字串不可压缩，放不下即视为空间不足，不做降级） |
| `CONTENT_FIT.time.dateMonthDay` | `{ w: 4.6, h: 1.3, wrap: true }` |
| 排序位置 | **插入到 `dateFull` 之后、`dateWeekday` 之前（第 2 位）** |
| 渲染模板 | 复用 `mid(v)`（`.pv-mid`，1em / 700 / lh 1.25 / tabular-nums） |

### 1.2 文案形态：不用 `10/20`，用 `10月20日`

| 语言 | 文案 | 生成方式 |
| --- | --- | --- |
| zh | `10月20日` | `` `${mo}月${d}日` `` |
| en | `Oct 20` | `now.toLocaleDateString('en-US', { month:'short', day:'numeric' })` |

**理由**
1. **与同族写法连续**：`dateWeekday` 的中文是 `10月20日 周日`，即 `月日` + 空格 + 星期。月日保持 `10月20日`，用户左右切换样式时文案形态不跳变，认知成本最低。
2. **斜杠破坏视觉重量**：`10/20` 的斜杠是细笔画标点，视觉重量只有 `月/日` 的约 1/3，整串会显得"轻飘"，与"日期主体"的定位不符；且在中文语境下 `10/20` 易被误读为分数或比例。
3. **层级靠字号而非符号**：视觉层级由信息量自然决定——同一块宽下，信息越少字号越大。实测层级如下（同一块宽、高不受限时）：

| 样式 | w + slack + pad | 理论相对字号 | 实测验证（1×2 卡、占格 2×1 = 114×48） |
| --- | --- | --- | --- |
| `dateFullWeekday` 年月日星期 | 11.775 | 1.00 | u=9.68 → **9.7px** |
| `dateFull` 年月日 | 9.475 | 1.24 | u=12.03 → **12.0px** |
| `dateWeekday` 月日星期 | 8.275 | 1.42 | u=13.78 → **13.8px** |
| **`dateMonthDay` 月日** | **5.975** | **1.97** | u=19.08 → **19.1px** |

> 月日约为年月日的 **1.59 倍**字号，约为年月日星期的 **1.97 倍**（实测 19.1 / 12.0 / 9.7）。这个梯度清晰且符合直觉（信息量减半 → 字号显著放大），不需要额外削弱。

### 1.3 换行兜底

- 声明 `wrap: true`，`slack = 1`。
- 文案必须插入 `<wbr>` 断点：`${mo}月<wbr>${d}日`。否则 CJK 会在任意字符处断行（如 `10月1` / `8日`），不可接受。
- 实测宽度 4.46em（4 位数字 + 2 个中文字），声明 **4.6**（+3%）；en `Oct 20` ≈ 3.0em < 4.6，**不声明 `wEn`**。

### 1.4 排序理由

`flatStyleSeq` 顺序决定左右切换（‹ ›）的相邻关系。月日放在年月日之后，用户从「年月日」右移一格即得「月日」（去掉年），再右移得「月日星期」（加星期），再右移得「年月日星期」（加年）——**四步构成完整的「年 / 星期」二维开关序列**，这是最优的可发现性排列。
新增样式不影响既有数据（旧 `cardBlocks` 里不存在该 key）。

---

## 2. 需求 4 — 日历日期标题（年、月、日）

### 2.1 显示条件

```
showCalTitle = span.cols >= 4
            && !(content === 'calendar' && style === 'month' && opts.singleLine)
```

- **用「占格列数 cols ≥ 4」，不用像素宽度。** 理由：
  1. 用户看到的、能操作的量就是占格编辑器里的「水平 N 格」，规则可预期、可在设置面板直接验证；
  2. 1×FULL 的 `cellW` 随宿主宽度在 **84~106px** 之间浮动，同一占格在不同宿主上像素宽差异达 25%，用像素阈值会出现"同一设置两种表现"；
  3. 1×FULL 只有 2 行高（约 96px），cols=2 时若按像素（210px > 阈值）判定会误加标题，把 96px 的内容区压掉 1/3。**格数规则天然规避了这一最坏情况。**
- **`calendar.week` 与 `calendar.month` 都适用。**
  - `month`：现有表头是 `2026年10月`（年月）→ 满足条件时**升级为完整日期**（补上「日」；**按拍板不带星期**），不新增第二行（两行表头会重复、且吃掉月历网格 1.2em 高度）。
  - `week`：现有无表头 → 满足条件时**新增一行表头**。周历只显示 7 个数字、没有月份上下文，标题价值最大。
- **月历「单行显示」（`singleLine`）不显示标题。** 理由：
  1. `monthSingle` 的 `h` 预算只有 **2.1em**（15 天横条），加标题需 +1.21em → 3.31em，日期条字号掉 **-37%**，直接不可读；
  2. 1×FULL 的月历默认就是 `singleLine`，而 `prefSpan` 会给它 6 列（cols=6 ≥ 4），若不加这条排除，默认配置会被直接压坏；
  3. 单行条本身已用主题色高亮「今天」，日期信息不缺失。
  （若将来要支持，需新增 `monthSingleTitle = { w: 15.4, h: 3.3 }` 并做成开关，v1.31 不做。）

### 2.2 标题文案形态

| 语言 | 主文案（`.pv-row2` 级） | 星期（次级） | 完整示例 |
| --- | --- | --- | --- |
| zh | `2026年10月20日` | `周日` | `2026年10月20日　周日` |
| en | `Oct 20, 2026` | `Sun` | `Oct 20, 2026　Sun` |

- en 主文案用 `toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' })`。
  **注意：必须用 `month:'short'`**（`Oct`），不能用现有表头的 `month:'long'`（`October`）：`October 20, 2026` ≈ 9.0em > 月历网格宽度 6.8em，会反客为主成为块的宽度约束，把整个月历缩小 5%~30%。
- en 星期用 `toLocaleDateString('en-US', { weekday:'short' })` → `Sun`。

> **【team-lead 拍板 · v1.31 定稿】月历标题「不带星期」，周历标题「带星期」。**
> 即：月历 `2026年10月20日`（5.95em < 网格 6.8em，`monthTitle.w = 6.8`，日格代价 **0%**）；周历照常带星期（`weekTitle.w = 7.8`，代价 **0%**）。
> 下方取舍原文保留，作为「日后再想给月历加回星期」时的现成依据。

**是否附星期（原文）：附。** 但由此产生一个必须知情的取舍（精确测算见 2.4 / 2.6）：

| 标题完整宽度（zh） | 计算 | 值 |
| --- | --- | --- |
| 日期部分 | 7.93em（实测）× 0.75em | 5.95em |
| + 间隔 | 0.3125em | 0.31em |
| + 星期 `周日` | 2 × 1.0em × 0.5625em | 1.13em |
| **合计** | | **7.39em** |

把 7.39em 与各日历的网格宽度比较：
- **周历**网格 7.8em > 7.39em → 表头不构成约束，**加星期零代价**；
- **月历**网格 6.8em < 7.39em → 表头反客为主成为宽度约束，日格字号 **-6.4%**（实测 228×228 块：17.4px → 16.3px）。

**取舍结论**：仍建议统一附星期——月历网格本身**没有星期表头**（`.pv-mini-grid` 只有数字，没有「日一二…」行），标题里的星期是唯一且高价值的星期信息；-6.4% 在可接受范围。
**若不接受 -6.4%**：月历标题改为不带星期（`2026年10月20日`，5.95em < 6.8em，`monthTitle.w` 保持 **6.8**，代价 0），周历照常带星期。**这是一个可独立切换的开关，两个数值都在 2.4 表中给出。**

### 2.3 数值表

| 项 | 值 |
| --- | --- |
| 标题行字号 | **0.75em**（复用 `.pv-row2`，weight 600） |
| 标题行颜色 | `visual.label2` |
| 星期字号 | **0.5625em**（复用 `.pv-sub` 级字号，weight 600） |
| 星期颜色 | `visual.label3` |
| 星期前置间距 | **0.3125em** |
| 标题与下方日历网格间距 | **0.3125em**（净间距） |
| 对齐 | **居中**（`text-align:center`） |

**间距实现（必须二选一，否则会叠加成 0.5625em）**
- 方案 A（推荐）：把 `.pv-mini-grid { margin-top: 0.25em }` 改为 `margin-top: 0`，间距统一由 `.pv-col` 的 `gap: 0.3125em` 提供。月历本身也会更紧凑，视觉更整。
- 方案 B：保留 `margin-top`，则实际净间距 = 0.5625em，下文 `h` 需各 +0.25。

**【team-lead 拍板 · v1.31 定稿：居中 ✅】**
**对齐改为居中**是一个明确的既有视觉变更（现月历表头是左对齐），理由是：① 标题是整块的头部，与下方 7 列等宽网格共用中轴；② 左对齐时标题与网格首列数字对不齐（`.pv-c` 是居中 flex），反而更乱；③ 与 1×FULL 默认水平置中的调性一致。**如不接受此项变更，保持左对齐亦可，不影响其他数值。**

### 2.4 对 `CONTENT_FIT` 的影响（按方案 A 的 0.3125em 间距）

推导（月历，6 行网格）：`h = 0.9（0.75em×1.2）+ 0.3125（gap）+ 5.81（6 行日格）= 7.02 ≈ 7.0` ✓ 与现值一致；
日期格宽度 `c = (6.8 − 6×0.125)/7 = 0.864em`。
（`getMonthGrid` 返回 35 或 42 格 → 5 或 6 行；`h` 按最坏情况 6 行固定为 7.0，5 行时网格由 `flex:1 + grid-auto-rows:1fr` 拉伸填满，**不会溢出**。）

| key | w | h | 变化 | 说明 |
| --- | --- | --- | --- | --- |
| `calendar.month` | 6.8 | 7.0 | 不变 | cols<4（表头仍为 `2026年10月`：6×0.616+2×1.0 = 5.70em × 0.75 = **4.27em** < 6.8em，网格仍是宽度约束） |
| **`calendar.monthTitle`** | **6.8** ✅定稿 | **7.0** | **新增** | **按 team-lead 拍板「不带星期」**：表头 = `2026年10月20日` = 7.93em × 0.75 = **5.95em** < 月历网格 6.8em → 网格仍是宽度约束，**日格字号代价 0**；`w` 直接沿用 6.8，`h` 不变（表头仍是一行 0.9em）。（若日后改回带星期：表头 7.39em → `w` 需改为 **7.5**，日格 -6.4%） |
| `calendar.monthSingle` | 15.4 | 2.1 | 不变 | 永不显示标题 |
| `calendar.week` | 7.8 | 2.1 | 不变 | cols<4 |
| **`calendar.weekTitle`** | **7.8** | **3.1** | **新增** | `h` = 0.9 + 0.3125 + 1.875（周历单元格）= 3.09 → **3.1**；`w` 仍由 7 列单元格决定（7.8 > 表头 7.39em），**加星期零宽度代价** |
| `calendar.weekVert` | 3.8 | 8.5 | 新增 | 见第 3 节（窄高竖排，与标题互斥） |

### 2.5 与竖排的优先级

**竖排（需求 7）优先；竖排的周历不再加日期标题。**
理由：竖排周历的 7 行每行已是「日期 + 星期」的完整信息，标题完全重复；且竖排场景纵向预算本就紧张。
两者实际几乎不冲突——按 0.4 节的单元格尺寸穷举，同时满足 `cols≥4` 与 `blockH ≥ 2·blockW` 的只有 **4×4 卡片上的 4×8 占格**（占满整卡且极端细高），概率极低。

### 2.6 标题带来的字号代价（诚实披露，供取舍）

| 场景 | 无标题 u | 有标题 u | 代价 |
| --- | --- | --- | --- |
| 2×4 卡，week 4×2（246×114） | 30.09（宽约束） | 30.09（仍宽约束） | **0%** |
| 4×4 卡，week 4×2（246×123） | 30.09 | 30.09 | **0%** |
| **2×2 卡，month 4×4（228×228）** | 30.92（高约束） | 30.92 | **0%**（拍板后：标题不带星期，5.95em < 6.8em，不成为宽度约束） |
| 4×4 卡，month 4×4（246×246） | 33.36 | 33.36 | **0%**（同上） |
| 1×FULL，week 4×2（420×96） | 38.79 | 27.63 | **-29%**（格子数字 29.1px → 20.7px，仍可读） |
| 2×4 卡，week 4×1（246×57） | 23.03 | 16.40 | **-29%**（17.3px → 12.3px，偏小） |

> **拍板后月历代价已归零**：month 的 -6.4% 完全来自「标题附星期」这一项，现按 `monthTitle.w = 6.8`（不带星期）落地，两行 month 均为 **0%**。
> 表中仍为正代价的只有 **week 的两行**（rows=1 超扁块 -29%，20.7px → 12.3px）。
> 若实测后认为最后一行（rows=1 的超扁块）不可接受，可在条件上追加 `span.rows >= 2` 作为二级门槛（对 1×FULL 无效，因其 rows 恒为 2）。**v1.31 建议先不加**，按用户原话 `cols ≥ 4` 落地。

---

## 3. 需求 7 — 窄高块竖排

### 3.1 阈值的准确定义

```
TALL_RATIO = 2
isTall = blockH >= blockW * TALL_RATIO      // 等价 blockH / blockW ≥ 2
blockW = span.cols × cellW
blockH = span.rows × cellH
```

**用实际像素比 `blockH / blockW`，不用格数比 `rows / cols`。** 这一点必须讲清楚：

- 用户的「水平：垂直 ≥ 1：2」应理解为 **垂直 ≥ 2 × 水平**（即块高至少是块宽的 2 倍，窄高块）。读作 `H/V ≥ 0.5 → V ≤ 2H` 会得到"不太高"的结论，与用户自注的「即窄高块」矛盾。
- 格数比 `rows/cols` 与像素比 `blockH/blockW` 的关系是：`blockH/blockW = (rows/cols) × (cellH/cellW)`。只有 `cellW = cellH` 时两者才相等。
- **反例（决定性）**：1×FULL，`cellW=105, cellH=48`。占格 1×2：
  - 格数比 `rows/cols = 2` → 判定为窄高 ❌
  - 像素比 `48×2 / 105 = 0.91` → 实际是**宽扁**块 ✅
  这个块放 7 个横排日期格绰绰有余（横排 `u=12.84`、数字 9.6px），若按格数比错误地改竖排，会变成一个 105×96 的方块里塞 7 行，`u=10.82`、数字降到 **8.1px**——反而变差。
- 另一个理由：1×FULL 的 `cols` 是**运行时按实测宽度覆盖的（4~10）**，格数比本身不稳定，同一份用户数据在窄宿主/宽宿主上会翻转。
- 反之，在 `cellW = cellH` 的 1×1 / 2×2 / 4×4 上，两者一致，用像素比不会漏判。

**回退规则**：`blockH < blockW × 2` 时，一律回退到原横排 key 与原模板（`week` / `dateFull` / `hm` / …），`CONTENT_FIT` 也用原值。

### 3.2 受影响样式与拆分方案

拆分原则：**每个「有效信息」单独一行；单位字（年/月/日/时/分/秒的中文单位）属于该信息的一部分，与数字同行，不单独成行。**

| 样式 key | 竖排 key | 行数 | zh 各行 | en 各行 | 行字号 em | 行高 | 字重 | 行间距 em |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `dateFull` 年月日 | `dateFullVert` | 3 | `2026年` / `10月` / `20日` | `2026` / `Oct` / `20` | **1em** | 1.15 | 700 | 0.1875 |
| `dateMonthDay` 月日 | `dateMonthDayVert` | 2 | `10月` / `20日` | `Oct` / `20` | **1em** | 1.15 | 700 | 0.1875 |
| `dateWeekday` 月日星期 | `dateWeekdayVert` | 3 | `10月` / `20日` / `周日` | `Oct` / `20` / `Sun` | **1em** | 1.15 | 700 | 0.1875 |
| `dateFullWeekday` 年月日星期 | `dateFullWeekdayVert` | 4 | `2026年` / `10月` / `20日` / `周日` | `2026` / `Oct` / `20` / `Sun` | **1em** | 1.15 | 700 | 0.1875 |
| `hm` 时分 | `hmVert` | 2 | `14` / `05` | 同 | **1.875em** | 1.1 | 800 | 0.125 |
| `hms` 时分秒 | `hmsVert` | 3 | `14` / `05` / `09` | 同 | **1.875em** | 1.1 | 800 | 0.125 |
| `calendar.week` 周日历 | `weekVert` | 7 | 见 3.3 | 见 3.3 | 见 3.3 | — | — | 0.0625 |

补充规则：
- 时间类竖排保留 `.pv-big` 的 1.875em / 800 / tabular-nums（时间的识别特征是大数字，不能降级到 1em）。
- **12 小时制**：`AM/PM` 不单独成行（会多出一个约 0.825em 的矮行、破坏节奏），改为以 `.pv-ap`（0.6875em / 600）**内联在「时」行的右侧**，间隔 0.25em。行示例：`02 PM` / `05` / `09`。因此只需声明 `w12`，**不需要给 `fitFontU` 加 `h12`**（避免改动反推公式）。
- 竖排 key **一律不声明 `wrap`**（每行必须单行，`white-space:nowrap`），因此 `slack = 0`。若误声明 `wrap:true`，`fitFontU` 会白加 1em 宽度余量并触发无意义的 `n=2` 分支。
- en 月份用 `short`（`Oct`）、星期用 `short`（`Sun`），不用 `long`（竖排里宽度才是稀缺维度）。
- **不在竖排范围**：`year` / `month` / `day` / `hour` / `minute` / `second` / `weekOfYear` / `weekday`（本身就是单一信息，无需拆）、`calendar.month`（7×6 网格本身就是竖排网格）、`important` / `schedule` / `blank`。

### 3.3 周日历竖排：**7 个日期改为 7 行竖排**（不是"保持 7 格横排但整体竖排"）

**结论：`.pv-wk` 由 `grid-template-columns: repeat(7, 1fr)` 改为 `grid-template-rows: repeat(7, 1fr)` 单列，每个 cell 占一行，行内「日期 + 星期」横向排列。**

理由：
1. **符合用户原话**：需求说「每个有效信息单独一行」。周日历的"有效信息"就是 7 个日期，竖排即 7 行。
2. **横排在窄高块里物理上不可行**：窄高块的 `blockW` 通常只有 48~96px，7 等分后每列宽 **6.9~13.7px**。2 位数字在 `.pv-wk-d`（0.75em）下需约 1.2em 列宽，反推字号只有 5.7~11.4px；实测 2×1 卡 1×2 占格（48×114）：横排 `u` 直接触 `FIT_MIN_U` 下限 7 → 数字 **5.3px**，竖排 `u=11.50` → 数字 **8.6px**。
3. **"保持 7 格横排但整体块内竖排"没有可操作的定义**：7 列横排在一个块里本来就只有一种摆法，这个解读改动不了任何东西，等于没做。

行内布局规范：

| 项 | 值 |
| --- | --- |
| 容器 | `.pv-wkv`：`display:grid; grid-template-rows:repeat(7,1fr); gap:0.0625em; width:100%` |
| 行 | `.pv-wkv-cell`：`display:flex; align-items:center; justify-content:space-between; padding:0.125em 0.375em; border-radius:0.375em` |
| 日期（左） | `0.75em` / weight 600 / tabular-nums / 颜色 `label2` |
| 星期（右） | `0.5625em` / 颜色 `label3` / `text-align:right` |
| 今日行 | 整行 `background: theme`，日期 `#fff`，星期 `#fff`（opacity .85） |
| 非今日行 | 日期 `label2`，星期 `label3` |
| 行序 | 按 `weekStart` 自上而下（周一优先 → 周一…周日） |
| en 星期 | 用 `weekday:'short'`（Mon/Tue…），**不用** `WEEK_MIN_EN` 单字母（竖排失去列头上下文，`T`/`S` 会歧义） |

`CONTENT_FIT.calendar.weekVert = { w: 3.8, h: 8.5 }`
- `h`：行高 = max(0.75×1.2, 0.5625×1.3) + 2×0.125 = 0.9 + 0.25 = 1.15em；7 行 8.05em + 6×0.0625 间隙 0.375em = **8.43em → 声明 8.5**（+1%）。
- `w`：日期 2 位 1.2em + 间隔 0.3125 + 星期 zh 2 字 1.125em + 左右 padding 0.75em = 3.39em → **声明 3.8**（+12%，竖排为新形态，留足余量）。en 用 short 星期 ≈ 3.16em < 3.8，不声明 `wEn`。

### 3.4 竖排后的 `CONTENT_FIT`

| key | w | w12 | h | wrap | 推导 |
| --- | --- | --- | --- | --- | --- |
| `time.dateFullVert` | **3.7** | — | **3.9** | false | w = `2026年` 3.46em（+7%）；h = 3×1.15 + 2×0.1875 = 3.825 → 3.9 |
| `time.dateMonthDayVert` | **2.5** | — | **2.6** | false | w = `10月` 2.23em（+12%）；h = 2×1.15 + 0.1875 = 2.49 → 2.6 |
| `time.dateWeekdayVert` | **2.5** | — | **3.9** | false | w = max(2.23, 2.23, `周日` 2.0) = 2.23 → 2.5；h = 3 行 = 3.9 |
| `time.dateFullWeekdayVert` | **3.7** | — | **5.3** | false | w = 3.46 → 3.7；h = 4×1.15 + 3×0.1875 = 5.16 → 5.3 |
| `time.hmVert` | **2.5** | **3.6** | **4.3** | false | w = 2 位×0.62×1.875 = 2.33em → 2.5；w12 = 2.33 + 0.25 + `PM` 0.83 = 3.41 → 3.6；h = 2×2.0625 + 0.125 = 4.25 → 4.3 |
| `time.hmsVert` | **2.5** | **3.6** | **6.5** | false | h = 3×2.0625 + 2×0.125 = 6.44 → 6.5 |
| `calendar.weekVert` | **3.8** | — | **8.5** | false | 见 3.3 |

`wEn` 一律不声明（en 短名均窄于 zh，取 zh 值即保守，见 0.3）。

### 3.5 效果验算（2×1 卡，120×252，grid 2×4，cell 48×57）

| 块 | 占格(列×行) | 块像素 | 像素比 | 横排 u（渲染字号） | 竖排 u（渲染字号） | 提升 |
| --- | --- | --- | --- | --- | --- | --- |
| hms | 2×4 | 96×228 | 2.38 ✅ | 11.07（20.7px） | **33.16（62.2px）** | **3.0×** |
| hms | 1×2 | 48×114 | 2.38 ✅ | 7.00（13.1px，触下限） | **16.58（31.1px）** | **2.4×** |
| dateFull | 2×4 | 96×228 | 2.38 ✅ | 10.13（10.1px） | **23.56（23.6px）** | **2.3×** |
| dateWeekday | 2×4 | 96×228 | 2.38 ✅ | 11.60（11.6px） | **33.39（33.4px）** | **2.9×** |
| calendar.week | 2×4 | 96×228 | 2.38 ✅ | 11.74（数字 8.8px） | **22.99（数字 17.2px）** | **2.0×** |
| calendar.week | 1×2 | 48×114 | 2.38 ✅ | 7.00（数字 5.3px，触下限） | **11.50（数字 8.6px）** | 1.6× |
| hms | 2×2 | 96×114 | 1.19 ❌ | 11.07（20.7px） | 回退横排 11.07 | — |
| 1×FULL week | 1×2 | 105×96 | 0.91 ❌ | 12.84（数字 9.6px） | 回退横排 12.84（若误判竖排会降到 10.82 / 8.1px） | — |

结论：竖排收益集中在 2×1 / 4×4 的细高占格上，正是用户抱怨的场景；1×FULL 与常规宽扁块不受影响。

---

## 4. 需求 8 — 1×1 / 1×2 卡片的「年」与「星期」

### 4.1 可用性确认（先回答"是否被过滤"）

**未被过滤，两项在所有尺寸都已可选。** 依据：
- `COMBO_CONTENTS` → `time.styles` 已含 `{ key:'year', span:{cols:1,rows:1} }` 与 `{ key:'weekday', span:{cols:1,rows:1} }`；
- `widgetConfig._renderStyleSection` 直接渲染 `contentDef(...).styles`，**没有 `sizes` 过滤**（`sizes` 过滤只存在于 `CARD_MODE_STYLES`，那是旧单独模式）；
- 1×1 卡网格 2×2、1×2 卡网格 4×2，span 1×1 都能放下（`blocksFit` 通过）。

> 因此 v1.31 只需要做「1×1 占格下的差异化渲染」，**不需要新增样式定义**。若产品希望它们在 1×1/1×2 上成为"默认出现的内容"，那是预设策略问题（建议 1×1 默认 `[年, 星期, 日]`，1×2 默认 `[时分秒, 月日星期]`），不属于本规范，请与 UX 确认后另立条目。

### 4.2 「年」在 1×1 占格显示后两位

| 项 | 结论 |
| --- | --- |
| 判定方式 | **`span.cols === 1 && span.rows === 1`（实际渲染占格，即已收窄到网格的 `b.span`）** |
| 为什么不用像素阈值 | ① 与用户"设置为 1×1"的心智模型、占格编辑器显示值完全一致；② 像素阈值在 1×FULL 上会翻转（105px/格），但在 1×FULL 上块高只有 48px，`u` 由**高度**约束（13.4），短年并不能增大字号——**两种判定在该场景结果完全相同**，像素阈值只带来不可预期性；③ 其余尺寸 1 格宽都在 48~61.5px，两种判定结论一致。 |
| 非 1×1 占格 | 显示完整四位数 `2026` |
| zh 文案 | `26` + 副标题 `年` |
| en 文案 | `26` + 副标题 `Year` |
| 副标题 | **保留**。去掉后 `26` 完全失去语义；日历卡片语境下 `26 / 年` 可读。备选：若认为 `26年` 有"26 年（时长）"歧义，可在 1×1 下隐藏副标题（此时 `yearShort.h` 从 3.2 降到 2.4，字号再 +33%）。 |

`CONTENT_FIT`（`year` 目前走 `time.__default`，本次改为显式 key）：

| key | w | h | 说明 |
| --- | --- | --- | --- |
| `time.year` | **4.7** | **3.2** | 4 位数字：4×0.62×1.875 = 4.65em（+1%）。**不声明 `wEn`** —— 顺带修正：原先走 `__default` 时 en 取 `max(4.7, 10.5)=10.5`，把 en 的 `2026` 压到不该有的小字号；en 副标题 `Year` 仅 1.24em，4.7 才是正确值 |
| `time.yearShort` | **2.6** | **3.2** | 2 位数字：2×0.62×1.875 = 2.33em（+12%）。h 不变（副标题高度不变） |

### 4.3 「星期」在 1×1 占格字号缩小一倍

| 项 | 结论 |
| --- | --- |
| 判定 | 同 4.2：`span.cols === 1 && span.rows === 1` |
| 主文字字号 | **1.875em → 0.9375em**（×0.5，即"缩小一倍"） |
| 主文字字重 | **800 → 700**（0.9375em 下 800 笔画发糊；700 也更窄，等于多给余量） |
| 主文字行高 | 1.1（不变） |
| 副标题字号 | **0.5625em → 0.5em**（同步下调，否则副标题会显得比主文字还重；0.9375 : 0.5 = 1.875 : 1） |
| 副标题文案 | 不变（`星期` / `Weekday`） |
| 容器 gap | 0.375em（沿用 `.pv-center`） |

> ⚠️ **预期效果说明（避免验收落差）**：em 减半 ≠ 渲染像素减半，因为 `u` 会随之上升。以 1×1 卡（48×48）为例：主文字 21.1px → **18.2px**（-14%），副标题 6.3px → **9.7px**（+54%）。净效果是**层级更均衡、不再头重脚轻**，这正是 1×1 下的问题所在。
> 若产品目标是"视觉上明显减半"，把 em 再降到 **0.75em**（= 原值 40%）：主文字 15.8px、副标题 10.6px，对应 `weekdaySmall = { w:1.6, wEn:4.3, h:1.9 }`。**本规范按字面"缩小一倍"取 0.9375em。**

`CONTENT_FIT`：

| key | w | wEn | h | 说明 |
| --- | --- | --- | --- | --- |
| `time.weekday` | **3.9** | **10.5** | **3.2** | zh `周日` = 2×1.0×1.875 = 3.75em（+4%）；en 最长 `Wednesday` = 9×0.55×1.875 = 9.28em → 10.5（沿用 `__default` 的 wEn，+13%） |
| `time.weekdaySmall` | **2.0** | **5.3** | **2.1** | zh `周日` at 0.9375em = 1.875em（+7%）→ 2.0；en `Wednesday` at 0.9375em = 4.64em → 5.3（+14%）；h = 0.9375×1.1 + 0.375 + 0.5×1.3 = 2.06 → 2.1 |

### 4.4 1×1 / 1×2 卡片下的完整数值

| 卡片 | 样式 | 占格 | 块像素 | 使用 key | u | 主文字渲染 | 副标题渲染 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1×1 | year | 1×1 | 48×48 | `yearShort` | 13.43 | `26` @ 25.2px | `年` @ 7.6px |
| 1×1 | year | 2×2 | 96×96 | `year` | 18.92 | `2026` @ 35.5px | `年` @ 10.6px |
| 1×1 | weekday | 1×1 | 48×48 | `weekdaySmall` | 19.39 | `周日` @ 18.2px | `星期` @ 9.7px |
| 1×1 | weekday | 2×2 | 96×96 | `weekday` | 22.46 | `周日` @ 42.1px | `星期` @ 12.6px |
| 1×2 | year | 1×1 | 57×48 | `yearShort` | 13.43 | `26` @ 25.2px | `年` @ 7.6px |
| 1×2 | year | 2×2 | 114×96 | `year` | 22.46 | `2026` @ 42.1px | `年` @ 12.6px |
| 1×2 | weekday | 1×1 | 57×48 | `weekdaySmall` | 19.39 | `周日` @ 18.2px | `星期` @ 9.7px |
| 1×2 | weekday | 2×2 | 114×96 | `weekday` | 26.67 | `周日` @ 50.0px | `星期` @ 15.0px |

对比（1×1 卡、占格 1×1，改前 → 改后）：
- 年：主文字 17.7px → **25.2px**（**+42%**）
- 星期：主文字 21.1px → 18.2px、副标题 6.3px → 9.7px（**层级更均衡**）

### 4.5 key 命名规则

**采用 camelCase 复合名 `<styleKey><Variant>`，不使用点号（`year.short`）或下划线。**

| Variant 后缀 | 含义 | 示例 |
| --- | --- | --- |
| `Vert` | 窄高竖排变体 | `dateFullVert` / `hmVert` / `weekVert` |
| `Short` | 内容缩写（年只取后两位） | `yearShort` |
| `Small` | 整体字号缩小的尺寸变体 | `weekdaySmall` |
| `Title` | 附带日期标题的变体 | `monthTitle` / `weekTitle` |
| （既有）`Single` | 单行显示 | `monthSingle` |

理由：① 与既有 `monthSingle` 一致；② `fitFor` 是**单层查找** `c[key] || c[style] || c.__default`，camelCase 复合名能天然享受"找不到竖排 key 就回退横排"的兜底；点号命名虽也能查到，但语义上会被误认为是嵌套结构，且一旦将来加二维查找就要改解析。

---

## 5. 需新增的 CSS class（全部 em，无 px）

新增 class 必须**同步写入 4 处**：`src/components/widget.js`、`src/components/mainPage.js`、`src/components/widgetConfig.js`、`scripts/make-preview.mjs`（否则预览与真机不一致）。

```css
/* ---- 竖排容器 ---- */
.pv-vstack { display:flex; flex-direction:column; align-items:center;
             justify-content:center; width:100%; gap:0.1875em; }      /* 日期串类 */
.pv-vstack.t { gap:0.125em; }                                          /* 时间类（大数字行） */
.pv-vline { font-size:1em; font-weight:700; line-height:1.15;
            white-space:nowrap; font-variant-numeric:tabular-nums; }   /* 日期串竖排行 */
.pv-vbig  { font-size:1.875em; font-weight:800; line-height:1.1;
            white-space:nowrap; font-variant-numeric:tabular-nums; }   /* 时间竖排行 */

/* ---- 日历日期标题 ---- */
.pv-cal-head { text-align:center; color:inherit; }                     /* 行容器，居中 */
.pv-cal-wd   { font-size:0.5625em; font-weight:600; margin-left:0.3125em; } /* 标题内星期 */

/* ---- 周日历竖排 ---- */
.pv-wkv { display:grid; grid-template-rows:repeat(7,1fr);
          grid-template-columns:1fr; gap:0.0625em; width:100%; }
.pv-wkv-cell { display:flex; align-items:center; justify-content:space-between;
               padding:0.125em 0.375em; border-radius:0.375em; }
.pv-wkv-d { font-size:0.75em; font-weight:600; font-variant-numeric:tabular-nums; }
.pv-wkv-w { font-size:0.5625em; text-align:right; }

/* ---- 小卡星期（1×1 占格） ---- */
.pv-wd-sm { font-size:0.9375em; font-weight:700; line-height:1.1; }
.pv-wd-sm + .pv-sub, .pv-center .pv-wd-sm ~ .pv-sub { font-size:0.5em; }
```

> `.pv-wd-sm + .pv-sub` 这条选择器用于把 1×1 星期的副标题降到 0.5em；若实现上用独立的副标题 class（如 `.pv-sub-sm`），更稳妥，推荐后者。

---

## 6. 待复核的测量项（`scripts/measure.html`）

改文案/字号必须重测。请在 `measure.html` 的样本表里追加（**分两组，字重不同**）：

**A 组（weight 700，font-size 100px → 结果 /100 = em）**
```
time:dateMonthDay      = "10月20日"
time:dateMonthDayEn    = "Oct 20"
time:vYear             = "2026年"
time:vMonth            = "10月"
time:vDay              = "20日"
time:vWeekdayZh        = "周日"
time:vWeekdayEnShort   = "Sun"
time:calTitleZh        = "2026年10月20日"   （用于 0.75em 行：实测 em × 0.75）
time:calTitleEn        = "Oct 20, 2026"     （同上）
```

**B 组（weight 800，font-size 100px）**
```
time:vBig2             = "05"      （竖排时间行：em × 1.875）
time:vBig4             = "2026"    （年：em × 1.875）
time:vBig2Zh           = "周日"    （星期大字：em × 1.875）
time:vBig2ZhSm         = "周日"    （小卡星期：em × 0.9375，建议 weight 700 再测一次）
time:vAp               = "PM"      （AM/PM：em × 0.6875）
```

把结果按「实测 em × 该行的 font-size em」换算成 u 单位宽度，写回第 3.4 / 4.2 / 4.3 节的表格；若与本文推导值偏差 >8%，以实测为准并回写本文档。

---

## 附录 A：需新增/修改的 key 与常量清单（前端落地用）

### A1. `src/core/user-store.js`

| 动作 | 内容 |
| --- | --- |
| 修改 | `COMBO_CONTENTS` → `time.styles`，在 `dateFull` 之后插入 `{ key:'dateMonthDay', zh:'月日', en:'M/D', span:{ cols:2, rows:1 } }`（**不声明 minSpan**） |
| 不变 | `year` / `weekday` 的 span 与定义（已存在，无需改） |

### A2. `src/core/card-mode-render.js`

**新增常量**

```js
/** 窄高判定：块高 ≥ 2 × 块宽（实际像素比，非格数比） */
export const TALL_RATIO = 2;
/** 支持竖排的 time 样式 */
const TIME_VERT = new Set(['dateFull','dateMonthDay','dateWeekday','dateFullWeekday','hm','hms']);
/** 支持竖排的 calendar 样式 */
const CAL_VERT = new Set(['week']);
/** 日历日期标题的最小占格列数 */
export const CAL_TITLE_MIN_COLS = 4;
/** 小卡差异化渲染的占格（1×1） */
const SMALL_SPAN = { cols: 1, rows: 1 };
```

**新增函数**

```js
export function isTallBlock(blockW, blockH) { return blockH >= blockW * TALL_RATIO; }
export function isSmallUnit(span) { return span.cols === SMALL_SPAN.cols && span.rows === SMALL_SPAN.rows; }
/** 竖排 → CONTENT_FIT key（竖排优先于日期标题） */
export function vertFitKey(content, style, tall) {
  if (!tall) return style;
  if (content === 'time' && TIME_VERT.has(style)) return `${style}Vert`;
  if (content === 'calendar' && CAL_VERT.has(style)) return `${style}Vert`;
  return style;
}
/** 日历日期标题显示条件 */
export function showCalTitle(content, style, span, opts) {
  if (content !== 'calendar') return false;
  if (content === 'calendar' && style === 'month' && opts && opts.singleLine) return false;
  return span.cols >= CAL_TITLE_MIN_COLS;
}
```

**修改点**
1. `CONTENT_FIT.calendar` 新增 `monthTitle`、`weekTitle`、`weekVert`；
2. `CONTENT_FIT.time` 新增 `dateMonthDay`、`dateFullVert`、`dateMonthDayVert`、`dateWeekdayVert`、`dateFullWeekdayVert`、`hmVert`、`hmsVert`、`year`、`yearShort`、`weekday`、`weekdaySmall`；
3. `fitFor(content, style, hour12, isZh, opts)`：
   - 支持 `opts.tall` → `key = vertFitKey(content, style, opts.tall)`；
   - 支持 `opts.small`（1×1 占格）→ `time.year → yearShort`、`time.weekday → weekdaySmall`；
   - 建议在 `w12` 之后加 `if (hour12 && f.h12) h = f.h12;`（本次不需要，但为将来留口子，**本次不改**）；
4. `renderBlocksHTML`：计算 `const tall = isTallBlock(blockW, blockH)` 与 `const small = isSmallUnit(b.span)`，把 `tall` / `small` 放进传给 `fitFor` 的 `opts` 与传给 `renderInfoBlockInner` 的 `o`；
5. `renderInfoBlockInner`：
   - `calendar.week`：`tall` 时走 7 行竖排模板（`.pv-wkv`）；
   - `calendar.month` / `calendar.week`：`showCalTitle()` 为真时渲染 `.pv-cal-head`（**居中**，日期 0.75em + 星期 0.5625em，间距 0.3125em；**月历按拍板不渲染星期节点，仅 `calendar.week` 渲染**）；
   - `time.*`：新增 `dateMonthDay` case；`dateFull/dateMonthDay/dateWeekday/dateFullWeekday` 与 `hm/hms` 在 `tall` 时走竖排模板；
   - `time.year`：`small` 时输出 `String(y).slice(-2)` 并使用 `yearShort`；
   - `time.weekday`：`small` 时主文字用 `.pv-wd-sm`（0.9375em / 700）、副标题 0.5em。

### A3. CSS（4 处，见第 5 节）

`widget.js`、`mainPage.js`、`widgetConfig.js`、`scripts/make-preview.mjs`。

另外（方案 A）：把 `.pv-mini-grid { margin-top: 0.25em }` 改为 `margin-top: 0`。

### A4. `locales/zh-CN.js` / `locales/en-US.js`

`COMBO_CONTENTS` 的样式名是内联 zh/en，**本次新增不需要 locale key**。若后续要把「日期标题」做成可开关项，建议预留：

| key | zh-CN | en-US |
| --- | --- | --- |
| `CARD_CAL_DATE_TITLE` | `显示日期标题` | `Show date title` |
| `CARD_VERT_HINT` | `窄高块已自动竖排` | `Stacked vertically on tall blocks` |

### A5. 预览 / 自检

- `scripts/make-preview.mjs` 的 `CASES` 建议追加：
  - `['2x1', 120, 252, [['time','hms'],['time','dateFull']]]`（竖排主场景）
  - `['2x1', 120, 252, [['calendar','week']]]`（周历竖排）
  - `['2x4', 516, 252, [['calendar','week']], ]` + 手动把 week 占格拉到 4×2（日期标题）
  - `['1x1', 120, 120, [['time','year'],['time','weekday']]]`（小卡年/星期）
  - `['1x2', 252, 120, [['time','year'],['time','weekday']]]`
  - `['1xfull', 1080, 120, [['calendar','month']]]`（确认单行不显示标题）
- `scripts/test-render.mjs` / `test-layout.mjs` 如有 `CONTENT_FIT` key 完整性断言，需同步补新 key。

---

## 附录 B：与 Phase 2（UX）交叉的视觉数值（应 `ux-designer` 请求补充）

> 对应 `docs/v131-ux-spec.md` 的 §1.5 置中三态、§2 单行显示按钮、§3 删除确认悬浮条。以下数值为**视觉侧裁定**，`ux-designer` 已同步。

### C1 占格编辑器置中按钮三态

基线（既有 `.se-toggle`）：`border:1.5px`、`padding:4px 12px`、`font-size:11px`、`weight:600`、`radius:999px`、`transparent`。既有 `.on` 态只靠内联 `border-color/color/background:${theme}1A` 表达 —— **只有颜色，无形状差异**，这正是要补的。

| 态 | 边框 | 背景 | 文字 | 角标 | 备注 |
| --- | --- | --- | --- | --- | --- |
| **关 / 默认关** | `1.5px solid var(--apple-separator)` | transparent | `var(--apple-label-2)` | 无 | 现状 |
| **开** | `1.5px solid ${theme}` | `${theme}1A`（10%） | `${theme}` | 无 | 现状 + 可选前置 ✓ 勾（9×9，`aria-hidden`） |
| **默认**（`b.align` 未显式设置） | 同「关」 | transparent | `var(--apple-label-2)` | 「默认」角标 | 角标见 C1.1 |
| **接管**（该轴被卡片级覆盖） | **`1.5px dashed var(--apple-separator)`** | transparent | **`var(--apple-label-3)`** | 「接管」角标 + 12×12 锁 svg（`aria-hidden="true"`） | `cursor:not-allowed`；**不加 `pointer-events:none`**（要能点出提示） |

#### C1.1 角标（badge）规格 —— 与主文字用不同的对比度口径

角标承载状态语义，**不适用** WCAG 1.4.3 的「非活动界面组件」豁免（主文字因为是 `aria-disabled` 才豁免到 ≥3:1）。角标字号 10px 属小字，**须按 4.5:1 考核**。

角标结构：`font-size:10px; font-weight:700; border-radius:5px; padding:1px 5px`，置于按钮文字右侧。
配色（**已定稿为 A**，与 `ux-designer` 达成一致）：

| 方案 | background | color | 浅色对比度 | 深色对比度 | 结论 |
| --- | --- | --- | --- | --- | --- |
| **A ✅ 已采纳** | `var(--apple-fill)` | **`var(--apple-label)`** | **16.54 ✅** | **10.81 ✅** | 两端远超 4.5；且角标（16.54/10.81）明显比接管态主文字（3.44/3.16）清晰——正是「状态语义不能被灰掉」的意图 |
| B（备选） | `transparent` | `var(--apple-label-2)` | 10.94 ✅ | 5.94 ✅ | 更轻、更安静；但角标与主文字同级，需靠字号/间距区分 |
| ❌ C | `var(--apple-fill)` | `var(--apple-label-2)` | 8.62 ✅ | **4.42 ❌** | 深色差 0.08 未达 4.5 |
| ❌ D | `var(--apple-fill)` | `var(--apple-label-3)` | **3.14 ❌** | 2.72 ❌ | 不可用 |

角标底的实际合成色（供实现核对）：**浅 `#E4E4E6` / 深 `#3D3D41`**（`--apple-fill` 叠卡片后）。

> ⚠️ 核算口径提醒：对比度必须**对角标自己的背景**（`--apple-fill` 叠卡后浅 `#E4E4E6` / 深 `#3D3D41`），而不是对卡片底。C 方案常被误判为「深色 5.94」——那是 label-2 对**卡片底**的值，对角标底只有 4.42。

**角标互斥规则**：「默认」与「接管」是两个独立维度，1×FULL 上会同时命中（`b.align` 未显式设置 + 卡片级开启）→ 会挂两个角标、很吵。
**规则：接管态优先，接管时不再显示「默认」角标**（此时单元级设置本就无效，「默认」是噪音）。

**⚠️ 对比度修正（必须改）**：UX 原稿写 `opacity: .45`。实测浅色模式 `--apple-label-2`(#3C3C43) 在白卡上：
| opacity | 0.45 | 0.50 | 0.55 | 0.60 | 0.70 |
| --- | --- | --- | --- | --- | --- |
| 对比度 | **2.40 ❌** | 2.67 ❌ | 3.02 ⚠️ | **3.44 ✅** | 4.46 ✅ |

`.45` 只有 **2.40:1，不满足 ≥3:1**。**不要用整体 opacity**，改为文字/边框直接取 `var(--apple-label-3)`：浅色 3.44:1、深色（#EBEBF560 on #1C1C1E）3.16:1，两端都达标且不依赖 opacity 叠加计算。**若坚持要"灰显"观感，opacity 下限为 0.6。**

**⚠️ 角标互斥规则**：「默认」与「接管」是两个独立维度，1×FULL 上会同时命中（`b.align` 未显式设置 + 卡片级开启）→ 会挂两个角标、很吵。
**规则：接管态优先，接管时不再显示「默认」角标**（此时单元级设置本就无效，「默认」是噪音）。

### C2 `.se-toggle` 触摸尺寸（对 UX §4「≥44×44」的一处偏离建议）

现有 `.se-toggle` 高度约 **26px**（11px×1.4 + 8 + 3），本就低于 44px。
建议：**视觉 `min-height: 36px`（padding 改 `8px 14px`）+ 用伪元素把热区撑到 44px**：
```css
.se-toggle { position: relative; min-height: 36px; padding: 8px 14px; }
.se-toggle::after { content:''; position:absolute; left:0; right:0; top:-4px; bottom:-4px; }
```
理由：44px 是**热区**要求而非视觉盒子要求（WCAG 2.2 SC 2.5.5 说的可点区域；SC 2.5.8 底线仅 24px）；实心 44px 高的胶囊配 11px 文字会显得空旷。36px 视觉 + 44px 热区是 Apple 小尺寸 chip 的通行做法。

**⚠️ 必须整组一起改（已与 ux-designer 达成一致）：`.se-toggle`、`.se-actions`（自适应 / FULL）、`.chip-tool` 三者同步 36px 视觉 + 44px 热区**，不允许只改其中一个，否则同面板内两种高度并存更糟。
**唯一例外**：悬浮删除条按钮保持实心 44px（破坏性操作不做热区技巧）。

**⚠️ 热区重叠修正**：`::after` 上下各扩 4px，两行按钮的热区各占 4px → 需要行间距 ≥ 8px 才不重叠。实测：

| 行间距 | 6px（现状 `.se-toggles` gap） | 8px | 10px |
| --- | --- | --- | --- |
| 相邻两行热区间隙 | **-2px（重叠 ❌）** | 0px（恰好相接） | +2px（安全） |

→ **只加行距，横向节奏不动**（已采纳 `ux-designer` 的拆法：`::after` 只上下扩，横向 6px 本就够）：
```css
.se-toggles { column-gap: 6px; row-gap: 8px; }   /* 原 gap:6px */
```
`.se-actions` 的 `margin-top:8px` 恰好够，不用动。
`ux-designer` 提的 `.se-actions{position:relative;z-index:1}` 只决定重叠区归谁、**不能消除重叠**（会让上一行按钮底部 2px 失效）。两者都加：`row-gap:8px` 为主、`z-index:1` 兜底。

### C3 「单行显示」按钮隐藏后（UX 需求 2）

`.se-toggles` 已是 `flex; flex-wrap:wrap; gap:6px`，少一个子元素**不会破坏布局**。三条要求：
1. **保持左对齐**，不要改成 `space-between` / `center` —— 否则 1×FULL 上出现第三个按钮时整行会跳动；
2. `margin-top:10px` 保持不变（不因元素数变化而改）；
3. 不加占位元素。

新增副标题（UX §1.6 的 `alignHint`）建议独立元素、放在 `.se-toggles` **之外**：
`.se-hint { font-size:11px; font-weight:500; color:var(--apple-label-3); line-height:1.35; margin-top:6px; }`

### C4 删除确认悬浮条（UX 需求 5）视觉数值

同意 UX 原稿的：圆角 14px、阴影 `0 8px 28px rgba(0,0,0,.28)`、`bottom: calc(12px + env(safe-area-inset-bottom,0px))`、z-index 140/130、曲线 `cubic-bezier(0.32,0.72,0,1)`、`cf-arm` 350ms 防误触。补充/修正：

| 项 | 值 |
| --- | --- |
| 容器 | `background:var(--apple-card); border-radius:14px; padding:12px 14px; gap:10px; box-shadow:0 8px 28px rgba(0,0,0,.28)` |
| 深色模式描边 | **追加** `border:1px solid var(--apple-separator)` —— 深色下 `box-shadow` 几乎不可见，没有边界会"浮不起来"（可用 `.fullscreen.dark` 作用域） |
| 按钮圆角 | **10px**（= 容器 14 − 内距 4，同心圆角）。既有 `.mgr-btn` 是 9px，此处统一到 10px |
| 「取消」（左） | 复用 `.mgr-btn` 基础样式：`border:1.5px solid var(--apple-separator); background:var(--apple-card); color:var(--apple-label)`；`min-width:88px; min-height:44px` |
| 「确认删除」（右） | 复用已有 `.mgr-btn.danger.solid`：`background:var(--apple-red); color:#fff`，**补 `border:1.5px solid var(--apple-red)`**（与左键等高）；`min-height:44px` |
| 文案 `.cf-text` | `flex:1; min-width:0; font-size:12px; font-weight:600; color:var(--apple-label); line-height:1.35; -webkit-line-clamp:2; display:-webkit-box; -webkit-box-orient:vertical; overflow:hidden` |
| 窄屏 | `@media (max-width:320px)`：`.cf-text{flex:1 1 100%}`（文案独占首行）、按钮行两按钮各 `flex:1`。保留 `flex-wrap:wrap` 作兜底 |
| `.mgr-list` 留白 | 悬浮条高度 ≈ 68px + bottom 12px → 建议 `padding-bottom: **92px**`（原稿 84px 略紧，最后一行仍会被压住一点） |

**⚠️ 三处缺陷修正（务必改，否则功能失效）**

1. **深色模式遮罩不可见**：`.fullscreen` 深色背景是 `#000000`，`rgba(0,0,0,.22)`（甚至 .50）叠上去仍是 `#000`，遮罩**完全看不出来**，用户不知道进入了"待确认"态。
   → 在 `.fullscreen` 上按 `dark` 加 class（`mainPage.js:2262` 已有 `appleThemeVars(dark)` 可同位加），用 `.fullscreen.dark .mgr-scrim { background: rgba(0,0,0,.55) }`；浅色保持 `.22`（叠在 `#F2F2F7` 上得 `#BDBDBD`，压暗感明确）。
   深色下若仍需可辨，可再叠 `box-shadow: inset 0 0 0 999px rgba(255,255,255,.06)`（不用 backdrop-filter，避免包含块问题）。
2. **遮罩会吃掉导航栏**：`.mgr-scrim { inset:0; z-index:130 }` 覆盖整个 `.fullscreen`，而 `.fs-nav`（返回 / 完成）无 `z-index` → 用户点「返回」会先命中遮罩，变成"取消"而不是"关闭页面"，UX §3.4 的「返回/完成 关闭页面并复位」这条路径失效。
   → `.fs-nav { position:relative; z-index:150 }`（高于悬浮条 140）。导航栏保持可用且不被压暗，语义也正确。
3. **`prefers-reduced-motion` 会让按钮永久失效**：`cf-arm` 用 `animation` 恢复 `pointer-events`。若 reduced-motion 的 `animation:none` 规则命中到 `.cf-btn`，按钮将**永远不可点**（破坏性操作直接卡死）。
   → reduced-motion 的关闭规则**只能作用于 `.mgr-confirm` 与 `.mgr-scrim` 两个容器**，绝不能写成 `.mgr-confirm *` 或全局。建议显式写 `.mgr-confirm .cf-btn { pointer-events:auto }` 兜底在 reduced-motion 分支里。

补充（体验项，`ux-designer` 已采纳并改了实现）：单条删除时若被删行不在视口内，需把它滚进视口，否则「让用户看清删的是哪一条」（`.armed`）的目的落空。
改用手动算 `.fs-body.scrollTop` + 只在行未完整可见时才滚（**不用 `scrollIntoView`**，它会向上冒泡滚动宿主面板/页面，iframe 内可能带动外层滚动）。若用 `behavior:'smooth'`，`prefers-reduced-motion` 下必须降级为 `'auto'`，否则与关闭动画的决定自相矛盾。
`.armed` 视觉：`box-shadow: inset 0 0 0 1.5px var(--apple-red)`（用 inset 而非 border，避免行高跳动）。

### C5 1×FULL 月历关闭「单行显示」后的可读性（回答 UX §2.3 附带核对项）

实测（1×FULL `cellW=105, cellH=48`，`month` fit `{w:6.8,h:7.0}`）：

| 占格 | 块像素 | u | 日格字号 | 日格物理宽 |
| --- | --- | --- | --- | --- |
| 6×2（现状 prefSpan） | 630×96 | **13.02** | **7.32px** | ≈90px（宽扁） |
| 2×2（UX 建议回退） | 210×96 | **13.02** | **7.32px** | ≈30px（近正方） |
| 8×2 | 840×96 | **13.02** | **7.32px** | ≈120px |

结论：
1. **`u` 被块高（96px）锁死在 13.02，与占格宽度无关** —— 1×FULL 只有 2 行高，非单行月历的日格字号恒为 **7.32px**，不可读。这是**尺寸本身的限制**，不是 `prefSpan` 的问题。
2. **因此「回退到 2×2」并不能提升字号**（都是 7.32px）。但它仍**值得做**，理由不同：6 列时日格被拉伸成 90px 宽的扁矩形、7px 数字周围全是空白，比 2 列（30px 近正方）更糟。
3. **我的建议**：`prefSpan` 回退到 `2×2`（同意 UX 方向，但理由如上），**同时**在用户于 1×FULL 手动关闭单行显示时给一次提示（复用 D6 的 `_showHint`，2.4s），告知「1×FULL 高度有限，非单行月历字号较小」。两者一起做，才是完整解法。
4. **守卫（`ux-designer` 补，采纳）**：回退只在 `opts.singleLine === false` **显式设置**时生效，默认值不算 —— 1×FULL 默认 `singleLine=true` 仍走 6×2，**存量用户零影响**。hint 与回退缺一不可：只 hint 不回退 → 用户仍看到 90px 扁日格；只回退不 hint → 用户以为被改坏了。

### C6 既有占格徽标 `.chip-span` 的对比度修正（**进 v1.31**）

`ux-designer` 在 §1.9 登记为 follow-up，**我裁定收进 v1.31**。理由：改动是 2 个文件各 1 行 `color`；该徽标显示的是**真实占格数值**（`${rows}×${cols}` / 「溢出」），不是装饰，不适用任何豁免；且它与本迭代新增的角标在**同一块面板相邻位置**，留一个 3.14 的徽标在 16.54 的角标旁边是说不过去的不一致。

现状（`mainPage.js:1948-1957` 与 `widgetConfig.js:1122-1131` **两份完全相同**）：
`font-size:9px; font-weight:700; color:var(--apple-label-3); background:var(--apple-fill); border-radius:5px; padding:1px 4px`

| 状态 | 现状 | 判定 |
| --- | --- | --- |
| 主态 | 浅 **3.14** / 深 **2.72** | ❌ 远低于 4.5（9px 小字） |
| 改 `color: var(--apple-label)` | 浅 **16.54** / 深 **10.81** | ✅ 与本迭代角标 A 方案**完全一致** |

**改动**：两个文件的 `.chip-span` 各把 `color: var(--apple-label-3)` 改为 `color: var(--apple-label)`。**只改这一行，不动字号 / 圆角 / 内距 / 背景。**

**另登记 follow-up（不进 v1.31）**：`.chip-span.bad`（「溢出」态）是 `color:#fff; background:#FF3B30`，白字在 `#FF3B30` 上只有 **3.55:1**，同样不达标。涉及品牌红，需产品确认。两条候选（`ux-designer` §1.9 已登记）：

| 方案 | 写法 | 对比度 | 主题依赖 | 评价 |
| --- | --- | --- | --- | --- |
| **1（推荐）** | `background:#D70015; color:#fff` | **5.38 ✅** | **无**（两色都硬编码，深浅同值） | 一条规则同时满足深浅两模式；保留「白字 + 红底」的错误态惯例 |
| 2 | 保留 `#FF3B30` 底，`color:#000` | 5.92 ✅ | **必须硬编码**，见下 | 不动品牌红；但深色模式下红底黑字观感需确认 |
| 2′ | 同上，`color:#1C1C1E` | 4.80 ✅ | 同上 | 比纯黑柔和，但余量小 |
| ❌ 2″ | 同上，`color: var(--apple-label)` | 浅 5.92 ✅ / **深 3.55 ❌** | — | **陷阱**：`--apple-label` 深色下是白色，会退回现状 3.55，等于没改 |

> ⚠️ 我的候选「红字 + `--apple-fill` 底」已作废 —— 实测浅 **2.79** / 深 **3.05**，比现状更差（`ux-designer` 复核发现）。红字只能用在红底上，不能用在灰底上。

**两条实现禁令（写死，防止「顺手规范化成 CSS 变量」把修复抵消掉）**

| # | 禁令 | 原因 |
| --- | --- | --- |
| 1 | 走方案 2 / 2′ 时文字**必须硬编码近黑**（`#000` 或 `#1C1C1E`），**禁止 `var(--apple-label)`** | `--apple-label` 深色下是白色 → 深色退回 **3.55**，等于没改 |
| 2 | **不要把硬编码 `#FF3B30` 换成 `var(--apple-red)`** | `--apple-red` 深色下是 `#FF453A`（更亮），白字在上面只有 **3.41:1**，**比现状 3.55 还差** |

白字在各红底上的对比度（9px，需 ≥4.5）：`#FF3B30` 3.55 ❌ / `#FF453A` 3.41 ❌ / **`#D70015` 5.38 ✅** / `#C1121F` 6.22 ✅（后者余量更大，可作备选）。

对照：`.chip-grip`（⣿ 拖拽手柄，`label-3`，10px）属**非文本**图形，按 WCAG 1.4.11 只需 ≥3:1 → 现状浅 3.44 / 深 3.16 ✅ **不用改**（已标「不要顺手一起改」）。

---

## v1.40 三项显示优化（beta，2026-10-20）

### ① 年 / 星期小卡规则对调

截图反馈：原 2×1 窄高卡显示「2026 / 周四」、1×2 宽扁卡显示「26 / 周二」，二者应互换。

- `SMALL_CARD_SIZES` 由 `{'1x1','1x2'}` 改为 `{'1x1','2x1'}`（`card-mode-render.js`）。
- `isSmallUnit(span, size)`：卡片尺寸 ∈ `SMALL_CARD_SIZES` **且**该单元水平占格 `cols === 1`（垂直不限）。
- 命中后：`year` 渲染后两位（`yearShort`）、`weekday` 主文字字号减半（`pv-wd-sm`，1.875em→0.9375em，副标题 `pv-sub-sm` 0.5625em→0.5em）。
- 效果：**2×1 窄高卡走小号**（26 / 周四），**1×2 宽扁卡走全量**（2026 / 周四）。

### ② 四样式（节日 / 节气 / 距放假 / 最近日程）占格放开 + flat/tall 显示

- `user-store.js` 样式目录：`festival` / `solarTerm` / `holidayGap` / `recent` 加 `minArea: 2`，声明 `span: {cols:2,rows:2}`。
  - `minArea > 0` 表示「禁 1×1（面积 <2 不可读），但允许 1×2（宽扁）或 2×1（窄高）」。
  - 机制：`spanBounds` 在 `minArea>0` 时把每轴下限退为 1（`floor={cols:1,rows:1}`），由面积校验接管；`autoLayout` 放不下首选 2×2 时按 `[{cols:2,rows:1},{cols:1,rows:2}]` 依次试放（过滤面积 ≥ minArea、不超网格、跳过等于首选的占格）。
- **宽扁块**（块像素比 `blockW ≥ 2 × blockH`，新增 `FLAT_RATIO=2` / `isFlatBlock`）走**双栏 flat 布局**：`countdownFlat` 产出 `.pv-center.pv-flat > .pv-fnum[.pv-big+.pv-sub] + .pv-ftext[.pv-row2+.pv-sub]`（数字列 + 文字列横向并排）。`fitFor` 对 `important` / `schedule.recent` 在 `opts.flat` 时切到 `__flat` 固有尺寸。
- **窄高块**（像素比 `blockH ≥ 2 × blockW`，`TALL_RATIO=2`）保持竖排，`__tall` 与默认竖排同源（DOM 一致，仅 FIT key 独立便于后续调参），不额外缩窄宽度预算（否则窄块会溢出）。`multiple` 不被 flat/tall 劫持。

**实测 FIT 值**（measure.html F 组，含 3 位天数最坏情况：365）：

| 内容 | key | w(zh) | wEn | h |
| --- | --- | --- | --- | --- |
| important | `__default` | 3.47 | 7.95 | 5.64 |
| important | `__flat` | 6.22 | 11.91 | 2.79 |
| important | `__tall` | 3.47 | 7.95 | 5.64 |
| schedule.recent | `recent` | 3.47 | 4.98 | 5.64 |
| schedule | `__flat` | 6.97 | 8.95 | 2.79 |
| schedule | `__tall` | 3.47 | 4.98 | 5.64 |

> CONTENT_FIT 改动均经 measure.html 实测回写（不要凭估计填数）。

### ③ 多个日程占格

- `schedule.multiple` 加 `minSpan: { cols: 2, rows: 1 }`：水平最低 2、垂直可到 1。
- 空间不足时按 `availH` 自适应减少日程条数（行高 `SCH_ROW_H_NARROW=0.9375em` + 行距 `SCH_ROW_GAP=0.3125em`，`rows = floor((availH - 0.2 + 0.3125) / (0.9375 + 0.3125))`）。

### 编辑器面积校验（防 1×1）

- `spanBounds` 新增输出 `minArea`。
- `renderSpanEditor` 步进「−」按钮在「面积将跌破 minArea」时禁用：`垂直−` 禁于 `span.cols*(span.rows-1) < minArea`；`水平−` 禁于 `(span.cols-1)*span.rows < minArea`。
- `mainPage._cardResizeSpan` / `widgetConfig._resizeSpan`（步进）与 `_cardResizeSpanTo` / `_resizeSpanTo`（点格拉伸）在 `cols*rows < minArea` 时拒绝并提示：`占格最小为 1×2 或 2×1（不能调到 1×1）`。

### 测试与预览

- `test-layout.mjs`：四样式 `spanBounds.minArea===2` 且 `min` 每轴为 1；`autoLayout` 在 1×2 卡首行被占后 festival 降级为 `{2,1}`；`multiple` 在 2×1 卡降级为 `2×1`（3342 断言通过）。
- `test-render.mjs`：`isSmallUnit` 对调（2×1 小卡 / 1×2 全量）；`fitFor` flat/tall 钩子；flat 渲染含 `pv-flat/pv-fnum/pv-ftext`（344 断言通过）。
- `make-preview.mjs`：新增 6 个用例（2×1 年/星期小号、1×2 年/星期全量、1×2 节日/节气双栏、2×1 节日/最近日程竖排、2×2 距放假/多日程双栏混合、1×2 节日通栏）。
- `measure.html`：F 组实测 flat/tall 固有尺寸并回写上表。

---

## v1.41 修复 — 窄高块「今天」水平归中（beta，2026-10-20）

**现象**：节日/节气/距放假/最近日程四样式在水平占格为 1（2×1 窄高块）且事件为今天时，主文字「今天」（两个汉字）折行后左贴边，未水平归中。

**根因**：`.pv-big` 在 1.875em 下「今天」宽 3.75em，超过 `__tall` 宽度预算 w=3.47（该值按 3 位天数「365」实测）→ 文字折行；flex fit-content 盒在内容溢出时占满整行可用宽，折行行默认 `text-align: start` → 左贴边。单字符（如「4」）盒收缩为单字宽，由 `align-items: center` 正常居中，故仅今天场景可见。

**修复**：`.pv-center` 增加 `text-align: center`（widget.js / mainPage.js / widgetConfig.js / make-preview.mjs / measure.html 五处 CSS 镜像同步）。折行行随盒居中；不影响 `multiple` 日程列表（走 `.pv-col`，左对齐设计不变）与 flat 双栏（`.pv-ftext` 本就 text-align:center）。未改 `__tall` 的 w=3.47——保持 3 位数字场景的字号上限，今天场景以折行+居中呈现（高度余量充足，实测无溢出）。

**验证**：`test-render.mjs` 新增 3 项断言（三组件 `.pv-center` 带 text-align:center，347 项通过）；`test-layout.mjs` 3342 项通过；lint 0 errors；make-preview 重建后无头 Chrome 截图肉眼核验 2×1 节日/最近日程用例「今/天」居中。

---

## v1.42 修复 — 窄高卡「水平2×垂直1」占格走 flat（beta，2026-10-20）

**现象**：四样式占格为水平 2、垂直 1 时，窄高卡（如 120×252）上该块不走 flat 双栏，回退默认竖排堆叠（宽卡/方卡同占格正常）。

**根因**：flat 判定 `isFlatBlock` = 块宽 ≥ 2×块高（纯像素比）。窄高卡格子非正方（60×63），2×1 块 120×63 像素比 1.9:1 不达阈值；卡越窄比值越低（96×57 ≈ 1.68:1，预览卡有内边距即此形态）。

**修复**（`card-mode-render.js` renderBlocksHTML）：倒数型四样式（important / schedule.recent）补「占格意图」判定——`span.rows === 1 && blockW > blockH` 也走 flat（显式选 2×1 即横向意图）。非倒数内容（time/calendar/schedule.multiple）不受影响；2×2 近方形占格不触发；像素比 ≥2:1 的原有判定保留。

**验证**：`test-render.mjs` 新增 3 项断言（窄高卡 2×1 倒数走 flat / time 同占格不劫持 / 2×2 不触发，350 项通过）；`test-layout.mjs` 3342 项通过；lint 0 errors；make-preview 新增「窄高卡 2×1×3 倒数」用例并截图核验三块均横向双栏（「今天」折行后居中于数字列，与 v1.41 折行居中行为一致）。

---

## v1.43 新增 — 7 种卡片规格的推荐默认样式（beta，2026-10-20）

**背景**：拼接模式下 7 种规格卡片默认空白，新用户面对空卡无从下手。v1.43 起「从未设置过内容」（`cardBlocks` 为 null/undefined）时按尺寸套用推荐默认；显式空数组 `[]` 表示用户主动清空，保持空白（不覆盖用户意图）。

**默认布局表**（`DEFAULT_CARD_BLOCKS`，span 为细网格列×行）：

| 规格 | 默认块（内容/样式 @ 占格） |
|------|------------------------------|
| 1×1 | 时间/日 @ 2×2（整卡「日」数字） |
| 1×2 | 时间/年月日 @ 2×2 + 日程/最近日程 @ 2×2 |
| 2×1 | 时间/年月日、重要日期/节日、重要日期/节气、日程/最近日程（各 @ 2×1） |
| 2×2 | 时间/年月日、节日、节气、最近日程（各 @ 2×2） |
| 2×4 | 日历/周日历 @ 8×1 + 时间/时分秒 @ 4×3 + 日程/最近日程 @ 4×3 |
| 4×4 | 日历/月日历 @ 8×5 + 节日、节气、距放假、最近日程（各 @ 2×3） |
| 1×FULL | 日历/月日历 @ 8×2（单行月历，运行时按宽度拉伸铺满 4~10 列） |

**实现**：`user-store.js` 新增 `DEFAULT_CARD_BLOCKS`（常量）与 `defaultCardBlocks(size)`（深拷贝取用，未知尺寸回退 2×2）；`sanitizeBlocks(list, mode, size)` 在 `list == null && mode === 'combo'` 时取默认块，其余逻辑不变。默认值不写入存储（读取时计算），后续调整默认样式可对所有未配置过的卡片生效。

**验证**：`test-layout.mjs` 新增 v1.43 块（7 尺寸块数、全部放得下、无重叠、1×1 为「日」、1×FULL 为 2×8 月历、深拷贝隔离），3366 项通过；`test-render.mjs` 350 项通过；lint 0 errors；`scripts/make-defaults-preview.mjs` 直接复用 `sanitizeBlocks(null,…)` 生成 `defaults-preview.html`，截图核验 7 张卡。

---

## v1.44 三步优化（beta，2026-10-21）

### 一、置中交互：从「接管」改为「点击即移交」
- **旧模型**：卡片级置中开启的轴，单元级开关被软禁用（锁图标 +「接管」角标），点击只弹提示、不生效 → 用户以为坏了。
- **新模型**：单元级开关**始终可点**。点击时若该轴由卡片级控制，先「钉住当前有效值 + 关闭该轴卡片级」，再执行本次切换，提示`已切换为单元级控制`；不会有「点了没反应」。
- 空间不足：`report.clamped[axis]` 为真 → 提示`空间不足，已尽量居中`。
- 位移过渡：`@media (prefers-reduced-motion: no-preference) { .pv-block { transition: left .16s ease, top .16s ease } }`（用 no-preference 开门，不占用既有 reduce 媒体查询）。
- 作用域：widgetConfig 的卡片级置中写部件配置（`cardCenterH/V`，未设置回退全局），与 mainPage 全局口径并存。

### 二、矩阵审计（`scripts/audit-matrix.mjs`）
- 覆盖 7 尺寸 × 22 样式 × 推荐/最小占格 = 308 组合，无头 Chrome 测量：块溢出、子元素越界、块根字号、**主文字/次要文字最小字号**。
- 判定：`CLIP`（溢出>1px 或越界）> `TINY`（主文字<9px）> `SUB`（次要<5.5px）> `OK`；「最小占格」遵守 `minArea`（面积下限生效时 1×1 已非法，改测 2×1/1×2 降级候选）。
- 基线：OK 260 / SUB 44 / TINY 2 / CLIP 2 → 修复后 **OK 284 / SUB 24 / TINY 0 / CLIP 0**。

### 三、按矩阵修复
- `time.hms`、`time.dateFullWeekday` 声明 `minArea: 2`：禁 1×1 占格（hms 1×1 横向溢出 4px；dateFullWeekday 主字号仅 7.9px）。1×1 场景改由 2×1 或 1×2（竖排）承担。
- 块根字号 <10px 时追加 `.pv-tight`，`display:none` 隐藏 `.pv-sub`（48px 小块里副标题只有 ~5px，不可读）。

### 四、单独模式按尺寸版式
- 容器加 `pv-single-<size>`；字号基准随尺寸放大：1×1 16 / 1×2 17 / 2×1 17 / 2×2 22 / 2×4 26 / 4×4 34 / 1×FULL 18（px）。
- 版式：1×1 隐藏副标题、主字 1.25em；1×2 / 2×4 / 1×FULL 横排（gap 0.75 / 0.875 / 1em）；2×1 纵排（gap 0.375em）；2×2 居中；4×4 副标题放大 0.6875em。
- 只作用于 `.pv-single`，不影响拼接模式。

**验证**：test-render 384、test-layout 3370、lint 0 errors。

### 五、日期「数值 + 单位」同排规则（v1.44）
- **规则**：`年月日 / 年月 / 月日 / 月日星期 / 年月日星期` 横排时，每个「数值+单位」（`2026年`、`10月`、`18日`、`周日`）包在 `.pv-seg { white-space: nowrap }` 里，**单位绝不与数值分行**；段与段之间用 `<wbr>` 提供换行点，空间不足时整段换到下一行。
- **窄块年份降两位**：块宽 <150px 时年份显示后两位（`26年`），省约 1.1em，换取段内同排；宽块仍显示四位（`2026年`）。`renderBlocksHTML` 传 `shortYear: blockW < 150`；单独模式按尺寸推断（1×1 / 1×2 / 2×1 为两位）。
- **实现**：`card-mode-render.js` 新增 `seg()` / `joinSegs()` 辅助，替换 5 个样式的纯字符串拼接；五处 CSS 镜像补 `.pv-seg`。
- **验证**：test-render 392（新增 8 条：段包裹、`<wbr>` 位置、窄块两位年、段数 2/4、CSS 镜像）；矩阵审计仍 **0 裁切 / 0 主文字过小**（换行由段边界承担，不产生溢出）。

### 六、预览与实际一致性（v1.45）
- **问题**：配置页预览用**写死的等比尺寸**（按尺寸网格缩放，宽高比固定），而 widget 用**宿主实测宽高**算网格（1×FULL 按宽度取 4~10 列、其它尺寸单元格 <24px 会降密度）→ 同一占格得到不同块宽/不同字号 → 预览与实际不一致。
- **修法**：
  1. `user-store.js` 新增 `comboGridFor(size, w, h)`——把运行时网格规则（1×FULL 列数、<24px 降密度、保底 2）收敛为一个函数，widget / mainPage / widgetConfig / make-preview / audit-matrix 全部共用。
  2. widget 在 `_measure()` 里把实测尺寸（`{size,w,h}`）防抖 600ms 回写到用户设置 `previewSize`（变化 <4px 不写，避免循环）。
  3. 两处预览优先用 `previewSize`：按真实宽高比缩放到预览框，`cellW/cellH` 用真实内边距（24px × 缩放）；无实测数据时退回原「等比示意」。
- **注意**：`previewSize` 要等 widget 至少渲染一次后才有值；在此之前预览仍是示意（近似）模式——部署后刷新面板即生效。
- **验证**：test-layout 3377（新增 `comboGridFor` 6 条：1080→10 列、700→8、520→6、300→保底 4、窄卡降密度、未测尺寸回退）、test-render 395（新增 3 条预览同源断言）。

---

---

## 附录 C：决策速查（给 team-lead 的一页纸）

| # | 决策 | 关键数值 |
| --- | --- | --- |
| 6 | 新增 `dateMonthDay`（月日 / M/D），插在 `dateFull` 后第 2 位；span 2×1，无 minSpan | `CONTENT_FIT { w:4.6, h:1.3, wrap:true }`；zh `10月20日` / en `Oct 20` |
| 4 | 日历块 `cols ≥ 4 && !singleLine` 时显示**居中**的日期标题（**拍板：月历不带星期、周历带星期**）；month 升级现有表头、week 新增表头 | 日期 0.75em、星期 0.5625em、间距 0.3125em；**`monthTitle {6.8, 7.0}` ✅定稿**、`weekTitle {7.8, 3.1}`；代价 **month 0%、week 0%**（week 的 rows=1 超扁块除外，-29%） |
| 7 | 竖排判定用**实际像素比** `blockH ≥ 2×blockW`（不是格数比）；6 个 time 样式 + 周日历受影响；周日历 = 7 天改 7 行 | `TALL_RATIO=2`；行字号 1em（日期）/1.875em（时间）；行距 0.1875em / 0.125em；`weekVert {3.8,8.5}` |
| 8 | `year`/`weekday` 已可用，无需新增定义；1×1 占格下年取后两位、星期主文字 ×0.5 | `yearShort {2.6,3.2}`、`weekdaySmall {2.0,5.3,2.1}`；主文字 1.875em→0.9375em，副标题 0.5625em→0.5em |
| 交叉（附录 B） | 与 UX 对齐的 6 项：置中三态 / 44px 热区 / 单行按钮 / 悬浮删除条 / 徽标对比度 / 1×FULL 月历回退 | 角标 `--apple-fill` + `--apple-label`（16.54/10.78）；`.se-toggle` 36px 视觉 + 44px 热区（`row-gap:8px`）；`.chip-span` 改 `var(--apple-label)`（3.14→16.54）；悬浮条圆角 14 / 按钮 10，`min-height:44px`，补白 92px |
