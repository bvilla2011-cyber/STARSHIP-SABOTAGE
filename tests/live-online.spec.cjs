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
  page.on('console',msg=>{if(msg.type()==='error'||msg.type()==='warning')diagnostics.push('console '+msg.type()+': '+msg.text())});
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
  return { context, page, diagnostics };
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
    try {
      await expect(hostPage.locator('#lobbyList')).toContainText(
        (await guestPage.locator('#name').inputValue()).slice(0, 16),
        { timeout: 20000 }
      );
    } catch (error) {
      const roomDiagnostics=await hostPage.evaluate(async roomId=>{
        try{
          const client=new Appwrite.Client().setEndpoint('https://fra.cloud.appwrite.io/v1').setProject('6af106fb00396755a6fb');
          const db=new Appwrite.TablesDB(client);
          const [rows,room]=await Promise.all([
            db.listRows({databaseId:'starship_db',tableId:'players_v2',queries:[Appwrite.Query.equal('roomId',roomId),Appwrite.Query.limit(20)],ttl:0}),
            db.getRow({databaseId:'starship_db',tableId:'rooms_v2',rowId:roomId})
          ]);
          return {players:rows.rows.map(p=>({id:p.$id,name:p.nickname,roomId:p.roomId,permissions:p.$permissions})),roomPermissions:room.$permissions};
        }catch(e){return {error:e.message}}
      },roomCode).catch(e=>({error:e.message}));
      throw new Error('Host lobby did not sync guest. hostDiagnostics='+host.diagnostics.slice(-25).join(' | ')+'; guestDiagnostics='+guest.diagnostics.slice(-25).join(' | ')+'; backend='+JSON.stringify(roomDiagnostics)+'; '+error.message);
    }
    await expect(guestPage.locator('#lobbyList')).toContainText(
      (await hostPage.locator('#name').inputValue()).slice(0, 16),
      { timeout: 20000 }
    );

    // Verifica que las ACL activas siguen permitiendo jugar a ambas sesiones invitadas.
    await hostPage.locator('#start').click();
    await expect(hostPage.locator('#game')).toBeVisible({ timeout: 20000 });
    await expect(guestPage.locator('#game')).toBeVisible({ timeout: 20000 });
    await expect.poll(() => guestPage.evaluate(() => document.querySelector('#phase')?.textContent || '')).not.toBe('');

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
