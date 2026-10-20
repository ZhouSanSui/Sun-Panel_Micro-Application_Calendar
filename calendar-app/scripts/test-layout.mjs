/**
 * v1.28 网格布局自检：
 *  1) CARD_GRID 宽高比与 SunPanel 尺寸命名一致
 *  2) 所有尺寸 × 所有样式组合：autoLayout 结果不重叠、不越界、全部落在网格内
 *  3) 单块（每种样式）在受支持尺寸下都能放下
 *  4) 全量样式塞满各尺寸：能放尽量多，且 blocksFit 判定与实放数量一致
 *  5) 旧数据（无 span/pos 的 [{c,s}]）经 layoutBlocks 后坐标合法
 */
import {
  CARD_GRID, gridForSize, styleSpanDef, buildOccupancy, canPlace, findSlot,
  autoLayout, blocksFit, layoutBlocks, sanitizeBlocks,
  normalizeSpan, blockSpanDef, effectiveSpan, spanBounds, flatStyleSeq, shiftFlatStyle,
  unitId, unitAlign, unitOpts, isFullCard, UserStore,
  COMBO_CONTENTS, displayContents,
  alignGovernor, applyAlignmentWithReport, applyCardCenter, layoutSignature,
  unitAlignExplicit, singleLineOn, prefSpan, soloUnitIndexes,
} from '../src/core/user-store.js';

let pass = 0;
const fails = [];
function ok(cond, msg) {
  if (cond) pass++;
  else fails.push(msg);
}

// ---------- 1) 宽高比一致性 ----------
// SunPanel 尺寸为 行×列；可见宽高比 = 列/行
const SUN = {
  '1x1': { rows: 1, cols: 1 }, '1x2': { rows: 1, cols: 2 }, '2x1': { rows: 2, cols: 1 },
  '2x2': { rows: 2, cols: 2 }, '2x4': { rows: 2, cols: 4 }, '4x4': { rows: 4, cols: 4 },
  '1xfull': { rows: 1, cols: 4 },
};
for (const [size, s] of Object.entries(SUN)) {
  const g = gridForSize(size);
  const wantRatio = s.cols / s.rows;
  const gotRatio = g.cols / g.rows;
  ok(Math.abs(wantRatio - gotRatio) < 0.001,
    `${size} 网格宽高比应=${wantRatio}，实际=${gotRatio}（${g.cols}×${g.rows}）`);
  ok(g.cols % s.cols === 0 && g.rows % s.rows === 0,
    `${size} 网格 ${g.cols}×${g.rows} 应为 SunPanel 单元的整数倍`);
}

// ---------- 2) 布局合法性 ----------
function checkLayout(layout, grid, label) {
  const seen = new Set();
  for (const b of layout) {
    const { pos, span } = b;
    ok(pos.col >= 0 && pos.row >= 0, `${label}: ${b.c}:${b.s} 坐标为负`);
    ok(pos.col + span.cols <= grid.cols, `${label}: ${b.c}:${b.s} 横向越界 (${pos.col}+${span.cols}>${grid.cols})`);
    ok(pos.row + span.rows <= grid.rows, `${label}: ${b.c}:${b.s} 纵向越界 (${pos.row}+${span.rows}>${grid.rows})`);
    for (let r = pos.row; r < pos.row + span.rows; r++) {
      for (let c = pos.col; c < pos.col + span.cols; c++) {
        const k = `${r},${c}`;
        ok(!seen.has(k), `${label}: 单元格 (${c},${r}) 重叠（${b.c}:${b.s}）`);
        seen.add(k);
      }
    }
  }
}

const sizes = Object.keys(CARD_GRID);
// 全量单元（全部内容 × 全部样式）
const allUnits = [];
for (const c of COMBO_CONTENTS) for (const s of c.styles) allUnits.push({ c: c.key, s: s.key });

for (const size of sizes) {
  const grid = gridForSize(size);
  // 每种单块
  for (const u of allUnits) {
    const lay = autoLayout([u], 'combo', size);
    ok(lay.length === 1, `${size}: 单块 ${u.c}:${u.s} 应能放下（span=${JSON.stringify(styleSpanDef('combo', u.c, u.s).span)}）`);
    if (lay.length) checkLayout(lay, grid, `${size}/single/${u.c}:${u.s}`);
  }
  // 全量塞满
  const layAll = autoLayout(allUnits, 'combo', size);
  checkLayout(layAll, grid, `${size}/all`);
  const fit = blocksFit(allUnits, 'combo', size);
  ok(fit === (layAll.length === allUnits.length),
    `${size}: blocksFit=${fit} 与实放 ${layAll.length}/${allUnits.length} 不一致`);

  // 部分组合（前 N 个）也必须合法
  for (let n = 1; n <= allUnits.length; n += 3) {
    const sub = allUnits.slice(0, n);
    checkLayout(autoLayout(sub, 'combo', size), grid, `${size}/first${n}`);
  }
}

// ---------- 3) 容量单调性：尺寸越大能放越多 ----------
const cap = {};
for (const size of sizes) cap[size] = autoLayout(allUnits, 'combo', size).length;
ok(cap['2x2'] >= cap['1x1'], `2x2 容量(${cap['2x2']}) 应 ≥ 1x1(${cap['1x1']})`);
ok(cap['4x4'] >= cap['2x2'], `4x4 容量(${cap['4x4']}) 应 ≥ 2x2(${cap['2x2']})`);
ok(cap['2x4'] >= cap['1x2'], `2x4 容量(${cap['2x4']}) 应 ≥ 1x2(${cap['1x2']})`);
// 1×FULL 的月历「单行显示」会占满整行，故多块并排用「不含月历」的单元衡量
const fullCapNoMonth = autoLayout(allUnits.filter((u) => !(u.c === 'calendar' && u.s === 'month')), 'combo', '1xfull').length;
ok(fullCapNoMonth >= 2, `1xfull（不含月历）至少能放 2 块（实际 ${fullCapNoMonth}）`);

