const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT_DIR1 = path.join(__dirname, '..', 'Rapport-PFE', 'extracted_diagrams');
const OUT_DIR2 = path.join(__dirname, '..', 'Rapport-PFE', 'captures_haute_lisibilite');

[OUT_DIR1, OUT_DIR2].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function saveCopies(sourcePath, filename) {
  const p1 = path.join(OUT_DIR1, filename);
  const p2 = path.join(OUT_DIR2, filename);
  fs.copyFileSync(sourcePath, p1);
  if (p1 !== p2) fs.copyFileSync(sourcePath, p2);
  const stat = fs.statSync(p1);
  console.log(`[OK] Saved: ${filename} (${stat.size} bytes)`);
}

async function run() {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true
  });

  const context = await browser.newContext({
    viewport: { width: 880, height: 720 },
    deviceScaleFactor: 2
  });

  const page = await context.newPage();

  async function limitTableRows(max = 5) {
    await page.evaluate((maxRows) => {
      const rows = document.querySelectorAll('table tbody tr');
      rows.forEach((r, idx) => {
        if (idx >= maxRows) r.style.display = 'none';
      });
      const pagination = document.querySelector('.pagination, ul.pagination, nav[aria-label*="Page"], .pagination-controls');
      if (pagination) pagination.style.display = 'none';
    }, max);
    await page.waitForTimeout(300);
  }

  // =========================================================================
  // Fig 4.1: image18.png - Page d'accueil publique, recherche d'offres
  // =========================================================================
  console.log('-> 4.1: Page accueil publique (image18.png)');
  await page.goto('http://localhost:4200/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const footer = document.querySelector('footer, app-footer');
    if (footer) footer.style.display = 'none';
  });
  const f18 = path.join(OUT_DIR2, 'image18.png');
  await page.screenshot({ path: f18, clip: { x: 0, y: 0, width: 880, height: 620 } });
  saveCopies(f18, 'image18.png');

  // =========================================================================
  // Fig 4.2: image19.png - Page de connexion
  // =========================================================================
  console.log('-> 4.2: Page de connexion (image19.png)');
  await page.goto('http://localhost:4200/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const f19 = path.join(OUT_DIR2, 'image19.png');
  const loginCard = page.locator('.card, .login-container, .auth-card').first();
  if (await loginCard.count() > 0) {
    await loginCard.screenshot({ path: f19 });
  } else {
    await page.screenshot({ path: f19, clip: { x: 140, y: 50, width: 600, height: 500 } });
  }
  saveCopies(f19, 'image19.png');

  // =========================================================================
  // CONNECT AS RH
  // =========================================================================
  console.log('Connexion RH...');
  await page.goto('http://localhost:4200/login', { waitUntil: 'networkidle' });
  await page.fill('#username, input[type="text"]', 'rh');
  await page.fill('#password, input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  // =========================================================================
  // Fig 4.3: image20.png - Gestion des offres d'emploi (RH)
  // =========================================================================
  console.log('-> 4.3: Gestion des offres d emploi RH (image20.png)');
  await page.goto('http://localhost:4200/admin/job-offers', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await limitTableRows(5);
  const f20 = path.join(OUT_DIR2, 'image20.png');
  await page.screenshot({ path: f20, clip: { x: 15, y: 70, width: 850, height: 500 } });
  saveCopies(f20, 'image20.png');

  // =========================================================================
  // Fig 4.4: image21.png - Liste des candidats avec score IA
  // =========================================================================
  console.log('-> 4.4: Liste des candidats avec score IA (image21.png)');
  await page.goto('http://localhost:4200/admin/candidates', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await limitTableRows(5);
  const f21 = path.join(OUT_DIR2, 'image21.png');
  await page.screenshot({ path: f21, clip: { x: 15, y: 70, width: 850, height: 520 } });
  saveCopies(f21, 'image21.png');

  // =========================================================================
  // Fig 4.5: image22.png - Modification d'un dossier candidat
  // =========================================================================
  console.log('-> 4.5: Modification d un dossier candidat (image22.png)');
  await page.goto('http://localhost:4200/admin/candidates', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const editBtn = page.locator('table tbody tr button:has(.fa-edit), table tbody tr .fa-edit').first();
  await editBtn.click();
  await page.waitForTimeout(1000);
  const f22 = path.join(OUT_DIR2, 'image22.png');
  const editModal = page.locator('.modal.show .modal-dialog');
  if (await editModal.count() > 0 && await editModal.first().isVisible()) {
    await editModal.first().screenshot({ path: f22 });
  } else {
    await page.screenshot({ path: f22, clip: { x: 100, y: 50, width: 680, height: 600 } });
  }
  saveCopies(f22, 'image22.png');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // =========================================================================
  // Fig 4.6: image23.png - Tableau Kanban du pipeline
  // =========================================================================
  console.log('-> 4.6: Tableau Kanban (image23.png)');
  await page.goto('http://localhost:4200/admin/kanban', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const f23 = path.join(OUT_DIR2, 'image23.png');
  await page.screenshot({ path: f23, clip: { x: 15, y: 80, width: 850, height: 540 } });
  saveCopies(f23, 'image23.png');

  // =========================================================================
  // Fig 4.7: image24.png - Gestion des entretiens
  // =========================================================================
  console.log('-> 4.7: Gestion des entretiens (image24.png)');
  await page.goto('http://localhost:4200/admin/interviews', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await limitTableRows(5);
  const f24 = path.join(OUT_DIR2, 'image24.png');
  await page.screenshot({ path: f24, clip: { x: 15, y: 70, width: 850, height: 500 } });
  saveCopies(f24, 'image24.png');

  // =========================================================================
  // Fig 4.8: image25.png - Gestion des feedbacks
  // =========================================================================
  console.log('-> 4.8: Gestion des feedbacks (image25.png)');
  await page.goto('http://localhost:4200/admin/feedbacks', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await limitTableRows(5);
  const f25 = path.join(OUT_DIR2, 'image25.png');
  await page.screenshot({ path: f25, clip: { x: 15, y: 70, width: 850, height: 500 } });
  saveCopies(f25, 'image25.png');

  // =========================================================================
  // Fig 4.10: image27.png - Paramétrage du scoring IA
  // =========================================================================
  console.log('-> 4.10: Parametrage scoring IA (image27.png)');
  await page.goto('http://localhost:4200/admin/scoring-settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const f27 = path.join(OUT_DIR2, 'image27.png');
  await page.screenshot({ path: f27, clip: { x: 15, y: 70, width: 850, height: 580 } });
  saveCopies(f27, 'image27.png');

  // =========================================================================
  // Fig 4.11: image28.png - Journal d'audit
  // =========================================================================
  console.log('-> 4.11: Journal d audit (image28.png)');
  await page.goto('http://localhost:4200/admin/audit-log', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await limitTableRows(5);
  const f28 = path.join(OUT_DIR2, 'image28.png');
  await page.screenshot({ path: f28, clip: { x: 15, y: 70, width: 850, height: 510 } });
  saveCopies(f28, 'image28.png');

  // =========================================================================
  // Fig 4.15: image31.png - Analyse détaillée IA d'une candidature
  // =========================================================================
  console.log('-> 4.15: Analyse detaillee IA candidature (image31.png)');
  await page.goto('http://localhost:4200/admin/candidates', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const eyeButtons = page.locator('table tbody tr .btn-outline-info');
  if (await eyeButtons.count() > 1) {
    await eyeButtons.nth(1).click();
  } else {
    await eyeButtons.first().click();
  }
  await page.waitForTimeout(1000);
  const f31 = path.join(OUT_DIR2, 'image31.png');
  const detailsDialog = page.locator('.modal.show .modal-dialog');
  if (await detailsDialog.count() > 0 && await detailsDialog.first().isVisible()) {
    await detailsDialog.first().screenshot({ path: f31 });
  } else {
    await page.screenshot({ path: f31, clip: { x: 100, y: 30, width: 680, height: 650 } });
  }
  saveCopies(f31, 'image31.png');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // =========================================================================
  // Fig 4.9: image26.png - Gestion des utilisateurs et des rôles (ADMIN)
  // =========================================================================
  console.log('Connexion ADMIN pour Fig 4.9...');
  await page.goto('http://localhost:4200/login', { waitUntil: 'networkidle' });
  await page.fill('#username, input[type="text"]', 'admin');
  await page.fill('#password, input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  console.log('-> 4.9: Gestion des utilisateurs (image26.png)');
  await page.goto('http://localhost:4200/admin/users', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await limitTableRows(5);
  const f26 = path.join(OUT_DIR2, 'image26.png');
  await page.screenshot({ path: f26, clip: { x: 15, y: 70, width: 850, height: 500 } });
  saveCopies(f26, 'image26.png');

  // =========================================================================
  // Fig 4.14: image30.png - « Job idéal » — suggestions d'offres
  // =========================================================================
  console.log('-> 4.14: Job ideal suggestions d offres (image30.png)');
  await page.goto('http://localhost:4200/job-matching', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const samplePdf = path.join(__dirname, '..', 'cv_tests', '1_CV_Backend_Java_Spring_Thomas.pdf');
  const fileInput = page.locator('input[type="file"]');
  if (await fileInput.count() > 0 && fs.existsSync(samplePdf)) {
    await fileInput.setInputFiles(samplePdf);
    await page.click('button.btn-primary');
    try {
      await page.waitForSelector('.row .card', { timeout: 15000 });
    } catch (e) {}
  }
  const f30 = path.join(OUT_DIR2, 'image30.png');
  await page.screenshot({ path: f30, clip: { x: 15, y: 40, width: 850, height: 600 } });
  saveCopies(f30, 'image30.png');

  // =========================================================================
  // CANDIDAT: Fig 4.13 (Postuler) + Fig 4.12 (Chatbot)
  // =========================================================================
  console.log('Connexion CANDIDAT...');
  await page.goto('http://localhost:4200/login', { waitUntil: 'networkidle' });
  await page.fill('#username, input[type="text"]', 'candidat');
  await page.fill('#password, input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  // 4.13: image29.png - Soumission de candidature + dépôt de CV
  console.log('-> 4.13: Soumission de candidature et depot de CV (image29.png)');
  await page.goto('http://localhost:4200/job-offers/2', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const applyBtn = page.locator('button:has-text("Postuler"), button:has-text("Postuler maintenant")').first();
  if (await applyBtn.count() > 0 && await applyBtn.isVisible()) {
    await applyBtn.click();
    await page.waitForTimeout(1000);
  }
  const f29 = path.join(OUT_DIR2, 'image29.png');
  const applyModal = page.locator('.modal.show .modal-dialog');
  if (await applyModal.count() > 0 && await applyModal.first().isVisible()) {
    await applyModal.first().screenshot({ path: f29 });
  } else {
    // If not in modal, capture form or application section
    const formSection = page.locator('form, .card:has(form)').first();
    if (await formSection.count() > 0) {
      await formSection.screenshot({ path: f29 });
    } else {
      await page.screenshot({ path: f29, clip: { x: 15, y: 100, width: 850, height: 600 } });
    }
  }
  saveCopies(f29, 'image29.png');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // 4.12: image90.png - Chatbot
  console.log('-> 4.12: Chatbot conversationnel (image90.png)');
  await page.goto('http://localhost:4200/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const chatBubble = page.locator('.chatbot-bubble, button.chatbot-toggle, .chatbot-container button').first();
  if (await chatBubble.count() > 0) {
    await chatBubble.click();
    await page.waitForTimeout(1500);
    const f90 = path.join(OUT_DIR2, 'image90.png');
    const chatPanel = page.locator('.chatbot-panel, .chatbot-card, .chatbot-widget').first();
    if (await chatPanel.count() > 0 && await chatPanel.isVisible()) {
      await chatPanel.screenshot({ path: f90 });
    } else {
      await page.screenshot({ path: f90, clip: { x: 480, y: 160, width: 380, height: 530 } });
    }
    saveCopies(f90, 'image90.png');
  }

  // =========================================================================
  // MANAGER: Fig 4.16 + Fig 4.17
  // =========================================================================
  console.log('Connexion MANAGER (manager.cs)...');
  await page.goto('http://localhost:4200/login', { waitUntil: 'networkidle' });
  await page.fill('#username, input[type="text"]', 'manager.cs');
  await page.fill('#password, input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2000);

  // 4.16: image32.png - Espace Manager (périmètre)
  console.log('-> 4.16: Espace Manager perimetre (image32.png)');
  await page.goto('http://localhost:4200/manager/candidates', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await limitTableRows(5);
  const f32 = path.join(OUT_DIR2, 'image32.png');
  await page.screenshot({ path: f32, clip: { x: 15, y: 70, width: 850, height: 510 } });
  saveCopies(f32, 'image32.png');

  // Fig 4.17: image_manager_dashboard.png - Tableau de bord espace gestionnaire
  console.log('-> 4.17: Tableau de bord espace gestionnaire (image_manager_dashboard.png & image33.png)');
  await page.goto('http://localhost:4200/manager/calendar', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const fMgr = path.join(OUT_DIR2, 'image_manager_dashboard.png');
  await page.screenshot({ path: fMgr, clip: { x: 15, y: 70, width: 850, height: 600 } });
  saveCopies(fMgr, 'image_manager_dashboard.png');
  saveCopies(fMgr, 'image33.png');

  await browser.close();
  console.log('\n======================================================');
  console.log('   TOUTES LES CAPTURES SONT TERMINEES AVEC SUCCES     ');
  console.log('======================================================');
}

run().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});

