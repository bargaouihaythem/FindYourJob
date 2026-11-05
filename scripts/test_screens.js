const { chromium } = require('playwright');

async function test() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 900, height: 750 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  // Test login
  await page.goto('http://localhost:4200/login', { waitUntil: 'networkidle' });
  await page.fill('#username, input[type="text"]', 'rh');
  await page.fill('#password, input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);
  console.log('Logged in as rh, URL:', page.url());

  // Test candidates
  await page.goto('http://localhost:4200/admin/candidates', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  console.log('Candidates table rows:', await page.locator('table tbody tr').count());
  
  // Test job offers
  await page.goto('http://localhost:4200/admin/job-offers', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  console.log('Job offers table rows:', await page.locator('table tbody tr').count());

  // Test audit log
  await page.goto('http://localhost:4200/admin/audit-log', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  console.log('Audit log table rows:', await page.locator('table tbody tr').count());

  await browser.close();
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
