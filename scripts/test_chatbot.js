const { chromium } = require('playwright');

async function testChatbot() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 880, height: 720 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  // Login as candidat
  await page.goto('http://localhost:4200/login', { waitUntil: 'networkidle' });
  await page.fill('#username, input[type="text"]', 'candidat');
  await page.fill('#password, input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  console.log('Candidat logged in, URL:', page.url());

  // Check chatbot widget
  const bubble = page.locator('.chatbot-bubble, button.chatbot-toggle, .chatbot-container button');
  console.log('Bubble count:', await bubble.count());
  
  // If bubble found, click it
  if (await bubble.count() > 0) {
    await bubble.first().click();
    await page.waitForTimeout(1000);
    const panel = page.locator('.chatbot-panel, .chatbot-card, .chatbot-widget');
    console.log('Panel count:', await panel.count(), 'isVisible:', await panel.first().isVisible());
  } else {
    // Check all buttons or elements with chatbot
    const chatElements = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('*')).filter(el => el.className && typeof el.className === 'string' && el.className.includes('chat')).map(el => el.className);
    });
    console.log('Chat classes in DOM:', chatElements);
  }

  await browser.close();
}

testChatbot().catch(console.error);

