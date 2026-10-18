'use strict';

// Trusted synthetic suite. Browser requests are fulfilled or aborted before
// transport; this is not a production customer journey or payment simulation.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');

test('fixture delivers the result and matching download bytes without egress', async ({ page, context, baseURL }) => {
  const target = new URL(baseURL);
  expect(target.hostname).toBe('127.0.0.1');
  expect(process.env.BOSSMIND_TEST_ISOLATION).toBe('1');
  expect(process.env.BOSSMIND_DBOS_ENABLED).toBe('0');
  for (const name of ['GOOGLE_APPLICATION_CREDENTIALS', 'GEMINI_API_KEY', 'GOOGLE_API_KEY', 'OPENAI_API_KEY', 'CURSOR_API_KEY']) {
    expect(process.env[name]).toBeUndefined();
  }
  const text = 'Synthetic readiness result. No model or customer data.\n';
  let deliveries = 0;
  let externalBlocked = 0;
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== target.origin) {
      externalBlocked += 1;
      return route.abort('blockedbyclient');
    }
    if (url.pathname === '/' && route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><meta charset="utf-8">
        <h1>Synthetic adapter fixture</h1><button id="generate">Deliver fixture</button>
        <p id="status" role="status">No result</p><pre id="result"></pre><button id="download" disabled>Download fixture</button>
        <script>
        let delivered;
        document.querySelector('#generate').onclick = async () => {
          document.querySelector('#generate').disabled = true;
          const response = await fetch('/fixture/result', {method:'POST'});
          if (!response.ok) throw new Error('Fixture delivery failed');
          delivered = (await response.json()).text;
          document.querySelector('#result').textContent = delivered;
          document.querySelector('#status').textContent = 'Delivered';
          document.querySelector('#download').disabled = false;
        };
        document.querySelector('#download').onclick = () => {
          const url = URL.createObjectURL(new Blob([delivered], {type:'text/plain'}));
          const link = document.createElement('a'); link.href = url; link.download = 'fixture.txt'; link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        };
        </script>` });
    }
    if (url.pathname === '/fixture/result' && route.request().method() === 'POST') {
      deliveries += 1;
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text, synthetic: true }) });
    }
    return route.abort('blockedbyclient');
  });
  await page.goto(baseURL);
  await expect(page.getByRole('heading')).toHaveText('Synthetic adapter fixture');
  await expect(page.locator('#download')).toBeDisabled();
  await page.locator('#generate').click();
  await expect(page.locator('#status')).toHaveText('Delivered');
  await expect(page.locator('#result')).toHaveText(text.trim());
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#download').click();
  const download = await downloadPromise;
  const actual = await fs.readFile(await download.path());
  expect(actual.equals(Buffer.from(text))).toBe(true);
  expect(deliveries).toBe(1);
  expect(await page.evaluate(() => fetch('https://fixture-egress.invalid/denied').then(() => 'unexpected').catch(() => 'blocked'))).toBe('blocked');
  expect(externalBlocked).toBe(1);
});
