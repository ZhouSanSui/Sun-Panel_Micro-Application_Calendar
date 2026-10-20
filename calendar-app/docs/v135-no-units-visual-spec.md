# v1.35 视觉规格：无单位（No Units）+ 新增「年月」样式

只给数值与决策，不含实现代码。所有 em 相对**块根字号 u**。
字符宽度模型（`.pv-mid` 级，700/tabular）：数字 0.616em、CJK 1.0em、空格 0.28em。

> **术语**：用户可见文案为「**无单位**」/ `No Units`（UX 定，避免与显示模式「简约日历」及既有样式 `compact`『紧凑』撞词）。
> 状态字段 **`opts.noUnits`**；`CONTENT_FIT` key 后缀 **`NoUnits`**。
> ⚠️ 曾用内部名 `compact` 已作废 —— `user-store.js:66/75` 已有 `key:'compact' zh:'紧凑'` 的**时间/日历样式**，复用会撞名。

---

## 1. 中心原点字符

**决策：`·` U+00B7 MIDDLE DOT，包在 `<span class="pv-dot">` 内做定点微调。**
淘汰项：`•` 视觉重量压过数字；`‧` U+2027 在多数 Latin 字体里被抬高、位置不可控；`.` 贴基线，`2026.10.18` 读成版本号。

```css
.pv-dot { vertical-align: 0.07em; margin: 0 0.28em; }   /* 不设 font-size，避免 em 基准错位 */
```

- **字重**：继承父级 700，不单设。
- **颜色**：**`visual.label`（与数字同色）**。禁用 `label3` —— u=7~12px 时点直径仅 2~3.4px，再降对比度会消失，整串退化成八位连排数字。层级靠尺寸差（点直径 ≈0.28em vs 数字字高 ≈0.70em，约 1:2.5）已足够，不靠颜色。
- **间隙：两侧各 0.28em（= 一个空格的视觉），但用 margin 不用空格字符**，单点占位 ≈**0.838em**（advance 0.278 + 2×0.28）。
- **垂直居中是算出来的**：字形中心 ≈0.28em + `vertical-align` 0.07em = **0.35em** = 数字字高 0.70em 的中心，不依赖字体内置位置。

理由：① `·` 在中文语境就是「间隔号」，copy / 读屏语义正确；② 三大平台字体栈下 U+00B7 都会命中 Latin 字体（SF Pro / Roboto / Arial 均含该字形），不会落到 PingFang 的全宽居中点，字形偏差 <0.03em；③ 与 UX 对齐后采用「空格外观」（`2026 · 10 · 18`）—— 相比紧排每点多 0.238em，`dateFull` 的字号收益从 +21.9% 降到 **+14.5%**（两者差 6.4%），代价可接受，换来与 UX 规格零歧义；④ **必须加 margin 而不是字面空格**：字面空格宽度随字体变（0.22~0.30em），且会在空格处产生断行机会、可能把 `·` 甩到下一行行首；加 margin 则宽度确定、且断行只发生在 `<wbr>`。

**落地要求**
1. 🚨 **`dotAdvance` 已实测 = 1.000em（方案 A 被否，必须用方案 B 自绘）。**
   我用项目同款字体栈 + 无头 Chrome（root=100px）实测：单独 `·` 的 advance = **1.000em** —— 正好是全宽 CJK 字形，不是我预期的 Latin 点（0.278em）。说明该字体栈下 U+00B7 回退到了中文字体。
   后果：方案 A 下单个圆点占位 1.56em（1.0 + 2×0.28），`2026·10·18` 串宽 **6.93em**，与「紧排 6.13em」几乎没差，圆点还会**又大又空**（字宽 1em 里字形只占 0.28em）。
   **采用方案 B（自绘实心圆）**：
   `.pv-dot{display:inline-block;width:.28em;height:.28em;border-radius:50%;background:currentColor;margin:0 .28em;vertical-align:.21em}`
   实测方案 B 单点占位 **0.84em**（0.28 + 2×0.28），与设计意图完全一致。
   ⚠️ 方案 B 必须**手动补 `text-shadow:0 1px 2px rgba(0,0,0,.38)`** —— 背景圆不吃 `.widget.text-light` 的 text-shadow，浅色文字模式下会「浮」在其他文字之外。**这是方案 B 唯一的额外成本，务必别漏。**
   ⚠️ 方案 B 的 `vertical-align:.21em` = 圆半径 0.14 + 数字字高中心 0.35 − 0.28（圆底）→ 精确对齐，改 `width` 必须同步改 `vertical-align`（`vertical-align = 0.35 − height/2`）。
