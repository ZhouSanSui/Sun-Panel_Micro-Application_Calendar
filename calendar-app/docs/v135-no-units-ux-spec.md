# v1.35「简约显示」开关（5 个日期样式）· 交互与体验规格【定稿】

> 需求：① 显示样式「年月日」后新增「年月」；② 为 年月日 / 年月 / 月日 / 月日星期 / 年月日星期 增加默认关闭的「简约显示」开关；③ 简约 = 不显示 年/月/日 单位，横向用「中心原点」代替单位，竖向只显示数字。
> 本文只给交互决策与落地要求，不含实现代码。术语沿用 `docs/v131-ux-spec.md`。配套视觉规格：`docs/v135-no-units-visual-spec.md`。
>
> **两层命名，不要混用**
> - **界面文案层**（用户看到的字）：**「简约显示」/ `Compact`** —— 用户 zhousansui 拍板，不再讨论。
> - **内部标识层**（字段 / 函数 / 常量）：一律 **`noUnits`** —— `opts.noUnits`、`noUnitsOn()`、`NO_UNITS_DATE_STYLES`、`onToggleNoUnits`、`_toggleSpanNoUnits`、CONTENT_FIT 后缀 `...NoUnits`。原因：`src/core/user-store.js:66`（`customCountdown.compact`「紧凑」）与 `:75`（`simpleCalendar.compact`「紧凑」）已存在同名 style key，内部再叫 `compact` 会撞 key。
> - 下文凡写 `noUnits` 均指**标识**，凡写「简约显示」/ `Compact` 均指**界面文案**。
>
> **修订记录**
> - v1.0 初稿（含备选文案论证）。
> - v1.1 定稿：按 team-lead 4 项裁决同步（文案改「简约显示」/`Compact`、按钮文案走内联三元、圆点间距改实测反推公式、en 竖排转纯数字、en aria-label 取非简约原串）。
> - **v1.2（当前）**：按无头 Chrome 实测同步 —— ① §8.4 圆点**强制方案 B 自绘**（实测 `·` advance = 1.000em，方案 A 废弃）；② §8.5 en 声明宽度偏差由「单开 follow-up」改判为**随 v1.35 一起修、独立提交**，写入实测数据与落地 `wEn`；③ 修正最坏值样本（非简约 en 取 `Wednesday, Sep 18`；简约 en 最宽短星期是 **`Mon`** 不是 `Wed`）。
> - **v1.3（2026-10-20，部署后反馈修订）**：① 用户反馈 1 —— 竖排 + 简约时**带星期样式与不带星期样式的数字字号必须一致**；根因是星期行（`周一` 2.5em）把 w 抬到 2.6 压垮同块字号，解法为星期行挂 `.pv-vline.wk { font-size:.7em }` 使其不再是宽度瓶颈，两个含星期 key 改声明 `w:1.7`、不声明 `wEn`（视觉规格 §3 已回写，`_probe.mjs` 生产同源复核字号严格相等）；② 用户反馈 2 —— §8.5 清单漏列 `dateWeekdayVert`（与 `dateFullWeekdayVert` 同缺陷类），同口径补 `wEn 2.5 → 3.1`。

---

## 1. 适用条件与出现位置

**决策：显示条件 = `c === 'time' && s ∈ NO_UNITS_DATE_STYLES`（5 个样式），与卡片尺寸无关——所有尺寸都显示；按钮放 `.se-toggles` 同一行的最后一个槽位，与「单行显示」互斥复用该槽位，不另起一行。**

理由

- 本开关只改文字排版（去单位 / 加 `·`），不改占格、不依赖网格高度。`singleLine` 限 1×FULL 是因为它切换的是「月历网格 vs 单行条」这种与可用高度强绑定的形态；本开关加尺寸限制没有依据，还会让用户在大卡设好、到小卡找不到按钮。
- **互斥判断成立**：`singleLine` 只属 `calendar:month`，本开关只属 `time:*`，内容 key 不相交 → 任何单元都不可能同现。故行内按钮数上限恒为 3（水平置中 / 垂直置中 / 二者之一），不会比现状更挤。

落地要求

