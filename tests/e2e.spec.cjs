const { test, expect } = require('@playwright/test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 4173;
const ORIGIN = 'http://127.0.0.1:' + PORT;
const shared = { rooms_v2: new Map(), players_v2: new Map() };
let server;

const sdkMock = String.raw`
(() => {
  const API = 'https://fra.cloud.appwrite.io/v1/mock';
  async function request(path, method='GET', payload) {
    const user = localStorage.getItem('__mock_user') || '';
    const response = await fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Mock-User': user },
      body: payload === undefined ? undefined : JSON.stringify(payload)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || ('HTTP ' + response.status));
    return body;
  }
  class Client { setEndpoint(){ return this; } setProject(){ return this; } }
  class Account {
    async get() {
      const id = localStorage.getItem('__mock_user');
      if (!id) throw new Error('No active session');
      return { $id:id, name:localStorage.getItem('__mock_name') || 'Tripulante', email:'', emailVerification:false };
    }
    async createAnonymousSession() {
      const id = 'usr_' + crypto.randomUUID().replace(/-/g,'').slice(0,20);
      localStorage.setItem('__mock_user',id);
      localStorage.setItem('__mock_name','Tripulante');
      return { $id:id };
    }
    async updateName({name}) { localStorage.setItem('__mock_name',name); return this.get(); }
    async createEmailPasswordSession({email}) {
      const id = 'usr_' + btoa(email).replace(/[^a-z0-9]/gi,'').slice(0,20);
      localStorage.setItem('__mock_user',id); return { $id:id };
    }
    async create(){ return { $id:'usr_test' }; }
    async createEmailVerificationOTP(){ return {}; }
    async updateEmailVerificationOTP(){ return {}; }
    async deleteSession(){ localStorage.removeItem('__mock_user'); }
  }
  class TablesDB {
    async createRow({tableId,rowId,data,permissions}) { return request('/rows/'+tableId+'/'+encodeURIComponent(rowId),'PUT',{data,permissions}); }
    async getRow({tableId,rowId}) { return request('/rows/'+tableId+'/'+encodeURIComponent(rowId)); }
    async listRows({tableId,queries=[]}) { return request('/list/'+tableId,'POST',{queries}); }
    async updateRow({tableId,rowId,data,permissions}) { return request('/rows/'+tableId+'/'+encodeURIComponent(rowId),'PATCH',{data,permissions}); }
    async deleteRow({tableId,rowId}) { return request('/rows/'+tableId+'/'+encodeURIComponent(rowId),'DELETE'); }
  }
  const Query = {
    equal:(attribute,value)=>({method:'equal',attribute,values:[value]}),
    limit:value=>({method:'limit',values:[value]}),
    orderDesc:(attribute)=>({method:'orderDesc',attribute})
  };
  const Role = { any:()=> 'any', users:()=> 'users', user:id=>'user:'+id };
  const Permission = {
    read:role=>'read("'+role+'")',
    create:role=>'create("'+role+'")',
    update:role=>'update("'+role+'")',
    delete:role=>'delete("'+role+'")'
  };
  class Functions { async createExecution(){ return { responseBody:'{}' }; } }
  window.__mockTest = { request };
  window.Appwrite = { Client, Account, TablesDB, Functions, ID:{ unique:()=> 'usr_'+crypto.randomUUID().replace(/-/g,'').slice(0,20) }, Query, Role, Permission };
})();
`;

async function apiRoute(route) {
  const req = route.request();
  const url = new URL(req.url());
  const parts = url.pathname.split('/').filter(Boolean);
  const method = req.method();
  const headers = {
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Headers':'Content-Type, X-Mock-User',
    'Access-Control-Allow-Methods':'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Content-Type':'application/json'
  };
  const send = (status, body) => route.fulfill({status,headers,body:JSON.stringify(body)});
  if (method === 'OPTIONS') return route.fulfill({status:204,headers});
  const user = req.headers()['x-mock-user'] || '';
  if (parts[2] === 'list' && method === 'POST') {
    const table = parts[3];
    const payload = req.postDataJSON() || {};
    const rows = [...(shared[table]?.values() || [])];
    const eq = (payload.queries || []).find(q => q.method === 'equal');
    const lim = (payload.queries || []).find(q => q.method === 'limit');
    const filtered = eq ? rows.filter(r => r[eq.attribute] === eq.values[0]) : rows;
    return send(200,{total:filtered.length,rows:filtered.slice(0,lim?.values?.[0] || 100)});
  }
  if (parts[2] === 'rows' && parts.length === 5) {
    const table=parts[3], id=decodeURIComponent(parts[4]), store=shared[table];
    if (!store) return send(404,{message:'Table not found'});
    if (method === 'PUT') {
      const payload=req.postDataJSON() || {};
      if (store.has(id)) return send(409,{message:'Row already exists'});
      const row={ $id:id, ...(payload.data||{}), $permissions:payload.permissions||[] };
      store.set(id,row); return send(201,row);
    }
    const row=store.get(id);
    if (!row) return send(404,{message:'Row not found'});
    if (method === 'GET') { const member=table==='rooms_v2'&&[...(shared.players_v2?.values()||[])].some(p=>p.$id===user&&p.roomId===row.$id); if (!(row.$permissions||[]).includes('read("any")') && !(row.$permissions||[]).includes('read("user:'+user+'")') && !((row.$permissions||[]).includes('read("users")')&&member)) return send(403,{message:'Read permission denied'}); return send(200,row); }
    const action=method==='PATCH'?'update':'delete';
    const member=table==='rooms_v2'&&[...(shared.players_v2?.values()||[])].some(p=>p.$id===user&&p.roomId===row.$id); if (!(row.$permissions||[]).includes(action+'("user:'+user+'")') && !((row.$permissions||[]).includes(action+'("users")')&&member) && !(table==='rooms_v2'&&(row.$permissions||[]).includes(action+'("any")'))) return send(403,{message:'Permission denied'});
    if (method === 'PATCH') {
      const payload=req.postDataJSON() || {};
      Object.assign(row,payload.data||{});
      if (payload.permissions) row.$permissions=payload.permissions;
      store.set(id,row); return send(200,row);
    }
    if (method === 'DELETE') { store.delete(id); return send(200,{}); }
  }
  return send(404,{message:'Mock endpoint not found'});
}

test.beforeAll(async () => {
  server=http.createServer((req,res)=>{
    const file=req.url==='/'?path.join(ROOT,'index.html'):path.join(ROOT,decodeURIComponent(req.url.split('?')[0]));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('Not found');
    }
    res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':'text/plain'});
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>server.listen(PORT,'127.0.0.1',resolve));
});

test.afterAll(async () => {
  if(server) await new Promise(resolve=>server.close(resolve));
});

async function openAsGuest(browser) {
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  await context.route('https://cdn.jsdelivr.net/npm/appwrite@29.0.0',route=>route.fulfill({status:200,contentType:'application/javascript',body:sdkMock}));
  await context.route('https://unpkg.com/appwrite@29.0.0',route=>route.fulfill({status:200,contentType:'application/javascript',body:sdkMock}));
  await context.route('https://fra.cloud.appwrite.io/v1/mock/**',apiRoute);
  const page=await context.newPage();
  await page.goto(ORIGIN);
  await expect(page.locator('#profileGate')).toHaveClass(/visible/);
  await page.locator('#guestPlay').click();
  await expect(page.locator('#profileGate')).not.toHaveClass(/visible/);
  return {context,page};
}

test('dos clientes crean sala, juegan, votan y transfieren el anfitrión con ACL', async ({browser}) => {
  test.setTimeout(60000);
  const first=await openAsGuest(browser);
  const second=await openAsGuest(browser);
  const p1=first.page,p2=second.page;
  try {
    await p1.locator('#create').click();
    await expect(p1.locator('#lobby')).toBeVisible();
    const code=(await p1.locator('#roomCode').textContent()).trim();
    const id1=await p1.evaluate(()=>localStorage.getItem('__mock_user'));
    const name2=await p2.evaluate(()=>localStorage.getItem('starship_player_name'));
    await p2.locator('#code').fill(code);
    await p2.locator('#join').click();
    await expect(p2.locator('#lobby')).toBeVisible();
    await expect(p1.locator('#lobbyList')).toContainText(name2.slice(0,16),{timeout:8000});
    const id2=await p2.evaluate(()=>localStorage.getItem('__mock_user'));
    await expect(p1.locator('#start')).toBeEnabled();
    await expect.poll(()=>shared.rooms_v2.get(code)?.$permissions?.includes('update("any")')).toBe(true);

    const memberWrite=await p2.evaluate(async roomId=>{
      try { await window.__mockTest.request('/rows/rooms_v2/'+encodeURIComponent(roomId),'PATCH',{data:{status:'waiting'}}); return true; }
      catch(e) { return false; }
    },code);
    expect(memberWrite).toBe(true);

    const outsiderCannotWritePlayer=await p1.evaluate(async playerId=>{
      try { await window.__mockTest.request('/rows/players_v2/'+encodeURIComponent(playerId),'PATCH',{data:{x:999}}); return false; }
      catch(e) { return /Permission denied/.test(e.message); }
    },id2);
    expect(outsiderCannotWritePlayer).toBe(true);

    await p1.locator('#start').click();
    await expect(p1.locator('#game')).toBeVisible({timeout:16000});
    await expect(p2.locator('#game')).toBeVisible({timeout:16000});
    // Simula una desconexión real: el jugador vuelve con la misma sesión y conserva su posición.
    shared.players_v2.get(id2).x=62.25;
    shared.players_v2.get(id2).y=36.5;
    await p2.reload();
    await expect(p2.locator('#profileGate')).not.toHaveClass(/visible/,{timeout:8000});
    await expect(p2.locator('#connect')).toBeVisible();
    await p2.locator('#code').fill(code);
    await p2.locator('#join').click();
    await expect(p2.locator('#game')).toBeVisible({timeout:10000});
    await expect.poll(()=>p2.evaluate(()=>window.__STARSHIP_TEST__.playerState())).toMatchObject({x:62.25,y:36.5,alive:true});
    const state=JSON.parse(shared.rooms_v2.get(code).settings);
    const crew=Object.values(state.players).filter(p=>p.role==='crew');
    const impostors=Object.values(state.players).filter(p=>p.role==='impostor');
    expect(impostors).toHaveLength(1);
    expect(shared.rooms_v2.get(code).$permissions).toContain('read("any")');
    expect(shared.rooms_v2.get(code).$permissions).toContain('update("any")');
    expect(shared.rooms_v2.get(code).$permissions).toContain('delete("user:'+id1+'")');
    expect(crew).toHaveLength(1);
    expect(crew[0].tasks).toHaveLength(4);

    await p1.evaluate(()=>window.__STARSHIP_TEST__.prepareEmergencyMeeting());
    await p1.evaluate(()=>window.__STARSHIP_TEST__.prepareEmergencyMeeting());
    await p1.locator('#emergency').click();
    await expect(p1.locator('#modal')).toContainText('¿QUIÉN ES EL IMPOSTOR?');
    await expect(p2.locator('#modal')).toContainText('¿QUIÉN ES EL IMPOSTOR?',{timeout:5000});
    await p1.locator('#modal [data-vote="'+id2+'"]').click();
    await p2.locator('#modal [data-vote="'+id1+'"]').click();
    await expect(p1.locator('#modal')).toContainText('RESULTADO DE LA REUNIÓN',{timeout:5000});
    await expect(p1.locator('#modal')).toHaveClass(/hidden/,{timeout:8000});

    p1.once('dialog',dialog=>dialog.accept());
    await p1.locator('#moreBtn').click();
    await p1.locator('#leaveMatchBtn').click();
    await expect.poll(()=>shared.rooms_v2.get(code)?.hostId).toBe(id2);
    await expect.poll(()=>shared.rooms_v2.get(code)?.$permissions?.includes('update("any")')).toBe(true);
    expect(shared.rooms_v2.get(code).$permissions).toContain('delete("user:'+id2+'")');
    const newHostWrite=await p2.evaluate(async roomId=>{try{await window.__mockTest.request('/rows/rooms_v2/'+encodeURIComponent(roomId),'PATCH',{data:{status:'playing'}});return true}catch(e){return false}},code);
    expect(newHostWrite).toBe(true);
  } finally {
    await first.context.close();
    await second.context.close();
  }
});


test('auditoría visual responsive: menú, tienda y hangar en escritorio y móvil', async ({browser}) => {
  test.setTimeout(45000);
  const {context,page}=await openAsGuest(browser);
  try {
    const checkNoHorizontalOverflow=async(label)=>{
      const metrics=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth}));
      expect(metrics.scrollWidth, label+' — overflow horizontal del documento').toBeLessThanOrEqual(metrics.width+1);
      expect(metrics.bodyWidth, label+' — overflow horizontal del body').toBeLessThanOrEqual(metrics.width+1);
    };
    await expect(page.locator('#connect')).toBeVisible();
    await expect(page.locator('#introSplash')).toHaveCount(0,{timeout:5000});
    await page.screenshot({path:'test-results/visual-home-desktop.png',fullPage:true});
    await page.locator('#shopOpen').click();
    await expect(page.locator('#shopScreen')).toBeVisible();
    await expect(page.locator('#shopItems .shop-item').first()).toBeVisible();
    await page.screenshot({path:'test-results/visual-shop-desktop.png',fullPage:true});
    await page.locator('#shopClose').click();
    await page.locator('#customizeOpen').click();
    await expect(page.locator('#customizeScreen')).toBeVisible();
    await expect(page.locator('#previewMate')).toBeVisible();
    await expect(page.locator('#customOptions [data-option]').first()).toBeVisible();
    await page.screenshot({path:'test-results/visual-hangar-desktop.png',fullPage:true});

    await page.setViewportSize({width:844,height:390});
    await page.locator('#customizeClose').click();
    await checkNoHorizontalOverflow('menú móvil apaisado');
    await page.screenshot({path:'test-results/visual-home-mobile-landscape.png',fullPage:true});
    await page.locator('#shopOpen').click();
    await expect(page.locator('#shopScreen')).toBeVisible();
    await checkNoHorizontalOverflow('tienda móvil apaisado');
    await page.screenshot({path:'test-results/visual-shop-mobile-landscape.png',fullPage:true});
    await page.locator('#shopClose').click();
    await page.locator('#customizeOpen').click();
    await expect(page.locator('#customizeScreen')).toBeVisible();
    await checkNoHorizontalOverflow('hangar móvil apaisado');
    await page.screenshot({path:'test-results/visual-hangar-mobile-landscape.png',fullPage:true});

    await page.setViewportSize({width:390,height:844});
    await checkNoHorizontalOverflow('menú móvil vertical');
    await page.screenshot({path:'test-results/visual-mobile-portrait-rotation.png',fullPage:true});
  } finally {
    await context.close();
  }
});



