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
```

预览页用浏览器打开即可肉眼校验；上述生成物不入库。

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
