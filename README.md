# 极简日历 · SunPanel 微应用

运行在 [SunPanel](https://github.com/YourDay/Sun-Panel) 面板上的日历微应用：在面板上以小部件形式展示日历 / 时间 / 节假日倒计时 / 日程，点击可打开完整日历页管理日程。

> 源码位于 [`calendar-app/`](calendar-app/)，本文档中的命令均在该目录下执行。

## 功能

- **7 种小部件规格**：1×1、1×2、2×1、2×2、2×4、4×4、1×FULL；新建卡片按规格自动套用推荐默认内容，不再是空白
- **拼接模式**：一张卡内可放多个信息块，支持精细网格占格、单元级/卡片级两级置中、宽扁双栏（flat）与窄高竖排自适应
- **显示内容**：日历（月历/周日历）、时间（年月日、年月、月日、月日星期、年月日星期、时分、时分秒、年、月、日、星期、第几周…）、节日、节气、距放假、最近日程、多个日程、进度、空白占位
- **简约显示（Compact）**：隐藏「年/月/日」单位，只留数字，横向用圆点分隔
- **完整日历页**：年 / 月 / 周 / 日程 / 天气多视图；日程增删改、导入导出
- **外观**：多种卡片主题（毛玻璃等）、亮度调节、深浅色自适应；卡片圆角运行时同步宿主
- **双语**：简体中文 / English

## 目录结构

```
.
├─ .gitignore
└─ calendar-app/            微应用源码
   ├─ config/               应用配置（app.config.js 是版本号唯一来源）
   ├─ src/
   │  ├─ components/        widget / mainPage / widgetConfig 三个 Web Component
   │  ├─ core/              渲染、布局、节假日、日程、状态等核心模块
   │  └─ main.js            微应用入口
   ├─ locales/              中英文文案
   ├─ build/                构建与打包（生成 app.json、产出 zip）
   ├─ scripts/              测试、预览生成、发布脚本
   ├─ docs/                 视觉/交互规格文档、版本规则与台账
   ├─ public/               图标等静态资源
   ├─ app.json              微应用清单（由 config/app.config.js 生成，随仓库提供）
   ├─ index.html            Vite 入口
   ├─ vite.config.js
   ├─ eslint.config.js
   └─ package.json
```
package.json	项目清单与命令中枢。version/name 是发布真源之一；scripts 统管 dev/build/pack/gen/check/test/lint/preview:png 等；依赖 lit、chinese-days，devDeps 含 vite、@sun-panel/micro-app、adm-zip。
vite.config.js	构建配置（lib 模式，入口 src/main.js → dist/main.js）。插件链：localesJsonProxy（dev）、compileLocalesPlugin、forceMinifyPlugin（生产 esbuild 压缩 + 模板换行转 \n）；构建前 spawn build/build.js --yes 生成 app.json。末尾 7 个 vite.config.js.timestamp-*.mjs 是 Vite 自动缓存，可忽略。
app.json	SunPanel 应用清单（由 build/build.js 生成，非手写）。含 microAppId、版本、components.widgets['calendar-widget'] 七种尺寸白名单、permissions、networkDomains、dataNodes（holidayCache 应用级公开 / userData 用户级私有）。
index.html / src/vite-env.d.ts	Vite 开发入口页 / TypeScript 类型声明。
eslint.config.js	ESLint 9 扁平配置，覆盖 src/config。
AGENTS.md	Agent（编码助手）入口说明，指向 docs/HANDOVER.md 与 PROJECT-CONVENTIONS.md。
README.md	仓库说明。
.gitignore / .vscode/settings.json	忽略 dist/.build/packages/.tmp / 编辑器设置。

构建链 build/
build/build.js	主构建编排。检测/升级 appJsonVersion 到 1.1（解析 appInfo、生成翻译文件、语法校验），再调 generateAppJson() 产出 app.json。--yes 非交互。
build/pack.js	打包器。读 app.json 取 microAppId-version.zip，用 AdmZip 收 app.json + dist/ + public/（排除 .map）。
build/generators/app-json.js	从 config/ 提取元数据（正则去 import 后 eval 解析 components.config）拼装 SunPanel 清单写盘。
build/generators/locales-generator.js	把 locales/*.js 经 vm.runInNewContext 编译为 dist/locales/*.json。

配置源 config/
config/app.config.js	版本唯一真源（release 脚本只改这里）。含 author、microAppId、version、entry、icon、appInfo（$t 引用翻译）、locales 映射、defaultLocale、permissions、networkDomains（大段注释说明 chinese-days 联网/缓存/三级回退）、dataNodes。
config/components.config.js	组件注册源。pages：calendar-config(560×760)、calendar-main(type:main, 880×1120)；widgets：calendar-widget（component、configComponentName、七种 size、排序）。

入口与组件层 src/
src/main.js	微应用入口（模板文件勿改）。import.meta.glob('../locales/*') 自动导入翻译 → initSDK({translations, defaultLocale, dev}) → 导出 microAppPackage = { appConfig, components }。
src/components/widget.js	核心卡片组件（已全读）。class Widget extends SunPanelWidgetElement：ResizeObserver 量宿主像素→_measure()（含 1×FULL 列数计算）；_syncCardRadius() 读宿主圆角写 --sp-card-radius 消除四角灰线；_card getter 合并配置并 migrateToBlocks 迁移旧数据；render() 按 combo/single 分流；7 个尺寸渲染方法 + 子渲染器（_renderTime/_renderDate/_renderLunar/_renderScheduleList/_renderNextHoliday/_renderNextTerm/_renderProgress/_renderMonthMini/_renderNextCountdown）。
src/components/widgetConfig.js	Apple Settings 风配置页（~96KB）。每个小部件独立配置显示模式/主题/亮度/外观/时间，写入 widget config。
src/components/mainPage.js	主页面（~93KB）。年/月/周/日程/天气五视图 + 日程管理 + 全屏设置。

核心逻辑 src/core/
app-state.js	单例装配层。导出 holidayService/userStore/initPromise；ensureAppState(api) 幂等初始化；subscribeAppState(fn) 订阅变更。
user-store.js	状态与样式注册表（~80KB）。DEFAULT_SETTINGS、CARD_THEMES（glass/frosted/dark/neon）、SINGLE_CONTENTS 注册表（含每个样式 sizes 白名单，是尺寸门禁的数据源）、STYLE_OPT_FIELDS、COMBO_CONTENTS、网格布局算法（autoLayout/layoutBlocks/blocksFit/alignGovernor 等）。
card-mode-render.js	渲染内核（已部分读）。CONTENT_FIT 两级查表（无头 Chrome 实测的固有尺寸）、renderInfoBlock（单独模式）、renderBlocksHTML（拼接模式）、fitFontU（根字号公式）、styleFitsSize（渲染期门禁打标记）。
card-mode-styles.js	CSS 单一真源。CARD_MODE_CSS 模板字符串，三组件与预览生成器均以插值引用；各尺寸 .pv-single-1x1~1xfull 字号基准。
cd-adapter.js	chinese-days 适配层（已全读）。映射 SOLAR_TERMS/LUNAR_FESTIVALS/SOLAR_FESTIVALS/COMPUTED_FESTIVALS，封装 getDayInfo/getYearSolarTerms/lunarToSolar/solarToLunar 等。
date-utils.js	纯日期函数：parseDate/formatDate/todayStr/addDays/diffDays/daysInMonth/firstDayWeekday/getMonthGrid/dayOfYear/yearProgress。
schedule.js	日程计算（已全读）。四类 event/birthday/anniversary/countdown；getNextOccurrence（年循环下一次，避免"搬到今年"陷阱）；normalizeImportedSchedule（导入规整）。
holiday-service.js	节假日数据服务（已全读）。三级优先级：应用级 dataNode 缓存 → 网络拉取 jsDelivr/chinese-days → 内置兜底；自动刷新 24h、手动最小 60s；onChange 订阅驱动重渲染。
holiday-fallback.js	离线兜底数据（大文件）。内置 2024–2026 年节假日/调休/补班数据，网络不可用时启用。
highlights.js	高亮聚合：getNextHoliday/getNextSolarTerm/getUpcomingSchedule，供"下个节日/节气/日程"展示。
ical.js	ICS/VCS 解析与序列化。兼容标准 ICS（RRULE）、裸 VEVENT 流、QP 编码中文、行折叠；输出经 schedule.js 规整。
picker.js	日期滚轮选择器数据层（公历/农历），1900–2100 年范围、闰月处理、公农历互转。
apple-ui.js	Apple 风 UI 组件库（Lit 片段 + 共享 appleStyles + 系统色板 APPLE_COLORS），供配置页复用。

本地化 locales/
locales/zh-CN.js / locales/en-US.js	翻译源（key→文案）。构建期编译为 dist/locales/*.json，运行时经 $t 引用。

脚本工具链 scripts/
release.mjs	发布主脚本。按 --mode=modify/minor/major 推进版本（改 config+package.json）→ pack → deploy → commit（归档版额外 tag/push/Release/台账）；默认 dry-run。
deploy.mjs	本地离线部署不入库：登录面板 → 上传离线包 → 已装则升级否则安装。
check-css-mirror.mjs	CSS 镜像一致性守卫（规则体级，不仅选择器名），防共享真源与组件/生成器漂移。
check-version.mjs	版本号三落点（config/package.json/app.json）一致性门禁。
test-layout.mjs	网格布局自检（~3230 断言）：尺寸×样式不重叠/不越界/span 合法/旧数据迁移。
test-render.mjs	渲染自检（~213 断言）：坐标合法、根字号区间、1×FULL 自适应、单独模式走 renderInfoBlock。
test-lit-commit.mjs	真 lit + 真浏览器提交门禁：堵"字符串拼接全绿但 ElementPart 静默丢插值"盲区（如 1×1「十六」被裁成「十」）。
audit-single.mjs / audit-matrix.mjs	单样式×(真实尺寸) / 样式×尺寸×占格 全矩阵无头 Chrome 审计，产出 HTML 图集 + JSON + 红黄绿报告。
make-preview.mjs / make-defaults-preview.mjs	生成静态预览页（拼接模式 / 7 规格默认样式），展平 lit 模板供肉眼校验。
real-preview.mjs	按用户实测像素 1:1渲染（配置页是缩略图，本脚本验证真实不裁切）。
screenshot.mjs	用无头 Chrome 把预览 HTML 截成 PNG（支持 --tile 分片）。
lib/chrome.mjs	无头 Chrome 工具（测量高度 + 精确截图），自动探测本地 Chrome 路径，不依赖 puppeteer。
其余 *.html/*.png	上述脚本的产物（预览图集、审计报告），被 .gitignore 覆盖不入库。

文档 docs/
HANDOVER.md	交接说明：当前状态快照 + 复现步骤（面向接手 Agent）。
PROJECT-CONVENTIONS.md	项目约定汇编（产品/架构/尺寸/渲染铁律）。
VERSIONS.md	版本规则与台账（X.Y.YYMMDD[-beta] 格式、tag、发布范围）。
panel-sizes.md	七视口×七规格真实像素尺寸总表 + 根字号模型 + dpr 换算 + 审计复现命令（前轮交付物）。
v131-ux/visual-spec.md	v1.31 交互/视觉规范（两级置中、月历单行、窄高竖排、小卡年/星期）。
v135-no-units-ux/visual-spec.md	v1.35「无单位/No Units」开关规格（5 个日期样式）。
v312-visual-spec.md	v3.12 视觉规格（yearGrid 适配、1×FULL 放大、进度条重组）。

资源与产物
public/icon.png / dist/icon.png	应用图标（源 + 构建输出）。
dist/	构建输出：main.js、locales/*.json。
packages/	打包产物 *.zip（发布用，被 ignore）。
node_modules/	依赖（被 ignore）。
.tmp/	临时探针/截图/备份（被 ignore，不计入源码）。



## 开发

要求 Node 18+（推荐 22）。

```bash
cd calendar-app
npm install
npm run dev        # 本地开发
npm run lint       # ESLint（0 error 为门禁）
```

## 测试与预览

```bash
cd calendar-app
node scripts/test-layout.mjs             # 布局/占格/置中回归（约 3300+ 断言）
node scripts/test-render.mjs             # 渲染/DOM/样式镜像回归（约 350 断言）
node scripts/make-preview.mjs            # → scripts/preview.html（各尺寸排版用例）
node scripts/make-defaults-preview.mjs   # → scripts/defaults-preview.html（7 卡默认样式）
node scripts/audit-matrix.mjs            # → scripts/audit-matrix.html（样式×尺寸显示能力矩阵）
```

`audit-matrix` 会把「每个显示样式 × 每个卡片尺寸 × 推荐/最小占格」全渲染一遍，用无头 Chrome
量溢出与字号，输出红黄绿矩阵（绿=正常、黄=主文字 <9px、蓝=次要文字 <5.5px、红=被裁切），
用于发现「某个尺寸下某样式塞不下」的问题。

预览页与审计报告均为生成物，不入库。

## 构建与部署

```bash
cd calendar-app
npm run pack        # 构建 + 打包 → packages/zhousansui-holiday-count-down-<version>.zip
```

部署到 SunPanel：在面板的「微应用管理」页上传上一步生成的 zip 即可。

> 仓库**不包含**部署脚本（含内网地址与登录逻辑，凭据统一走环境变量）。本地如需脚本化部署，请自建
> `deploy.mjs`（调用 `/api/login` 取 Token → 上传 zip → 安装/升级），并确保凭据从 `SP_USER` / `SP_PASS`
> 环境变量读取、文件本身不要提交。

## 版本规则与发布

版本格式 `X.Y.YYMMDD[-beta]`，Beta / 正式版的推进规则、判定标准与 Beta→Release 对照台账见
**[calendar-app/docs/VERSIONS.md](calendar-app/docs/VERSIONS.md)**。

```bash
cd calendar-app
node scripts/release.mjs                          # dry-run，查看本次要产出的版本
node scripts/release.mjs --execute                # 修改：bump + pack + deploy + 本地提交
node scripts/release.mjs --mode=minor --execute   # 小归档：另加 tag + push + GitHub Release + 台账
node scripts/release.mjs --mode=major --execute   # 归档
```

## 文档

- [视觉规格](calendar-app/docs/v131-visual-spec.md)：字号、CONTENT_FIT 实测值、布局数值的唯一来源
- [交互规格](calendar-app/docs/v131-ux-spec.md)：拼接模式交互、占格编辑器、悬浮确认栏等
- [简约显示 · 交互](calendar-app/docs/v135-no-units-ux-spec.md) / [视觉](calendar-app/docs/v135-no-units-visual-spec.md)
- [版本规则与台账](calendar-app/docs/VERSIONS.md)