test('controles: mapa grande con M y botones contextuales limitados por proximidad', async ({browser}) => {
  test.setTimeout(30000);
  const {context,page}=await openAsGuest(browser);
  try {
    await page.locator('#explore').click();
    await expect(page.locator('#game')).toBeVisible();
    const map=page.locator('#mapPanel');
    await expect(map).toHaveClass(/hidden/);
    await page.keyboard.press('m');
    await expect(map).not.toHaveClass(/hidden/);
    const box=await map.boundingBox();
    expect(box.width).toBeGreaterThan(0.9*1280);
    expect(box.height).toBeGreaterThan(0.9*720);
    const mapStyle=await map.evaluate(el=>({background:getComputedStyle(el).backgroundColor}));
    expect(mapStyle.background.startsWith('rgba(')).toBe(true);
    await page.keyboard.press('m');
    await expect(map).toHaveClass(/hidden/);
    const availability=await page.evaluate(()=>window.__STARSHIP_TEST__.actionAvailability());
    expect(availability).toEqual({task:false,report:false,meeting:false});
    await page.evaluate(()=>window.__STARSHIP_TEST__.prepareTask('card'));
    await expect(page.locator('#interact')).toBeEnabled();
    await page.keyboard.press('e');
    await expect(page.locator('#modal')).not.toHaveClass(/hidden/);
    await page.locator('#cancelTask').click();
    await page.evaluate(()=>window.__STARSHIP_TEST__.prepareReportBody());
    await expect(page.locator('#report')).toBeEnabled();
    await page.evaluate(()=>window.__STARSHIP_TEST__.prepareSosButton());
    await expect(page.locator('#emergency')).toBeEnabled();
  } finally { await context.close(); }
});

