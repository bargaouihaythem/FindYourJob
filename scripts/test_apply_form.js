const { chromium } = require('playwright');
const path = require('path');

async function testApplyForm() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 880, height: 750 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  await page.goto('http://localhost:4200/job-offers', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const firstOffer = page.locator('.job-card, .card, a[href*="/job-offers/"]').first();
  console.log('Offer link count:', await firstOffer.count());

  await page.goto('http://localhost:4200/job-offers/1', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  console.log('Job detail URL:', page.url());

  // Check form
  const forms = page.locator('form');
  console.log('Forms count on job detail:', await forms.count());

  const applyCard = page.locator('.card:has(form), .card:has(input[type="file"]), form');
  console.log('Apply card count:', await applyCard.count());

  if (await applyCard.count() > 0) {
    const shotPath = path.join(__dirname, 'test_apply_shot.png');
    await applyCard.first().scrollIntoViewIfNeeded();
    await applyCard.first().screenshot({ path: shotPath });
    console.log('Took apply form shot');
  }

  await browser.close();
}

testApplyForm().catch(console.error);

