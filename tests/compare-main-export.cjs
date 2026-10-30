// main ↔ 현재 브랜치 저장 결과 비교.
// 실행: main을 MARKING_MAIN_URL(기본 8766), 현재 브랜치를 MARKING_BRANCH_URL(기본 8765)에서 띄운 뒤
//       `node tests/compare-main-export.cjs` (MARKING_BROWSER=webkit 가능)
//
// A. 기존 회귀 테스트의 1280px 조건(1280×700)과 같은 방식(미리보기 35%→65% 마우스 드래그)으로 원을 그리고,
//    앱이 실제로 받은 포인터 좌표를 원본 이미지 좌표로 환산해 두 버전을 비교한다.
//    원본 좌표 차이 여부와 저장 파일 차이 여부가 일치하는지 확인한다.
// B. 각 버전의 창을 하단 예약 높이만큼 더 길게 열어 두 버전의 작업 영역·미리보기 위치·배율을
//    똑같이 맞춘다(둘 다 폭 기준 맞춤이라 선 굵기·가림 강도 기준 배율도 같다). 그러면 같은 정수
//    마우스 좌표가 같은 원본 좌표가 되므로(WebKit 정수 좌표 제약과 무관), 원·화살표·사각형
//    모자이크·사각형 블러를 같은 원본 좌표에 넣고 저장 파일을 비교할 수 있다.
//    B가 일치하면 이 PR이 렌더링·저장 결과를 바꾸지 않았다는 뜻이다.
const { chromium, webkit } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const engine = process.env.MARKING_BROWSER || 'chromium';
if (!['chromium', 'webkit'].includes(engine)) throw new Error('Unsupported browser engine: ' + engine);
const browserType = engine === 'webkit' ? webkit : chromium;
const MAIN = process.env.MARKING_MAIN_URL || 'http://127.0.0.1:8766';
const BRANCH = process.env.MARKING_BRANCH_URL || 'http://127.0.0.1:8765';
const outDir = path.join(process.cwd(), 'test-results');
fs.mkdirSync(outDir, { recursive: true });
const report = { engine, A: {}, B: {} };
let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::${ok ? 'notice' : 'error'} title=main↔branch ${engine}::${name} — ${detail}`);
  if (!ok) failures++;
}
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const fmt = n => ({ x: +n.x.toFixed(3), y: +n.y.toFixed(3) });

async function makePhoto(page) {
  return page.evaluate(async () => {
    const w = 1600, h = 1067, c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), img = g.createImageData(w, h);
    let s = 7654321; const rnd = () => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296;
    for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) {
      const r = rnd() * 255, gg = rnd() * 255, b = rnd() * 255;
      for (let dy = 0; dy < 4 && y + dy < h; dy++) for (let dx = 0; dx < 4 && x + dx < w; dx++) {
        const o = ((y + dy) * w + x + dx) * 4; img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
}

async function open(browser, base, photo, height = 700) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height }, deviceScaleFactor: 1, acceptDownloads: true });
  const page = await ctx.newPage();
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.setInputFiles('#fileInput', { name: 'cmp.png', mimeType: 'image/png', buffer: Buffer.from(photo) });
  await page.waitForSelector('#view-canvas.ready');
  await page.waitForTimeout(400);
  // 앱이 받은 포인터 좌표 기록(편집 동작에는 관여하지 않음).
  await page.evaluate(() => {
    window.__pts = [];
    const cv = document.getElementById('view-canvas');
    const rec = e => window.__pts.push({ type: e.type, x: e.clientX, y: e.clientY });
    cv.addEventListener('pointerdown', rec, true);
    cv.addEventListener('pointermove', rec, true);
  });
  const geo = await page.evaluate(() => {
    const wa = document.getElementById('workarea'), cv = document.getElementById('view-canvas');
    const r = cv.getBoundingClientRect();
    const reserve = parseFloat(document.documentElement.style.getPropertyValue('--editor-bottom')) || 0;
    return { left: r.left, top: r.top, width: r.width, height: r.height, waW: wa.clientWidth, waH: wa.clientHeight, reserve };
  });
  // fitCanvas()와 같은 식: scale = min(1, (W-24)/nw, (H-24)/nh). 화면→원본 좌표는 (client-left)/scale.
  geo.scale = Math.min(1, (geo.waW - 24) / 1600, (geo.waH - 24) / 1067);
  return { ctx, page, geo };
}
const toNat = (geo, p) => ({ x: (p.x - geo.left) / geo.scale, y: (p.y - geo.top) / geo.scale });
async function exportSha(page, label) {
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.locator('#btn-save').click()]);
  const t = path.join(outDir, `cmp-${engine}-${label}-${d.suggestedFilename()}`);
  await d.saveAs(t);
  return sha(fs.readFileSync(t));
}
async function dragMouse(page, a, b) {
  await page.evaluate(() => { window.__pts = []; });
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const pts = await page.evaluate(() => window.__pts);
  const down = pts.find(p => p.type === 'pointerdown'), last = [...pts].reverse().find(p => p.type === 'pointermove');
  return { down, last };
}
const maxDiff = (m, b) => Math.max(...[0, 1].flatMap(i => [Math.abs(m[i].x - b[i].x), Math.abs(m[i].y - b[i].y)]));

(async () => {
  const browser = await browserType.launch({ headless: true });
  try {
    const seed = await (await browser.newContext()).newPage();
    const photo = await makePhoto(seed);
    await seed.context().close();

    // ---------- A: 기존 1280px 회귀 조건 ----------
    const A = {};
    for (const [label, base] of [['main', MAIN], ['branch', BRANCH]]) {
      const { ctx, page, geo } = await open(browser, base, photo, 700);
      await page.locator('#btn-circle').click();
      const p0 = { x: geo.left + geo.width * 0.35, y: geo.top + geo.height * 0.35 };
      const p1 = { x: geo.left + geo.width * 0.65, y: geo.top + geo.height * 0.65 };
      const got = await dragMouse(page, p0, p1);
      A[label] = { preview: `${geo.width}x${geo.height}`, requested: [p0, p1], received: [got.down, got.last],
        nat: [toNat(geo, got.down), toNat(geo, got.last)], export: await exportSha(page, 'A-' + label) };
      await ctx.close();
    }
    report.A = A;
    const natDiff = maxDiff(A.main.nat, A.branch.nat);
    const integerCoords = [...A.main.received, ...A.branch.received].every(p => Number.isInteger(p.x) && Number.isInteger(p.y));
    const aSame = A.main.export === A.branch.export;
    console.log(`A ${engine}: 미리보기 main ${A.main.preview} / branch ${A.branch.preview}, 앱이 받은 좌표가 정수=${integerCoords}`);
    console.log(`A ${engine}: 요청 좌표 main ${JSON.stringify(A.main.requested.map(fmt))} / branch ${JSON.stringify(A.branch.requested.map(fmt))}`);
    console.log(`A ${engine}: 받은 좌표 main ${JSON.stringify(A.main.received)} / branch ${JSON.stringify(A.branch.received)}`);
    console.log(`A ${engine}: 원본 좌표 main ${JSON.stringify(A.main.nat.map(fmt))} / branch ${JSON.stringify(A.branch.nat.map(fmt))}, 최대 차이 ${natDiff.toFixed(3)}px, 저장 파일 같음=${aSame}`);
    check('A. 비율 드래그: 원본 좌표 차이 여부와 저장 파일 차이 여부가 일치한다',
      (natDiff < 0.01) === aSame, // 0.01px 미만은 브라우저 내부 float32 표현 오차
      JSON.stringify({ receivedIntegerCoords: integerCoords, maxNaturalDiffPx: +natDiff.toFixed(3), exportSame: aSame }));

    // ---------- B: 같은 원본 좌표 ----------
    // 작업 영역 높이를 900px로 맞춘다: 각 버전의 하단 예약 높이를 먼저 재고 그만큼 창을 늘린다
    // (예약이 없는 버전은 900, 있는 버전은 900+예약).
    const WORK_H = 900;
    const reserveOf = async base => { const p = await open(browser, base, photo, WORK_H); const r = p.geo.reserve; await p.ctx.close(); return r; };
    const reserveMain = await reserveOf(MAIN), reserveBranch = await reserveOf(BRANCH);
    const pm = await open(browser, MAIN, photo, WORK_H + reserveMain), pb = await open(browser, BRANCH, photo, WORK_H + reserveBranch);
    const same = ['left', 'top', 'width', 'height', 'scale', 'waW', 'waH'].every(k => Math.abs(pm.geo[k] - pb.geo[k]) < 1e-9);
    const reserve = { main: reserveMain, branch: reserveBranch };
    check('B 준비: 두 버전의 작업 영역·미리보기 위치·크기·배율이 같다', same,
      JSON.stringify({ reservePx: reserve, main: pm.geo, branch: pb.geo }));
    const ensureBlur = async p => {
      const blur = p.locator('#btn-blur');
      if (!((await blur.getAttribute('class')) || '').split(/\s+/).includes('active')) await blur.click();
    };
    const ops = [
      ['원', async p => { await p.locator('#btn-circle').click(); }, [0.20, 0.20, 0.42, 0.45]],
      ['화살표', async p => { await p.locator('#btn-arrow').click(); }, [0.55, 0.15, 0.85, 0.40]],
      ['사각형 모자이크', async p => {
        await ensureBlur(p);
        await p.locator('#options-bar button', { hasText: '모자이크' }).first().click();
        await p.locator('#options-bar button', { hasText: '사각형' }).first().click();
      }, [0.15, 0.58, 0.40, 0.85]],
      ['사각형 블러', async p => {
        await ensureBlur(p);
        await p.locator('#options-bar button', { hasText: '블러' }).first().click();
        await p.locator('#options-bar button', { hasText: '사각형' }).first().click();
      }, [0.58, 0.58, 0.88, 0.88]],
    ];
    const used = [];
    let worst = 0;
    for (const [name, prep, [fx0, fy0, fx1, fy1]] of ops) {
      const nats = {};
      for (const [label, side] of [['main', pm], ['branch', pb]]) {
        const g = side.geo;
        // 정수 화면 좌표(모든 엔진에서 그대로 전달됨). 두 버전의 geo가 같으므로 같은 원본 좌표가 된다.
        const a = { x: Math.round(g.left + g.width * fx0), y: Math.round(g.top + g.height * fy0) };
        const b = { x: Math.round(g.left + g.width * fx1), y: Math.round(g.top + g.height * fy1) };
        await prep(side.page);
        const got = await dragMouse(side.page, a, b);
        await side.page.keyboard.press('Escape');
        nats[label] = [toNat(g, got.down), toNat(g, got.last)];
      }
      const d = maxDiff(nats.main, nats.branch);
      worst = Math.max(worst, d);
      used.push({ name, natural: nats.main.map(fmt), maxDiffPx: +d.toFixed(4) });
    }
    const undoOk = !(await pm.page.locator('#btn-undo').isDisabled()) && !(await pb.page.locator('#btn-undo').isDisabled());
    const bm = await exportSha(pm.page, 'B-main'), bb = await exportSha(pb.page, 'B-branch');
    report.B = { reserve, ops: used, maxNaturalDiffPx: worst, main: bm, branch: bb };
    console.log(`B ${engine}: ${JSON.stringify(used)}`);
    check('B. 같은 원본 좌표로 원·화살표·사각형 모자이크·블러를 넣으면 저장 파일이 main과 바이트 단위로 같다',
      same && undoOk && worst === 0 && bm === bb,
      JSON.stringify({ maxNaturalDiffPx: worst, main: bm.slice(0, 16), branch: bb.slice(0, 16) }));
    await pm.ctx.close(); await pb.ctx.close();
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(outDir, `compare-main-${engine}.json`), JSON.stringify(report, null, 2));
  if (failures) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
