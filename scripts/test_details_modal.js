const { chromium } = require('playwright');

async function testRemaining() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 880, height: 720 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  // Login as RH
  await page.goto('http://localhost:4200/login', { waitUntil: 'networkidle' });
  await page.fill('#username, input[type="text"]', 'rh');
  await page.fill('#password, input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  // Test details modal
  await page.goto('http://localhost:4200/admin/candidates', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  
  // Click on eye button of candidate 1 (who has AI score and HITL)
  const eyeButtons = page.locator('table tbody tr .btn-outline-info');
  console.log('Eye buttons count:', await eyeButtons.count());
  await eyeButtons.nth(1).click();
  await page.waitForTimeout(1000);
  
  const visibleModal = page.locator('.modal.show .modal-dialog');
  console.log('Visible modal count:', await visibleModal.count());
  const isVis = await visibleModal.isVisible();
  console.log('Visible modal isVisible:', isVis);

  await browser.close();
}

testRemaining().catch(console.error);

