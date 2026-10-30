// PC 작업 영역·사진 이동·가장자리 가림 회귀 검사.
// 실행: 프로젝트 루트에서 `python3 -m http.server 8765` 후 `node tests/run-pc-edge-regression.cjs`
// (MARKING_BROWSER=webkit 으로 WebKit 실행. 모바일 터치 검사는 Chromium에서만 실행한다.)
const { chromium, webkit } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const engine = process.env.MARKING_BROWSER || 'chromium';
if (!['chromium', 'webkit'].includes(engine)) throw new Error('Unsupported browser engine: ' + engine);
const browserType = engine === 'webkit' ? webkit : chromium;
const BASE = process.env.MARKING_BASE_URL || 'http://127.0.0.1:8765';
const outDir = path.join(process.cwd(), 'test-results');
fs.mkdirSync(outDir, { recursive: true });

let failures = 0;
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok ? '' : ' — ' + detail}`);
  if (!ok) failures++;
}

// 결정적인 노이즈 사진(가림 전후 차이를 픽셀 분산으로 판별할 수 있게 한다).
async function makePhoto(page, w, h) {
  return page.evaluate(async ({ w, h }) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const img = g.createImageData(w, h);
    let s = 1234567;
    const rnd = () => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296;
    for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) {
      const r = rnd() * 255, gg = rnd() * 255, b = rnd() * 255;
      for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) {
        const o = ((y + dy) * w + (x + dx)) * 4;
        if (o >= img.data.length || x + dx >= w) continue;
        img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, { w, h });
}

async function openEditor(context, photo) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.setInputFiles('#fileInput', { name: 'edge.png', mimeType: 'image/png', buffer: Buffer.from(photo) });
  await page.waitForSelector('#view-canvas.ready');
  await page.waitForTimeout(400);
  return { page, errors };
}
const box = (page, sel) => page.locator(sel).boundingBox();
const transformOf = page => page.locator('#view-canvas').evaluate(el => el.style.transform);
async function frames(page) { await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); }
async function chooseMasking(page, mode, shape) {
  const blur = page.locator('#btn-blur');
  if (!((await blur.getAttribute('class')) || '').split(/\s+/).includes('active')) await blur.click();
  await page.locator('#options-bar button', { hasText: mode }).first().click();
  await page.locator('#options-bar button', { hasText: shape }).first().click();
}
async function drag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
  await frames(page);
}
async function spacePan(page, dx, dy) {
  const c = await box(page, '#view-canvas');
  const start = { x: c.x + c.width / 2, y: c.y + c.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.keyboard.down('Space');
  await page.mouse.down();
  await page.mouse.move(start.x + dx, start.y + dy, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.up('Space');
  await frames(page);
}
async function exportBytes(page, label) {
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), page.locator('#btn-save').click()]);
  const target = path.join(outDir, `pc-edge-${engine}-${label}-${download.suggestedFilename()}`);
  await download.saveAs(target);
  return fs.readFileSync(target);
}
// 저장 파일을 브라우저에서 디코드해 지정 영역의 픽셀 표준편차(가림 여부 판별)를 구한다.
async function patchStd(page, bytes, patches) {
  return page.evaluate(async ({ b64, patches }) => {
    const bin = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
    const bmp = await createImageBitmap(new Blob([bin]));
    const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
    const g = c.getContext('2d'); g.drawImage(bmp, 0, 0);
    return patches.map(([px, py, size]) => {
      const x = Math.round(px * (bmp.width - size)), y = Math.round(py * (bmp.height - size));
      const d = g.getImageData(x, y, size, size).data;
      let sum = 0, sum2 = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; sum += v; sum2 += v * v; n++; }
      return Math.sqrt(Math.max(0, sum2 / n - (sum / n) ** 2));
    });
  }, { b64: Buffer.from(bytes).toString('base64'), patches });
}

(async () => {
  const browser = await browserType.launch({ headless: true });
  try {
    const desktop = () => browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, acceptDownloads: true });
    const seed = await (await browser.newContext()).newPage();
    const landscape = await makePhoto(seed, 1600, 1067);
    const portrait = await makePhoto(seed, 1067, 1600);
    await seed.context().close();

    // 1. PC: 사진이 하단 도구바·보조 도구(설정창)에 가려지지 않고, 도구를 바꿔도 크기가 그대로다.
    for (const [label, photo] of [['가로', landscape], ['세로', portrait]]) {
      const ctx = await desktop();
      const { page, errors } = await openEditor(ctx, photo);
      const before = await box(page, '#view-canvas');
      await chooseMasking(page, '모자이크', '얼굴');
      await frames(page);
      const after = await box(page, '#view-canvas');
      const options = await box(page, '#options-bar');
      const toolbar = await box(page, '#toolbar');
      check(`PC ${label}: 사진 하단이 보조 도구 위에 있다`, after.y + after.height <= options.y + 0.5,
        JSON.stringify({ canvasBottom: after.y + after.height, optionsTop: options.y }));
      check(`PC ${label}: 사진 하단이 도구바 위에 있다`, after.y + after.height <= toolbar.y + 0.5);
      check(`PC ${label}: 보조 도구 표시 전후 사진 크기·위치 동일`,
        Math.abs(before.width - after.width) < 0.5 && Math.abs(before.height - after.height) < 0.5 && Math.abs(before.y - after.y) < 0.5,
        JSON.stringify({ before, after }));
      for (const tool of ['#btn-circle', '#btn-arrow', '#btn-blur']) { await page.locator(tool).click(); await frames(page); }
      const cycled = await box(page, '#view-canvas');
      check(`PC ${label}: 도구 전환 후에도 사진 크기 동일`, Math.abs(cycled.height - after.height) < 0.5 && Math.abs(cycled.y - after.y) < 0.5,
        JSON.stringify({ after, cycled }));
      check(`PC ${label}: 자바스크립트 오류 없음`, errors.length === 0, errors.join(' | '));
      await ctx.close();
    }

    // 2. 1배율 Space+드래그 이동 — 편집은 생기지 않고, 모서리를 작업 영역 중앙까지 옮길 수 있다.
    {
      const ctx = await desktop();
      const { page } = await openEditor(ctx, landscape);
      await chooseMasking(page, '모자이크', '얼굴');
      await spacePan(page, 2000, 2000);
      const t = await transformOf(page);
      const c = await box(page, '#view-canvas');
      const wa = await box(page, '#workarea');
      check('1배율 Space+드래그로 사진이 이동한다', /scale\(1\)/.test(t) && !/translate\(0px, 0px\)/.test(t), t);
      check('왼쪽 위 모서리를 작업 영역 중앙까지 옮길 수 있다',
        Math.abs(c.x - (wa.x + wa.width / 2)) <= 2 && Math.abs(c.y - (wa.y + wa.height / 2)) <= 2,
        JSON.stringify({ corner: [c.x, c.y], center: [wa.x + wa.width / 2, wa.y + wa.height / 2] }));
      check('Space+드래그는 편집 기록을 만들지 않는다', await page.locator('#btn-undo').isDisabled());
      await spacePan(page, -4000, -4000);
      const c2 = await box(page, '#view-canvas');
      check('오른쪽 아래 모서리도 작업 영역 중앙까지 옮길 수 있다',
        Math.abs(c2.x + c2.width - (wa.x + wa.width / 2)) <= 2 && Math.abs(c2.y + c2.height - (wa.y + wa.height / 2)) <= 2,
        JSON.stringify({ corner: [c2.x + c2.width, c2.y + c2.height] }));
      await ctx.close();
    }

    // 3. 확대 후 이동, 더블클릭으로 원위치.
    {
      const ctx = await desktop();
      const { page } = await openEditor(ctx, landscape);
      const home = await box(page, '#view-canvas');
      await page.mouse.move(home.x + home.width * 0.3, home.y + home.height * 0.3);
      await page.mouse.wheel(0, -600);
      await frames(page);
      const zoomed = await transformOf(page);
      await spacePan(page, 150, -90);
      const panned = await transformOf(page);
      check('확대 후 Space+드래그 이동', zoomed !== panned && !/scale\(1\)/.test(panned), JSON.stringify({ zoomed, panned }));
      const c = await box(page, '#view-canvas');
      await page.mouse.dblclick(c.x + c.width / 2, c.y + c.height / 2);
      await frames(page);
      const back = await box(page, '#view-canvas');
      check('더블클릭하면 원래 위치·배율로 돌아온다', (await transformOf(page)) === 'translate(0px, 0px) scale(1)'
        && Math.abs(back.x - home.x) < 0.5 && Math.abs(back.y - home.y) < 0.5, await transformOf(page));
      await ctx.close();
    }

    // 4. 네 모서리에 걸친 얼굴을 '얼굴(타원)' 모자이크로 모서리 끝까지 가릴 수 있다.
    {
      const ctx = await desktop();
      const { page } = await openEditor(ctx, landscape);
      await chooseMasking(page, '모자이크', '얼굴');
      const c = await box(page, '#view-canvas');
      const corners = [[0, 0, -1, -1, '왼쪽 위'], [1, 0, 1, -1, '오른쪽 위'], [0, 1, -1, 1, '왼쪽 아래'], [1, 1, 1, 1, '오른쪽 아래']];
      for (const [fx, fy, sx, sy] of corners) {
        const inner = { x: c.x + c.width * (fx ? 0.86 : 0.14), y: c.y + c.height * (fy ? 0.82 : 0.18) };
        const outer = { x: c.x + c.width * fx + sx * 45, y: c.y + c.height * fy + sy * 45 };
        await drag(page, inner, outer);
        await page.locator('#toast').filter({ hasText: '사진 가장자리까지 가림' }).waitFor({ timeout: 3000 }).catch(() => {});
        // 다음 모서리를 그리기 전에 선택 해제(빈 곳 클릭 대신 Escape).
        await page.keyboard.press('Escape');
      }
      const bytes = await exportBytes(page, 'corners');
      const std = await patchStd(page, bytes, [[0, 0, 24], [1, 0, 24], [0, 1, 24], [1, 1, 24], [0.5, 0.5, 24]]);
      corners.forEach(([, , , , name], i) => check(`${name} 모서리 끝 픽셀까지 모자이크가 적용된다`, std[i] < std[4] * 0.35,
        JSON.stringify({ cornerStd: +std[i].toFixed(1), untouchedStd: +std[4].toFixed(1) })));
      await ctx.close();
    }

    // 5·6. 사진을 옮긴 상태에서 같은 원본 좌표에 가림을 넣으면 저장 결과가 이동 전과 픽셀 단위로 같다.
    {
      const shaFor = async (pan) => {
        const ctx = await desktop();
        const { page } = await openEditor(ctx, landscape);
        await chooseMasking(page, '모자이크', '사각형');
        if (pan) await spacePan(page, pan[0], pan[1]);
        const c = await box(page, '#view-canvas');
        // 원본 좌표 기준 같은 영역(사진의 20%~45%)에 사각형 모자이크와 얼굴 모자이크를 넣는다.
        await drag(page, { x: c.x + c.width * 0.20, y: c.y + c.height * 0.25 }, { x: c.x + c.width * 0.45, y: c.y + c.height * 0.55 });
        await page.keyboard.press('Escape');
        const bytes = await exportBytes(page, pan ? 'panned' : 'still');
        const transform = await transformOf(page);
        await ctx.close();
        return { sha: crypto.createHash('sha256').update(bytes).digest('hex'), transform };
      };
      const still = await shaFor(null);
      const panned = await shaFor([137, -91]);
      check('이동 상태 확인(보기만 이동)', /translate\(137px, -91px\) scale\(1\)/.test(panned.transform), panned.transform);
      check('이동 전후 같은 편집의 저장 파일이 픽셀·바이트 단위로 일치', still.sha === panned.sha, JSON.stringify({ still: still.sha, panned: panned.sha }));
    }

    // 7. 모바일 터치: 가장자리 밖 허용과 Space 이동은 적용되지 않는다(기존 동작 유지). Chromium 전용.
    if (engine === 'chromium') {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
      const { page, errors } = await openEditor(ctx, landscape);
      await page.locator('#btn-blur').tap();
      await page.locator('#options-bar button', { hasText: '모자이크' }).first().tap();
      await page.locator('#options-bar button', { hasText: '얼굴' }).first().tap();
      const c = await box(page, '#view-canvas');
      const cdp = await ctx.newCDPSession(page);
      const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      await touch('touchStart', c.x + c.width * 0.2, c.y + c.height * 0.2);
      for (let i = 1; i <= 8; i++) await touch('touchMove', c.x + c.width * 0.2 - i * 15, c.y + c.height * 0.2 - i * 15);
      await touch('touchEnd');
      await page.waitForTimeout(600);
      const toast = await page.locator('#toast').textContent();
      check('모바일: 터치로 사진 밖까지 끌어도 가장자리 밖 가림으로 처리되지 않는다', !/가장자리까지/.test(toast || ''), toast);
      check('모바일: 터치 가림 생성은 기존처럼 동작한다', !(await page.locator('#btn-undo').isDisabled()));
      check('모바일: 보기 이동 없음(1배율 유지)', (await transformOf(page)) === 'translate(0px, 0px) scale(1)', await transformOf(page));
      check('모바일: 자바스크립트 오류 없음', errors.length === 0, errors.join(' | '));
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(outDir, `pc-edge-report-${engine}.json`), JSON.stringify(results, null, 2));
  console.log(failures ? `실패 ${failures}건` : '모두 통과');
  if (failures) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
