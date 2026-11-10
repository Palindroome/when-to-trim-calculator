// Used by viewport.sh: node viewport.mjs <url> <widths,comma,separated> [screenshotDir]
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const [url, widthList, shots] = process.argv.slice(2);
const widths = widthList.split(',').map(Number);
if (shots) mkdirSync(shots, { recursive: true });

const browser = await chromium.launch();
let failed = false;
for (const width of widths) {
  const page = await browser.newPage({
    viewport: { width, height: 800 },
    locale: 'pl-PL',
    timezoneId: 'Europe/Warsaw',
  });
  const errors = [];
  page.on('console', (msg) => msg.type() === 'error' && errors.push(msg.text()));
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto(url, { waitUntil: 'networkidle' });
  const m = await page.evaluate(() => {
    const d = document.documentElement;
    const result = document.querySelector('#result');
    return {
      scrollWidth: d.scrollWidth,
      clientWidth: d.clientWidth,
      resultChars: result ? result.textContent.trim().length : -1,
    };
  });
  const overflow = m.scrollWidth > m.clientWidth;
  const ok = !overflow && m.resultChars > 0 && errors.length === 0;
  if (!ok) failed = true;
  console.log(
    `${width}px: ${ok ? 'ok' : 'FAIL'} scrollWidth=${m.scrollWidth} clientWidth=${m.clientWidth}` +
      ` overflow=${overflow} #result chars=${m.resultChars} errors=${errors.length}`,
  );
  for (const e of errors) console.log(`    error: ${e}`);
  if (shots) await page.screenshot({ path: `${shots}/${width}.png`, fullPage: true });
  await page.close();
}
await browser.close();
if (shots) console.log(`screenshots: ${shots}`);
process.exit(failed ? 1 : 0);
