#!/usr/bin/env node
/**
 * 发布脚本：版本号推进 + 打包部署 + （归档/小归档）推送 GitHub 与发 Release + 台账。
 *
 * 用法：
 *   node scripts/release.mjs                       # 默认 --mode=modify，dry-run（只打印计划）
 *   node scripts/release.mjs --execute             # 修改版：bump + pack + deploy + 本地 commit（不 push）
 *   node scripts/release.mjs --mode=minor --execute    # 小归档：额外 tag + push + Release + 台账
 *   node scripts/release.mjs --mode=major --execute    # 归档：同上，正式版第一位 +1
 *   参数：--note="一句话摘要"  --skip-pack  --skip-deploy
 *
 * 规则与台账见 docs/VERSIONS.md（版本格式、判定、tag、发布范围、脚本用法）。
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REPO_DIR = path.resolve(APP_DIR, '..');
const CONFIG = path.join(APP_DIR, 'config', 'app.config.js');
const LEDGER = path.join(APP_DIR, 'docs', 'VERSIONS.md');

// ---------- 参数 ----------
const args = process.argv.slice(2);
const opt = (name, def) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};
const flag = (name) => args.includes(`--${name}`);
const MODE = opt('mode', 'modify');
const EXECUTE = flag('execute');
const NOTE = opt('note', '');
if (!['modify', 'minor', 'major'].includes(MODE)) {
  console.error(`未知 --mode=${MODE}（可选 modify / minor / major）`);
  process.exit(1);
}

// ---------- 工具 ----------
const sh = (cmd, opts = {}) => execSync(cmd, { cwd: APP_DIR, stdio: 'inherit', ...opts });
const out = (cmd, cwd = APP_DIR) => execSync(cmd, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const pad = (n) => String(n).padStart(2, '0');
const todayCode = () => {
  const d = new Date();
  return `${pad(d.getFullYear() % 100)}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
};
const isoDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

function readVersion() {
  const m = readFileSync(CONFIG, 'utf8').match(/version:\s*'([^']+)'/);
  if (!m) throw new Error('config/app.config.js 中未找到 version');
  return m[1];
}
function writeVersion(v) {
  writeFileSync(CONFIG, readFileSync(CONFIG, 'utf8').replace(/(version:\s*')[^']+(')/, `$1${v}$2`));
  const pjPath = path.join(APP_DIR, 'package.json');
  const pj = JSON.parse(readFileSync(pjPath, 'utf8'));
  pj.version = v;
  writeFileSync(pjPath, `${JSON.stringify(pj, null, 2)}\n`);
  console.log(`  版本写入：config/app.config.js + package.json → ${v}`);
}
const parseVer = (raw) => {
  const m = raw.match(/^(\d+)\.(\d+)\.(\d{6})(-beta)?$/);
  if (!m) throw new Error(`版本格式不合法：${raw}（应形如 1.2.261020 或 1.2.261020-beta）`);
  return { x: Number(m[1]), y: Number(m[2]), d: m[3], beta: !!m[4] };
};

/** 台账最后一条正式版 */
function lastRelease() {
  if (!existsSync(LEDGER)) return null;
  const rows = readFileSync(LEDGER, 'utf8').split('\n')
    .filter((l) => /^\|\s*\d{4}-\d{2}-\d{2}\s*\|/.test(l));
  if (!rows.length) return null;
  const cols = rows[rows.length - 1].split('|').map((s) => s.trim());
  const rel = (cols[3] || '').replace(/`/g, '');
  const m = rel.match(/^(\d+)\.(\d+)\.(\d{6})$/);
  return m ? { x: Number(m[1]), y: Number(m[2]), d: m[3], raw: rel } : null;
}

/** 台账最后一条 beta（用于从正式版状态推算下一个 beta） */
function lastBeta() {
  if (!existsSync(LEDGER)) return null;
  const rows = readFileSync(LEDGER, 'utf8').split('\n')
    .filter((l) => /^\|\s*\d{4}-\d{2}-\d{2}\s*\|/.test(l));
  if (!rows.length) return null;
  const cols = rows[rows.length - 1].split('|').map((s) => s.trim());
  const raw = (cols[2] || '').replace(/`/g, '');
  const m = raw.match(/^(\d+)\.(\d+)\.(\d{6})-beta$/);
  return m ? { x: Number(m[1]), y: Number(m[2]), d: m[3], raw } : null;
}