2. 横排串必须在**圆点后**插 `<wbr>`：`2026<span class="pv-dot">·</span><wbr>10…`，断行时点留行尾（中黑/间隔号惯例）。不要插在点前。
3. **星期前的分隔保持字面空格，不要改成 margin，也不要加 `<wbr>`**（UX §8.3 约束）：现状 `dateWeekday` 就是 `${mo}月${d}日 ${wdZh}`，沿用字面空格 = 沿用现状已有的断行行为，零变化。**只有圆点用 margin。**

---

## 2. 横排无单位形式

**决策：年份保持 4 位；星期保留，与数字之间用空格分隔、不加 `·`。**

| style | 无单位（zh） | 无单位（en） |
| --- | --- | --- |
| dateFull | `2026 · 10 · 18` | `2026 · 10 · 18` |
| dateYearMonth | `2026 · 10` | `2026 · 10` |
| dateMonthDay | `10 · 18` | `10 · 18` |
| dateWeekday | `10 · 18 周日` | `10 · 18 Sun` |
| dateFullWeekday | `2026 · 10 · 18 周日` | `2026 · 10 · 18 Sun` |

> 星期取值随当天变化，全文示例统一取 **2026-10-18 = 周日 / Sunday**（`date -d 2026-10-18 +%A` 已核实）。
> ⚠️ **测量时不要用当天星期，必须用最长的短星期 `Wed`**（宽度最大，`S`≈0.58 / `u`≈0.61 / `W`≈0.93em，比 `Sun` 宽约 0.29em），见 §7.3。
> 竖排同理：`周一` 与 `周日` 同为 2 个 CJK，宽度无差别，但**测量仍按 2×1.0em 计**。

理由：① 圆点的身份是**单位字的替身**，不是通用字段分隔符；挪到星期前会改变语义角色；② 用户诉求是「只去单位」，保留空格 = 只删单位、其他零位移，开关切换可预期；③ 圆点紧邻 `周一` 这类块状汉字会挤，圆点光学中心 0.35em 与汉字重心不对齐；④ 星期不是「年/月/日」单位，删它是丢信息不是去单位（且 `dateWeekday`/`dateFullWeekday` 去掉星期会退化成「月日」，等于样式失效）。

对齐/字距：沿用 `.pv-mid`（1em/700/lh1.25/tabular-nums），居中由 `.pv-center` 提供；**不要给 `.pv-mid` 加 letter-spacing**（破坏 tabular 等宽）。

**CONTENT_FIT（横排 NoUnits，均 `h:1.3, wrap:true`）** —— **已按方案 B 实测回写**：

| key | 实测 w | 声明 w | 实测 wEn | 声明 wEn |
| --- | --- | --- | --- | --- |
| `dateFullNoUnits` | 6.614 | **6.9** | 6.614（同形） | — |
| `dateYearMonthNoUnits` | 4.540 | **4.8** | 4.540（同形） | — |
| `dateMonthDayNoUnits` | 3.307 | **3.5** | 3.307（同形） | — |
| `dateWeekdayNoUnits` | 5.605 | **5.9** | **6.237**（Mon 最宽） | **6.5** |
| `dateFullWeekdayNoUnits` | 8.912 | **9.3** | **9.540**（Mon 最宽） | **9.9** |

🚨 **en 的最宽短星期是 `Mon`，不是 `Wed`！** 实测一周七天（`10·18 <wd>`，方案 B）：
`Sun 5.502 / Mon 6.237 / Tue 5.384 / Wed 5.899 / Thu 5.524 / Fri 4.886 / Sat 5.198`
`Mon` 比 `Wed` 宽 **0.338em**，比最窄的 `Fri` 宽 **1.351em**。**必须按 `Mon` 声明 `wEn`**，按 `Wed` 会在周一溢出。

