# AGENTS.md

> 给自动化 Agent / 交接者看的工程说明书。人类读者请看 [README.md](README.md)。
> 本文件是项目规则的**唯一入口**；细节见 `calendar-app/docs/`（视觉规格、交互规格、版本台账、约定汇编）。

## 1. 仓库结构

```
.
├─ README.md                 项目介绍（GitHub 首页展示）
├─ AGENTS.md                 本文件：agent 说明书
└─ calendar-app/             微应用源码（所有命令都在此目录执行）
   ├─ src/components/        widget / mainPage / widgetConfig 三个 Web Component（Lit）
   ├─ src/core/              渲染、布局、数据、节假日、日程、状态
   ├─ config/app.config.js   版本号唯一来源（app.json 由构建生成）
   ├─ build/                 Vite 构建 + app.json/locales 生成 + zip 打包
   ├─ locales/               中英文文案
   ├─ docs/                  视觉/交互规格、版本台账、约定汇编、交接说明
   └─ scripts/               测试、预览生成、矩阵审计、发布脚本
```

- 技术栈：Lit Web Components + Vite，纯 JavaScript（无 TypeScript），无框架。
- 微应用 ID：`zhousansui-holiday-count-down`，运行在 SunPanel 面板。

## 2. 环境

- Node 18+（实际使用 22.22.x），`npm` 直接可用。
- 无头 Chrome（截图 / 审计）：`C:/Program Files/Google/Chrome/Application/chrome.exe`。
  参数：`--headless=new --disable-gpu --no-sandbox --virtual-time-budget=3000`，`--screenshot` **必须用绝对路径**。
- 内网部署目标：SunPanel `http://192.168.10.251:13002`（地址可用 `SP_BASE` 覆盖）。

## 3. 常用命令（cwd = `calendar-app/`）

| 目的 | 命令 |
|------|------|
| 依赖安装 | `npm install` |
| 本地开发 | `npm run dev` |
| 代码检查 | `npm run lint`（门禁：0 error） |
| 布局回归 | `node scripts/test-layout.mjs`（约 3377 断言） |
| 渲染回归 | `node scripts/test-render.mjs`（约 395 断言） |
| 排版预览 | `node scripts/make-preview.mjs` → `scripts/preview.html`、`preview-single.html` |
| 默认样式预览 | `node scripts/make-defaults-preview.mjs` → `scripts/defaults-preview.html` |
| 显示能力矩阵 | `node scripts/audit-matrix.mjs` → `scripts/audit-matrix.html` |
| 打包 | `npm run pack` → `packages/<name>-<version>.zip` |
| 部署 | `SP_USER=… SP_PASS=… node deploy.mjs`（脚本不入库，见 §6） |
| 发布 | `node scripts/release.mjs [--mode=modify|minor|major] [--execute]` |

## 4. 交付门禁（缺一不可）

1. `node scripts/test-layout.mjs` 全绿
2. `node scripts/test-render.mjs` 全绿
3. `npm run lint` 0 error
4. 改了渲染/尺寸 → `node scripts/audit-matrix.mjs` 结果中 `CLIP`（裁切）与 `TINY`（主文字 <9px）必须为 **0**
5. 改了视觉 → 生成预览 + 无头截图肉眼核对，报告里写明看了哪些尺寸

## 5. 架构不变量（改之前必须知道）

- **一套渲染、五处 CSS 镜像**：`src/core/card-mode-render.js` 产出 DOM；样式同时存在于
  `src/components/widget.js` / `mainPage.js` / `widgetConfig.js` / `scripts/make-preview.mjs` / `scripts/measure.html`。
  **改一条 CSS 规则必须五处同步**，否则预览与实际不一致。
- **字号靠 FIT 反推**：块根字号 `u = fitFontU(blockW, blockH, fit)`，块内全用 `em`。
  `CONTENT_FIT` 是每种样式的最坏情况实测值（`scripts/measure.html` 是测量台），**改它必须实测回写**，不能拍脑袋。
