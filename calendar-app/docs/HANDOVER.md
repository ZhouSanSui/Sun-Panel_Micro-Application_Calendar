# 交接说明（Handover）

> 目标：把本仓库交给任意编码 Agent（如 DeepSeek Harness / `dsh`）接管时可自解释、可复现、无凭据泄漏。
> 配套文件：根目录 `AGENTS.md`（agent 入口）、`docs/PROJECT-CONVENTIONS.md`（约定汇编）、`docs/VERSIONS.md`（版本台账）。

## 一、当前状态快照（2026-10-21 04:10）

| 项 | 值 |
|---|---|
| 工作版本 | `2.2.261021-beta`（`calendar-app/config/app.config.js`） |
| 已部署 | SunPanel 应用 `zhousansui-holiday-count-down` → `v2.2.261021-beta` |
| 最近正式版 | `1.0.261020`（GitHub Release + tag，唯一正式 tag） |
| 测试 | `test-layout` 3377 项、`test-render` 395 项，全绿 |
| Lint | 0 error（261 warning 为既有基线） |
| 矩阵审计 | 裁切 0 / 主文字过小 0 / 次要注意 24 |
| 跟踪文件 | 51（源码 + 5 份规格/约定/台账/交接 + 根 README/AGENTS） |

> 部署名以 `calendar-app/app.json` 的 `microAppId` 为准：`zhousansui-holiday-count-down`。

## 二、接手前必做（4 项）

### 1. 读三份文档
`AGENTS.md` → `docs/PROJECT-CONVENTIONS.md` → `docs/VERSIONS.md`。
理解三件事：**五处 CSS 镜像**、**版本规则**、**交付门禁**。

### 2. 配环境
- Node 18+（建议 22.x 与当前一致）
- `cd calendar-app && npm install`
- 无头 Chrome 路径：`C:/Program Files/Google/Chrome/Application/chrome.exe`（截图/审计用，`--screenshot` 必须绝对路径）

### 3. 凭据（不进仓库）
- 部署：`SP_USER` / `SP_PASS` 两个环境变量；`SP_BASE` 可选（默认内网地址）
- 发 Release（归档/小归档）：`GITHUB_TOKEN` 环境变量（origin URL 已不含 token）
- 仓库不含 `deploy.mjs`（gitignore）。如需脚本化部署，按 `AGENTS.md §6` 自建：
  登录 `/api/login` 取 Token → 上传 zip → 安装/升级；凭据只从环境变量读
- **禁止**把任何 token / 密码写进被跟踪文件

### 4. 自检
```bash
cd calendar-app
node scripts/test-layout.mjs
node scripts/test-render.mjs
npm run lint
node scripts/audit-matrix.mjs
```
四项通过即环境就绪。

## 三、常用工作流

### 改一个显示样式（最常见）
1. 改 `src/core/card-mode-render.js` 的渲染分支（必要时补 `CONTENT_FIT`）
2. **五处 CSS 镜像同步**（三组件 + make-preview + measure.html）
3. `node scripts/test-render.mjs`；若涉及尺寸/占格再跑 `test-layout.mjs`
4. `node scripts/audit-matrix.mjs` 确认 0 裁切 / 0 主文字过小
5. `node scripts/make-preview.mjs` + 无头截图肉眼核对
6. `node scripts/release.mjs --execute`（beta：bump + pack + deploy + 本地提交）

### 发布版本
```bash
node scripts/release.mjs                    # dry-run：先看会产出什么版本
node scripts/release.mjs --execute          # 修改版（beta）
node scripts/release.mjs --mode=minor --execute   # 小归档（tag + push + Release）
node scripts/release.mjs --mode=major --execute   # 归档
```
规则：用户说「归档 / 小归档」才升版本；否则一律「修改」。

## 四、回滚与排障

- **回滚线上**：在 SunPanel 微应用管理页重新上传上一次的 zip（`packages/` 本地留存），或 `git checkout <上一个版本号>` 后 `npm run pack` + 部署。
- **白屏只剩 `NaN`**：99% 是模板字符串里出现了未转义反引号（含注释），见 `AGENTS.md §8.1`。
- **预览与实际不一致**：先看 widget 是否已回写 `previewSize`（刷新面板再生效）；再看是否有人绕过 `comboGridFor` 自算列数。
- **文字被裁**：跑矩阵审计定位组合，检查该样式是否有 `minArea` / 是否需要 `pv-tight` / FIT 是否欠预留。
- **推送失败**：`github.com` 直连可能被网络策略拦截；用 `ssh` remote 或配置代理隧道（见历史提交说明）。

## 五、交接后第一批建议任务

1. 跑完 §二.4 的四项自检，报告数字（验证环境一致）
2. 处理矩阵审计里 24 个「次要文字 <5.5px」组合：决定是「隐藏副标题 / 提高最小占格 / 保持现状」
3. 英文日期与中文对齐：把 `Oct 18, 2026` 也做成分段（`Oct 18` / `2026`），避免在怪位置换行
4. 把 `_showHint` 加上「撤销」动作，减少误操作成本

## 六、已知风险

- `dsh` 处于开发者预览阶段（0.1 rc），官方声明会有破坏性变更；**不要让它直接操作线上部署**，先本地提交 + 人工审阅。
- 内网 SunPanel 地址与账号属于敏感信息，只走环境变量。
- 历史提交已重建（单提交起步），旧版本只保留 tag `1.0.261020` 及之后的提交，更早历史不可回溯。