（实测条件：与 `widget.js` 同款字体栈、root=100px、`font-weight:700`、`tabular-nums`、`.pv-dot` 方案 B；测量样本见 §7.3。声明值 = 实测 +4%~5%。）
**en 与 zh 不再「同宽」**：en 星期名比 zh `周日`/`周一` 宽约 0.29em，故两个含星期的 key 必须声明 `wEn`（`fitFor` 对 en 取 `max(w, wEn)`）。

字号收益（denominator = w + slack 1 + pad 0.375）：`dateFull` 9.475→8.275 **+14.5%**；`dateMonthDay` 5.975→4.875 **+22.6%**；`dateWeekday` 8.275→7.275 **+13.8%**；`dateFullWeekday` 11.775→10.675 **+10.3%**。

---

## 3. 竖排无单位

**决策：每行只留数字，不加单位占位、不加分隔线、不加字号差异。**

- `dateFullVert`：`26年/10月/18日` → **`26` / `10` / `18`**
- `dateYearMonthVert` → `26` / `10`；`dateMonthDayVert` → `10` / `18`
- `dateWeekdayVert` → `10` / `18` / `周一`；`dateFullWeekdayVert` → `26` / `10` / `18` / `周一`
- **不保留占位**：`.pv-vstack` 已 `align-items:center`，逐行独立居中，去掉单位不会左右错位；保留隐藏占位会引入无意义 DOM 且宽度不变 = 白做。
- **不加视觉锚点**：行间细线要吃 h（≥0.1em/行），把刚省下来的高度还回去，字号收益被抵消。竖排本是「一行一信息」的强结构，行序（上→下 = 年→月→日）即语义，与现状完全一致。
- **「年行降到 1.0em」备选已否决**（UX §8）：① 同产品已有先例 —— `hmsVert` 竖排 `14`/`30`/`05` 就是裸数字且已上线（`card-mode-render.js:449`）；② 行序零位移 —— 现状竖排本就是上→下 `26年/10月/18日`（大→小，与 ISO 8601 / 中文日期书写序一致），只删单位字；③ 主动且可逆 —— 用户自己开、一键关回，开启时有 hint，不是默认形态；④ 该备选是「加设计意图」—— 会引入「日是主角」的层级解读、横排无对应物 → 横竖不一致，为 0.4em 收益引入语义标记不划算（收益主来源是 w 2.9→1.7）。
- **en 竖排也要去掉短月名**（UX 决策：`Oct` 属「单位词」，中英形态必须一致否则开关像坏了）：`26`/`Oct`/`20` → **`26`/`10`/`20`**；星期行保留 short（`Wed`/`Sun`）。

**CONTENT_FIT（竖排 NoUnits）** —— **已实测回写**（`.pv-vstack` + `.pv-vline`，root=200px）：

| key | 实测 w（数字行） | 实测 w（`.wk` 星期行） | 声明 w | 实测 wEn | 声明 wEn | 实测 h | 声明 h |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `dateFullVertNoUnits` | 1.542 | — | **1.7** | 1.542 | — | 4.688 | **4.8** |
| `dateYearMonthVertNoUnits` | 1.542 | — | **1.7** | 1.542 | — | 3.063 | **3.2** |
| `dateMonthDayVertNoUnits` | 1.542 | — | **1.7** | 1.542 | — | 3.063 | **3.2** |
| `dateWeekdayVertNoUnits` | 1.542 | **1.400**（`周一` ×0.7em） | **1.7** | **1.634**（`Mon` ×0.7em） | — | 4.055 | **4.8** |
| `dateFullWeekdayVertNoUnits` | 1.542 | **1.400**（`周一` ×0.7em） | **1.7** | **1.634**（`Mon` ×0.7em） | — | 5.680 | **6.5** |

