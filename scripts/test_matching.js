const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function testMatching() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 880, height: 720 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  await page.goto('http://localhost:4200/job-matching', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const samplePdf = path.join(__dirname, '..', 'cv_tests', '1_CV_Backend_Java_Spring_Thomas.pdf');
  console.log('Sample PDF exists:', fs.existsSync(samplePdf));

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(samplePdf);
  await page.click('button.btn-primary');
  
  // Wait up to 15s for matching result or cards
  try {
    await page.waitForSelector('.row .card', { timeout: 15000 });
  } catch (e) {
    console.log('Wait completed or caught:', e.message);
  }

  const resultsCount = await page.locator('.row .card').count();
  console.log('Matching results cards count:', resultsCount);

  // Take a test screenshot of the matching suggestions
  const shotPath = path.join(__dirname, 'test_matching_shot.png');
  await page.screenshot({ path: shotPath, fullPage: false });
  console.log('Took test matching screenshot');

  await browser.close();
}

testMatching().catch(console.error);