/** 计算目标版本：modify → 新 beta；minor/major → 正式版 + 新 beta */
function computePlan(mode, curRaw) {
  const cur = parseVer(curRaw);
  const last = lastRelease();
  const today = todayCode();
  if (mode === 'modify') {
    if (cur.beta) return { target: `${cur.x}.${cur.y + 1}.${today}-beta`, betaAfter: null };
    // 当前是正式版（如新克隆）：台账里的 beta 若已是大版本+1 则继续 +1，否则从「大版本+1、第二位 0」起步
    const lb = lastBeta();
    if (lb && lb.x > cur.x) return { target: `${lb.x}.${lb.y + 1}.${today}-beta`, betaAfter: null };
    return { target: `${cur.x + 1}.0.${today}-beta`, betaAfter: null };
  }
  if (!cur.beta) throw new Error('小归档/归档要求当前版本为 beta（请先以 --mode=modify 产出 beta）');
  // 正式版：小归档沿用上一个正式版第一位；归档 +1；首次归档取 beta 第一位
  const relX = !last ? cur.x : (mode === 'major' ? last.x + 1 : last.x);
  const relY = mode === 'major' ? 0 : (last ? last.y + 1 : 0);
  const release = `${relX}.${relY}.${cur.d}`; // 第三位沿用最后一次 beta 打包日
  const betaAfter = mode === 'major' ? `${relX + 1}.0.${today}-beta` : curRaw;
  return { target: release, betaAfter, release, betaBefore: curRaw };
}

/** 推送隧道（沙箱代理封 github.com，只能 SSH-over-443） */
function ensureTunnel() {
  const dir = path.join(REPO_DIR, '.tmp');
  const file = path.join(dir, 'proxy-connect.mjs');
  if (existsSync(file)) return file.replace(/\\/g, '/');
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, `import net from 'node:net';
const host = process.argv[2];
const port = Number(process.argv[3] || 443);
const px = new URL(process.env.HTTPS_PROXY || process.env.HTTP_PROXY || 'http://127.0.0.1:1695');
const sock = net.connect(Number(px.port || 80), px.hostname, () => {
  sock.write(\`CONNECT \${host}:\${port} HTTP/1.1\\r\\nHost: \${host}:\${port}\\r\\n\\r\\n\`);
});
let buf = Buffer.alloc(0);
let ok = false;
sock.on('data', (c) => {
  if (ok) return;
  buf = Buffer.concat([buf, c]);
  const i = buf.indexOf('\\r\\n\\r\\n');
  if (i < 0) return;
  if (!/^HTTP\\/1\\.[01] 200/.test(buf.subarray(0, i).toString('latin1'))) process.exit(1);
  ok = true;
  const rest = buf.subarray(i + 4);
  sock.removeAllListeners('data');
  sock.on('data', (d) => process.stdout.write(d));
  if (rest.length) process.stdout.write(rest);
  process.stdin.pipe(sock);
  process.stdin.on('end', () => sock.end());
  sock.on('close', () => process.exit(0));
});
sock.on('error', () => process.exit(1));
`);
  console.log(`  已生成推送隧道：${file}`);
  return file.replace(/\\/g, '/');
}

function pushGit(tag) {
  const tunnel = ensureTunnel();
  const key = path.join(homedir(), '.ssh', 'id_ed25519_cal').replace(/\\/g, '/');
  const env = {
    ...process.env,
    HOME: homedir(),
    GIT_SSH_COMMAND: `ssh -i "${key}" -o ProxyCommand="node '${tunnel}' %h %p" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=25`,
  };
  const origin = out('git remote get-url origin', REPO_DIR);
  const m = origin.match(/github\.com[/:]([^/]+\/[^/.]+?)(?:\.git)?$/);
  if (!m) throw new Error('无法解析 origin 仓库路径');
  const sshUrl = `git@github.com:${m[1]}.git`;
  try { out('git remote get-url ssh', REPO_DIR); } catch { out(`git remote add ssh ${sshUrl}`, REPO_DIR); }
  console.log('  push main …');
  sh('git push ssh main', { cwd: REPO_DIR, env });
  if (tag) {
    console.log(`  push tag ${tag} …`);
    sh(`git push ssh ${tag}`, { cwd: REPO_DIR, env });
  }
  return origin.match(/(ghp_[A-Za-z0-9_]+)/)?.[1] || process.env.GITHUB_TOKEN || '';
}