// 1×FULL 横向 FULL：应能并排放多块（月历在 1×FULL 默认占 6 列，单独排除后再测）
const fullUnits = allUnits.filter((u) => !(u.c === 'calendar' && u.s === 'month'));
const fullLay = autoLayout(fullUnits.slice(0, 6), 'combo', '1xfull');
ok(fullLay.length >= 4, `1xfull 前 6 块应至少放下 4 块（实际 ${fullLay.length}）`);
// v1.32 需求 2：1×FULL 月历「单行显示」占满整行宽度（减少两侧留白），显式 span 不受影响
const mDef = autoLayout([{ c: 'calendar', s: 'month' }], 'combo', '1xfull');
ok(mDef.length === 1 && mDef[0].span.cols === 8 && mDef[0].span.rows === 2,
  `1xfull 月历默认应占满整行 8×2（实际 ${JSON.stringify(mDef[0] && mDef[0].span)}）`);
// 关闭单行后回到 2×2（D13 守卫：显式关闭且未设 span）
const mOff = autoLayout([{ c: 'calendar', s: 'month', opts: { singleLine: false } }], 'combo', '1xfull');
ok(mOff.length === 1 && mOff[0].span.cols === 2,
  `1xfull 月历显式关闭单行应回退 2×2（实际 ${JSON.stringify(mOff[0] && mOff[0].span)}）`);
const mOv = autoLayout([{ c: 'calendar', s: 'month', span: { cols: 4, rows: 2 } }], 'combo', '1xfull');
ok(mOv.length === 1 && mOv[0].span.cols === 4, '1xfull 月历显式 span 4×2 应生效');
// v1.34 需求 1：运行时网格更宽（宿主面板大 → 9/10 列）时，FULL 意图的占格拉伸到整行
{
  const wide = { cols: 10, rows: 2 };
  // 用户点过 FULL（存 8×2）→ 运行时 10 列应拉伸铺满，消除两侧留白
  const mFull = autoLayout([{ c: 'calendar', s: 'month', span: { cols: 8, rows: 2 } }], 'combo', '1xfull', wide);
  ok(mFull.length === 1 && mFull[0].span.cols === 10 && mFull[0].span.rows === 2,
    `1xfull 月历 FULL 占格应在 10 列运行时拉伸为 10×2（实际 ${JSON.stringify(mFull[0] && mFull[0].span)}）`);
  // 无显式 span（默认首选即占满）同样铺满
  const mDef10 = autoLayout([{ c: 'calendar', s: 'month' }], 'combo', '1xfull', wide);
  ok(mDef10.length === 1 && mDef10[0].span.cols === 10, '1xfull 月历无 span 时 10 列运行时也应铺满');
  // 显式窄占格（4×2 < 基础网格 8 列）不拉伸：用户意图就是窄条
  const mNarrow = autoLayout([{ c: 'calendar', s: 'month', span: { cols: 4, rows: 2 } }], 'combo', '1xfull', wide);
  ok(mNarrow.length === 1 && mNarrow[0].span.cols === 4, '1xfull 月历显式 4×2 在 10 列运行时应保持 4 列');
  // 拉伸不得挤掉邻居：月历 + 时间并排时月历让位（保持 8×2，时间放剩余 2 列）
  const mBoth = autoLayout([
    { c: 'calendar', s: 'month', span: { cols: 8, rows: 2 } },
    { c: 'time', s: 'hms', span: { cols: 2, rows: 1 } },
  ], 'combo', '1xfull', wide);
  ok(mBoth.length === 2, `月历+时间并排应都放下（实际 ${mBoth.length} 块）`);
  ok(mBoth.length === 2 && mBoth[0].span.cols === 8, `并排时月历应保持 8×2 不拉伸（实际 ${JSON.stringify(mBoth[0] && mBoth[0].span)}）`);
  ok(mBoth.length === 2 && mBoth[1].pos.col === 8, `时间应落在第 8 列（实际 col=${mBoth[1] && mBoth[1].pos.col}）`);
  // 无显式 span 的月历同样不得挤掉邻居（回退首选 8×2）
  const mBoth2 = autoLayout([
    { c: 'calendar', s: 'month' },
    { c: 'time', s: 'hms', span: { cols: 2, rows: 1 } },
  ], 'combo', '1xfull', wide);
  ok(mBoth2.length === 2 && mBoth2[0].span.cols === 8 && mBoth2[1].pos.col === 8,
    `无 span 月历+时间并排应回退 8×2（实际 ${JSON.stringify(mBoth2.map((x) => x.span))}）`);
  // 非 1×FULL 尺寸不受影响（2×4 网格 8 列，月历单行选项在非 FULL 上不生效）
  const m24 = autoLayout([{ c: 'calendar', s: 'month', span: { cols: 8, rows: 2 } }], 'combo', '2x4');
  ok(m24.length === 1 && m24[0].span.cols === 8 && m24[0].span.rows === 2, '2x4 月历显式 span 应原样生效');
}

// ---------- 4) 旧数据兼容 ----------
for (const size of sizes) {
  const legacy = [{ c: 'time', s: 'hms' }, { c: 'calendar', s: 'month' }, { c: 'schedule', s: 'recent' }];
  const lay = layoutBlocks(legacy, 'combo', size, gridForSize(size));
  checkLayout(lay, gridForSize(size), `${size}/legacy`);
  // 小卡片只放得下更少单元；关键是坐标合法且不静默越界
  const minExpect = (size === '1x1' || size === '1x2' || size === '2x1' || size === '1xfull') ? 1 : 2;
  ok(lay.length >= minExpect, `${size}: 旧数据应至少放下 ${minExpect} 块（实际 ${lay.length}）`);
  // 坐标必须是整数
  for (const b of lay) {
    ok(Number.isInteger(b.pos.col) && Number.isInteger(b.pos.row), `${size}: 坐标应为整数`);
  }
}

// ---------- 5) single 模式透传 ----------
const single = layoutBlocks([{ c: 'timeDate', s: 'led' }], 'single', '2x2');
ok(single.length === 1 && !single[0].span, 'single 模式应原样返回 [{c,s}]');