🚨 en 竖排星期行实测一周七天（`pv-vline` 1.25em）：`Sun 2.372 / Mon 2.917 / Tue 2.224 / Wed 2.868 / Thu 2.399 / Fri 1.602 / Sat 1.992` → **最宽是 `Mon` 2.917em**，`Fri` 最窄 1.602em（差 1.315em，接近一倍）。

- **h 全部保持原值不变**（4.8 / 3.2 / 3.2 / 4.8 / 6.5）—— 声明值即预算上限，实测均在其下（`.wk` 行降字号后含星期 key 的实测 h 降到 4.055 / 5.680，余量更大）。
- 3 个不含星期的 key：实测 1.542em = 2×0.616×1.25 的精确值，二者 **w/wEn 一致**（纯数字，中英同形）。
- ⚠️ **含星期的 2 个 key，en 实测 2.868em（`Wed`）> zh 2.500em，且最宽是 `Mon` 2.917em** —— 见下方「.7em 星期行」规则的数值依据。
  同时发现**既有 `dateFullWeekdayVert` 与 `dateWeekdayVert` 有同样的缺漏**：实测 en 竖排最宽行都是 `Mon` 2.917em，但声明的 `wEn` 只有 2.5 → en 下这两个样式溢出约 0.42em。`dateFullWeekdayVert` 已按 UX §8.5 随 v1.35 同批修（`wEn: 2.5 → 3.1`，独立提交 `5ca0958`）；`dateWeekdayVert` 两份修复清单都漏列，按用户反馈 2 于 2026-10-20 同口径补修，详见 §7.5。

**星期行 `.7em` 规则（v1.35 反馈 1，2026-10-20）**：竖排 + noUnits 时，星期行挂 `.pv-vline.wk { font-size: .7em }`（**覆盖** `.pv-vline` 的 1.25em，非叠加；em 相对父级 = 块根字号 u）。于是：

- zh `周一` = 2.0em/字 × 0.7 = **1.400em**；en `Mon` = 2.334em × 0.7 = **1.634em**（均按 1.25em 实测值折算）—— 两者 ≤ 数字行的 1.542em 预算量级，**星期行不再是宽度瓶颈**。
- 两个含星期 key 因此改声明 `w:1.7`、**不声明 `wEn`**（1.634 < 1.7），与 3 个无星期 key **同 fit → 数字字号严格相等**（任意块尺寸下 u 相同）。修复前 zh 实测 `周一` 2.5em 把 w 抬到 2.6，同块 u 被压约 30%（2×2 卡 1×3：19.2px vs 27.5px）。
- **探针复核**（`_probe.mjs` nuTrio/nuTrioEn，生产同源 CSS + 真实渲染 DOM）：2×2 卡三兄弟 1×3 场景，月日星期-简约与年月日-简约的数字行字号均为 34.375px（u=27.5）**严格相等**；en 最坏 `Mon` 行 40.8px ≤ 块内宽 52.7px（ovfX 0）；4 行样式在自然 4 行占格下也相等，挤进 3 行占格时转高度约束（31.1px）但不溢出。
- **只改竖排 + noUnits**：横排星期样式段数更少、数字本就更大（`dateWeekdayNoUnits` w=5.9 < `dateFullNoUnits` 6.9），无此问题；非简约竖排两类样式均被 `26年`/`10月` ≈2.5em 瓶颈，同声明 w=2.9，本就相等。
- `.7em` 落在既有次级字号档之间（`.pv-row2` .75em 与 `.pv-sub` .5em），符合设计语言；星期是次级信息，视觉让位数字。
- a11y 不变：`.wk` 行仍渲染星期文字（只降字号），`role="img"` + `aria-label` 恒取横排原串。


- **不额外设字号上限**，u 已有全局 clamp `[7,40]`。验算：2×1 卡 2×4 占格（96×228）`dateFull` 竖排 —— 现状 u = 96/(2.9+0.375) = **29.3**（宽约束）；无单位 u = min(96/2.075 = 46.3, 228/5.175 = 44.1) → **40（触顶）**，数字 1.25em×40 = 50px。同块既有 `hmsVert` 是 62.2px，50px 不异常。

