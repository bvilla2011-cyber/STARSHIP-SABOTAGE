import {createRequire} from 'node:module';
import {randomInt} from 'node:crypto';
const require=createRequire(import.meta.url);
const Core=require('./core.cjs');
const DB='starship_db',ROOMS='rooms_v4',PROFILES='profiles_v4';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const q=(method,attribute,values)=>JSON.stringify({method,...(attribute?{attribute}:{}),...(values?{values}: {})});

// No administrative credential is shipped to the client. Appwrite injects a
// narrowly scoped dynamic API key for each authenticated function execution.
export default async function main({req,res,error}){
 const endpoint=process.env.APPWRITE_FUNCTION_API_ENDPOINT||'https://fra.cloud.appwrite.io/v1';
 const project=process.env.APPWRITE_FUNCTION_PROJECT_ID||'6af106fb00396755a6fb';
 const key=req.headers['x-appwrite-key']||process.env.APPWRITE_API_KEY;
 const jwt=req.headers['x-appwrite-user-jwt'];
 const api=async(path,method='GET',body,user=false)=>{
  const response=await fetch(endpoint+path,{method,headers:{'Content-Type':'application/json','X-Appwrite-Project':project,...(user?{'X-Appwrite-JWT':jwt}:{'X-Appwrite-Key':key})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
  const data=response.status===204?{}:await response.json();
  if(!response.ok)throw Object.assign(new Error(data.message||'Appwrite request failed'),{status:response.status,type:data.type});return data;
 };
 const rowPath=(table,rid)=>'/tablesdb/'+DB+'/tables/'+table+'/rows/'+encodeURIComponent(rid);
 const read=async(table,rid,tx)=>api(rowPath(table,rid)+(tx?'?transactionId='+tx:''));
 const create=async(table,rid,data,tx)=>api('/tablesdb/'+DB+'/tables/'+table+'/rows','POST',{rowId:rid,data,permissions:[],...(tx?{transactionId:tx}:{})});
 const write=async(table,rid,data,tx)=>api(rowPath(table,rid),'PATCH',{data,...(tx?{transactionId:tx}:{})});
 const transaction=async(table,rid,callback)=>{
  for(let attempt=0;attempt<6;attempt++){
   const tx=await api('/tablesdb/transactions','POST',{ttl:60});
   try{
    // Stage a write before reading to establish a conflict baseline. The read
    // sees staged writes, and a changed row makes commit fail with HTTP 409.
    await write(table,rid,{version:Date.now()},tx.$id);
    const row=await read(table,rid,tx.$id),value=JSON.parse(row.payload);
    const result=await callback(value,tx.$id);
    await write(table,rid,{payload:JSON.stringify(value)},tx.$id);
    await api('/tablesdb/transactions/'+tx.$id,'PATCH',{commit:true});return result;
   }catch(e){await api('/tablesdb/transactions/'+tx.$id,'PATCH',{rollback:true}).catch(()=>{});if(e.status===409&&attempt<5){await pause(randomInt(15,70)*(attempt+1));continue;}throw e;}
  }
 };
 try{
  Core.assert(jwt,'Inicia sesión para continuar.',401);
  const user=await api('/account','GET',undefined,true),uid=user.$id;
  const body=typeof req.bodyJson==='object'&&req.bodyJson?req.bodyJson:JSON.parse(req.body||'{}');
  Core.assert(JSON.stringify(body).length<=10000,'La petición es demasiado grande.',413);
  Core.assert(body.protocolVersion===4,'Actualiza el juego para continuar.',426);
  let profileRow;
  try{profileRow=await read(PROFILES,uid);}catch(e){if(e.status!==404)throw e;const profile=Core.newProfile(uid);
   // Previously verified referral claims have a server audit trail and can be
   // migrated safely. Unverifiable browser balances cannot mint currency.
   const query='?queries[]='+encodeURIComponent(q('equal','userId',[uid]));
   const gifts=await api('/tablesdb/'+DB+'/tables/gift_claims/rows'+query).catch(()=>({rows:[]}));
   if(gifts.rows?.some(g=>g.campaign==='BVILLA3000')){profile.coins=3000;profile.giftClaimed=true;profile.history.push({id:'BVILLA3000',amount:3000,reason:'verified_gift',at:Date.now()});}
   try{profileRow=await create(PROFILES,uid,{payload:JSON.stringify(profile),version:1});}catch(createError){if(createError.status!==409)throw createError;profileRow=await read(PROFILES,uid);}
  }
  let profile=JSON.parse(profileRow.payload);const now=Date.now();
  const profileView=()=>({coins:profile.coins,owned:profile.owned,loadout:profile.loadout,equipped:profile.loadout.arriba,history:profile.history});
  const appearance={name:String(body.name||user.name||'Tripulante').slice(0,16),color:body.color,loadout:profile.loadout};
  if(body.action==='health')return res.json({ok:true,version:'4.0.0',serverTime:now});
  if(body.action==='profile')return res.json({ok:true,profile:profileView(),shop:Core.Rules.daily(now),serverTime:now});
  if(body.action==='buy'||body.action==='equip'){
   await transaction(PROFILES,uid,async p=>{if(body.action==='buy')Core.buy(p,body.itemId,now);else Core.equip(p,body.loadout||{});profile=p;});
   return res.json({ok:true,profile:profileView(),serverTime:now});
  }
  if(body.action==='public_rooms'){
   const params=new URLSearchParams();params.append('queries[]',q('equal','privacy',['public']));params.append('queries[]',q('equal','phase',['lobby']));params.append('queries[]',q('limit',null,[30]));
   const listed=await api('/tablesdb/'+DB+'/tables/'+ROOMS+'/rows?'+params);
   const rooms=(listed.rows||[]).map(r=>JSON.parse(r.payload)).filter(r=>now-r.updatedAt<90000).map(r=>({code:r.code,count:Object.values(r.players).filter(p=>!p.left&&now-p.lastSeen<25000).length,maxPlayers:r.settings.maxPlayers,host:r.players[r.hostId]?.name}));
   return res.json({ok:true,rooms,serverTime:now});
  }
  if(body.action==='create'){
   let room;
   await transaction(PROFILES,uid,async(p,tx)=>{
    const active=p.activeRoom;
    if(active){const existing=await read(ROOMS,active).catch(()=>null);if(existing){const r=JSON.parse(existing.payload),player=r.players[uid];Core.assert(!player||player.left||r.phase==='ended'||now-r.updatedAt>=120000,'Ya tienes una sala activa. Vuelve a entrar con el código '+active);}}
    const code=Array.from({length:6},()=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');
    room=Core.createRoom(code,uid,appearance,body.settings,now);
    await create(ROOMS,code,{payload:JSON.stringify(room),version:1,privacy:room.settings.privacy,phase:room.phase},tx);
    p.activeRoom=code;profile=p;
   });
   return res.json({ok:true,state:Core.snapshot(room,uid,now),profile:profileView(),serverTime:now});
  }
  const code=String(body.code||'').toUpperCase();Core.assert(/^[A-Z0-9]{6}$/.test(code),'Introduce un código de 6 caracteres.');
  let finalState,result;
  await transaction(ROOMS,code,async(room,tx)=>{
   const currentNow=Date.now();
   if(body.action==='join'){await write(PROFILES,uid,{version:currentNow},tx);profile=JSON.parse((await read(PROFILES,uid,tx)).payload);}
   if(body.action==='join'&&profile.activeRoom&&profile.activeRoom!==code){const old=await read(ROOMS,profile.activeRoom).catch(()=>null);if(old){const r=JSON.parse(old.payload);Core.assert(!r.players[uid]||r.players[uid].left||r.phase==='ended'||currentNow-r.updatedAt>120000,'Tu cuenta está conectada a otra sala.');}}
   result=Core.action(room,uid,{...body,profile:appearance},currentNow);
   // Room rewards and wallet changes are committed in the same transaction.
   const earned=room.rewards[uid]||0,paid=room.paid[uid]||0;
   if(earned>paid||['join','leave'].includes(body.action)){
    await write(PROFILES,uid,{version:currentNow},tx);
    profile=JSON.parse((await read(PROFILES,uid,tx)).payload);
    if(earned>paid){const day=Math.floor(currentNow/86400000);if(profile.daily.day!==day)profile.daily={day,earned:0};const amount=Math.min(earned-paid,Math.max(0,500-profile.daily.earned));profile.coins+=amount;profile.daily.earned+=amount;profile.history.push({id:room.code+':'+earned,amount,reason:'match_rewards',at:currentNow});profile.history=profile.history.slice(-120);room.paid[uid]=earned;}
    profile.activeRoom=body.action==='leave'?'':code;await write(PROFILES,uid,{payload:JSON.stringify(profile)},tx);
   }
   await write(ROOMS,code,{phase:room.phase,privacy:room.settings.privacy},tx);
   if(body.action!=='leave')finalState=Core.snapshot(room,uid,currentNow);
  });
  return res.json({ok:true,state:finalState,...result,profile:profileView(),serverTime:Date.now()});
 }catch(e){if((e.status||500)>=500)error('Authority failed: '+e.message);return res.json({ok:false,message:e.status&&e.status<500?e.message:'El servidor no ha podido completar la acción. Inténtalo de nuevo.',type:e.type||'game_error'},e.status||500);}
}
