const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const LIVE_URL = 'https://bvilla2011-cyber.github.io/STARSHIP-SABOTAGE/';

async function openLiveGuest(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  // Keep the production GitHub Pages origin (required by Appwrite platform/CORS),
  // but serve the exact development-branch HTML checked out by this workflow.
  await context.route('https://bvilla2011-cyber.github.io/STARSHIP-SABOTAGE/**', async route => {
    if (route.request().isNavigationRequest()) {
      return route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        body: fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
      });
    }
    return route.continue();
  });
  const page = await context.newPage();
  const diagnostics=[];
  page.on('console',msg=>{if(msg.type()==='error')diagnostics.push('console: '+msg.text())});
  page.on('pageerror',err=>diagnostics.push('pageerror: '+err.message));
  page.on('requestfailed',req=>diagnostics.push('requestfailed: '+req.url()+' :: '+(req.failure()?.errorText||'')));
  page.on('response',async res=>{if(res.url().includes('appwrite')&&!res.ok()){let body='';try{body=(await res.text()).slice(0,500)}catch(e){}diagnostics.push('HTTP '+res.status()+' '+res.url()+' body='+body)}});
  await page.goto(LIVE_URL, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#profileGate')).toHaveClass(/visible/);
  // initProfile awaits the initial /account probe before assigning the guest button handler.
  await expect.poll(()=>page.evaluate(()=>typeof document.querySelector('#guestPlay')?.onclick)).toBe('function');
  await page.locator('#guestPlay').click();
  try {
    await expect(page.locator('#profileGate')).not.toHaveClass(/visible/, { timeout: 20000 });
  } catch (error) {
    const feedback=(await page.locator('#authFeedback').textContent().catch(()=>''))?.trim();
    const status=(await page.locator('#authStatus').textContent().catch(()=>''))?.trim();
    fs.mkdirSync(path.join(ROOT,'test-results'),{recursive:true});
    await page.screenshot({path:path.join(ROOT,'test-results/live-auth-failure.png'),fullPage:true}).catch(()=>{});
    throw new Error('Guest auth did not complete. authFeedback='+feedback+'; authStatus='+status+'; diagnostics='+diagnostics.slice(-20).join(' | ')+'; '+error.message);
  }
  return { context, page };
}

test('Appwrite real: dos sesiones anónimas crean, unen y abandonan una sala', async ({ browser }) => {
  test.setTimeout(120000);
  const host = await openLiveGuest(browser);
  const guest = await openLiveGuest(browser);
  const hostPage = host.page;
  const guestPage = guest.page;
  let roomCode = '';
  try {
    const hostId = await hostPage.evaluate(() => localStorage.getItem('starship_guest_id'));
    const guestId = await guestPage.evaluate(() => localStorage.getItem('starship_guest_id'));
    expect(hostId).toBeTruthy();
    expect(guestId).toBeTruthy();
    expect(hostId).not.toBe(guestId);

    await hostPage.locator('#create').click();
    await expect(hostPage.locator('#lobby')).toBeVisible({ timeout: 20000 });
    roomCode = (await hostPage.locator('#roomCode').textContent()).trim();
    expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);

    await guestPage.locator('#code').fill(roomCode);
    await guestPage.locator('#join').click();
    await expect(guestPage.locator('#lobby')).toBeVisible({ timeout: 20000 });
    await expect(hostPage.locator('#lobbyList')).toContainText(
      (await guestPage.locator('#name').inputValue()).slice(0, 16),
      { timeout: 20000 }
    );
    await expect(guestPage.locator('#lobbyList')).toContainText(
      (await hostPage.locator('#name').inputValue()).slice(0, 16),
      { timeout: 20000 }
    );

    // The non-host leaves first; the host must remain able to close the room.
    await guestPage.locator('#leave').click();
    await expect(guestPage.locator('#connect')).toBeVisible({ timeout: 20000 });
    await expect(hostPage.locator('#lobbyList')).not.toContainText(
      (await guestPage.locator('#name').inputValue()).slice(0, 16),
      { timeout: 15000 }
    );
    await hostPage.locator('#leave').click();
    await expect(hostPage.locator('#connect')).toBeVisible({ timeout: 20000 });
  } finally {
    // Best-effort cleanup if an assertion fails after a room has been created.
    for (const page of [guestPage, hostPage]) {
      try {
        if (await page.locator('#lobby').isVisible()) await page.locator('#leave').click({ timeout: 3000 });
      } catch (_) {}
    }
    await guest.context.close();
    await host.context.close();
  }
});