- 新增常量 `NO_UNITS_DATE_STYLES = ['dateFull','dateYearMonth','dateMonthDay','dateWeekday','dateFullWeekday']`；新样式 key `dateYearMonth`（排在 `dateFull` 之后，span/minSpan 与 `dateMonthDay` 同为 2×1 / 1×1）。
- `widgetConfig._renderSpanEditor`（:724 附近）与 `mainPage._renderCardSpanEditor`（:1396 附近）对称加：`noUnits: (info.b.c === 'time' && NO_UNITS_DATE_STYLES.includes(info.b.s)) ? unitOpts(...).noUnits : null`，并传 `onToggleNoUnits`。
- `renderSpanEditor` 加一行 `noUnits === null || undefined ? '' : toggle(...)`；**不改 `toggle()` 本体**。`.se-toggles` 的左对齐 / wrap / 不加占位（§1.5）保持不变。

---

## 2. 文案与语义

**决策：中文「简约显示」，英文 `Compact`（用户拍板）。按钮文案恒定不变，开 / 关只靠 `.on` 的视觉态表达，不加「：开 / 关」后缀。**

理由与保留约束

- 备选「无单位 / `No Units`」（描述更准确、不与既有术语撞词）已提交评估，未被采纳，不再论证。
- **不加状态后缀**（未被推翻，仍需遵守）：① 同行按钮宽度在切换瞬间跳动 → 触摸端误点；② 英文 `Compact: On` 在窄配置面板会溢出；③ 状态由 `aria-checked` 播报。`.on` 已有边框 + 字色 + 背景三重差异，满足「色彩不是唯一通道」（§4）；不加前置 ✓，与既有置中开关保持一致。
- **`title` / `aria-label` 必须补行为描述**：「简约」是主观评价词，用户无法从名字预判结果，无障碍层必须写明「隐藏年/月/日单位」（见 §5）。
- 风险登记（已知、接受）：英文 `Compact` 与既有样式「紧凑」的英文名**完全相同**（`user-store.js:66/75`，`{ zh:'紧凑', en:'Compact' }`）。但两者分属不同 `displayMode`（本开关在 combo 模式的 `time` 日期样式；「紧凑」在 single 模式的 `CARD_MODES`），**不会同框出现**。若将来同框，需把本开关 en 文案改为 `Plain` / `No Units`。

落地要求：**按钮文案不引入 i18n key**，沿用 `card-mode-render.js:880` 既有的内联三元写法（该处「单行显示 / One line」就是内联的）：`isZh ? '简约显示' : 'Compact'`。

---

## 3. 默认值与状态持久化

**决策：`normalizeOpts` 增认 `noUnits`，未设置则不写该字段（整对象仍返回 `null`）；`unitOpts` 对 `noUnits` 不提供任何尺寸感知默认值——恒以 `!!o.noUnits` 为准，缺省即关。**

理由：`singleLine` 的「1×FULL 默认 true」正是 D13 的教训来源——尺寸感知默认值会随卡片尺寸静默改变存量用户视觉。`noUnits` 在任何尺寸下语义一致（默认关），无尺寸耦合，因此不需要、也不允许默认值分支；老数据 `opts` 无 `noUnits` → false → 视觉零变化。

落地要求

```js
export function normalizeOpts(v) {
  if (!v || typeof v !== 'object') return null;
  const out = {};
  if (v.singleLine !== undefined) out.singleLine = !!v.singleLine;
  if (v.noUnits !== undefined) out.noUnits = !!v.noUnits;
  return Object.keys(out).length ? out : null;   // 存量行为不变：无字段仍返回 null
}
// unitOpts：singleLine 分支不动，追加 ——
// const noUnits = (o && o.noUnits !== undefined) ? !!o.noUnits : false;
```

防御性改动（3 处各 1 行）：`widgetConfig.js:512`、`mainPage.js:1641`、`user-store.js:758` 目前是**整对象覆盖** `opts`，改为 `{...b.opts, ...}` 合并写，避免同单元多个 opts 字段互相抹掉。

---

## 4. 状态反馈与即时预览

**决策：不新增任何预览代码；只在「开启」方向弹一次 2.4s hint，关闭不弹。**

现状核实：占格编辑器**内部没有预览区**（`.se-body` 只有占格示意网格 + 步进器）。实时预览在编辑器上方 `_renderCardPreview` 的 `.pv-size-box`（widgetConfig.js:590-633），每次 `requestUpdate` 用最新 `cardBlocks` 重跑 `layoutBlocks` + `renderBlocksHTML`。「单行显示」的现状是 `_setBlockField → cardBlocks 换引用 → requestUpdate()`，预览与 chip 徽标同帧刷新，且**只在 1×FULL 手动关闭时**弹一次 `CARD_SINGLELINE_SMALL_FONT`。