// ---------- 6) sanitizeBlocks 输出无 span/pos ----------
const sb = sanitizeBlocks([{ c: 'time', s: 'hms' }, { c: 'time', s: 'hms' }, 'calendar'], 'combo', '2x2');
ok(sb.length === 2, `sanitizeBlocks 去重后应为 2 条（实际 ${sb.length}）`);
ok(sb.every((b) => !b.span && !b.pos), 'sanitizeBlocks 不应包含布局字段');

// ---------- 7) 网格工具函数 ----------
{
  const grid = { cols: 4, rows: 4 };
  const occ = Array.from({ length: 4 }, () => Array(4).fill(null));
  ok(canPlace(occ, grid, 0, 0, { cols: 2, rows: 2 }), '空网格 2×2 应可放');
  ok(!canPlace(occ, grid, 3, 3, { cols: 2, rows: 2 }), '右下角 2×2 应越界不可放');
  occ[0][0] = 'a'; occ[0][1] = 'a'; occ[1][0] = 'a'; occ[1][1] = 'a';
  ok(!canPlace(occ, grid, 1, 1, { cols: 2, rows: 2 }), '与已有块重叠应不可放');
  ok(canPlace(occ, grid, 1, 1, { cols: 2, rows: 2 }, 'a'), 'ignoreId 允许自身重叠');
  const slot = findSlot(occ, grid, { cols: 2, rows: 2 });
  ok(slot && slot.col === 2 && slot.row === 0, `首个空位应为 (2,0)，实际 ${JSON.stringify(slot)}`);
  const occ2 = buildOccupancy([{ id: 'x', pos: { col: 1, row: 1 }, span: { cols: 2, rows: 2 } }], grid);
  ok(occ2[1][1] === 'x' && occ2[2][2] === 'x' && occ2[0][0] === null, 'buildOccupancy 标记位置正确');
}

// ---------- 8) v1.29 单元级占格覆盖 / 扁平样式序列 ----------

// 8.1 normalizeSpan：只接受 1..8 的整数
for (const bad of [null, undefined, 0, '2', {}, { cols: 0, rows: 2 }, { cols: 9, rows: 1 }, { cols: 'x', rows: 1 }, { cols: NaN, rows: 1 }]) {
  ok(normalizeSpan(bad) === null, `normalizeSpan 应拒绝 ${JSON.stringify(bad)}`);
}
ok(JSON.stringify(normalizeSpan({ cols: 3, rows: 4 })) === '{"cols":3,"rows":4}', 'normalizeSpan 应接受合法整数占格');
ok(JSON.stringify(normalizeSpan({ cols: 2.4, rows: 3.6 })) === '{"cols":2,"rows":4}', 'normalizeSpan 应四舍五入取整');

// 8.2 sanitizeBlocks 往返：保留合法覆盖、丢弃非法覆盖
{
  const out = sanitizeBlocks([
    { c: 'time', s: 'hm', span: { cols: 3, rows: 2 } },
    { c: 'calendar', s: 'month', span: { cols: 0, rows: 2 } },
    { c: 'important', s: 'festival', span: { cols: 99, rows: 2 } },
  ], 'combo', '4x4');
  ok(out.length === 3, `sanitizeBlocks 应保留 3 条（实际 ${out.length}）`);
  ok(out[0].span && out[0].span.cols === 3 && out[0].span.rows === 2, '合法占格覆盖应被保留');
  ok(!out[1].span, '非法占格（0 列）应被丢弃');
  ok(!out[2].span, '越界占格（99 列）应被丢弃');
}

// 8.3 autoLayout 按覆盖值放置；覆盖超出网格时收窄而非丢弃
{
  const list = [{ c: 'time', s: 'hm', span: { cols: 3, rows: 2 } }, { c: 'time', s: 'minute' }];
  const laid = autoLayout(list, 'combo', '2x2');
  ok(laid.length === 2, `2x2（4×4）应放下两个单元（实际 ${laid.length}）`);
  ok(laid[0].span.cols === 3 && laid[0].span.rows === 2, '覆盖单元应按 3×2 放置');
  checkLayout(laid, gridForSize('2x2'), '覆盖占位 2x2');

  const big = autoLayout([{ c: 'time', s: 'hm', span: { cols: 8, rows: 8 } }], 'combo', '1x1');
  ok(big.length === 1, '超过网格的覆盖应收窄后放入，而不是被丢弃');
  ok(big[0].span.cols === 2 && big[0].span.rows === 2, `1x1（2×2）应收窄为 2×2，实际 ${big[0].span.cols}×${big[0].span.rows}`);
}

// 8.4 blocksFit 反映覆盖后的真实占用
{
  const grid = gridForSize('2x2');
  ok(blocksFit([{ c: 'time', s: 'hm', span: { cols: 4, rows: 4 } }], 'combo', '2x2'), '整卡占格应放得下');
  ok(!blocksFit([
    { c: 'time', s: 'hm', span: { cols: 4, rows: 4 } },
    { c: 'time', s: 'minute' },
  ], 'combo', '2x2'), '整卡被占满后不应再放得下第二个单元');
  // 覆盖后「降级为 minSpan」不再发生：calendar.week 声明 min 2×1，覆盖 2×2 时应严格 2×2
  const wk = autoLayout([{ c: 'calendar', s: 'week', span: { cols: 2, rows: 2 } }], 'combo', '1x2');
  ok(wk.length === 1 && wk[0].span.rows === 2, '有覆盖时不应自行降级为 minSpan');
  ok(grid.cols === 4 && grid.rows === 4, '2x2 网格应为 4×4');
}