---

## 4. en 语言

**决策：开关对 en 生效，生效时统一转数字式，与 zh 完全同形（含段序）。**

| style | en 现状 | en 无单位 |
| --- | --- | --- |
| dateFull | `October 18, 2026` | `2026 · 10 · 18` |
| dateYearMonth | `Oct 2026` | `2026 · 10` |
| dateMonthDay | `Oct 18` | `10 · 18` |
| dateWeekday | `Sunday, Oct 18` | `10 · 18 Sun` |
| dateFullWeekday | `Sunday, October 18, 2026` | `2026 · 10 · 18 Sun` |

- **段序一律 `年 · 月 · 日`，en 不得改成 `10 · 18 · 2026`**（中英顺序不一致会被判定为开关坏了）。
- 🚨 **【最易踩坑】en 现状的 month 长短在四个样式间不统一，实现时别搞错**（已核 `card-mode-render.js:433/437/441/445`）：`dateFull` 与 `dateFullWeekday` 是 `month:'long'`（`October`），`dateMonthDay` 与 `dateWeekday` 已是 `month:'short'`（`Oct`）。所以「去掉长月名」只对前两个生效；`dateWeekday` 只需转数字式并把 `weekday` 由 `'long'` 降为 `'short'`（`Sunday` → `Sun`）—— 完整星期名会把宽度拉回原状，与「无单位」自相矛盾。
- 🚨 **既有缺陷（已实测确认，不在本次改动范围，但建议单开一条修）**：
  实测 `dateWeekday` 的 en 现状 **`Sunday, Oct 18` = 7.518em**，而声明的 `w` 只有 **6.9**（该值对应 zh 实测 6.765em），且 **未声明 `wEn`** → `fitFor` 对 en 取不到正确宽度。
  `dateFullWeekday` en 同理：实测 **12.893em** vs 声明 `10.4`（zh 实测 10.23em 对得上）。
  **后果**：不是崩溃（`wrap:true` 会兜底换行），而是 **en 下这两个样式字号偏大、提前掉两行**，且与 zh 不一致。
  **修法**（若单开）：`dateWeekday: { w:6.9, wEn:7.9, h:1.3, wrap:true }`、`dateFullWeekday: { w:10.4, wEn:13.2, h:1.3, wrap:true }`（实测 +5%）。**本次不动**，因为它会连带改变 en 下既有样式的字号，属于行为变更、需单独回归。
- **本次 NoUnits 的 `wEn` 已按实测声明**，不会复制上述缺陷。
- 理由（用户价值最大）：en 的长月份/长星期名正是横排的字号杀手（`dateFullWeekday` w=10.4 就是被 `Wednesday, October 18, 2026` 撑出来的）；转数字式后 **en 与 zh 同宽，可复用同一组 CONTENT_FIT**，且「无单位」是一个**视觉风格开关**（去修饰、只留数字）而非「去中文单位开关」—— 否则 en 下该开关是残缺功能。数字式日期在 en 语境通用（ISO 风格），无误读风险。

---

## 5. 新增样式「年月」

**决策：key `dateYearMonth`，zh「年月」/ en「Y/M」，插在 `dateFull` 之后（第 2 位）；沿用既有 `mid()`（横排）与 `vstack([...], false)`（竖排），不发明新样式、不加新 class。**

| key | 实测 w | 声明 w | 实测 h | 声明 h | wrap |
| --- | --- | --- | --- | --- | --- |
| `dateYearMonth` | 5.700 | **5.9** | 1.250 | **1.3** | true |
| `dateYearMonthVert` | 2.792 | **2.9** | 3.063 | **3.2** | false |

- 横排实测 zh `2026年10月` = **5.700em**；en `Oct 2026` = **4.514em** < 5.9 → **不声明 wEn**（`fitFor` 取 `max(w,wEn)` 时取不到更大值，安全）。
- 竖排实测 `["26年","10月"]` = **2.792 × 3.063em**，与既有 `dateFullVert` 的 w(2.792) 一致、h 与 `dateMonthDayVert`(3.063) 一致 —— 正好落在两者之间，符合预期。