落地要求

- `_toggleSpanNoUnits` 完全照抄该链路（`_setBlockField(info.idx, { opts: {...} })`），预览自动同步，无需新逻辑。
- 提示文案**走既有 i18n 通道**：`this.t('CARD_NO_UNITS_ON')`，并在 `locales/zh-CN.js` 与 `locales/en-US.js` 登记（与 `CARD_SINGLELINE_SMALL_FONT` 同位置、同为 `CARD_*` 段，见 `locales/zh-CN.js:132` / `en-US.js:132`）。
  - zh：「已隐藏 年/月/日 单位：横向用 · 分隔，竖向只显示数字」
  - en：「Year/month/day labels hidden — · across, digits only when stacked」
  - 只提示开启方向：开启会「变样」、必须解释 `·` 的含义；关回默认形态无需解释。与单行显示「只在反默认方向提示」节奏对称，用户不必记两套规则。
  - ⚠️ 此 key **必须保留**：按钮文案（§2）走内联三元是对的，但**提示语**在本代码库中一律走 locales 表（`widgetConfig.js:514`、`mainPage.js:1643` 已如此）。若提示语改成硬编码中文，en 用户会看到中文。
- 风险登记：小屏上点第 3 个按钮时预览区可能已滚出视口。本迭代不自动滚动（与单行显示现状一致），靠 hint 文案描述结果兜底。

---

## 5. 无障碍

**决策：`role="switch"` + `aria-checked`，不用 `aria-pressed`；用原生 `<button>`，天然可聚焦，不加 `tabindex`。**

理由：本控件是「本单元的持久二元设置」，符合 ARIA APG 的 switch 语义；`aria-pressed` 适合加粗 / 置顶这类即时命令按钮。热区 `::after` 是装饰、不进无障碍树（§4 已确认）；Enter / Space 由原生 button 提供。

落地要求（风险 0）

- 新按钮**与既有「单行显示」一起**补 `role="switch"` + `aria-checked="${on}"`，避免同一行两种语义不一致。
- `aria-label` = zh「简约显示，隐藏年/月/日单位」/ en「Compact — hides year/month/day labels」；`title` 同值（触摸端无 hover，仅作补充通道）。
- 渲染侧无障碍见 §8.3（日期根节点 `role="img"` + `aria-label`）。
- 置中按钮因有「开 / 默认 / 接管」三态，`aria-checked` 表达不了，**列 follow-up**（需 `aria-describedby` 配角标），不在本迭代改。

---

## 6. 边界情况

| 场景 | 决策 | 理由 / 落地 |
|---|---|---|
| 单元从「年月日」切成「时分秒」 | **保留 `opts.noUnits`，不清零；切走不提示** | 同 D9：样式来回切换是本面板最高频操作，清零意味着每次切回都要重开；清零需在渲染期回写 store（副作用渲染、易抖动）。保留 ≠ 生效：渲染层必须走门控 `noUnitsOn(displayMode,size,b)`（类比 `singleLineOn`），非 5 样式一律 false。不提示：按钮消失即解释，且保留即可自动恢复 |
| 不支持简约的样式（年 / 月 / 日 / 星期 / 时 / 分 / 秒 / 第几周 / 时分 / 时分秒 / 周历 / 月历） | **不显示按钮**（传 `null`） | 单信息样式去掉单位只剩裸数字，与「月」「日」无法区分；`hm`/`hms` 的 `:` 本就是无单位形态。统一由 `NO_UNITS_DATE_STYLES` 白名单控制 |
| 星期段 | **不动** | `dateWeekday` / `dateFullWeekday` 的星期不是「年/月/日」单位，且是它与「月日」区分的唯一信息，去掉会让样式退化。横排视觉串保留 `周三` / `Wed`（英文用 short），与数字间用**字面空格**分隔，不加 `·` |
| 12/24 小时制 | **完全正交** | 5 个样式不含时间；不联动，`hour12` 变化时不重置 |
| 中英文切换 | **只去单位，不改段序** | 中文 `2026·10·18`，英文同为 `2026·10·18`（改顺序会让中英文行为不一致，用户会以为开关坏了）；英文横排去掉长月名（`October`）与 en-US 长格式逗号；**竖排（含 en）一律转纯数字三行**，en 去掉短月名 `Oct`。切语言不重置 `noUnits` |
| en 竖排 | **转纯数字** | 原判「en 竖排本无单位、是 no-op」已推翻：若 en 竖排不生效，用户会以为开关坏了。en 竖排与 zh 一致只留裸数字 `26` / `10` / `18`（详见 §8.1） |