// 8.5 blockSpanDef / effectiveSpan / spanBounds
{
  const b = { c: 'calendar', s: 'week', span: { cols: 4, rows: 3 } };
  ok(blockSpanDef('combo', b).span.cols === 4, 'blockSpanDef 应优先返回覆盖值');
  ok(effectiveSpan('combo', '2x2', b).rows === 3, 'effectiveSpan 未越界时应等于覆盖值');
  const clamped = effectiveSpan('combo', '1x1', b);
  ok(clamped.cols === 2 && clamped.rows === 2, `effectiveSpan 越界应按网格收窄，实际 ${clamped.cols}×${clamped.rows}`);
  const noOv = { c: 'calendar', s: 'week' };
  ok(JSON.stringify(effectiveSpan('combo', '2x2', noOv)) === '{"cols":2,"rows":2}', '无覆盖时 effectiveSpan = 样式声明');
  const bd = spanBounds('combo', '1x2', noOv);
  ok(bd.min.cols === 2 && bd.min.rows === 1, `calendar.week 最小占格应为 2×1，实际 ${bd.min.cols}×${bd.min.rows}`);
  ok(bd.max.cols === 4 && bd.max.rows === 2, 'spanBounds 上限应等于网格');
  const bd2 = spanBounds('combo', '2x2', noOv);
  ok(bd2.min.cols === 2 && bd2.min.rows === 1, 'minSpan 不随卡片尺寸变大而放大');
}

// v1.40 需求 2/3：面积下限（minArea）与降级链
{
  // 四样式（festival/solarTerm/holidayGap/recent）声明 minArea=2：每轴下限退为 1，但面积约束禁 1×1
  for (const s of ['festival', 'solarTerm', 'holidayGap', 'recent']) {
    const bd = spanBounds('combo', '2x2', { c: s === 'recent' ? 'schedule' : 'important', s });
    ok(bd.minArea === 2, `${s} 的 minArea 应为 2`);
    ok(bd.min.cols === 1 && bd.min.rows === 1, `${s} 面积下限模式下每轴下限退为 1`);
  }
  // schedule.multiple 仍可缩到 2×1（minSpan {cols:2,rows:1}），不属面积下限
  const mb = spanBounds('combo', '2x2', { c: 'schedule', s: 'multiple' });
  ok(mb.min.cols === 2 && mb.min.rows === 1, 'schedule.multiple 最小占格 2×1');
  ok(mb.minArea === 0, 'schedule.multiple 无面积下限');

  // 降级链：2×2 放不下时，面积样式按 {2,1}/{1,2} 降级（而非跳过）
  // 1x2 卡（网格 4×2）：先放一个占满首行的块，仅剩 4×1 横条 → festival 降级为 2×1
  const lay = autoLayout(
    [{ c: 'time', s: 'hm', span: { cols: 4, rows: 1 } }, { c: 'important', s: 'festival' }],
    'combo', '1x2',
  );
  ok(lay.length === 2, `1x2 卡片应放下两单元（含降级），实际 ${lay.length}`);
  const fz = lay.find((x) => x.c === 'important' && x.s === 'festival');
  ok(fz && fz.span.cols === 2 && fz.span.rows === 1, `festival 2×2 放不下应降级 2×1，实际 ${fz ? `${fz.span.cols}×${fz.span.rows}` : '未放下'}`);

  // 2x1 卡（网格 2×4）：先放占满前三行的块，仅剩 2×1 竖条 → multiple 降级为 2×1（minSpan）
  const layM = autoLayout(
    [{ c: 'time', s: 'hm', span: { cols: 2, rows: 3 } }, { c: 'schedule', s: 'multiple' }],
    'combo', '2x1',
  );
  ok(layM.length === 2, `2x1 卡片应放下两单元（含降级），实际 ${layM.length}`);
  const mu = layM.find((x) => x.c === 'schedule' && x.s === 'multiple');
  ok(mu && mu.span.cols === 2 && mu.span.rows === 1, `multiple 放不下应降级 2×1，实际 ${mu ? `${mu.span.cols}×${mu.span.rows}` : '未放下'}`);
}

// 8.6 扁平样式序列：左右按钮可跨显示内容连续切换
{
  const seq = flatStyleSeq('combo');
  const total = COMBO_CONTENTS.reduce((n, c) => n + c.styles.length, 0);
  ok(seq.length === total, `扁平序列长度应=${total}，实际 ${seq.length}`);
  let cur = { c: seq[0].c, s: seq[0].s };
  for (let i = 1; i < seq.length; i++) {
    cur = shiftFlatStyle('combo', cur.c, cur.s, 1);
    ok(cur.c === seq[i].c && cur.s === seq[i].s, `正向第 ${i} 步应到达 ${seq[i].c}:${seq[i].s}`);
  }
  cur = shiftFlatStyle('combo', cur.c, cur.s, 1);
  ok(cur.c === seq[0].c && cur.s === seq[0].s, '正向越界应循环回第一个样式');

  // 内容边界：最后一个内容（schedule）后应回到第一个内容（calendar）
  const last = seq[seq.length - 1];
  const wrapAfter = shiftFlatStyle('combo', last.c, last.s, 1);
  ok(wrapAfter.c === COMBO_CONTENTS[0].key, `跨界后应切到首个显示内容，实际 ${wrapAfter.c}`);
  // 反向同理
  const wrapBefore = shiftFlatStyle('combo', seq[0].c, seq[0].s, -1);
  const lastContent = COMBO_CONTENTS[COMBO_CONTENTS.length - 1];
  ok(wrapBefore.c === lastContent.key, `反向跨界应切到末个显示内容，实际 ${wrapBefore.c}`);
  // 未知组合不应崩溃
  const unknown = shiftFlatStyle('combo', 'nope', 'nope', 1);
  ok(unknown.c === seq[0].c, '未知样式应回退到序列首项');
  // 单独模式序列
  ok(flatStyleSeq('single').length === displayContents('single').reduce((n, c) => n + c.styles.length, 0), '单独模式扁平序列长度正确');
}

// ---------- 9) v1.30 空卡片 / 空白单元 ----------

