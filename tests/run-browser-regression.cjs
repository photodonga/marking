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
    for (const width of [320, 375, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));
      try {
        await page.goto('http://127.0.0.1:8765/tests/regression.html', { waitUntil: 'load', timeout: 30000 });
        await page.waitForFunction(() => document.querySelector('#report')?.textContent?.includes('완료:'), null, { timeout: 30000 });
        if (width !== 390) {
          await page.locator('#viewport').selectOption(String(width));
          await page.waitForFunction(() => document.querySelector('#report')?.textContent?.includes('완료:'), null, { timeout: 30000 });
        }
        const report = await page.locator('#report').textContent();
        const failLines = report.split('\n').filter(line => line.startsWith('FAIL '));
        const passLines = report.split('\n').filter(line => line.startsWith('PASS '));
        const ok = failLines.length === 0 && passLines.length >= 10 && errors.length === 0;
        if (!ok) failures++;
        results.push({ width, ok, passed: passLines.length, failed: failLines.length, errors, report });
        await page.screenshot({ path: path.join(outDir, `regression-${width}.png`), fullPage: true });
        console.log(`[${ok ? 'PASS' : 'FAIL'}] ${width}px: ${passLines.length} passed, ${failLines.length} failed`);
      } catch (error) {
        failures++;
        results.push({ width, ok: false, error: String(error), errors });
        console.error(`[ERROR] ${width}px: ${error}`);
        await page.screenshot({ path: path.join(outDir, `regression-${width}-error.png`), fullPage: true }).catch(() => {});
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(results, null, 2));
  if (failures) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