---

## 7. 需补的回归断言

1. `normalizeOpts({})` → `null`；`normalizeOpts({singleLine:true})` → `{singleLine:true}`（存量不变）；`normalizeOpts({noUnits:true})` → `{noUnits:true}`。
2. 6 种尺寸 × `{c:'time',s:'dateFull'}`：`unitOpts(...).noUnits === false`（**无尺寸感知默认值**）。
3. 显式 `opts:{noUnits:true}` 在任意尺寸（含 1×1 与 1×FULL）返回 `true`。
4. `noUnitsOn`：`dateFull/dateYearMonth/dateMonthDay/dateWeekday/dateFullWeekday` 随 opts；`hms`/`hm`/`year`/`month`/`weekday`/`day`/`weekOfYear`/`calendar:month`/`schedule:*` → `false`。
5. `renderSpanEditor({...noUnits:null})` 输出**不含**「简约显示」且不含 `Compact`（中 / 英各一条，对齐既有「非 1×FULL 不渲染单行显示」双断言）。
6. `noUnits:false` → 出现按钮且不带 `.on`；`noUnits:true` → `.se-toggle on` 计数 +1。
7. 互斥：`calendar:month` + 1×FULL 的输出含「单行显示」但不含「简约显示」；`time:dateFull` 的输出含「简约显示」但不含「单行显示」。
8. 落库：切换后 `cardBlocks[idx].opts.noUnits === true`，且同单元既有 `opts.singleLine` 未被抹掉。
9. 样式往返：`dateFull`(noUnits:true) → `hms` → `dateFull`，`opts.noUnits` 仍为 `true`（不清零）。
10. 渲染：横排 noUnits 不含「年/月/日」且含 `·`；竖排 noUnits 不含单位字符；`dateWeekday` noUnits **仍含**星期。
11. `isZh:false` 横排 noUnits 不含长月名（October / September…）与 en-US 长格式逗号；**竖排** noUnits 不含 `Oct` 等任何月名字串（中英一致）。
12. `sanitizeBlocks([{c:'time',s:'dateFull'}])` 的 `opts` 为 `undefined`（不写空 opts，避免持久化膨胀）。
13. 无障碍：noUnits 渲染输出含 `role="img"`，且 `aria-label` **等于该样式「横排 + 未开启」的原串**——中英各一条，横排与竖排各断言一次（竖排的 label 同样含 4 位年 `2026`，不是 `26`）。
14. 新样式：`dateYearMonth` 在 `COMBO_CONTENTS.time.styles` 中排在 `dateFull` 之后（第 2 位），span/minSpan = 2×1 / 1×1。

---

## 8. 复核结论（与 visual-architect / team-lead 对齐）

### 8.1 竖排三行裸数字：`26` / `10` / `18` —— 不加锚点，备选不转正

**决策：不加分隔线、不加字号/字重差异；备选「年行降到 1.0em」不转正。en 竖排同样转纯数字（去 `Oct`）。**

理由

1. **同产品已有先例**：`hmsVert` 竖排就是 `14` / `30` / `05` 全裸数字（`card-mode-render.js:449` 的 `vstack([hPart, mm, ss], ...)`，无单位），已上线且无歧义反馈 → 竖排裸数字是本产品既有范式。
2. **行序零位移**：现状竖排本就是 上→下 `26年` / `10月` / `18日`，简约只删单位字，行序（单位由大到小，与 ISO 8601 / 中文日期书写顺序一致）原样继承。
3. **主动 + 可逆**：用户自己开启、可一键关回，且开启时有 hint（§4 `CARD_NO_UNITS_ON`）说明形态；不是默认形态，无需为「路人视角」兜底。
4. **备选是加设计意图**：年行降 1.0em 会引入「日是主角」的层级解读，超出「只去单位、其他零位移」的诉求；横排无对应物 → 横竖不一致。为 0.4em 收益引入语义标记不划算（宽度 2.9→1.7 才是收益主来源）。