// 9.1 拼接模式允许 0 个单元（卡片可以不显示内容）；单独模式仍保证 1 个
{
  ok(sanitizeBlocks([], 'combo', '2x2').length === 0, '拼接模式应允许空卡片（显式 [] 不套默认）');
  // v1.43：从未设置过（null）→ 套用该尺寸的推荐默认样式
  ok(sanitizeBlocks(null, 'combo', '2x2').length === 4, `拼接模式 null 应套用 2×2 默认（4 块，实际 ${sanitizeBlocks(null, 'combo', '2x2').length}）`);
  ok(sanitizeBlocks([], 'single', '2x2').length === 1, '单独模式应始终保留 1 个单元');
  ok(layoutBlocks(sanitizeBlocks([], 'combo', '2x2'), 'combo', '2x2').length === 0, '空卡片布局应为空');
}

// 9.1b v1.43：7 种尺寸的推荐默认样式——块数、每块可放下、无重叠
{
  const expect = {
    '1x1': 1, '1x2': 2, '2x1': 4, '2x2': 4, '2x4': 3, '4x4': 5, '1xfull': 1,
  };
  for (const [size, n] of Object.entries(expect)) {
    const list = sanitizeBlocks(null, 'combo', size);
    ok(list.length === n, `${size} 默认块数应为 ${n}（实际 ${list.length}）`);
    const laid = layoutBlocks(list, 'combo', size, gridForSize(size));
    ok(laid.length === n, `${size} 默认块应全部放得下（${laid.length}/${n}）`);
    // 无重叠：面积之和 = 占用格数
    const area = laid.reduce((s, b) => s + b.span.cols * b.span.rows, 0);
    const occupied = new Set();
    let overlap = false;
    for (const b of laid) {
      for (let r = b.pos.row; r < b.pos.row + b.span.rows; r++) {
        for (let c = b.pos.col; c < b.pos.col + b.span.cols; c++) {
          const k = `${c},${r}`;
          if (occupied.has(k)) overlap = true;
          occupied.add(k);
        }
      }
    }
    ok(!overlap && occupied.size === area, `${size} 默认布局不应重叠（占用 ${occupied.size} vs 面积 ${area}）`);
  }
  // 1×1 用「日」样式；1×FULL 用月历 2×8
  const d1 = sanitizeBlocks(null, 'combo', '1x1');
  ok(d1[0].c === 'time' && d1[0].s === 'day', '1×1 默认应为「日」样式');
  const df = sanitizeBlocks(null, 'combo', '1xfull');
  ok(df[0].c === 'calendar' && df[0].s === 'month' && df[0].span.cols === 8 && df[0].span.rows === 2,
    '1×FULL 默认应为 2×8 月历');
  // 默认返回深拷贝：修改返回值不影响常量
  const a = sanitizeBlocks(null, 'combo', '2x2');
  a[0].span.cols = 1;
  ok(sanitizeBlocks(null, 'combo', '2x2')[0].span.cols === 2, '默认块应为深拷贝（修改不污染常量）');
}

// 9.2 空白单元：可重复、序号自动补齐、唯一标识不同
{
  const out = sanitizeBlocks([
    { c: 'blank', s: 'space' },
    { c: 'blank', s: 'space' },
    { c: 'blank', s: 'space', n: 7 },
  ], 'combo', '2x2');
  ok(out.length === 3, `空白单元应全部保留（实际 ${out.length}）`);
  ok(out[0].n === 1 && out[1].n === 2 && out[2].n === 7, `空白序号应为 1/2/7，实际 ${out.map((b) => b.n).join(',')}`);
  ok(new Set(out.map(unitId)).size === 3, '空白单元的唯一标识应互不相同');
  const ids = new Set(out.map(unitId));
  ok(ids.has('blank:space:1') && ids.has('blank:space:7'), 'unitId 应带上空白序号');
  // 与其他内容混合时普通单元仍去重
  const mixed = sanitizeBlocks([
    { c: 'time', s: 'hms' }, { c: 'time', s: 'hms' }, { c: 'blank', s: 'space' },
  ], 'combo', '2x2');
  ok(mixed.length === 2, '普通单元仍应去重，空白不去重');
  // 空白单元按 1×1 落位，且能参与布局
  const laid = autoLayout([{ c: 'blank', s: 'space', n: 1 }, { c: 'blank', s: 'space', n: 2 }], 'combo', '2x2');
  ok(laid.length === 2, '两个空白单元都应落位');
  checkLayout(laid, gridForSize('2x2'), '空白单元 2x2');
  ok(laid[0].n === 1 && laid[1].n === 2, '布局结果应保留空白序号（渲染要用）');
}

// ---------- 10) v1.30 置中（单元级 / 卡片级） ----------

// 10.1 默认：1×FULL 卡片默认全置中，其他尺寸默认不置中
{
  const full = { c: 'time', s: 'hm' };
  const a1 = unitAlign('combo', '1xfull', full);
  ok(a1.h && a1.v, '1×FULL 卡片单元应默认水平+垂直置中');
  const a2 = unitAlign('combo', '2x2', full);
  ok(!a2.h && !a2.v, '非 FULL 卡片单元默认不置中');
  const a3 = unitAlign('combo', '2x2', { c: 'time', s: 'hm', align: { h: true, v: false } });
  ok(a3.h && !a3.v, '显式设置应覆盖默认值');
}

// 10.2 单个单元置中：在网格内居中
{
  const grid = gridForSize('2x2'); // 4×4
  const laid = layoutBlocks([{ c: 'time', s: 'hm', align: { h: true, v: true } }], 'combo', '2x2', grid);
  ok(laid.length === 1, '单元应落位');
  ok(laid[0].pos.col === 1 && laid[0].pos.row === 1,
    `1×1 单元在 4×4 网格中应居中到 (1,1)，实际 (${laid[0].pos.col},${laid[0].pos.row})`);
  // 未置中时保持左上角
  const plain = layoutBlocks([{ c: 'time', s: 'hm' }], 'combo', '2x2', grid);
  ok(plain[0].pos.col === 0 && plain[0].pos.row === 0, '未置中时应留在 (0,0)');
}

