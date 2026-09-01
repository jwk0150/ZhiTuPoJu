const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const outDir = path.join(__dirname, '_shots');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://8.148.77.88/?cb=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(1200);
  console.log('boot', await page.evaluate(() => ({
    phase: document.body.dataset.phase,
    css: document.querySelector('link[href*="cinema.css"]')?.href,
    title: document.title,
    ready: document.readyState
  })));
  await page.waitForFunction(() => !!document.body.dataset.phase, { timeout: 15000 });
  await page.mouse.click(720, 480);
  await page.waitForFunction(() => {
    const p = document.body.dataset.phase;
    return p === 'scene2' || p === 'transition';
  }, { timeout: 25000 });
  await page.waitForFunction(() => document.body.dataset.phase === 'scene2', { timeout: 25000 });
  await page.click('.platform-enter', { force: true });
  await page.waitForFunction(() => {
    const p = document.body.dataset.phase;
    return p === 'scene3' || p === 'transition-2-3';
  }, { timeout: 25000 });
  if (await page.evaluate(() => document.body.dataset.phase === 'transition-2-3')) {
    await page.mouse.wheel(0, 900);
  }
  await page.waitForFunction(() => document.body.dataset.phase === 'scene3', { timeout: 25000 });
  await page.waitForSelector('.login-card.is-entering, .login-card', { timeout: 10000 });
  await page.waitForTimeout(900);

  const inspect = async () => page.evaluate(() => {
    const login = document.getElementById('entryLoginForm');
    const reg = document.getElementById('entryRegisterForm');
    const input = login?.querySelector('input') || reg?.querySelector('input');
    const cs = input ? getComputedStyle(input) : null;
    const loginCs = login ? getComputedStyle(login) : null;
    const regCs = reg ? getComputedStyle(reg) : null;
    return {
      cssHref: document.querySelector('link[href*="cinema.css"]')?.href,
      jsHref: document.querySelector('script[src*="entry.js"]')?.src,
      loginDisplay: loginCs?.display,
      loginHidden: login?.hidden,
      loginH: login?.getBoundingClientRect().height,
      regDisplay: regCs?.display,
      regHidden: reg?.hidden,
      regH: reg?.getBoundingClientRect().height,
      borderBottom: cs?.borderBottom,
      border: cs?.border,
      bg: cs?.backgroundColor,
      boxShadow: cs?.boxShadow,
      titles: [...document.querySelectorAll('.login-card h2, .login-tab, .login-submit')].map((el) => el.textContent.trim()),
      visibleInputs: [...document.querySelectorAll('.login-form input')].filter((el) => el.offsetParent !== null).map((el) => el.placeholder)
    };
  });

  const loginState = await inspect();
  console.log('LOGIN', JSON.stringify(loginState, null, 2));
  await page.screenshot({ path: path.join(outDir, 'prod-scene3-login-1440.png') });

  await page.click('[data-auth-tab="register"]');
  await page.waitForTimeout(400);
  const regState = await inspect();
  console.log('REGISTER', JSON.stringify(regState, null, 2));
  await page.screenshot({ path: path.join(outDir, 'prod-scene3-register-1440.png') });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(outDir, 'prod-scene3-register-390.png') });

  await page.click('[data-auth-tab="login"]');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, 'prod-scene3-login-390.png') });

  const ok =
    loginState.loginDisplay === 'grid' &&
    loginState.regDisplay === 'none' &&
    loginState.borderBottom.startsWith('0px') &&
    regState.loginDisplay === 'none' &&
    regState.regDisplay === 'grid';
  console.log(ok ? 'PASS' : 'FAIL');
  await browser.close();
  if (!ok) process.exit(1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