### 8.2 「年月」插在第 2 位 —— 不需要改样式切换器的心智模型

**决策：保持插入位置；不修改 ‹› 的行为，也不新增任何说明文案。**

理由

1. **‹› 不是主通道**：`.style-opts` 是横排 chip 条，**所有样式一次可见、可直点**；‹› 只是浏览快捷键；`.style-counter` 恒显示 `idx+1/总数 · 当前名称`（widgetConfig.js:824）。用户始终知道自己在哪，不依赖序列单调性。新增样式只是 `list.length` 5→6，counter 与 `_scrollStripToActive()`（:246）都是通用实现，**无需改代码**。
2. **原序列本来就非单调**：段数 3（年月日）→ 2（月日）→ 3（月日星期）→ 4（年月日星期）本身是 V 形。插入「年月」后 3 → 2 → 2 → 3 → 4 仍是 V 形，谷底从 1 个样式变 2 个。没有破坏任何契约。
3. **逐位游走仍成立**：年月日 →(删日) 年月 →(删年、加日) 月日 →(加星期) 月日星期 →(加年) 年月日星期，每步只动 1~2 个维度。

落地：无需改代码。验收时确认 chip 条在窄屏横向滚动正常（`.style-opts` 已有 4px scrollbar，`_scrollStripToActive` 通用）。

### 8.3 noUnits 生效时的无障碍文本

**决策：noUnits 生效时，日期渲染根节点加 `role="img"` + `aria-label`，视觉子节点 `aria-hidden="true"`。**

**label 内容的唯一原则：`aria-label` = 该样式「横排 + 未开启 noUnits」时的原串。** 不逐样式枚举文案——按原则取值自动对齐，将来原串改了也无需同步。

| style | zh（横排原串） | en（横排原串，node 实测） |
|---|---|---|
| `dateFull` | `2026年10月18日` | `October 18, 2026` |
| `dateYearMonth` | `2026年10月` | `Oct 2026` |
| `dateMonthDay` | `10月18日` | `Oct 18` |
| `dateWeekday` | `10月18日 周一` | `Sunday, Oct 18` |
| `dateFullWeekday` | `2026年10月18日 周一` | `Sunday, October 18, 2026` |

- en 以 2026-10-18 为例，**星期名随日期变化**；`month` 的 long/short **不随日期变化**，且四个样式间不统一：`dateFull` / `dateFullWeekday` 是 `long`（`October`），`dateMonthDay` / `dateWeekday` 是 **`short`（`Oct`）** —— 这是本次两处差错的根因，实现时最容易踩。
- **视觉串与 aria 串的星期形式故意不同**：视觉串用 short（`Wed`，省宽度），aria-label 用非简约原串的完整星期名（`Sunday`，避免读屏念成字母串）。这不是 bug，因为 label 走的是「未开启态的原串」。
- ⚠️ 向 team-lead 说明：裁决第 5 条里写的 `Monday, October 18` 其 month 形式是 **long**，与 `card-mode-render.js:441`（`month:'short'`）不符；按该裁决自己定的「复用非简约原串」原则，正确值是 **`Sunday, Oct 18`**（星期名随日期变）。上表已按代码实测值写。

理由（三条）

1. **这是明确的可访问性回归，必须补**：现状竖排 `26年/10月/18日` 读屏至少能听出单位；noUnits 竖排是三个独立 DOM 节点 `26` / `10` / `18`，读屏必然碎片化成三个无意义数字；横排 `2026·10·18` 的 `·` 也可能被读成 "middle dot"。
2. **原则而非枚举，是因为「简约显示是纯视觉开关，语义层零差异」**：读屏输出应与开关状态无关、与横排/竖排无关。取「横排 + 未开启」原串后，开/关 × 横/竖 四种组合读屏听到同一句话 → 零 a11y 差异，用户心智也统一为「这个开关只改样子、不改意思」。
3. **横排原串（而非竖排原串）**：竖排年份只显示后两位（v1.32 需求 5）本身也是视觉压缩，读屏不该跟着丢世纪位（`26年` 有歧义），故竖排也取横排的 4 位年串。

落地