// 10.3 同行内容任一阵中 → 整行居中（v1.31 D4：some 取代 every）
{
  const grid = gridForSize('1xfull'); // 8×2
  const both = layoutBlocks([
    { c: 'time', s: 'hm', align: { h: true, v: false } },
    { c: 'time', s: 'minute', align: { h: true, v: false } },
  ], 'combo', '1xfull', grid);
  ok(both.length === 2, '两个单元都应落位');
  // 原始位置 (0,0)/(1,0)，整组宽 2 列 → 居中后 dx=(8-2)/2=3
  ok(both[0].pos.col === 3 && both[1].pos.col === 4,
    `同行两单元应整体水平居中到 3/4，实际 ${both[0].pos.col}/${both[1].pos.col}`);
  ok(both[0].pos.row === 0 && both[1].pos.row === 0, '垂直未置中时应保持行号');

  // 组内只有一个单元要求居中 → 整组（行带）居中（修复 R6「点了没反应」）
  const half = layoutBlocks([
    { c: 'time', s: 'hm', align: { h: true, v: false } },
    { c: 'time', s: 'minute', align: { h: false, v: false } },
  ], 'combo', '1xfull', grid);
  ok(half[0].pos.col === 3 && half[1].pos.col === 4,
    `同行任一单元要求居中时整行应居中到 3/4，实际 ${half[0].pos.col}/${half[1].pos.col}`);

  // 组内全部未要求居中 → 不偏移
  const none = layoutBlocks([
    { c: 'time', s: 'hm', align: { h: false, v: false } },
    { c: 'time', s: 'minute', align: { h: false, v: false } },
  ], 'combo', '1xfull', grid);
  ok(none[0].pos.col === 0 && none[1].pos.col === 1,
    `同行全部未要求居中时不应偏移，实际 ${none[0].pos.col}/${none[1].pos.col}`);
}

// 10.4 垂直置中（同列组：两条横贯整宽的单元必然同列）
{
  const grid = gridForSize('2x1'); // 2×4
  const laid = layoutBlocks([
    { c: 'time', s: 'hms', align: { h: false, v: true } },
    { c: 'time', s: 'hms', align: { h: false, v: true } },
  ], 'combo', '2x1', grid);
  ok(laid.length === 2, '两单元都应落位');
  // 两单元同列（col 0），纵向占 2 行 → dy=(4-2)/2=1
  ok(laid[0].pos.row === 1 && laid[1].pos.row === 2,
    `同列两单元应整体垂直居中到 1/2，实际 ${laid[0].pos.row}/${laid[1].pos.row}`);
}

// 10.5 卡片级置中：整体内容块在卡片内居中
{
  const grid = gridForSize('2x2'); // 4×4
  const laid = layoutBlocks([{ c: 'time', s: 'hm' }], 'combo', '2x2', grid, { h: true, v: true });
  ok(laid[0].pos.col === 1 && laid[0].pos.row === 1,
    `卡片级置中后应到 (1,1)，实际 (${laid[0].pos.col},${laid[0].pos.row})`);
  const none = layoutBlocks([{ c: 'time', s: 'hm' }], 'combo', '2x2', grid, { h: false, v: false });
  ok(none[0].pos.col === 0 && none[0].pos.row === 0, '未开卡片级置中时不应偏移');
  // 填满时不产生偏移
  const full = layoutBlocks([{ c: 'time', s: 'hm', span: { cols: 4, rows: 4 } }], 'combo', '2x2', grid, { h: true, v: true });
  ok(full[0].pos.col === 0 && full[0].pos.row === 0, '内容填满时卡片级置中不产生偏移');
}

// 10.6 置中后的布局仍合法（不重叠、不越界）
{
  for (const size of Object.keys(CARD_GRID)) {
    const grid = gridForSize(size);
    const list = [
      { c: 'time', s: 'hm', align: { h: true, v: true } },
      { c: 'time', s: 'minute', align: { h: true, v: true } },
      { c: 'blank', s: 'space', n: 1, align: { h: true, v: true } },
    ];
    const laid = layoutBlocks(list, 'combo', size, grid, { h: true, v: true });
    if (!laid.length) continue;
    checkLayout(laid, grid, `置中布局 ${size}`);
  }
}

// ---------- 11) v1.30 月日历单行显示 ----------
{
  ok(unitOpts('combo', '1xfull', { c: 'calendar', s: 'month' }).singleLine, '1×FULL 卡片的月日历默认单行显示');
  ok(!unitOpts('combo', '4x4', { c: 'calendar', s: 'month' }).singleLine, '其他尺寸的月日历默认不单行');
  ok(!unitOpts('combo', '1xfull', { c: 'calendar', s: 'week' }).singleLine, '周日历不受单行选项影响');
  ok(unitOpts('combo', '4x4', { c: 'calendar', s: 'month', opts: { singleLine: true } }).singleLine,
    '显式开启单行应生效');
  ok(!unitOpts('combo', '1xfull', { c: 'calendar', s: 'month', opts: { singleLine: false } }).singleLine,
    '显式关闭单行应生效');
  ok(isFullCard('1xfull') && !isFullCard('2x2'), 'isFullCard 仅识别 1×FULL');

  // 布局输出必须带上生效的 opts，渲染层才能按单行模式渲染
  const laidFull = layoutBlocks([{ c: 'calendar', s: 'month' }], 'combo', '1xfull', gridForSize('1xfull'));
  ok(laidFull.length === 1 && laidFull[0].opts && laidFull[0].opts.singleLine,
    '1×FULL 卡片的月日历布局结果应带上 singleLine（渲染要用）');
  const laid4 = layoutBlocks([{ c: 'calendar', s: 'month' }], 'combo', '4x4', gridForSize('4x4'));
  ok(!(laid4[0] && laid4[0].opts), '非 FULL 卡片的月日历不应带 singleLine');
  const laidOff = layoutBlocks([{ c: 'calendar', s: 'month', opts: { singleLine: false } }], 'combo', '1xfull', gridForSize('1xfull'));
  ok(!!(laidOff[0] && laidOff[0].opts) && laidOff[0].opts.singleLine === false,
    '显式关闭单行时布局结果应带 singleLine=false');
}

