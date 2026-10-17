const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const outDir = path.join(process.cwd(), 'test-results');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  let failures = 0;
  try {
    for (const reference of ['index', 'test']) {
    for (const width of [320, 375, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));
      try {
        await page.goto('http://127.0.0.1:8765/tests/regression.html?reference=' + reference, { waitUntil: 'load', timeout: 30000 });
        await page.waitForFunction(() => document.querySelector('#report')?.textContent?.includes('완료:'), null, { timeout: 30000 });
        if (width !== 390) {
          const previousRun = Number(await page.locator('#report').getAttribute('data-run-completed') || 0);
          await page.locator('#viewport').selectOption(String(width));
          await page.waitForFunction(({ expected, previousRun }) => {
            const frame = document.querySelector('#app');
            const report = document.querySelector('#report');
            return frame && Number.parseInt(frame.style.width, 10) === expected
              && Number(report?.dataset.runCompleted || 0) > previousRun
              && report?.textContent?.includes('완료:');
          }, { expected: width, previousRun }, { timeout: 30000 });
        }
        // End-to-end edit/history/export checks in the same app iframe.
        const app = page.frameLocator('#app');
        const canvas = app.locator('#view-canvas');
        // Regression harness leaves the circle tool selected; clicking again would toggle it off.
        const circleButton = app.locator('#btn-circle');
        if (!(await circleButton.getAttribute('class') || '').split(/\s+/).includes('active')) await circleButton.click();
        const bounds = await canvas.boundingBox();
        if (!bounds || bounds.width < 60 || bounds.height < 60) throw new Error('Canvas has no usable bounds');
        const x1 = bounds.x + bounds.width * .35, y1 = bounds.y + bounds.height * .35;
        const x2 = bounds.x + bounds.width * .65, y2 = bounds.y + bounds.height * .65;
        await page.mouse.move(x1, y1);
        await page.mouse.down();
        await page.mouse.move(x2, y2, { steps: 8 });
        await page.mouse.up();
        // Allow the app's requestAnimationFrame redraw to finish before reading pixels.
        await canvas.evaluate(() => new Promise(resolve =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))));
        // Capture deterministic edited pixels for production/refactor comparison.
        const imageData = await canvas.evaluate(el => {
          const ctx = el.getContext('2d');
          const { width, height } = el;
          const samples = [];
          for (const [fx, fy] of [[.25,.25],[.35,.35],[.5,.5],[.65,.65],[.75,.75]]) {
            const x=Math.min(width-1,Math.floor(width*fx));
            const y=Math.min(height-1,Math.floor(height*fy));
            samples.push([...ctx.getImageData(x,y,1,1).data]);
          }
          return { width, height, samples };
        });
        const undo = app.locator('#btn-undo'), redo = app.locator('#btn-redo');
        if (await undo.isDisabled()) throw new Error('Drawing did not create undo history');
        await undo.click();
        if (await redo.isDisabled()) throw new Error('Undo did not enable redo');
        if (!(await undo.isDisabled())) throw new Error('Undo did not return to initial history state');
        await redo.click();
        if (await undo.isDisabled()) throw new Error('Redo did not restore history');
        if (!(await redo.isDisabled())) throw new Error('Redo did not return to newest history state');
        // Test actual export only on desktop to avoid mobile share-sheet behavior.
        if (width === 1280) {
          const save = app.locator('#btn-save');
          if (await save.isDisabled()) throw new Error('Save remained disabled');
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 15000 }),
            save.click()
          ]);
          const name = download.suggestedFilename();
          if (!/\.(png|jpe?g)$/i.test(name)) throw new Error('Unexpected download: ' + name);
          const target = path.join(outDir, `${reference}-${width}-${name}`);
          await download.saveAs(target);
          if (fs.statSync(target).size < 1000) throw new Error('Downloaded image too small');
        }
        const report = await page.locator('#report').textContent();
        const failLines = report.split('\n').filter(line => line.startsWith('FAIL '));
        const passLines = report.split('\n').filter(line => line.startsWith('PASS '));
        const ok = failLines.length === 0 && passLines.length >= 10 && errors.length === 0;
        if (!ok) failures++;
        results.push({ reference, width, imageData, ok, passed: passLines.length, failed: failLines.length, errors, report });
        await page.screenshot({ path: path.join(outDir, `regression-${reference}-${width}.png`), fullPage: true });
        console.log(`[${ok ? 'PASS' : 'FAIL'}] ${reference} ${width}px: ${passLines.length} passed, ${failLines.length} failed`);
      } catch (error) {
        failures++;
        results.push({ reference, width, ok: false, error: String(error), errors });
        console.error(`[ERROR] ${reference} ${width}px: ${error}`);
        await page.screenshot({ path: path.join(outDir, `regression-${reference}-${width}-error.png`), fullPage: true }).catch(() => {});
      } finally {
        await context.close();
      }
    }
    }
    for (const width of [320, 375, 390, 1280]) {
      const baseline = results.find(r => r.reference === 'index' && r.width === width);
      const candidate = results.find(r => r.reference === 'test' && r.width === width);
      if (baseline && candidate && baseline.ok && !candidate.ok) {
        console.error(`[PARITY] ${width}px: production passes but refactored test fails`);
      }
      if (baseline?.ok && candidate?.ok && baseline.passed !== candidate.passed) {
        failures++;
        console.error('Regression check count differs at ' + width + 'px: ' + baseline.passed + ' versus ' + candidate.passed);
      }
      if (baseline?.ok && candidate?.ok && JSON.stringify(baseline.imageData)!==JSON.stringify(candidate.imageData)) {
        failures++;
        console.error(`[PARITY] ${width}px: edited canvas pixel samples differ`);
      }
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(results, null, 2));
  if (failures) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