test('renderer del mapa: Canvas 2D dibuja las salas y pasillos sin excepciones', async ({browser}) => {
  test.setTimeout(30000);
  const {context,page}=await openAsGuest(browser);
  const drawErrors=[];
  page.on('pageerror',error=>drawErrors.push(error.message));
  page.on('console',message=>{
    if(message.type()==='error') drawErrors.push(message.text());
  });
  try {
    await page.locator('#explore').click();
    await expect(page.locator('#game')).toBeVisible();
    await page.waitForTimeout(1200);
    const render=await page.locator('#world').evaluate(canvas=>{
      const ctx=canvas.getContext('2d');
      if(!ctx)return {hasContext:false,width:canvas.width,height:canvas.height,colors:0};
      const {width,height}=canvas;
      const data=ctx.getImageData(0,0,width,height).data;
      const seen=new Set();
      const stride=Math.max(4,Math.floor((width*height)/18000))*4;
      for(let i=0;i<data.length;i+=stride){
        if(data[i+3]>0)seen.add((data[i]<<16)|(data[i+1]<<8)|data[i+2]);
      }
      return {hasContext:true,width,height,colors:seen.size};
    });
    expect(render.hasContext).toBe(true);
    expect(render.width).toBeGreaterThan(100);
    expect(render.height).toBeGreaterThan(100);
    expect(render.colors, 'el mapa debe tener variedad cromática real, no un canvas vacío').toBeGreaterThan(24);
    expect(drawErrors, 'el render del mapa no debe lanzar errores JavaScript ni errores de Canvas').toEqual([]);
    const spawn=await page.evaluate(()=>{
      const p=window.__STARSHIP_TEST__.playerState();
      return {player:p,walkable:!!p&&window.__STARSHIP_TEST__.collisionProbe(p.x,p.y).walkable};
    });
    expect(spawn.player, 'Explorar debe crear el monguito local').not.toBeNull();
    expect(spawn.walkable, 'la posición inicial debe permitir caminar').toBe(true);
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(450);
    await page.keyboard.up('ArrowRight');
    const moved=await page.evaluate(()=>window.__STARSHIP_TEST__.playerState());
    expect(moved.x, 'el monguito debe responder al teclado y desplazarse').toBeGreaterThan(spawn.player.x+.15);
  } finally {
    await context.close();
  }
});

