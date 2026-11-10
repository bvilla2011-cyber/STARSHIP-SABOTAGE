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
  const Role = { any:()=> 'any', user:id=>'user:'+id };
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
    if (method === 'GET') { if (!(row.$permissions||[]).includes('read("any")') && !(row.$permissions||[]).includes('read("user:'+user+'")')) return send(403,{message:'Read permission denied'}); return send(200,row); }
    const action=method==='PATCH'?'update':'delete';
    if (!(row.$permissions||[]).includes(action+'("user:'+user+'")')) return send(403,{message:'Permission denied'});
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
    await expect.poll(()=>shared.rooms_v2.get(code)?.$permissions?.includes('update("user:'+id2+'")')).toBe(true);

    const memberWrite=await p2.evaluate(async roomId=>{
      try { await window.__mockTest.request('/rows/rooms_v2/'+encodeURIComponent(roomId),'PATCH',{data:{status:'waiting'}}); return true; }
      catch(e) { return false; }
    },code);
    expect(memberWrite).toBe(true);

    const denied=await p2.evaluate(async roomId=>{
      const member=localStorage.getItem('__mock_user');
      localStorage.setItem('__mock_user','usr_outsider');
      try { await window.__mockTest.request('/rows/rooms_v2/'+encodeURIComponent(roomId),'PATCH',{data:{status:'hacked'}}); return false; }
      catch(e) { return /Permission denied/.test(e.message); }
      finally { localStorage.setItem('__mock_user',member); }
    },code);
    expect(denied).toBe(true);

    await p1.locator('#start').click();
    await expect(p1.locator('#game')).toBeVisible({timeout:16000});
    await expect(p2.locator('#game')).toBeVisible({timeout:16000});
    const state=JSON.parse(shared.rooms_v2.get(code).settings);
    const crew=Object.values(state.players).filter(p=>p.role==='crew');
    const impostors=Object.values(state.players).filter(p=>p.role==='impostor');
    expect(impostors).toHaveLength(1);
    expect(shared.rooms_v2.get(code).$permissions).not.toContain('read("any")');
    expect(shared.rooms_v2.get(code).$permissions).toContain('read("user:'+id1+'")');
    expect(shared.rooms_v2.get(code).$permissions).toContain('read("user:'+id2+'")');
    expect(crew).toHaveLength(1);
    expect(crew[0].tasks).toHaveLength(4);

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
    await expect.poll(()=>shared.rooms_v2.get(code)?.$permissions?.includes('update("user:'+id2+'")')).toBe(true);
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


test('gameplay: la interacción abre y completa los cinco tipos de minijuego con IDs de tarea online', async ({browser}) => {
  test.setTimeout(90000);
  const {context,page}=await openAsGuest(browser);
  try {
    await page.locator('#explore').click();
    await expect(page.locator('#game')).toBeVisible();
    const types=['card','wires','route','filter','calibrate'];
    for (const type of types) {
      const taskId=await page.evaluate(type=>{
        const station=MAP.tasks.find(t=>t.type===type);
        if(!station)throw new Error('No hay estación del tipo '+type);
        const p=gameState.players[playerId];
        const id=station.id+'_online_assignment';
        p.tasks=[{id,name:station.name,room:station.room,stationId:station.id}];
        p.done=[];
        p.x=station.x;p.y=station.y;
        gameState.required=999;
        return id;
      },type);
      await page.locator('#interact').click();
      await expect(page.locator('#modal')).not.toHaveClass(/hidden/);
      if(type==='wires') {
        for(let i=0;i<4;i++)await page.locator('#modal [data-wire]').nth(i).click();
      } else if(type==='route') {
        for(const i of [0,1,2,5,8])await page.locator('#modal [data-route="'+i+'"]').click();
      } else if(type==='filter') {
        for(let i=0;i<6;i++)await page.locator('#modal [data-debris]').first().click();
      } else if(type==='calibrate') {
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
        const card=page.locator('#modal #idCard');
        const b=await card.boundingBox();
        await page.mouse.move(b.x+b.width/2,b.y+b.height/2);
        await page.mouse.down();
        await page.waitForTimeout(500);
        await page.mouse.move(b.x+b.width/2+45,b.y+b.height/2,{steps:4});
        await page.mouse.up();
      }
      await expect(page.locator('#modal')).toHaveClass(/hidden/,{timeout:7000});
      await expect.poll(()=>page.evaluate(id=>gameState.players[playerId].done.includes(id),taskId)).toBe(true);
    }
  } finally {
    await context.close();
  }
});
