/* STARSHIP SABOTAGE — EVENT ANIMATION DIRECTOR
   All scenes are visual-only and non-interactive: no backend writes, game rules, or timers altered. */
(function(){
'use strict';
let layer=null,stopTimer=0,lastKey='',lastTime=0;const meetingSeen=new Set();
const ESC=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const visual=()=>window.StarshipVisual;
function layerNode(){
 if(layer?.isConnected)return layer;
 layer=document.createElement('div');layer.id='starshipCine';layer.hidden=true;
 layer.setAttribute('aria-hidden','true');
 document.body.appendChild(layer);
 return layer;
}
const labelMap={
 kill:['SEÑAL VITAL INTERRUMPIDA','ELIMINACIÓN','CONEXIÓN PERDIDA'],
 sabotage:['PROTOCOLO DE EMERGENCIA','¡SABOTAJE!','SISTEMAS COMPROMETIDOS'],
 report:['ALERTA DE LA TRIPULACIÓN','¡CUERPO REPORTADO!','REUNIENDO A LA TRIPULACIÓN'],
 emergency:['PROTOCOLO DE EMERGENCIA','¡REUNIÓN!','DEBATE ABIERTO'],
 vote:['FASE DE VOTACIÓN','EMITE TU VOTO','LA TRIPULACIÓN DECIDE'],
 eject:['ESCLUSA DE EXPULSIÓN','¡EXPULSADO!','DESTINO: ESPACIO EXTERIOR'],
 skip:['RESULTADO DEL CONSEJO','SIN EXPULSIÓN','NO HAY MAYORÍA'],
 complete:['TERMINAL DE MISIÓN','¡MISIÓN COMPLETADA!','']
};
function avatar(a={},motion='idle',where=''){
 let obj=a&&typeof a==='object'?a:{color:'#e85d75'};
 return '<div class="cine-monguito '+where+'">'+(visual()?.svg(obj,{motion})||'')+'</div>';
}
function close(){
 clearTimeout(stopTimer);stopTimer=0;
 if(layer){layer.hidden=true;layer.innerHTML='';layer.removeAttribute('data-type')}
}
function play(type,opts={}){
 const data=labelMap[type];if(!data||!visual())return;
 if(type==='complete'&&layer&&!layer.hidden&&layer.dataset.type!=='complete')return;
 const key=opts.key||type+':'+Date.now();
 if(key===lastKey&&Date.now()-lastTime<900)return;
 lastKey=key;lastTime=Date.now();
 close();const el=layerNode();el.hidden=false;
 el.dataset.type=type;
 const main=ESC(opts.title||data[1]),sub=ESC(opts.subtitle||data[2]),top=ESC(data[0]);
 const lead=opts.actor||{color:'#e85d75'},target=opts.target||{color:'#57cdeb'};
 const dual=type==='kill';
 const symbol={sabotage:({lights:'⚡',reactor:'☢',comms:'⌁',o2:'O₂',doors:'▣'}[opts.system]||'⚠')};
 el.innerHTML='<div class="cine-scene"><div class="cine-grid"></div><div class="cine-rim"></div>'+
 '<div class="cine-floor"></div><div class="cine-ring"></div>'+
 '<div class="cine-kicker">'+top+'</div><div class="cine-title">'+main+'</div>'+
 (type==='sabotage'?'<div class="cine-symbol">'+(symbol.sabotage||'⚠')+'</div>':'')+
 (dual?avatar(lead,'walk','cine-actor')+avatar(target,'defeat','cine-target')+'<i class="cine-slash"></i>':
 (type==='complete'||type==='skip'?'':avatar(opts.target||lead,type==='eject'?'defeat':type==='vote'?'idle':'walk'))) +
 '<div class="cine-bottom">'+sub+'</div></div>';
 const duration=type==='eject'?2600:type==='kill'?1470:type==='sabotage'?1480:type==='report'?1250:type==='emergency'?1040:type==='vote'?1050:type==='skip'?900:type==='complete'?1030:1200;
 stopTimer=setTimeout(close,duration);
}
function meeting(m,getPlayer){
 if(!m)return;
 const stage=(m.status||'discussion'),key=m.id+':'+stage;
 if(meetingSeen.has(key))return;
 meetingSeen.add(key);
 if(meetingSeen.size>55){const first=meetingSeen.values().next().value;meetingSeen.delete(first)}
 if(stage==='discussion'){
  const actor=getPlayer?.(m.reporterId);
  play(m.isReport?'report':'emergency',{actor,title:m.isReport?'¡CUERPO REPORTADO!':'¡REUNIÓN DE EMERGENCIA!',key});
 }else if(stage==='voting')play('vote',{title:'HORA DE VOTAR',key});
 else if(stage==='resolved'){
  const victim=m.result?.targetId&&getPlayer?.(m.result.targetId);
  if(victim)play('eject',{target:victim,title:'¡JUGADOR EXPULSADO!',subtitle:ESC(victim.name||'EXPULSADO')+(typeof m.result?.targetWasImpostor==='boolean'?' · '+(m.result.targetWasImpostor?'IMPOSTOR':'TRIPULANTE'):''),key});
  else play('skip',{key});
 }
}
function taskOpen(type){
 const modal=document.getElementById('modal');
 if(!modal)return;modal.dataset.task=String(type||'terminal');delete modal.dataset.pulse;
 const board=modal.querySelector('#taskBoard');
 if(board&&!board.dataset.monguitoSfx){
  board.dataset.monguitoSfx='1';
  board.addEventListener('pointerdown',()=>{modal.dataset.pulse='1';setTimeout(()=>{if(modal.dataset.task)delete modal.dataset.pulse},260)},{passive:true});
 }
}
function taskComplete(type){play('complete',{title:'¡MISIÓN COMPLETADA!',subtitle:'SISTEMA CONFIRMADO · '+ESC(type||'MISIÓN')})}
function role(isImpostor){
 const root=document.getElementById('roleReveal');if(!root)return;
 root.dataset.alignment=isImpostor?'impostor':'crew';
 // The existing role reveal remains visible; title and team are animated by CSS.
 root.querySelectorAll('.role-card-avatar .monguito-svg').forEach((node,i)=>node.style.setProperty('--draw-delay',i*.13+'s'));
}
function result(win,person={}){
 const root=document.getElementById('end'),panel=root?.querySelector('.victory-panel');if(!panel||!visual())return;
 root.dataset.outcome=win?'win':'lose';
 let wrap=panel.querySelector('.universal-outcome');
 if(!wrap){wrap=document.createElement('div');wrap.className='universal-outcome';const icon=panel.querySelector('.victory-emblem');if(icon)icon.insertAdjacentElement('afterend',wrap);else panel.prepend(wrap)}
 wrap.innerHTML=visual().svg(person,{motion:win?'celebrate':'defeat',className:'outcome-avatar'});
}
window.StarshipCinematics={play,close,meeting,taskOpen,taskComplete,role,result,version:'2.0'};
})();