test('gameplay: la interacción abre y completa los cinco tipos de minijuego con IDs de tarea online', async ({browser}) => {
  test.setTimeout(90000);
  const {context,page}=await openAsGuest(browser);
  try {
    await page.locator('#explore').click();
    await expect(page.locator('#game')).toBeVisible();
    const types=['card','wires','route','filter','sequence'];
    for (const type of types) {
      const taskId=await page.evaluate(type=>window.__STARSHIP_TEST__.prepareTask(type),type);
      await page.locator('#interact').click();
      await expect(page.locator('#modal')).not.toHaveClass(/hidden/);
      if(type==='wires') {
        for(let i=0;i<4;i++)await page.locator('#modal [data-wire]').nth(i).click();
      } else if(type==='route') {
        for(const i of [0,1,2,5,8])await page.locator('#modal [data-route="'+i+'"]').click();
      } else if(type==='filter') {
        for(let i=0;i<6;i++)await page.locator('#modal [data-debris]').first().click();
      } else if(type==='sequence') {
        for(let stage=0;stage<3;stage++) {
          let synced=false;
          for(let attempt=0;attempt<55&&!synced;attempt++) {
            await page.locator('#modal #cal'+stage).click();
            synced=(await page.locator('#modal #calState'+stage).textContent()).includes('SINCRONIZADO');
            if(!synced)await page.waitForTimeout(35);
          }
          expect(synced,'El módulo '+stage+' debe sincronizarse dentro del rango verde').toBe(true);
        }
      } else if(type==='card') {
        await page.evaluate(async()=>{
          const card=document.querySelector('#modal #idCard');
          const startX=card.getBoundingClientRect().left+card.getBoundingClientRect().width/2;
          const startY=card.getBoundingClientRect().top+card.getBoundingClientRect().height/2;
          // Dispatch the same pointer sequence while preserving the minigame's timed swipe window.
          card.setPointerCapture=()=>{};
          card.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,clientX:startX,clientY:startY}));
          await new Promise(resolve=>setTimeout(resolve,500));
          card.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:1,clientX:startX+45,clientY:startY}));
          card.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1,clientX:startX+45,clientY:startY}));
        });
      }
      await expect(page.locator('#modal')).toHaveClass(/hidden/,{timeout:7000});
      await expect.poll(()=>page.evaluate(id=>window.__STARSHIP_TEST__.taskDone(id),taskId)).toBe(true);
    }
  } finally {
    await context.close();
  }
});