// ---------- 12) 批量删除日程 ----------
{
  const store = new UserStore({});
  store.data.schedules = [
    { id: 'a', title: 'A' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' },
  ];
  const n = await store.removeMany(['a', 'c']);
  ok(n === 2, `removeMany 应删除 2 条（实际 ${n}）`);
  ok(store.data.schedules.length === 1 && store.data.schedules[0].id === 'b', 'removeMany 后仅剩未选中的 b');
  const n2 = await store.removeMany([]);
  ok(n2 === 0, '空 id 列表不应删除任何数据');
  const n3 = await store.removeMany(['x']);
  ok(n3 === 0 && store.data.schedules.length === 1, '不存在的 id 不应影响数据');
}

// ---------- 13) v1.31 需求 1：两级置中（卡片级 > 单元级，逐轴接管） ----------
{
  const sig = (l) => layoutSignature(l);
  const monthUnit = { c: 'calendar', s: 'month', align: { h: true, v: true } };
  const g = gridForSize('4x4'); // 8×8

  // 13.1 治理者判定：两轴独立
  ok(alignGovernor(null).h === 'unit' && alignGovernor(null).v === 'unit',
    '未开启卡片级置中 → 两轴均由单元级治理');
  ok(alignGovernor({ h: true, v: false }).h === 'card' && alignGovernor({ h: true, v: false }).v === 'unit',
    '卡片级水平置中开启 → 仅水平轴被接管');
  ok(alignGovernor({ h: false, v: true }).h === 'unit' && alignGovernor({ h: false, v: true }).v === 'card',
    '卡片级垂直置中开启 → 仅垂直轴被接管');

  // 13.2 卡片级接管后：单元级在该轴不再叠加偏移（杜绝 R1 翻倍贴右）
  const unitOnly = layoutBlocks([monthUnit], 'combo', '4x4', g, { h: false, v: false });
  const cardH = layoutBlocks([monthUnit], 'combo', '4x4', g, { h: true, v: false });
  const cardHV = layoutBlocks([monthUnit], 'combo', '4x4', g, { h: true, v: true });
  ok(unitOnly.length === 1 && cardH.length === 1 && cardHV.length === 1, '三种模式都应放下该单元');
  ok(cardH[0].pos.col === unitOnly[0].pos.col,
    `卡片级接管水平轴后总水平偏移应与纯单元级一致（${cardH[0].pos.col} vs ${unitOnly[0].pos.col}），不得翻倍`);
  ok(cardHV[0].pos.row === unitOnly[0].pos.row,
    `卡片级接管垂直轴后总垂直偏移应与纯单元级一致（${cardHV[0].pos.row} vs ${unitOnly[0].pos.row}），不得翻倍`);
  ok(cardH[0].pos.row === unitOnly[0].pos.row,
    '卡片级只开水平时，垂直轴仍由单元级治理（偏移一致）');

  // 13.3 卡片级 H 开启时，单元级 align.h 的取值不影响渲染结果
  const on = layoutBlocks([{ c: 'calendar', s: 'month', align: { h: true, v: false } }], 'combo', '4x4', g, { h: true, v: false });
  const off = layoutBlocks([{ c: 'calendar', s: 'month', align: { h: false, v: false } }], 'combo', '4x4', g, { h: true, v: false });
  ok(sig(on) === sig(off), '卡片级接管水平轴后，单元级水平置中开关不影响渲染结果');

  // 13.4 关闭卡片级后，单元级设置原样生效（数据未被改写 → 用 unitAlignExplicit 验证）
  const explicit = { c: 'calendar', s: 'month', align: { h: true, v: true } };
  ok(unitAlignExplicit(explicit) && unitAlignExplicit(explicit).h === true, '显式 align 应被识别');
  ok(unitAlignExplicit({ c: 'calendar', s: 'month' }) === null, '未显式设置 align 时应返回 null（UI 显示「默认」角标）');
  const backOn = layoutBlocks([explicit], 'combo', '4x4', g, { h: false, v: false });
  ok(backOn[0].pos.col > 0, '关闭卡片级后单元级水平置中原样生效');

  // 13.4b 单元级置中仍产生可见偏移（不是「点了没反应」）
  const noAlign = layoutBlocks([{ c: 'calendar', s: 'month', align: { h: false, v: false } }], 'combo', '4x4', g, { h: false, v: false });
  const withAlign = layoutBlocks([{ c: 'calendar', s: 'month', align: { h: true, v: true } }], 'combo', '4x4', g, { h: false, v: false });
  ok(withAlign[0].pos.col > noAlign[0].pos.col, '单元级水平置中应产生水平偏移');
  ok(withAlign[0].pos.row > noAlign[0].pos.row, '单元级垂直置中应产生垂直偏移');

  // 13.5 clamp：居中偏移永不把单元推出网格
  const wideUnit = [{ c: 'calendar', s: 'month', span: { cols: 7, rows: 7 }, align: { h: true, v: true } }];
  for (const s of Object.keys(CARD_GRID)) {
    const gg = gridForSize(s);
    for (const cc of [{ h: true, v: true }, { h: true, v: false }, { h: false, v: true }]) {
      const laid = layoutBlocks(wideUnit, 'combo', s, gg, cc);
      for (const bb of laid) {
        ok(bb.pos.col >= 0 && bb.pos.col + bb.span.cols <= gg.cols,
          `${s}/h=${cc.h}: 居中后横向不得越界 (col=${bb.pos.col},span=${bb.span.cols},grid=${gg.cols})`);
        ok(bb.pos.row >= 0 && bb.pos.row + bb.span.rows <= gg.rows,
          `${s}/v=${cc.v}: 居中后纵向不得越界 (row=${bb.pos.row},span=${bb.span.rows},grid=${gg.rows})`);
      }
    }
  }

  // 13.6 layoutSignature：相同输入 → 相同指纹；不同置中 → 不同指纹
  const s1 = layoutBlocks([monthUnit], 'combo', '4x4', g, { h: false, v: false });
  const s2 = layoutBlocks([monthUnit], 'combo', '4x4', g, { h: false, v: false });
  ok(sig(s1) === sig(s2), '相同输入应产生相同布局指纹');
  ok(sig(s1).length > 0, '布局指纹不应为空');
  ok(sig(withAlign) !== sig(noAlign), '置中开关变化应改变布局指纹');
}
// ---------- 14) v1.31 需求 2 + D13：单行显示仅 1×FULL / 显式关闭时占格回退 ----------
{
  const month = { c: 'calendar', s: 'month' };
  // singleLineOn 门控：仅 1×FULL 生效，非 1×FULL 即使显式 true 也不生效
  ok(singleLineOn('combo', '1xfull', month), '1×FULL 月历单行生效');
  ok(!singleLineOn('combo', '4x4', { ...month, opts: { singleLine: true } }),
    '非 1×FULL 即使显式开启也不生效（按钮不渲染）');
  ok(!singleLineOn('combo', '1xfull', { ...month, opts: { singleLine: false } }),
    '显式关闭单行不生效');
  ok(!singleLineOn('combo', '2x2', { c: 'calendar', s: 'week' }), '周历不受单行选项影响');

  // D13 双重守卫：① 仅显式 false 才回退 ② 有显式 span 时绝不改写
  const dflt = prefSpan('combo', '1xfull', { c: 'calendar', s: 'month' });
  const on = prefSpan('combo', '1xfull', { c: 'calendar', s: 'month', opts: { singleLine: true } });
  const off = prefSpan('combo', '1xfull', { c: 'calendar', s: 'month', opts: { singleLine: false } });
  const withSpan = prefSpan('combo', '1xfull', {
    c: 'calendar', s: 'month', opts: { singleLine: false }, span: { cols: 4, rows: 2 },
  });
  ok(dflt.span.cols === 8 && dflt.span.rows === 2,
    `默认（未设置）应占满整行 8×2，实际 ${dflt.span.cols}×${dflt.span.rows}`);
  ok(on.span.cols === 8 && on.span.rows === 2,
    `singleLine=true 应占满整行 8×2，实际 ${on.span.cols}×${on.span.rows}`);
  ok(off.span.cols === 2 && off.span.rows === 2,
    `显式关闭单行应回退 2×2，实际 ${off.span.cols}×${off.span.rows}`);
  const decl = styleSpanDef('combo', 'calendar', 'month').span;
  ok(withSpan.span.cols === decl.cols && withSpan.span.rows === decl.rows,
    '有显式 span 时不应自动改写（守卫 ②）');
  // 非 1×FULL / 非月历不受回退影响
  const other = prefSpan('combo', '4x4', { c: 'calendar', s: 'month', opts: { singleLine: false } });
  ok(other.span.cols === decl.cols && other.span.rows === decl.rows, '非 1×FULL 卡片不触发回退');
}

// ---------- 15) v1.32 需求 1：孤立的 1×1 单元独立置中 ----------
{
  const G = { cols: 4, rows: 4 };
  // A：1×1 且所在行/列都没有其他单元（B 在右下角，不同行不同列）
  const solo = [
    { c: 'time', s: 'hms', span: { cols: 1, rows: 1 }, pos: { col: 0, row: 0 }, align: { h: true, v: true } },
    { c: 'time', s: 'dateFull', span: { cols: 2, rows: 2 }, pos: { col: 2, row: 2 } },
  ];
  const idx = soloUnitIndexes(solo);
  ok(idx.has(0), '1×1 且行列无同伴 → 判定为孤立单元');
  ok(!idx.has(1), '2×2 单元不算孤立单元');
  const r1 = applyAlignmentWithReport(solo, 'combo', '2x2', G, {}).layout;
  ok(r1[0].pos.col === 1 && r1[0].pos.row === 1,
    `孤立 1×1 单元应独立居中到 (1,1)（实际 ${JSON.stringify(r1[0].pos)}）`);
  ok(r1[1].pos.col === 2 && r1[1].pos.row === 2, '其他单元不应被孤立单元带动');

  // 未标记置中 → 不动
  const noAlign = [
    { c: 'time', s: 'hms', span: { cols: 1, rows: 1 }, pos: { col: 0, row: 0 } },
    { c: 'time', s: 'dateFull', span: { cols: 2, rows: 2 }, pos: { col: 2, row: 2 } },
  ];
  const r2 = applyAlignmentWithReport(noAlign, 'combo', '2x2', G, {}).layout;
  ok(r2[0].pos.col === 0 && r2[0].pos.row === 0, '未标记置中的孤立单元保持原位');

  // 同列有他人 → 不是孤立（共享列即失去独立性）
  const shared = [
    { c: 'time', s: 'hms', span: { cols: 1, rows: 1 }, pos: { col: 0, row: 0 }, align: { h: true, v: true } },
    { c: 'time', s: 'dateFull', span: { cols: 1, rows: 1 }, pos: { col: 0, row: 2 } },
  ];
  ok(!soloUnitIndexes(shared).has(0), '同列有其他单元 → 不算孤立');
  // 同行有他人 → 不是孤立
  const sharedRow = [
    { c: 'time', s: 'hms', span: { cols: 1, rows: 1 }, pos: { col: 0, row: 0 } },
    { c: 'time', s: 'dateFull', span: { cols: 1, rows: 1 }, pos: { col: 2, row: 0 } },
  ];
  ok(!soloUnitIndexes(sharedRow).has(0), '同行有其他单元 → 不算孤立');
}

// ---------- 汇总 ----------
console.log(`\n容量表: ${Object.entries(cap).map(([k, v]) => `${k}=${v}`).join('  ')}`);
console.log(`总单元数: ${allUnits.length}`);
if (fails.length) {
  console.log(`\n✗ 失败 ${fails.length} 项 / 通过 ${pass} 项\n`);
  for (const f of fails.slice(0, 40)) console.log('  - ' + f);
  process.exit(1);
}
console.log(`\n✓ 全部通过（${pass} 项断言）`);
