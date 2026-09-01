const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const outDir = path.join(__dirname, '_shots');
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:8088/?v=35', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(400);

  await page.evaluate(() => {
    document.body.dataset.phase = 'scene3';
    const track = document.getElementById('contentTrack');
    if (track) {
      track.classList.remove('is-moving');
      track.style.transition = 'none';
      track.style.transform = 'translate3d(-200vw, 0, 0)';
    }
    document.querySelectorAll('.bg-video').forEach((v) => v.classList.remove('is-visible'));
    const v = document.getElementById('scene3Video');
    if (v) {
      v.classList.add('is-visible');
      v.muted = true;
      try { v.currentTime = 2; } catch (_) {}
      v.play().catch(() => {});
    }
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(outDir, 'scene3-login-1440.png') });

  const login = await page.evaluate(() => {
    const loginForm = document.getElementById('entryLoginForm');
    const registerForm = document.getElementById('entryRegisterForm');
    const input = loginForm.querySelector('input');
    const cs = getComputedStyle(input);
    return {
      loginHidden: loginForm.hidden,
      loginDisplay: getComputedStyle(loginForm).display,
      registerHidden: registerForm.hidden,
      registerDisplay: getComputedStyle(registerForm).display,
      borderBottom: cs.borderBottom,
      background: cs.backgroundColor
    };
  });
  console.log('LOGIN', JSON.stringify(login, null, 2));

  await page.locator('[data-auth-tab="register"]').click();
  await page.waitForTimeout(200);
  const register = await page.evaluate(() => {
    const loginForm = document.getElementById('entryLoginForm');
    const registerForm = document.getElementById('entryRegisterForm');
    return {
      loginHidden: loginForm.hidden,
      loginDisplay: getComputedStyle(loginForm).display,
      registerHidden: registerForm.hidden,
      registerDisplay: getComputedStyle(registerForm).display,
      fields: [...registerForm.querySelectorAll('label span')].map((el) => el.textContent.trim())
    };
  });
  console.log('REGISTER', JSON.stringify(register, null, 2));
  await page.screenshot({ path: path.join(outDir, 'scene3-register-1440.png') });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(outDir, 'scene3-login-390.png') });
  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