test('gameplay: geometría sin solapamientos, mobiliario sólido, red de conductos conectada y visión por luz', async ({browser}) => {
  test.setTimeout(45000);
  const {context,page}=await openAsGuest(browser);
  try {
    await page.locator('#explore').click();
    await expect(page.locator('#game')).toBeVisible();
    const audit=await page.evaluate(()=>window.__STARSHIP_TEST__.geometryAudit());
    expect(audit).toMatchObject({rooms:16,corridors:11,vents:14,roomOverlaps:[]});
    expect(audit.obstacles).toBeGreaterThan(30);
    const table=await page.evaluate(()=>window.__STARSHIP_TEST__.collisionProbe(52,29.6));
    expect(table).toMatchObject({walkable:false,furniture:true});
    // Las sillas del comedor también son sólidos independientes de las mesas.
    const chair=await page.evaluate(()=>window.__STARSHIP_TEST__.collisionProbe(50.64,28.42));
    expect(chair).toMatchObject({walkable:false,furniture:true});
    const doors=await page.evaluate(()=>window.__STARSHIP_TEST__.doorAccessAudit());
    expect(doors.tested).toBeGreaterThanOrEqual(32);
    expect(doors.blocked).toEqual([]);
    const floor=await page.evaluate(()=>window.__STARSHIP_TEST__.collisionProbe(60,40));
    expect(floor).toMatchObject({walkable:true,furniture:false});
    const network=await page.evaluate(()=>window.__STARSHIP_TEST__.ventNetwork());
    expect(network).toHaveLength(14);
    const ids=new Set(network.map(v=>v.id));
    for(const vent of network)for(const link of vent.links){
      expect(ids.has(link)).toBe(true);
      expect(network.find(v=>v.id===link).links).toContain(vent.id);
    }
    const reachable=new Set([network[0].id]),queue=[network[0].id];
    while(queue.length){const id=queue.shift();for(const link of network.find(v=>v.id===id).links)if(!reachable.has(link)){reachable.add(link);queue.push(link)}}
    expect(reachable.size).toBe(14);
    const first=await page.evaluate(()=>window.__STARSHIP_TEST__.prepareVent('v1'));
    await page.locator('#vent').click();
    await expect.poll(()=>page.evaluate(()=>window.__STARSHIP_TEST__.ventPlayerState())).toMatchObject({inVent:true,ventId:'v1'});
    await page.locator('#vent').click();
    await expect(page.locator('#modal')).toContainText('CONDUCTOS DE SERVICIO');
    await expect(page.locator('#modal')).toContainText('REACTOR');
    await page.locator('#modal [data-exit="v2"]').click();
    await expect.poll(()=>page.evaluate(()=>window.__STARSHIP_TEST__.ventPlayerState())).toMatchObject({inVent:false,ventId:null});
    const lighting=await page.evaluate(()=>({hasLayer:!!window.__starshipLightLayer,code:document.documentElement.innerHTML.includes('visionRadius')}));
    expect(lighting.code).toBe(true);
    const shadowGeometry=await page.evaluate(()=>window.__STARSHIP_TEST__.shadowGeometryAudit());
    expect(shadowGeometry.corridorSegments).toBeGreaterThan(20);
    expect(shadowGeometry.roomLeaks).toBe(0);
    expect(shadowGeometry.junctionLeaks).toBe(0);
    // Comprobar que la visión y las sombras siguen funcionando en una salida de sala y en un cruce.
    const doorShadows=await page.evaluate(()=>window.__STARSHIP_TEST__.shadowProbe(60,22.5,11.9));
    const junctionShadows=await page.evaluate(()=>window.__STARSHIP_TEST__.shadowProbe(10,21,11.9));
    expect(doorShadows.occludedRays).toBeGreaterThan(0);
    expect(junctionShadows.occludedRays).toBeGreaterThan(0);
    const shadows=await page.evaluate(()=>window.__STARSHIP_TEST__.shadowProbe(55,42,11.9));
    expect(shadows.segments).toBeGreaterThan(100);
    expect(shadows.points).toBeGreaterThan(48);
    expect(shadows.occludedRays).toBeGreaterThan(0);
  } finally {
    await context.close();
  }
});