function createRelease(version, token, zipPath, note) {
  const origin = out('git remote get-url origin', REPO_DIR);
  const repoPath = origin.match(/github\.com[/:]([^/]+\/[^/.]+?)(?:\.git)?$/)[1];
  const body = [
    `## V${version}`, '',
    note || '归档发布', '',
    '### 安装',
    `下载 \`${path.basename(zipPath)}\`，在 SunPanel 微应用管理页上传安装/升级。`, '',
    '### 版本说明',
    '版本规则与 Beta→Release 对照见仓库 `docs/VERSIONS.md`。',
  ].join('\n');
  const tmpJson = path.join(REPO_DIR, '.tmp', 'release.json');
  writeFileSync(tmpJson, JSON.stringify({ tag_name: version, name: `V${version}`, body, prerelease: false, make_latest: 'true' }));
  const hdr = `-H "Authorization: Bearer ${token}" -H "Accept: application/vnd.github+json" -H "Content-Type: application/json"`;
  sh(`curl -sS -X POST ${hdr} https://api.github.com/repos/${repoPath}/releases -d @${tmpJson} -o ${path.join(REPO_DIR, '.tmp', 'release-resp.json')} -w "HTTP %{http_code}\\n"`);
  const resp = JSON.parse(readFileSync(path.join(REPO_DIR, '.tmp', 'release-resp.json'), 'utf8'));
  if (!resp.id) throw new Error(`创建 Release 失败：${JSON.stringify(resp)}`);
  console.log(`  Release 已创建：id=${resp.id} tag=${resp.tag_name}`);
  const upHdr = `-H "Authorization: Bearer ${token}" -H "Accept: application/vnd.github+json" -H "Content-Type: application/zip"`;
  sh(`curl -sS -X POST ${upHdr} --data-binary @${zipPath} "https://uploads.github.com/repos/${repoPath}/releases/${resp.id}/assets?name=${path.basename(zipPath)}" -o ${path.join(REPO_DIR, '.tmp', 'asset-resp.json')} -w "HTTP %{http_code}\\n"`);
  const asset = JSON.parse(readFileSync(path.join(REPO_DIR, '.tmp', 'asset-resp.json'), 'utf8'));
  if (asset.state !== 'uploaded') throw new Error(`上传资产失败：${JSON.stringify(asset)}`);
  console.log(`  资产已上传：${asset.name}（${asset.size} B）`);
  return `https://github.com/${repoPath}/releases/tag/${version}`;
}

function appendLedger(row) {
  const head = readFileSync(LEDGER, 'utf8');
  const lines = head.split('\n');
  let lastRow = -1;
  lines.forEach((l, i) => { if (/^\|\s*\d{4}-\d{2}-\d{2}\s*\|/.test(l)) lastRow = i; });
  const cells = `| ${row.date} | \`${row.beta}\` | \`${row.release}\` | \`${row.release}\` | ${row.note} |`;
  if (lastRow >= 0) lines.splice(lastRow + 1, 0, cells);
  else lines.push(cells);
  writeFileSync(LEDGER, lines.join('\n'));
  console.log(`  台账已追加：${row.release}`);
}

// ---------- 主流程 ----------
const cur = readVersion();
const plan = computePlan(MODE, cur);
const isRelease = MODE !== 'modify';
const pkgName = JSON.parse(readFileSync(path.join(APP_DIR, 'package.json'), 'utf8')).name;
const zipPath = path.join(APP_DIR, 'packages', `${pkgName}-${plan.target}.zip`);

