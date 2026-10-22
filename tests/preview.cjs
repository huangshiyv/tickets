const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {});
  fs.mkdirSync(process.env.PREVIEW_DIR || 'preview', { recursive: true });
  try {
    for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844]]) {
      const page = await browser.newPage({ viewport: { width, height } });
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:8000/#lat=39.9042&lng=116.4074&date=2026-06-21&time=720&zone=8');
      await page.waitForFunction(() => document.getElementById('sunrise').textContent !== '—');
      const rise = await page.locator('#sunrise').innerText();
      assert.match(rise, /^04:[45]\d$/, 'Beijing summer sunrise around 04:46 UTC+8');
      assert.match(await page.locator('#sunset').innerText(), /^19:[45]\d$/);
      assert.ok(parseFloat(await page.locator('#altitude').innerText()) > 70);
      await page.locator('#time').fill('0'); await page.locator('#time').dispatchEvent('input');
      assert.equal(await page.locator('#phase').innerText(), '夜间');
      assert.match(await page.locator('#shadow-result').innerText(), /地平线下/);
      await page.locator('#lat').fill('78.22'); await page.locator('#lng').fill('15.65'); await page.locator('#coordinates-go').click();
      assert.match(await page.locator('#duration').innerText(), /极昼/);
      await page.locator('#date').fill('2026-12-21'); await page.locator('#date').dispatchEvent('change');
      assert.match(await page.locator('#duration').innerText(), /极夜/);
      // Deterministic search result: tests do not depend on public geocoder availability.
      await page.route('https://nominatim.openstreetmap.org/**', route => route.fulfill({ json: [{ lat: '48.8566', lon: '2.3522', display_name: '巴黎, 法国' }] }));
      await page.locator('#search').fill('巴黎'); await page.locator('#search-form button').click();
      await page.locator('#results button').click();
      assert.equal(await page.locator('#lat').inputValue(), '48.85660');
      await page.locator('#zone').selectOption('2');
      await page.locator('#date').fill('2026-06-21'); await page.locator('#date').dispatchEvent('change');
      await page.locator('#time').fill('720'); await page.locator('#time').dispatchEvent('input');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const hash = await page.evaluate(() => location.hash); assert.match(hash, /lat=48.85660/);
      await page.reload(); await page.waitForFunction(() => document.getElementById('lat').value === '48.85660');
      await page.screenshot({ path: `${process.env.PREVIEW_DIR || 'preview'}/${name}.png`, fullPage: true });
      assert.deepEqual(errors, []);
      await page.close(); console.log(`${name}: solar events, time slider, shadow, polar days, search, sharing and layout passed`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