- zh 横排 `2026年10月`，必须插 `<wbr>`：`2026年<wbr>10月`。
- zh 竖排 2 行 `26年` / `10月`，年份同样取后两位。
- en 用 `{year:'numeric', month:'short'}` → **`Oct 2026`**，不用 `long`：`October 2026` ≈6.6em，会让「年月」几乎吃不到比「年月日」(8.1) 更大的字号收益（1.23× vs 1.49×），新样式失去意义。
- **span / minSpan 与 `dateMonthDay` 同为 `{cols:2,rows:1}` / `{cols:1,rows:1}`** —— 已复核，无需改动。依据：2×2 卡 1×1 占格（48×48）下 `dateYearMonth` u = 48/(5.9+1.375) = 6.60 → 触 7px 下限；同条件 `dateMonthDay` u = 8.03px、`dateFull` u = 5.06 → 也触下限。三者同属「1×1 下极小但可用」区间，`dateFull` 早已允许 1×1；若把「年月」的 minSpan 单独提到 2×1，会出现「1×1 格子能选月日、不能选年月」的难解释规则。
- 备注（非风险，UX §8 已确认，无需跟进）：插入后段数 3→2→2→3→4 **仍是 V 形**，且原序列本就非单调（谷底由 1 个变 2 个），逐位游走每步只动 1~2 个维度。主通道是 `.style-opts` 横排 chip 条（样式一次可见、可直点），‹› 只是浏览快捷键，`.style-counter` 恒显示 `idx+1/总数 · 当前名称`。**不改进切换器、不改心智模型说明、零代码改动。**

---

## 6. 可访问性（noUnits 开启时必做）

**决策：日期渲染根节点加 `role="img"` + `aria-label="<完整可读日期>"`，视觉子节点 `aria-hidden="true"`。仅在 `opts.noUnits` 为真时加，不动非简约路径。**

```html
<!-- 横排：根 = .pv-center -->
<div class="pv-center" role="img" aria-label="2026年10月18日">
  <div class="pv-mid" aria-hidden="true">…</div>
</div>
<!-- 竖排：根 = .pv-vstack -->
<div class="pv-vstack" role="img" aria-label="2026年10月18日">
  <div class="pv-vline" aria-hidden="true">26</div>…
</div>
```

理由：竖排无单位后是三个独立 DOM 节点 `26` / `10` / `18`，读屏必然碎片化成三个无意义数字；横排 `·` 可能被读成 "middle dot"。这是**明确的可访问性回归**，不是可选优化。

- **原则（UX §8.3，取代逐项枚举）：`aria-label` = 该样式「横排 + 未开启 noUnits」时的原串。**
  即 `<原串>` 提取成 const，同时喂给 `mid()` 和 `aria-label` —— 零新增格式化逻辑，将来原串改了也不用同步。
  这条原则同时保证三件事：① **读屏输出与开关状态、与横排/竖排都无关**，「开/关 × 横/竖」四种组合听到同一句话 → 零 a11y 差异、零回归风险，也给用户一条可预期心智「这个开关只改样子、不改意思」；② 不新增任何格式化选项组合；③ 自然取到完整星期名（`Sunday` 而非 `Sun`）与完整单位。
- **竖排的 label 同样取横排原串**：即恒用 **4 位年 `2026`**，不是竖排视觉上的 `26`。理由：竖排年份只显示后两位是 v1.32 需求 5 的既有**视觉**压缩，读屏不该跟着丢世纪位（`26年` 有歧义）。实现零成本 —— `<原串>` 本就用 `y`，竖排分支才用 `yS`，提取 const 时取 `y` 那个即可。
- **不要新造 `.sr-only` 类**（项目里没有，`role="img"` + `aria-label` 已足够，能省一个 CSS 类）。
- **对渲染与测量的影响：零。** `role` / `aria-*` / `aria-hidden` 都不参与布局 —— `CONTENT_FIT` 与 `measure.html` 结构样本**不需要**为此做任何改动，也不要把它算进 w/h。