test('sabotajes: las cinco reparaciones funcionan y los críticos provocan derrota al agotar el tiempo', async ({browser}) => {
  test.setTimeout(90000);
  const {context,page}=await openAsGuest(browser);
  try {
    await page.locator('#explore').click();
    await expect(page.locator('#game')).toBeVisible();
    const repairs=['lights','reactor','comms','o2','doors'];
    for(const sabotage of repairs){
      const type=await page.evaluate(s=>window.__STARSHIP_TEST__.prepareRepair(s),sabotage);
      if(sabotage==='comms'){
        await page.evaluate(()=>window.__STARSHIP_TEST__.prepareTask('wires'));
        await page.evaluate(()=>window.__STARSHIP_TEST__.tryStartTask());
        await expect(page.locator('#modal')).toHaveClass(/hidden/);
        await expect(page.locator('#taskText')).toContainText('COMUNICACIONES INTERFERIDAS');
        await page.evaluate(()=>window.__STARSHIP_TEST__.prepareRepair('comms'));
      }
      await page.locator('#interact').click();
      await expect(page.locator('#modal')).not.toHaveClass(/hidden/);
      if(type==='wires'){
        for(let i=0;i<4;i++)await page.locator('#modal [data-wire]').nth(i).click();
      }else if(type==='filter'){
        for(let i=0;i<6;i++)await page.locator('#modal [data-debris]').first().click();
      }else if(type==='card'){
        await page.evaluate(async()=>{
          const card=document.querySelector('#modal #idCard');
          const r=card.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;
          card.setPointerCapture=()=>{};
          card.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:2,clientX:x,clientY:y}));
          await new Promise(resolve=>setTimeout(resolve,500));
          card.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:2,clientX:x+45,clientY:y}));
          card.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:2,clientX:x+45,clientY:y}));
        });
      }else if(type==='sequence'){
        for(let stage=0;stage<3;stage++){
          let synced=false;
          for(let attempt=0;attempt<55&&!synced;attempt++){
            await page.locator('#modal #cal'+stage).click();
            synced=(await page.locator('#modal #calState'+stage).textContent()).includes('SINCRONIZADO');
            if(!synced)await page.waitForTimeout(35);
          }
          expect(synced,'Reparación de reactor: módulo '+stage).toBe(true);
        }
      }
      await expect(page.locator('#modal')).toHaveClass(/hidden/,{timeout:7000});
      await expect.poll(()=>page.evaluate(()=>window.__STARSHIP_TEST__.sabotageActive())).toBe(false);
    }
    const doors=await page.evaluate(()=>window.__STARSHIP_TEST__.expireSabotage('doors'));
    expect(doors).toMatchObject({phase:'playing',active:false});
    for(const type of ['reactor','o2']){
      const expired=await page.evaluate(t=>window.__STARSHIP_TEST__.expireSabotage(t),type);
      expect(expired).toMatchObject({phase:'ended',winner:'impostor',active:false});
    }
  } finally {
    await context.close();
  }
});
