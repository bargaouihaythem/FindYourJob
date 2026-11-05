const { chromium } = require('playwright');

async function check() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 900, height: 750 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  await page.goto('http://localhost:4200/login', { waitUntil: 'networkidle' });
  await page.fill('#username, input[type="text"]', 'rh');
  await page.fill('#password, input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  await page.goto('http://localhost:4200/admin/candidates', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const candidatesData = await page.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('table tbody tr'));
    return rows.map((r, i) => ({
      index: i,
      text: r.innerText.replace(/\n+/g, ' | ')
    }));
  });

  console.log('Candidates in table:');
  candidatesData.forEach(c => console.log(c.index, c.text));

  await browser.close();
}

check().catch(console.error);