| style | zh aria-label | en aria-label |
| --- | --- | --- |
| dateFull | `2026年10月18日` | `October 18, 2026` |
| dateYearMonth | `2026年10月` | `Oct 2026` |
| dateMonthDay | `10月18日` | `Oct 18` |
| dateWeekday | `10月18日 周日` | `Sunday, Oct 18` |
| dateFullWeekday | `2026年10月18日 周日` | `Sunday, October 18, 2026` |

（上表即「横排 + 未开启」原串，由原则导出，非手写枚举；星期示例取 2026-10-18 = 周日。）
⚠️ `dateWeekday` 的 en 是 **short month + long weekday** → `Sunday, Oct 18`，不是 `Monday, October 18`（`dateFullWeekday` 才是 long month）。此项已由 UX 实测指出并经 `date -d 2026-10-18 +%A` 复核为 Sunday。

---

## 7. 风险提示：必须实测回写的数值

1. `.pv-dot` 的 CSS 要同步 **5 处**：`widget.js` / `mainPage.js` / `widgetConfig.js` / `scripts/make-preview.mjs` / `scripts/measure.html`。漏一处 → 预览与真机不一致。
2. **无单位串不能走 `run()` 纯文本测量**（圆点带 margin / vertical-align），必须用 `measure.html` 的 `box()` 结构样本（root=200px，`.pv-center > .pv-mid`），且要先在 `measure.html` 里加 `.pv-dot` 规则。
3. **必测清单**（root=200px，`/200` = em）：

> ✅ **§2 的 w 已用下列样本实测回写**（方案 B，root=100px）。前端不必重测横排，只需在改 `.pv-dot` 尺寸或字体栈时复核；**竖排（§3）与年月（§5）仍待实测**。

| 样本 | 内容 | 实测结果 |
| --- | --- | --- |
| `dotAdvance` | 单独 `·` 的 advance | **1.000em → 已确认必须方案 B** |
| `dotB` | 方案 B 空内容的 `.pv-dot` | **0.840em** |
| `dateWeekdayEn` / `Zh` | `Sunday, Oct 18` / `10月18日 周日` | **7.518 / 6.765em**（既有样式） |
| `dateFullWeekdayEn` / `Zh` | `Sunday, October 18, 2026` / `2026年10月18日 周日` | **12.893 / 10.23em**（既有样式） |
| `dateFullEn` | `October 18, 2026` | **8.655em**（vs 声明 8.1，偏紧） |
| `dateFullCmp` | `2026 · 10 · 18`（含 `.pv-dot` 结构，zh/en 同形只测一次） |
| `dateYmCmp` / `dateMdCmp` | `2026 · 10` / `10 · 18` |
| `dateWdCmpZh` / `En` | `10 · 18 周一` / `10 · 18 Wed`（用最长短星期 `Wed` 测） |
| `dateFwCmpZh` / `En` | `2026 · 10 · 18 周一` / `2026 · 10 · 18 Wed` |
| `dateYearMonthZh` / `En` | `2026年10月` / `Oct 2026` |
| `dateYearMonthVertZh` / `En` | vstack `["26年","10月"]` / `["26","Oct"]` |
| `dateFullVertCmpZh` / `En` | vstack `["26","10","18"]`（en 同形，去掉 `Oct`） |
| `dateYmVertCmpZh` / `dateMdVertCmpZh` | `["26","10"]` / `["10","18"]` |
| `dateWdVertCmpZh` / `En` | `["10","18","周一"]` / `["10","18","Wed"]` |
| `dateFwVertCmpZh` / `En` | `["26","10","18","周一"]` / `["26","10","18","Wed"]` |

✅ **§2（横排）、§3（竖排）、§5（年月）三张表的数值均已实测回写，可直接落地。**
实测条件：与 `widget.js` 完全同源的字体栈与 CSS（`.pv-center`/`.pv-mid`/`.pv-vstack`/`.pv-vline`/`.pv-dot` 方案 B），横排 root=100px、竖排 root=200px，`font-weight:700`、`tabular-nums`。
**前端不需要重测这三张表**；只有在改动 `.pv-dot` 尺寸、字体栈或 `.pv-vline` 字号/行高时才需要复核（这三者都会让 w/h 失效）。

