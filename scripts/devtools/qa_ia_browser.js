/**
 * Headed/headless smoke for IA hubs + QA drawer.
 * Usage: node scripts/devtools/qa_ia_browser.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.FRONTEND_BASE || 'http://127.0.0.1:8080';
const outDir = path.join(__dirname, 'qa-screens');
fs.mkdirSync(outDir, { recursive: true });

const results = [];

function ok(name, detail) {
  results.push({ name, pass: true, detail: detail || '' });
  console.log('PASS', name, detail || '');
}
function fail(name, detail) {
  results.push({ name, pass: false, detail: String(detail || '') });
  console.log('FAIL', name, detail || '');
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(outDir, name + '.png'), fullPage: false });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    // Home + QA fab
    await page.goto(BASE + '/pages/home.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('#qa-fab', { timeout: 8000 });
    ok('home-qa-fab', 'fab visible');
    await page.click('#qa-fab');
    await page.waitForSelector('#qa-drawer.is-open', { timeout: 5000 });
    ok('qa-drawer-open');
    await page.waitForSelector('#qa-drawer-frame');
    const frame = page.frameLocator('#qa-drawer-frame');
    await frame.locator('#qa-input').waitFor({ timeout: 10000 });
    ok('qa-embed-loaded', 'input ready');
    await frame.locator('.qa-suggest').first().click();
    await page.waitForTimeout(800);
    const msgs = await frame.locator('.chat-msg').count();
    if (msgs >= 2) ok('qa-suggest-click', 'msgs=' + msgs);
    else fail('qa-suggest-click', 'msgs=' + msgs);
    await shot(page, '01-qa-drawer');
    await page.click('#qa-drawer-close');
    await page.waitForTimeout(300);
    const closed = await page.locator('#qa-drawer.is-open').count();
    if (closed === 0) ok('qa-drawer-close');
    else fail('qa-drawer-close');

    // Insight tabs
    await page.goto(BASE + '/pages/insight.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('[data-hub=insight] .hub-tab', { timeout: 8000 });
    const evoActive = await page.locator('[data-hub-panel=evolution].active').count();
    if (evoActive) ok('insight-default-evolution');
    else fail('insight-default-evolution');
    await page.click('[data-hub-tab=trends]');
    await page.waitForTimeout(500);
    const trendsActive = await page.locator('[data-hub-panel=trends].active').count();
    if (trendsActive) ok('insight-tab-trends');
    else fail('insight-tab-trends');
    await shot(page, '02-insight-trends');

    // Data tabs
    await page.goto(BASE + '/pages/more/data.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('[data-hub=data] .hub-tab', { timeout: 8000 });
    await page.click('[data-hub-tab=quality]');
    await page.waitForTimeout(400);
    if (await page.locator('[data-hub-panel=quality].active').count()) ok('data-tab-quality');
    else fail('data-tab-quality');
    await shot(page, '03-data-quality');

    // Match profile tab
    await page.goto(BASE + '/pages/match.html?tab=profile', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('[data-hub-panel=profile].active', { timeout: 8000 });
    ok('match-profile-tab');
    await page.waitForSelector('.profile-embed-frame', { timeout: 5000 });
    const pframe = page.frameLocator('.profile-embed-frame');
    await pframe.locator('#display-name').waitFor({ timeout: 10000 });
    ok('match-profile-embed');
    await shot(page, '04-match-profile');

    // Settings gear
    await page.goto(BASE + '/pages/home.html', { waitUntil: 'domcontentloaded' });
    const gear = page.locator('a.topbar-icon-btn[title="系统设置"]');
    await gear.waitFor({ timeout: 5000 });
    ok('settings-gear');
    await gear.click();
    await page.waitForURL(/settings\.html/, { timeout: 8000 });
    ok('settings-nav');

    // Nav count primary = 5
    await page.goto(BASE + '/pages/map.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.sidebar-nav .nav-group', { timeout: 8000 });
    const primaryCount = await page.locator('.nav-group').first().locator('.nav-item').count();
    if (primaryCount === 5) ok('nav-primary-5', String(primaryCount));
    else fail('nav-primary-5', String(primaryCount));
  } catch (err) {
    fail('runner', err && err.stack ? err.stack : err);
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.pass);
  console.log('\n--- summary ---');
  console.log('pass', results.length - failed.length, '/', results.length);
  if (failed.length) {
    failed.forEach((f) => console.log(' -', f.name, f.detail));
    process.exit(1);
  }
})();
