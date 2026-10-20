# 版本规则与台账

## 一、版本格式

`X.Y.YYMMDD[-beta]`：X 大版本号、Y 小归档序号、第三位打包日期（6 位，如 `261020`）。

## 二、Beta 版

- 第一位：首次为 `1`；每次「归档」后 = 新正式版第一位 + 1；「小归档」不变。
- 第二位：每次「修改」+1；「归档」后置 0；「小归档」不变。
- 第三位：今日打包日期。
- 后缀：`-beta`。

## 三、正式版

- 第一位：首次归档为 `1`；之后每次「归档」= 上一个正式版第一位 + 1；「小归档」不变。
- 第二位：「归档」后从 `0` 起；每次「小归档」+1。
- 第三位：**沿用最后一次 beta 的打包日期**（只去 `-beta`，不改日期）。
- 无后缀。

> 注：原表述「正式版第一位 = beta 第一位」在小归档场景会破坏单调性
> （例：1.0 → 小归档 2.1 → 再归档 2.0，版本倒退）。故以本条为准：
> **正式版第一位只在大归档时 +1，小归档沿用**；beta 第一位恒为「正式版第一位 + 1」。

示例（单调不倒退）：`1.0 → 1.1（小归档） → 2.0（归档） → 2.1（小归档）`

## 四、判定与发布流程

1. **判定**：只有用户明确说「归档」/「小归档」才升版本；未提出的一律算「修改」（beta 第二位 +1）。
2. **必须重新打包**：归档/小归档版本号已变，发布包必须用新版本号重新构建；**禁止**改名复用 beta 的 zip（否则包内版本与 tag 不一致）。
3. **Tag / Release**：beta tag `X.Y.YYMMDD-beta`；正式 tag `X.Y.YYMMDD`；Release 标题 `VX.Y.YYMMDD`；发布前检查 tag 是否已存在。
4. **上传范围**：归档与小归档都 push `main` + 发 Release（正式版、非 prerelease、设 latest）；纯「修改」只本地 commit，不上传。
5. **台账**：每次归档/小归档在本文件表格追加一行（beta 号与正式版号不能互推，回溯只能查表）。
6. **package.json**：版本与 `config/app.config.js` 同步（发布脚本自动写入）。

## 五、发布脚本

```bash
node scripts/release.mjs                          # dry-run：只打印计划
node scripts/release.mjs --execute                # 修改：bump + pack + deploy + 本地 commit
node scripts/release.mjs --mode=minor --execute   # 小归档：另加 tag + push + Release + 台账
node scripts/release.mjs --mode=major --execute   # 归档：同上，正式版第一位 +1
# 可选：--note="一句话摘要" --skip-pack --skip-deploy
```

脚本会：计算目标版本 → 写入 config/package.json → 打包 → 部署 SunPanel → 提交 → （归档/小归档）打标签、推送、创建 Release 并上传 zip、追加台账 → 归档后自动进入下一个 beta。

## 六、仓库范围

GitHub 只保留打包所需源码。以下均已 gitignore：`.tmp/`、`.workbuddy/`、`packages/`、`dist/`、生成的 `scripts/preview*.html`。

---

## 台账（Beta → Release 对照）

| 发布日 | Beta 版本 | 正式版 | Tag | 说明 |
|--------|-----------|--------|-----|------|
| 2026-10-21 | `1.43.261020-beta` | `1.0.261020` | `1.0.261020` | 首次归档：7 卡推荐默认样式（1×1=「日」、1×FULL=月历 2×8）；v1.41 折行居中、v1.42 窄高卡 2×1 走双栏 |

> 手工发布时按上表格式补记；用 `scripts/release.mjs` 会自动追加。