### 7.5 既有缺陷（v1.31 遗留 → **已于 v1.35 全部修复**，数值备查）

实测暴露 5 处既有 `CONTENT_FIT` 与真实文案不符，**均非 v1.35 引入**，都会导致 en 下字号算错。前 4 处按 UX §8.5 以独立提交 `5ca0958` 修复；第 5 处 `dateWeekdayVert` 两份修复清单都漏列，按用户反馈 2 于本轮（2026-10-20）同口径补修：

| key | 原声明 | 实测最坏值（全年任意一天） | 后果 | 修复值（已落地） |
| --- | --- | --- | --- | --- |
| `dateWeekday` | `w:6.9`，无 `wEn` | zh 6.765 / **en 9.639**（Wednesday） | en 超标 **2.74em**，字号明显偏大、提前换行 | `wEn:9.8` |
| `dateFullWeekday` | `w:10.4`，无 `wEn` | zh 10.23 / **en ≈14.9**（Wednesday + long） | en 超标 ~4.5em | `wEn:15.2` |
| `dateFullWeekdayVert` | `wEn:2.5` | zh 2.500 / **en 2.917**（Mon） | en 竖排溢出 0.42em | `wEn:3.1` |
| `dateWeekdayVert` | `wEn:2.5` | zh 2.500 / **en 2.917**（Mon） | en 竖排溢出 0.42em（同上一行，两份清单漏列） | `wEn:3.1` |
| （`dateFull`） | `w:8.1` | zh 7.93 / **en 8.655** | en 偏紧 0.55em | `wEn:8.8` |

🚨 **en 非简约的最坏值远比早前估的严重**（已实测一周七天，`<weekday>, Oct 18`）：
`Sunday 7.518 / Monday 7.954 / Tuesday 7.893 / **Wednesday 9.639** / Thursday 8.463 / Friday 6.902 / Saturday 8.281`
最宽/最窄差 **2.737em（近 40%）** → 这就是「声明值 6.9 只覆盖到周五」的原因：`Saturday` 与 `Wednesday` 都远超 6.9。
根因：这些 `w` 都是按 **zh** 实测定的（zh 6.765 ≈ 声明 6.9），`wEn` 要么缺失、要么按最短星期估小。

**修复方式**：只补 `wEn`（实测 +4%~5% 余量），**没有**改 en 现状的星期格式（`long`→`short` 等）—— 那是改存量视觉，超出兼容容忍度。修复会连带改变 en 下既有样式的字号，属行为变更，已随 v1.35 beta 部署验证。**新增的 `…NoUnits` key 已全部按实测最坏值声明，不会复制这些缺陷。**

4. **key 命名**：`<styleKey>Vert?NoUnits`（camelCase，与 v1.31 §4.5 一致），如 `dateFullNoUnits` / `dateFullVertNoUnits`。`fitFor` 里在 `vertFitKey` **之后**追加 noUnits 判定（先定形态、再加修饰），共 10 个新 key。**不要使用 `Compact`** —— 与既有样式 `compact`『紧凑』撞名。
5. **`_setBlockField` 会整体替换 `opts`**：现有 `{ opts: { singleLine: next } }` 会清掉 `opts.noUnits`（反之亦然）。写 noUnits 时改为 `opts: { ...curOpts, noUnits: next }`。
6. **开关视觉**（UX 定，与 v1.31 附录 B 一致）：复用 `.se-toggle`（关 = `1.5px solid var(--apple-separator)` / transparent / `--apple-label-2`；开 = `1.5px solid ${theme}` / `${theme}1A` / `${theme}`），放进 `.se-toggles` 第 3 个槽位（36px 视觉高 + `::after` 撑 44×44 热区 + `row-gap:8px`）。文案恒为「无单位」/ `No Units`，**不加「：开/关」后缀**（避免切换瞬间按钮宽度跳动导致误点）。**默认不打开**（`opts.noUnits` 缺省即 false）。