- 用 `role="img"` + `aria-label`，**不新增 `.sr-only` 类**；只在 noUnits 开启时加，不动未开启时的渲染路径。
- **零新增格式化选项组合**：各 `case` 的 `tall ? vstack(...) : mid(<原串>)` 里 `<原串>` 已存在，提取为 const 后同时喂 `mid()` 与 `aria-label`（`October 2026` / `October 18 Mon` 被否决，因为它们是代码里不存在的新组合）。
- 渲染 / 测量零影响：`role` / `aria-*` / `aria-hidden` 不参与布局，`CONTENT_FIT` 与 `measure.html` 结构样本无需改动。

follow-up（本迭代不做）：`hmsVert` 的 `14`/`30`/`05` 有同样的读屏碎片化欠账。

### 8.4 圆点间隙：margin 实现 + 实测反推（定稿口径）

**决策：`.pv-dot` 用 `margin` 实现间隙，视觉串中不写字面空格字符；margin 值由实测 advance 反推，不写死。**

定稿公式（team-lead 裁决 3）：

```
单点总占位恒为 0.838em
margin = (0.838 − 实测 U+00B7 advance) / 2     // 结果四舍五入到 0.005em
```

- 此前 0.28 / 0.30 的分歧**只来自各自假设的 advance 不同**（0.278 → 0.28；0.238 → 0.30），公式统一后即消解。

**⚠️ 实测已裁决：方案 A（字面 `·`）废弃，强制方案 B（自绘圆点）。**
visual-architect 用项目同款字体栈 + 无头 Chrome 实测：单独 `·` 的 advance = **1.000em**（远超 0.45em 阈值）—— 该字体栈下 U+00B7 **回退到中文字体的全宽字形**，不是 Latin 点。后果：方案 A 下单点占位 1.56em、`2026·10·18` 串宽 6.93em，与紧排（6.13em）几乎无差 → 「变短 → 字号变大」收益归零，且圆点又大又空。

```css
.pv-dot { display:inline-block; width:.28em; height:.28em; border-radius:50%;
          background:currentColor; margin:0 .28em; vertical-align:.21em; }
```

- 方案 B 实测单点占位 **0.84em** ≈ 定稿口径 0.838em → 公式在方案 B 下直接成立，**margin 恒为 0.28em**。
- **必须手动补 `text-shadow:0 1px 2px rgba(0,0,0,.38)`**：自绘圆的 `background` 不吃 `.widget.text-light` 的 text-shadow，浅色文字模式下圆点会「浮」在其他文字之外。
- **不要按「Windows 特例」处理**：这是平台相关的字体回退，方案 B 跨平台渲染完全一致，**不赌字体回退**，故全平台统一用方案 B。

其余约束不变：

1. **复制文本无空格是符合预期的**：`2026·10·18` 是标准间隔号写法，粘贴进搜索框 / 输入框无需清空格。
2. **读屏不受影响**：§8.3 已定根节点 `role="img"` + `aria-label`、视觉串 `aria-hidden` → 读屏不读圆点，不存在「靠空格断词」的需求。
3. **断行更可控**：断行只发生在指定 `<wbr>`（点后、点留行尾）。
4. **星期前的分隔仍用字面空格**（现状 `dateWeekday` 即 `${mo}月${d}日 ${wdZh}`），不加 `<wbr>`、不改成 margin —— 只有圆点用 margin。

### 8.5 en 声明宽度偏差（v1.31 既有）——随 v1.35 一起修，但独立提交

**裁决（team-lead）：不做 follow-up，随 v1.35 一起做，但拆成一次独立提交**（提交信息标注「v1.31 既有问题」），便于单独 revert。

- 理由：数据已在手，落地成本只剩补 `wEn` 键；「只记录不落地」会导致下次要么重测（重复成本）、要么照过期笔记改数（更危险）。且本项目既定纪律就是「CONTENT_FIT 改动必须 `measure.html` 实测回写」。
- **风险边界**（这是可以合并进本迭代的前提）：只加 `wEn`、**不动 `w`**（中文侧零影响）；**不改 en 的星期格式**（`{month:'short', weekday:'long'}` 维持原样）；最坏只是 en 字号小幅变小换单行显示，`wrap:true` 仍在，不截断不崩；占格是绝对格数持久化，字号变化不影响已保存布局。
- 若实测值与 `6.9` 的偏差在 **2% 以内、且实测不掉行**，则**只记录不改数**，回报说明即可 —— 不做无收益的改动。