- **网格坐标一律「列×行」**：`span = {cols, rows}`。SunPanel 的 `gridSize` 是「行×列」，口语 1×2 = 宽扁、2×1 = 窄高。
- **运行时网格函数唯一**：`comboGridFor(size, w, h)`（`src/core/user-store.js`）——1×FULL 按宽度取 4~10 列，
  其它尺寸单元格 <24px 会降密度。widget / 两个预览 / 预览脚本 / 审计全部调它，**不要另写一套列数规则**。
- **预览对齐实际**：widget 测到宿主尺寸后防抖回写设置 `previewSize = {size,w,h}`，配置页预览优先用它；
  没有实测值时预览是「示意」模式。
- **布局不持久化**：只存 `[{c,s,span?,align?,opts?,n?}]`，`layoutBlocks()` 在渲染时按实际网格现算。

## 6. 凭据与安全

- `deploy.mjs` **不入库**（含内网地址）；凭据只从 `SP_USER` / `SP_PASS` 读，缺失即报错。
- `git remote origin` 必须是不含 token 的 URL：`https://github.com/ZhouSanSui/Sun-Panel_Micro-Application_Calendar.git`
- **禁止**把 API Key、面板密码、PAT 写进任何被跟踪的文件（含 `docs/`、测试、脚本）。
- 需要推送 GitHub 时用 `ssh` remote（`git@github.com:...`），不要往 URL 里加 token。
- 发 Release 需要 `GITHUB_TOKEN`（fine-grained，具备 repo 读写权限）；`release.mjs` 从该环境变量读取。

## 7. 版本与发布

规则全文与 Beta→Release 台账：`calendar-app/docs/VERSIONS.md`（**必须查表**，两套编号不能互推）。

- 只有用户明确说「归档 / 小归档」才升版本；其余改动算「修改」（beta 第二位 +1）。
- `release.mjs` 默认 dry-run；`--execute` 才执行。`modify` 只本地提交；`minor`/`major` 会打 tag、推 main、发 Release。
- 归档/小归档**必须重新打包**，禁止改名复用 beta 的 zip。

## 8. 高频陷阱（踩过的坑，别再踩）

1. **模板字符串里不能出现未转义反引号**（`html\`` / `css\`` 内，**注释里也不行**）——会提前闭合模板，
   整页白屏只剩 `NaN`。`test-render.mjs` 有源码扫描断言。
2. **禁用 `position: fixed`** 做浮层：会被 `backdrop-filter` 祖先劫持、画出卡片遮住面板 UI。用 `.fullscreen` 内 `absolute`。
3. **竖排/宽扁判定用像素比**，不要用格数比（1×FULL 的格子不是正方形）。
4. **渲染改动必须跑矩阵审计**：历史上「今天」折行、窄高卡不横排、`hms` 溢出都是它抓出来的。
5. **日期串**：每个「数值+单位」是 `.pv-seg`（nowrap），只在段间 `<wbr>` 换行；块宽 <150px 自动用两位年。
6. **小文字**：块根字号 <10px 时加 `.pv-tight` 隐藏副标题（48px 小块里副标题只有 ~5px）。
7. **面积下限**：`hms`、`dateFullWeekday`、四样式（节日/节气/距放假/最近日程）有 `minArea: 2`，禁 1×1 占格。
8. **测试里的 `base.now` 是固定历史日期**；涉及「今天」要显式传 `now: new Date()`。

## 9. 接手后的第一个任务（建议）

```
1) 读本文件 + calendar-app/docs/PROJECT-CONVENTIONS.md + docs/VERSIONS.md
2) 跑 node scripts/test-layout.mjs 与 node scripts/test-render.mjs，报告断言数
3) 报告 config/app.config.js 版本号、git status、最近 3 条提交
4) 不要修改任何文件
```

确认理解一致后，再开始改代码；每次提交前跑完 §4 门禁。