console.log(`\n=== 发布计划（${MODE}${EXECUTE ? '' : ' · dry-run'}）===`);
console.log(`  当前版本：${cur}`);
console.log(`  目标版本：${plan.target}${isRelease ? '（正式版）' : '（beta）'}`);
if (isRelease) console.log(`  之后 beta：${plan.betaAfter}`);
console.log(`  产物：${path.relative(APP_DIR, zipPath)}`);
console.log(`  GitHub：${isRelease ? 'push main + tag + Release' : '仅本地 commit（不上传）'}`);
if (!EXECUTE) {
  console.log('\n（dry-run 未做任何修改；加 --execute 执行）\n');
  process.exit(0);
}

if (isRelease) {
  const tags = out('git tag -l', REPO_DIR).split('\n');
  if (tags.includes(plan.release)) throw new Error(`tag ${plan.release} 已存在，不能重复归档`);
}

if (!flag('skip-deploy')) {
  if (!existsSync(path.join(APP_DIR, 'deploy.mjs'))) {
    console.error('\n未找到本机 deploy.mjs（该脚本不入库）：请自行提供，或加 --skip-deploy 跳过部署');
    process.exit(1);
  }
  if (!process.env.SP_USER || !process.env.SP_PASS) {
    console.error('\n部署凭据缺失：请先 export SP_USER=… SP_PASS=…（或加 --skip-deploy 跳过部署）');
    process.exit(1);
  }
}

writeVersion(plan.target);

if (!flag('skip-pack')) {
  console.log('\n[1/6] 打包…');
  sh('npm run pack');
}
if (!flag('skip-deploy')) {
  console.log('\n[2/6] 部署到 SunPanel…');
  sh('node deploy.mjs');
}

if (isRelease) {
  appendLedger({
    date: isoDate(),
    beta: plan.betaBefore,
    release: plan.release,
    note: NOTE || (MODE === 'major' ? '归档' : '小归档'),
  });
}

console.log('\n[3/6] 提交…');
// app.json 虽由 build/build.js 生成，但仍是跟踪文件，且版本字段必须与
// config/app.config.js、package.json 同步（check-version.mjs 三处比对），
// 故 bump 后一并提交，否则仓库快照会停在旧版本号。
const addPaths = [
  'calendar-app/config/app.config.js', 'calendar-app/package.json', 'calendar-app/app.json',
  ...(isRelease ? ['calendar-app/docs/VERSIONS.md'] : []),
].join(' ');
sh(`git add ${addPaths}`, { cwd: REPO_DIR });
const msg = isRelease
  ? `release: v${plan.target} ${MODE === 'major' ? '归档' : '小归档'}${NOTE ? ` — ${NOTE}` : ''}`
  : `chore: 版本 v${plan.target}`;
sh(`git commit -m "${msg}"`, { cwd: REPO_DIR });

let url = '';
if (isRelease) {
  console.log(`\n[4/6] 打标签 ${plan.release}…`);
  sh(`git tag -a ${plan.release} -m "v${plan.release}"`, { cwd: REPO_DIR });
  console.log('\n[5/6] 推送 GitHub…');
  const token = pushGit(plan.release);
  console.log('\n[6/6] 创建 Release 并上传资产…');
  url = createRelease(plan.release, token, zipPath, NOTE);
  console.log(`  ${url}`);
  // 归档/小归档后进入下一个 beta：写回版本并提交，保持工作区干净、下次 --mode=modify 直接 +1
  if (plan.betaAfter) {
    writeVersion(plan.betaAfter);
    sh('git add calendar-app/config/app.config.js calendar-app/package.json', { cwd: REPO_DIR });
    sh(`git commit -m "chore: 版本进入 beta ${plan.betaAfter}"`, { cwd: REPO_DIR });
    const token2 = pushGit(null);
    console.log(`  beta 起步已提交并推送：${plan.betaAfter}${token2 ? '' : '（推送失败请手动执行）'}`);
  }
} else {
  console.log('\n[4/6] 跳过 tag / push / Release（beta 不上传 GitHub）');
  console.log('[5/6] 跳过');
  console.log('[6/6] 跳过');
}

console.log('\n=== 完成 ===');
console.log(`  版本：${plan.target}`);
console.log(`  包：${path.relative(APP_DIR, zipPath)}`);
if (url) console.log(`  Release：${url}`);
console.log('');