实测数据（visual-architect 无头 Chrome，root=100px，`font-weight:700` / `tabular-nums`）

| 串 | 实测 | 现声明 | 判定 |
|---|---|---|---|
| `10月18日 周日`（zh，既有） | 6.765em | 6.9 | ✅ 说明 6.9 是按 zh 定的 |
| `Sunday, Oct 18`（en 最窄 Friday） | 6.902em | 6.9 | 擦边 |
| `Wednesday, Oct 18`（en 最宽） | **9.639em** | 6.9 | ❌ 超 2.74em |
| `2026年10月18日 周日`（zh） | 10.23em | 10.4 | ✅ |
| `Sunday, October 18, 2026`（en） | 12.893em | 10.4 | ❌ 超 2.49em |
| `October 18, 2026`（en） | 8.655em | 8.1 | ❌ 超 0.55em |

一周七天的 en 非简约 `dateWeekday` 实测：Friday 6.902 / Sunday 7.518 / Tuesday 7.893 / Monday 7.954 / Saturday 8.281 / Thursday 8.463 / **Wednesday 9.639** —— **声明 6.9 只覆盖到 Friday，其余六天全部超标**，最宽与最窄差约 40%。

**落地数值**：`wEn = 实测 × 1.02`（team-lead 口径，四舍五入到 0.1em）
- `dateWeekday`：`wEn: 9.8`（9.639 × 1.02；visual 文档写的 10.2 是 +5.8%，超出其自身 +2~5% 区间，**请统一按 ×1.02**）
- `dateFullWeekday`：`wEn: 15.2`（按 14.9 推算；以实测为准）
- `dateFull`：`wEn: 8.8`（8.655 × 1.02）
- 竖排 `dateFullWeekdayVert`：`wEn` 2.5 → 3.1（竖排按 +4~10% 口径）
- 竖排 `dateWeekdayVert`：`wEn` 2.5 → 3.1（**2026-10-20 用户反馈 2 补修** —— 与上一行同缺陷类、同口径，但本清单与 visual §7.5 清单双双漏列；教训：竖排两个含星期 key 应成对出现，列清单时按 `*Vert` 全量 grep 一遍）

**落地状态**：前 4 项已随 v1.35 以独立提交 `5ca0958` 修复并部署；第 5 项 `dateWeekdayVert` 于 2026-10-20 补修（同批反馈 1 的 `.7em` 星期行改动一并提交）。

**测量样本（最坏值，不是当天值）**
- `dateWeekday` 非简约 en（weekday **long** + month **short**）：最宽是 **`Wednesday, Sep 18`**（`Wednesday` 9 字母最宽；月份用 short 故取 `Sep`）。
- `dateWeekdayNoUnits` 简约 en（weekday **short**）：最宽是 **`Mon`**，不是 `Wed` —— 实测 `Mon 6.237` > `Wed 5.899`，`Fri` 最窄 4.886，极差 1.351em。（我原先按「W 最宽」选 `Wed` 是错的，实测已推翻。）

**一个必须说清的连带结论：en 与 zh 在含星期的 key 上不再同宽。**
不含星期的 3 个 key（纯数字）中英仍同宽、可复用同一组 CONTENT_FIT；含星期的 2 个 key 必须单独声明 `wEn`（en `Mon` 比 zh `周日` 宽约 0.29em）。
→ **不为此拆 key**（zh 会因此比最优字号小约 9%）：因为「取 `max(w, wEn)`」是**既有全局行为**——`dateFull` 声明 8.1 本就按 en 的 8.655 定的，而 zh 只需 5.46em，一直如此。单独为这 2 个 key 拆开反而引入不一致，维护量翻倍不值得。

### 8.6 其余遗留（不在 v1.35 范围）

| 问题 | 判定 |
|---|---|
| 置中按钮「开 / 默认 / 接管」三态无法用 `aria-checked` 表达 | follow-up，需 `aria-describedby` 配角标 |
| `hmsVert` 读屏碎片化 | follow-up，与 §8.3 一并收口 |
| 竖排 / 「年月」的 CONTENT_FIT 仍为推导值 | ✅ 已实测回写（visual §3/§5，`measure.html` root=200px；`.wk` 行规则另有 `_probe.mjs` 生产同源复核） |
