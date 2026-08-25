(() => {
'use strict';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const canvas = $('#gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const bg = new Image();
bg.src = 'assets/hallway.jpg';
const stageBgs = [new Image()]; stageBgs[0].src='assets/stage1.jpg';
const logoIcon = new Image(); logoIcon.src = 'assets/icon-192.png';

const UI = {
  menu: $('#menu'), help: $('#helpPanel'), pause: $('#pausePanel'), stage: $('#stagePanel'), over: $('#gameOverPanel'), victory: $('#victoryPanel'), hud: $('#hud'),
  healthText: $('#healthText'), healthFill: $('#healthFill'), stageName: $('#stageName'), cleanText: $('#cleanText'), cleanFill: $('#cleanFill'), score: $('#scoreText'), enemy: $('#enemyText'),
  bossBar: $('#bossBar'), bossName: $('#bossName'), bossHp: $('#bossHpText'), bossFill: $('#bossFill'), combo: $('#comboBadge'), toast: $('#eventToast'), damage: $('#damageVignette'),
  weaponIcon: $('#weaponIcon'), weaponName: $('#weaponName'), weaponStatus: $('#weaponStatus'), diffBadge: $('#difficultyBadge'), brandComboText: $('#brandComboText'), supportList: $('#supportList'), mobileSupportStrip: $('#mobileSupportStrip')
};

const STAGES = [
  {name:'KHOA PHỤ SẢN', tint:'rgba(62,160,160,.02)', quota:16, spawn:.92, boss:'THAI BÀO ĐỘT BIẾN', bossHp:30, mix:['basic','flagella','breather','wall']},
  {name:'KHU XÉT NGHIỆM', tint:'rgba(100,220,230,.05)', quota:21, spawn:.80, boss:'CHÚA TỂ BÀO TỬ', bossHp:40, mix:['breather','spore','shield','spitter']},
  {name:'KHU CẤP CỨU', tint:'rgba(255,89,89,.04)', quota:25, spawn:.72, boss:'VI KHUẨN XUNG KÍCH', bossHp:50, mix:['charger','spitter','cluster','flyer']},
  {name:'KHU CÁCH LY', tint:'rgba(123,96,205,.065)', quota:29, spawn:.66, boss:'DỊ CHỦNG CÁCH LY', bossHp:62, mix:['elite','wall','cluster','nucleus']},
  {name:'KHU VÔ TRÙNG', tint:'rgba(150,240,235,.05)', quota:33, spawn:.60, boss:'LÕI KHÁNG HUYẾT THANH', bossHp:78, mix:['shield','nucleus','elite','flyer','spitter']},
  {name:'TRUNG TÂM NGUỒN BỆNH', tint:'rgba(255,55,111,.055)', quota:40, spawn:.52, boss:'NGUỒN BỆNH TỐI THƯỢNG', bossHp:110, mix:['elite','nucleus','cluster','charger','flyer','spitter'], final:true},
];

const WEAPONS = [
  {name:'Súng thuốc viên', icon:'💊', cooldown:170, damage:1.15, status:'Đạn vô hạn', kind:'shot'},
  {name:'Kim tiêm xuyên lõi', icon:'💉', cooldown:470, damage:3.1, status:'Sát thương cao', kind:'pierce'},
  {name:'Bình xịt khử khuẩn', icon:'🧴', cooldown:80, damage:.48, status:'Tầm gần · diện rộng', kind:'spray'},
  {name:'Bom vitamin', icon:'🟠', cooldown:850, damage:5.5, status:'3 quả / khu', kind:'bomb'},
  {name:'Tia miễn dịch', icon:'⚡', cooldown:85, damage:.55, status:'Năng lượng 100%', kind:'beam'},
];

const ENEMY = {
  basic:{hp:2.1,speed:.095,rad:28,color:'#69d6b2',score:100,attack:.8},
  flagella:{hp:2.4,speed:.105,rad:25,color:'#76b6d7',score:120,attack:.85,sway:1.3},
  breather:{hp:3.3,speed:.085,rad:30,color:'#aa8ddd',score:150,attack:1.0,pulse:1.5},
  wall:{hp:3.2,speed:.11,rad:24,color:'#f0a86f',score:180,attack:1.0,wall:true,sway:2.1},
  spitter:{hp:3.8,speed:.105,rad:28,color:'#d47bb9',score:220,attack:1.0,sway:1.9},
  spore:{hp:1.8,speed:.13,rad:18,color:'#d7df83',score:160,attack:.65,fly:true},
  shield:{hp:5.8,speed:.072,rad:31,color:'#79c6c8',score:260,attack:1.0,shield:true},
  flyer:{hp:2.4,speed:.13,rad:20,color:'#81d1ff',score:200,attack:.75,fly:true,sway:2.5},
  charger:{hp:4.6,speed:.16,rad:31,color:'#f18a66',score:300,attack:1.25,charge:true},
  cluster:{hp:5.2,speed:.082,rad:34,color:'#a88bdb',score:330,attack:1.1,cluster:true},
  nucleus:{hp:6.4,speed:.075,rad:34,color:'#da6c82',score:380,attack:1.25,core:true},
  elite:{hp:8.2,speed:.086,rad:38,color:'#7c6ac8',score:500,attack:1.5,elite:true,shield:true},
};

const DIFF = {
  easy:{enemyHp:.82, enemySpeed:.85, damage:.75, spawn:1.18},
  normal:{enemyHp:1, enemySpeed:1, damage:1, spawn:1},
  hard:{enemyHp:1.18, enemySpeed:1.12, damage:1.25, spawn:.86},
};

let state = null;
let raf = 0;
let last = performance.now();
let pointer = {x:innerWidth/2,y:innerHeight/2,down:false};
let deferredInstall = null;
let audioEnabled = true;
let audioCtx = null;
let masterGain = null, reverbSend = null, convolver = null, wetGain = null;

function newState(stageIndex=0){
  const cfg = STAGES[stageIndex];
  return {
    mode:'playing', stageIndex, cfg, difficulty: window.__difficulty || 'normal', health:10, maxHealth:10, score: stageIndex===0?0:(state?.score||0),
    enemies:[], particles:[], tracers:[], hitMarkers:[], enemyShots:[], powerups:[], spawnLeft:cfg.quota, bossSpawned:false, bossDefeated:false, spawnTimer:.4,
    contamination:100, kills:0, shots:0, hits:0, combo:0, comboTimer:0, weapon:0, lastFire:0, bombs:3, beam:100,
    shield:0, drone:0, stageElapsed:0, transition:0, zoom:0, shake:0, toastTimer:0, nextPanel:false,
    playerX:0, playerVX:0, moveLeft:false, moveRight:false, mobileMoveAxis:0, lastMoveDir:1,
    dashCooldown:0, dashTimer:0, dashDir:0, dodgeTilt:0, recoil:0, muzzleFlash:0, dodgeMessage:0,
  };
}

function resize(){
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = Math.max(1, innerWidth), h = Math.max(1, innerHeight);
  canvas.width = Math.floor(w*dpr); canvas.height = Math.floor(h*dpr);
  canvas.style.width = w+'px'; canvas.style.height = h+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
addEventListener('resize', resize, {passive:true}); resize();

function ensureAudio(){
  if(!audioEnabled) return null;
  if(!audioCtx){
    audioCtx = new (window.AudioContext||window.webkitAudioContext)();
    masterGain=audioCtx.createGain(); masterGain.gain.value=.82; masterGain.connect(audioCtx.destination);
    convolver=audioCtx.createConvolver();
    const len=Math.floor(audioCtx.sampleRate*.34), impulse=audioCtx.createBuffer(2,len,audioCtx.sampleRate);
    for(let c=0;c<2;c++){const data=impulse.getChannelData(c);for(let i=0;i<len;i++){const decay=Math.pow(1-i/len,2.8);data[i]=(Math.random()*2-1)*decay*.48;}}
    convolver.buffer=impulse; wetGain=audioCtx.createGain();wetGain.gain.value=.16;reverbSend=audioCtx.createGain();reverbSend.gain.value=.20;
    reverbSend.connect(convolver).connect(wetGain).connect(masterGain);
  }
  if(audioCtx.state==='suspended') audioCtx.resume();
  return audioCtx;
}
function connectSfx(node,pan=0,wet=.16){
  const a=ensureAudio(); if(!a)return null; let out=node;
  if(a.createStereoPanner){const p=a.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,pan));node.connect(p);out=p;}
  out.connect(masterGain); if(wet>0){const send=a.createGain();send.gain.value=wet;out.connect(send).connect(reverbSend);} return out;
}
function tone(freq=440,dur=.06,type='sine',gain=.05,slide=0,pan=0,wet=.12){
  const a=ensureAudio(); if(!a) return;
  const o=a.createOscillator(), g=a.createGain(); o.type=type; o.frequency.setValueAtTime(freq,a.currentTime); if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(40,freq+slide),a.currentTime+dur);
  g.gain.setValueAtTime(gain,a.currentTime); g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+dur); o.connect(g);connectSfx(g,pan,wet);o.start();o.stop(a.currentTime+dur);
}
function noiseBurst(dur=.04,gain=.025,filterFreq=1800,pan=0,wet=.10){
  const a=ensureAudio();if(!a)return;const n=Math.max(64,Math.floor(a.sampleRate*dur)),buf=a.createBuffer(1,n,a.sampleRate),d=buf.getChannelData(0);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,1.8);
  const src=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain();src.buffer=buf;f.type='bandpass';f.frequency.value=filterFreq;f.Q.value=.8;g.gain.value=gain;src.connect(f).connect(g);connectSfx(g,pan,wet);src.start();
}
function panForX(x){return Math.max(-.8,Math.min(.8,(x/Math.max(1,innerWidth)-.5)*1.6));}
function comboPitch(){return 1+Math.min(.16,(state?.combo||0)*.006);}
const sfx={
  weapon:(kind,x)=>{const p=comboPitch(),pan=panForX(x);if(kind==='pierce'){tone(980*p,.055,'triangle',.035,-360,pan,.12);tone(1900*p,.018,'sine',.013,-500,pan,.08);noiseBurst(.025,.018,2600,pan,.08)}else if(kind==='spray'){noiseBurst(.075,.026,1250,pan,.13);tone(330*p,.055,'sine',.012,-80,pan,.10)}else if(kind==='bomb'){tone(125,.18,'sawtooth',.05,-70,pan,.18);noiseBurst(.09,.035,520,pan,.18)}else if(kind==='beam'){tone(720*p,.055,'sine',.018,120,pan,.18);tone(1440*p,.035,'triangle',.008,-180,pan,.12)}else{tone(560*p,.035,'square',.025,-145,pan,.11);tone(1080*p,.018,'sine',.010,-260,pan,.08);noiseBurst(.025,.012,1750,pan,.08)}},
  hit:(x)=>{const pan=panForX(x);tone(215,.03,'sine',.022,75,pan,.09);noiseBurst(.022,.012,950,pan,.07)},
  crit:(x)=>{const pan=panForX(x);tone(980,.055,'triangle',.028,310,pan,.12);setTimeout(()=>tone(1360,.06,'sine',.022,250,pan,.12),28)},
  kill:(x=innerWidth/2)=>{const pan=panForX(x);tone(620,.075,'triangle',.032,280,pan,.12);tone(310,.06,'sine',.015,160,pan,.10)},
  hurt:()=>{tone(95,.16,'sawtooth',.042,-30,0,.16);noiseBurst(.06,.022,430,0,.14)},
  dodge:()=>{tone(430,.055,'sine',.022,260,0,.10);noiseBurst(.04,.012,2100,0,.06)},
  dodgeSuccess:()=>{tone(720,.055,'triangle',.023,340,0,.11);setTimeout(()=>tone(1040,.05,'sine',.015,180,0,.08),35)},
  power:()=>{tone(540,.12,'sine',.032,420,0,.16);setTimeout(()=>tone(880,.11,'triangle',.020,250,0,.12),55)},
  gpp:()=>{tone(520,.11,'sine',.035,250,0,.18);setTimeout(()=>tone(780,.12,'triangle',.032,360,0,.16),80);setTimeout(()=>tone(1120,.15,'sine',.024,420,0,.14),170)},
  boss:()=>{tone(110,.3,'sawtooth',.05,-25,0,.22);setTimeout(()=>tone(82,.35,'square',.035,-15,0,.22),160)},
  clear:()=>{tone(520,.12,'sine',.035,220,0,.18);setTimeout(()=>tone(760,.18,'sine',.035,300,0,.18),120)}
};

function show(el){ el.classList.remove('hidden'); }
function hide(el){ el.classList.add('hidden'); }
function toast(text, sec=1.5){ if(!state)return; UI.toast.textContent=text; show(UI.toast); state.toastTimer=sec; }
function setCombo(){ const n=state?.combo||0; if(UI.brandComboText){UI.brandComboText.textContent=`×${n}`;UI.brandComboText.closest('.brand-combo')?.classList.toggle('active',n>=2);} if(!state || n<2){hide(UI.combo);return;} UI.combo.textContent=`🔥 COMBO ×${n}`; show(UI.combo); }

function startGame(stage=0){
  ensureAudio();
  state = newState(stage); hide(UI.menu); hide(UI.help); hide(UI.pause); hide($('#settingsPanel')); hide(UI.stage); hide(UI.over); hide(UI.victory); show(UI.hud); UI.menu.classList.remove('active');
  updateWeaponUI(); updateHUD(); setCombo(); last=performance.now(); cancelAnimationFrame(raf); raf=requestAnimationFrame(loop);
}

function goHome(){
  if(state) state.mode='menu'; cancelAnimationFrame(raf); state=null; hide(UI.hud); hide(UI.pause); hide($('#settingsPanel')); hide(UI.stage); hide(UI.over); hide(UI.victory); hide(UI.help); UI.menu.classList.add('active'); show(UI.menu); drawAttract();
}

function pauseGame(){ if(!state||state.mode!=='playing')return; state.moveLeft=false;state.moveRight=false;state.mobileMoveAxis=0;state.playerVX*=.35;state.mode='paused'; show(UI.pause); }
function resumeGame(){ if(!state||state.mode!=='paused')return; hide(UI.pause); state.mode='playing'; last=performance.now(); }

function gameplayViewport(){
  const desktop=matchMedia('(min-width:1180px) and (hover:hover) and (pointer:fine)').matches;
  const left=desktop?180:0,right=desktop?178:0,width=Math.max(260,innerWidth-left-right);
  return {desktop,left,right,width,center:left+width/2};
}
function playerTravelPx(){const v=gameplayViewport();return Math.max(1,Math.min(v.width*.43,v.width*.5-38));}
function playerScreenX(x=state?.playerX||0){const v=gameplayViewport();return v.center+x*playerTravelPx();}
function dash(dir){
  if(!state||state.mode!=='playing'||state.dashCooldown>0)return;
  dir=dir<0?-1:1;
  state.dashDir=dir;state.lastMoveDir=dir;state.dashTimer=.16;state.dashCooldown=.68;state.dodgeTilt=dir*.24;state.dodgeMessage=.24;sfx.dodge();
}
function movementAxis(){
  if(!state)return 0;
  const keyboard=(state.moveRight?1:0)-(state.moveLeft?1:0);
  return Math.max(-1,Math.min(1,Math.abs(state.mobileMoveAxis)>.04?state.mobileMoveAxis:keyboard));
}

function spawnEnemy(type, boss=false){
  const base = ENEMY[type] || ENEMY.basic; const d=DIFF[state.difficulty];
  const hp = (boss ? state.cfg.bossHp : base.hp) * d.enemyHp;
  const side = Math.random() < .5 ? -1 : 1;
  const x = boss ? .5 : .18 + Math.random()*.64;
  state.enemies.push({
    id:Math.random(), type, boss, name: boss?state.cfg.boss:null, x, baseX:x, depth:boss ? .68 : .90+Math.random()*.08, hp, maxHp:hp,
    speed:(boss?.028:base.speed)*d.enemySpeed*(.9+Math.random()*.18), rad:boss?76:base.rad, color:boss?'#d65b86':base.color,
    phase:Math.random()*6.28, wobble:Math.random()*2+1, attackTimer:boss?1.4:999, summon:boss?3.2:999,
    flash:0, dead:false, side, base,
  });
  if(boss){ show(UI.bossBar); UI.bossName.textContent=state.cfg.boss; sfx.boss(); toast('⚠ BOSS ĐỘT BIẾN XUẤT HIỆN!',2); }
}

function update(dt){
  if(!state||state.mode!=='playing')return;
  const d=DIFF[state.difficulty]; state.stageElapsed+=dt;
  if(state.transition>0){ state.transition+=dt; state.zoom=Math.min(1,state.transition/2.2); if(state.transition>2.15 && !state.nextPanel){state.nextPanel=true; stageCompletePanel();} return; }
  state.zoom = Math.min(.13, state.stageElapsed*.0025);
  if(state.shake>0) state.shake=Math.max(0,state.shake-dt);
  state.dashCooldown=Math.max(0,state.dashCooldown-dt);state.dashTimer=Math.max(0,state.dashTimer-dt);state.dodgeTilt*=Math.pow(.001,dt);state.recoil=Math.max(0,state.recoil-dt*7.5);state.muzzleFlash=Math.max(0,state.muzzleFlash-dt*10);state.dodgeMessage=Math.max(0,state.dodgeMessage-dt);
  const axis=movementAxis();
  if(Math.abs(axis)>.03)state.lastMoveDir=axis<0?-1:1;
  if(state.dashTimer>0){
    state.playerVX=state.dashDir*2.55;
  }else{
    const accel=6.8,maxSpeed=1.12,friction=8.2;
    if(Math.abs(axis)>.03)state.playerVX+=axis*accel*dt;
    else state.playerVX*=Math.max(0,1-friction*dt);
    state.playerVX=Math.max(-maxSpeed,Math.min(maxSpeed,state.playerVX));
  }
  state.playerX+=state.playerVX*dt;
  if(state.playerX<=-1){state.playerX=-1;if(state.playerVX<0)state.playerVX=0;}
  if(state.playerX>=1){state.playerX=1;if(state.playerVX>0)state.playerVX=0;}
  if(state.toastTimer>0){state.toastTimer-=dt;if(state.toastTimer<=0)hide(UI.toast)}
  if(state.comboTimer>0){state.comboTimer-=dt;if(state.comboTimer<=0){state.combo=0;setCombo()}}
  if(state.shield>0)state.shield-=dt; if(state.drone>0)state.drone-=dt; state.beam=Math.min(100,state.beam+18*dt);

  if(state.spawnLeft>0){
    state.spawnTimer-=dt;
    if(state.spawnTimer<=0){
      const t=state.cfg.mix[(Math.random()*state.cfg.mix.length)|0]; spawnEnemy(t,false); state.spawnLeft--; state.spawnTimer=state.cfg.spawn*d.spawn*(.72+Math.random()*.55);
    }
  } else if(!state.bossSpawned && state.enemies.length===0){ state.bossSpawned=true; spawnEnemy(state.stageIndex>=4?'elite':'breather',true); }

  for(const e of state.enemies){
    if(e.dead)continue; e.phase+=dt*(1.7+(e.base.pulse||0)); e.flash=Math.max(0,e.flash-dt*6);
    const sway=(e.base.sway||.7) * Math.sin(e.phase*e.wobble) * .012;
    e.x=e.baseX+sway;
    if(!e.boss){
      e.depth-=e.speed*dt*(e.base.charge && e.depth<.45?1.75:1);
    } else {
      e.depth=.66+Math.sin(e.phase*.45)*.018;
      e.summon-=dt;
      if(e.summon<=0){ e.summon=3.3; for(let i=0;i<Math.min(3, 1 + Math.floor(state.stageIndex / 2));i++) spawnEnemy(state.cfg.mix[(Math.random()*state.cfg.mix.length)|0],false); }
    }
    if(e.boss){ e.attackTimer-=dt; if(e.attackTimer<=0){ fireEnemyShot(e); e.attackTimer=1.15/d.enemySpeed; } }
    if(!e.boss && e.depth<=.08){
      const sc=enemyScreen(e),hitRadius=Math.max(46,Math.min(100,sc.r*.72+innerWidth*.022));
      if(Math.abs(playerScreenX()-sc.x)<hitRadius)damagePlayer(e.base.attack*d.damage);
      else {state.score+=35;sfx.dodgeSuccess();toast('↔ NÉ ĐƯỢC VIRUS!',.55);}
      e.dead=true;burstAt(sc.x,sc.y,e.color,8);
    }
  }
  state.enemies=state.enemies.filter(e=>!e.dead);

  for(const sh of state.enemyShots){
    sh.t+=dt;sh.x+=sh.vx*dt;sh.y+=sh.vy*dt;sh.r+=18*dt;
    if(sh.t>=sh.life){
      const hitRadius=Math.max(42,Math.min(82,innerWidth*.052));
      if(Math.abs(playerScreenX()-playerScreenX(sh.targetPlayerX))<hitRadius)damagePlayer(sh.damage*d.damage);
      else {state.score+=20;sfx.dodgeSuccess();toast('↔ NÉ ĐÒN ĐỘC!',.55);}
      sh.dead=true;
    }
  }
  state.enemyShots=state.enemyShots.filter(s=>!s.dead);

  for(const p of state.particles){ p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=12*dt;p.a=Math.max(0,p.life/p.max); }
  state.particles=state.particles.filter(p=>p.life>0);

  for(const tr of state.tracers){tr.t+=dt;tr.life-=dt;} state.tracers=state.tracers.filter(tr=>tr.life>0);
  for(const hm of state.hitMarkers){hm.life-=dt;} state.hitMarkers=state.hitMarkers.filter(hm=>hm.life>0);

  for(const p of state.powerups){ p.t+=dt;p.y+=Math.sin(p.t*3)*.15; p.life-=dt;if(p.life<=0)p.dead=true; }
  state.powerups=state.powerups.filter(p=>!p.dead);

  if(state.drone>0 && state.enemies.length){
    state._droneTimer=(state._droneTimer||0)-dt;
    if(state._droneTimer<=0){state._droneTimer=.42;const target=state.enemies.find(e=>!e.dead);if(target){hitEnemy(target,.75,false,true);}}
  }

  if(state.bossSpawned && !state.bossDefeated && !state.enemies.some(e=>e.boss) && state.spawnLeft<=0){ state.bossDefeated=true; beginStageClear(); }
  updateHUD();
}

function fireEnemyShot(e){
  const s=enemyScreen(e),targetPlayerX=state.playerX,tx=playerScreenX(targetPlayerX),ty=innerHeight*.78;
  const dx=tx-s.x,dy=ty-s.y,l=Math.hypot(dx,dy)||1,speed=e.boss?135:112;
  state.enemyShots.push({x:s.x,y:s.y,vx:dx/l*speed,vy:dy/l*speed,t:0,life:Math.max(.62,l/speed),r:7,damage:e.boss?1.2:e.base.attack,color:e.boss?'#ff5477':'#9d63d8',targetPlayerX});
}

function damagePlayer(amount){
  if(!state||state.mode!=='playing')return; if(state.shield>0)amount*=.35; state.health=Math.max(0,state.health-amount); state.shake=.16; UI.damage.classList.add('hit'); setTimeout(()=>UI.damage.classList.remove('hit'),110); sfx.hurt();
  if(state.health<=0){state.mode='over';show(UI.over);}
}

function beginStageClear(){ if(state.transition>0)return; state.transition=.001; state.mode='playing'; sfx.clear(); toast('✅ KHU VỰC ĐÃ KHỬ NHIỄM',2); }

function stageCompletePanel(){
  state.mode='stage'; hide(UI.bossBar); const acc=state.shots?Math.round(state.hits/state.shots*100):100; const rank=rankFor(acc,state.health,state.stageElapsed);
  $('#stageResultTitle').textContent=state.cfg.name; $('#stageScore').textContent=state.score.toLocaleString('vi-VN'); $('#stageAccuracy').textContent=acc+'%'; $('#stageHealth').textContent=`${Math.ceil(state.health)}/10`; $('#stageRank').textContent=rank;
  if(state.cfg.final){ hide(UI.stage); $('#victoryText').textContent=`Tổng điểm ${state.score.toLocaleString('vi-VN')} · Chính xác ${acc}% · Xếp hạng ${rank}`; show(UI.victory); }
  else show(UI.stage);
}
function rankFor(acc,hp,time){ const v=acc*.55+hp*4+(time<80?12:time<110?7:2); return v>=85?'S+':v>=72?'S':v>=56?'A':'B'; }

function enemyScreen(e){
  const w=innerWidth,h=innerHeight; const horizon=h*.41; const prog=Math.pow(1-e.depth,1.55); const y=horizon+prog*h*.49 + (e.base.fly?Math.sin(e.phase*2)*18-45:0) + (e.base.wall?(e.side<0?-30:10):0);
  const spread=.28+.72*prog;const v=gameplayViewport();const x=v.center+(e.x-.5)*v.width*spread*1.52;const scale=.38+prog*1.25;return {x,y,scale,r:e.rad*scale*(e.boss?1.1:1)};
}

function aimHit(x,y,weapon){
  const candidates=[];
  for(const e of state.enemies){ const sc=enemyScreen(e); const dist=Math.hypot(x-sc.x,y-sc.y); if(dist<sc.r*1.15)candidates.push({e,s:sc,dist}); }
  candidates.sort((a,b)=>a.dist-b.dist);
  if(weapon.kind==='spray'){
    let hit=false,target=null; for(const e of state.enemies){const sc=enemyScreen(e);const dist=Math.hypot(x-sc.x,y-sc.y);if(dist<145 && e.depth<.62){hitEnemy(e,weapon.damage*(1.15-e.depth*.35),true,false,false);hit=true;target=target||sc;}}
    return {hit,x:target?.x||x,y:target?.y||y,crit:false};
  }
  if(weapon.kind==='bomb'){ explode(x,y,weapon.damage); return {hit:true,x,y,crit:false}; }
  if(weapon.kind==='beam'){
    if(candidates[0]){const c=candidates[0];const crit=c.dist<c.s.r*.30;hitEnemy(c.e,weapon.damage*(crit?1.35:1),true,false,crit);return {hit:true,x:c.s.x,y:c.s.y,crit};}return {hit:false,x,y,crit:false};
  }
  if(weapon.kind==='pierce'){
    if(!candidates.length)return {hit:false,x,y,crit:false}; let hit=false,crit=false; for(const c of candidates.slice(0,2)){const cc=c.dist<c.s.r*.32||!!c.e.base.core;hitEnemy(c.e,weapon.damage*(cc?1.35:1),true,false,cc);hit=true;crit=crit||cc;} const c=candidates[0];return {hit,x:c.s.x,y:c.s.y,crit};
  }
  if(candidates[0]){ const c=candidates[0],crit=c.dist<c.s.r*.35; hitEnemy(c.e,weapon.damage*(crit?1.6:1),true,false,crit); if(crit)toast('🎯 CORE HIT!',.7); return {hit:true,x:c.s.x,y:c.s.y,crit}; }
  return {hit:false,x,y,crit:false};
}

function getMuzzlePoint(){
  const w=innerWidth,h=innerHeight,pv=gameplayViewport(),nx=Math.max(-1,Math.min(1,((pointer.x-pv.left)/pv.width-.5)*2));
  return {x:playerScreenX()+nx*42,y:h-Math.max(74,h*.13)};
}
function addTracer(kind,x,y){
  if(!state)return;
  const m=getMuzzlePoint();
  // Long enough for the eye to follow the projectile from the muzzle to the target.
  const specs={shot:[.28,.18,'#56fff0',5.2],pierce:[.30,.16,'#f2ffff',4.1],spray:[.20,.14,'#8cffe9',6],bomb:[.44,.31,'#ffd45f',6.5],beam:[.13,.085,'#c9ffff',9]};
  const q=specs[kind]||specs.shot;
  state.tracers.push({x1:m.x,y1:m.y,x2:x,y2:y,t:0,life:q[0],max:q[0],travel:q[1],color:q[2],width:q[3],kind,seed:Math.random()*99});
}
function shoot(x,y){
  if(!state||state.mode!=='playing')return; const now=performance.now(); const w=WEAPONS[state.weapon]; if(now-state.lastFire<w.cooldown)return;
  if(w.kind==='bomb' && state.bombs<=0){toast('Bom vitamin đã hết',.9);return;} if(w.kind==='beam' && state.beam<5){toast('Tia miễn dịch đang hồi',.8);return;}
  state.lastFire=now; state.shots++; if(w.kind==='bomb')state.bombs--; if(w.kind==='beam')state.beam=Math.max(0,state.beam-4.5);
  state.recoil=Math.min(1,state.recoil+(w.kind==='bomb'?.85:w.kind==='pierce'?.62:w.kind==='beam'?.20:w.kind==='spray'?.16:.36));state.muzzleFlash=1;sfx.weapon(w.kind,x);
  const result=aimHit(x,y,w); if(result.hit)state.hits++; addTracer(w.kind,result.x,result.y); const m=getMuzzlePoint();muzzleBurst(m.x,m.y,w.kind);
}

function hitEnemy(e,damage,countHit=true,drone=false,crit=false){
  if(e.dead)return; let dmg=damage; if(e.base.shield && e.hp>e.maxHp*.45)dmg*=.62; e.hp-=dmg; e.flash=1; const s=enemyScreen(e); burstAt(s.x,s.y,e.color,drone?3:(crit?9:5)); state.hitMarkers.push({x:s.x,y:s.y,life:crit?.28:.18,max:crit?.28:.18,crit}); sfx.hit(s.x); if(crit)sfx.crit(s.x);
  if(e.boss){ UI.bossFill.style.width=Math.max(0,e.hp/e.maxHp*100)+'%'; UI.bossHp.textContent=Math.max(0,Math.ceil(e.hp/e.maxHp*100))+'%'; }
  if(e.hp<=0){
    e.dead=true; sfx.kill(s.x); state.kills++; state.score+=e.boss?2500:e.base.score; state.contamination=Math.max(0,state.contamination-(e.boss?20:80/state.cfg.quota)); state.combo++; state.comboTimer=1.8; setCombo(); burstAt(s.x,s.y,e.color,e.boss?32:12);
    if(e.base.cluster&&!e.boss){ for(let i=0;i<2;i++) spawnMini(s.x,s.y); }
    if(!e.boss && Math.random()<.09)spawnPowerup(s.x,s.y);
    if(e.boss){ state.enemies.forEach(other=>{ if(other!==e && !other.boss) other.dead=true; }); hide(UI.bossBar); toast('💥 BOSS ĐÃ BỊ KHỬ NHIỄM!',1.8) }
  }
}

function spawnMini(px,py){
  const e={id:Math.random(),type:'spore',boss:false,name:null,x:.35+Math.random()*.3,baseX:.35+Math.random()*.3,depth:.38+Math.random()*.1,hp:1.1,maxHp:1.1,speed:.15,rad:15,color:'#d9e889',phase:Math.random()*6.28,wobble:2,attackTimer:999,summon:999,flash:0,dead:false,side:1,base:ENEMY.spore}; state.enemies.push(e);
}

function explode(x,y,damage){
  for(const e of state.enemies){const s=enemyScreen(e);const dist=Math.hypot(x-s.x,y-s.y);if(dist<220)hitEnemy(e,damage*(1-dist/300),true);} burstAt(x,y,'#ffd66b',35); toast('🟠 BOM VITAMIN KHỬ NHIỄM!',1.1);
}
function muzzleBurst(x,y,kind){ const c=kind==='beam'?'#b7ffff':kind==='bomb'?'#ffd66b':'#d9fff9'; for(let i=0;i<4;i++)state.particles.push({x:x+(Math.random()-.5)*8,y:y+(Math.random()-.5)*8,vx:(Math.random()-.5)*40,vy:(Math.random()-.5)*40,life:.22,max:.22,a:1,size:2+Math.random()*3,color:c}); }
function burstAt(x,y,color,count=8){ for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,sp=25+Math.random()*100;state.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:.35+Math.random()*.45,max:.8,a:1,size:2+Math.random()*4,color});}}

function spawnPowerup(x,y){ const kinds=['heal','shield','drone','heal','shield','drone','gpp']; const kind=kinds[(Math.random()*kinds.length)|0]; state.powerups.push({x,y,kind,t:0,life:6,dead:false}); }
function collectPowerups(x,y){ for(const p of state.powerups){ if(Math.hypot(x-p.x,y-p.y)<40){p.dead=true;if(p.kind==='heal'){state.health=Math.min(10,state.health+2);toast('❤️ +2 sinh tồn',1.1);sfx.power()}if(p.kind==='shield'){state.shield=5;toast('🛡 Khiên khử nhiễm 5s',1.1);sfx.power()}if(p.kind==='drone'){state.drone=9;toast('🤖 Drone y tế hỗ trợ',1.1);sfx.power()}if(p.kind==='gpp'){state.health=Math.min(10,state.health+1);state.contamination=Math.max(0,state.contamination-6);for(const e of [...state.enemies])if(!e.boss)hitEnemy(e,1.45,false,true,false);toast('✨ TRƯỜNG GPP BOOST · QUÉT SẠCH!',1.5);sfx.gpp()}updateHUD();return true;}} return false; }

function updateHUD(){
  if(!state)return; UI.healthText.textContent=`${Math.max(0,state.health).toFixed(state.health%1?1:0)}/10`; UI.healthFill.style.width=(state.health/state.maxHealth*100)+'%';
  const clean=Math.round(Math.max(0,100-state.contamination)); UI.stageName.textContent=state.cfg.name; UI.cleanText.textContent=`KHỬ NHIỄM ${clean}%`; UI.cleanFill.style.width=clean+'%'; UI.score.textContent=state.score.toLocaleString('vi-VN'); UI.enemy.textContent=`Virus: ${state.enemies.length+state.spawnLeft}`;
  const w=WEAPONS[state.weapon]; UI.weaponIcon.textContent=w.icon; UI.weaponName.textContent=w.name; UI.weaponStatus.textContent=w.kind==='bomb'?`${state.bombs} quả còn lại`:w.kind==='beam'?`Năng lượng ${Math.round(state.beam)}%`:state.shield>0?`🛡 Khiên ${state.shield.toFixed(1)}s`:w.status;
}
function updateWeaponUI(){ $$('#weaponButtons button').forEach((b,i)=>b.classList.toggle('active',i===state.weapon)); updateHUD(); }
function selectWeapon(i){ if(!state)return; state.weapon=Math.max(0,Math.min(WEAPONS.length-1,i)); updateWeaponUI(); toast(`${WEAPONS[state.weapon].icon} ${WEAPONS[state.weapon].name}`,.75); }

function drawBackground(t){
  const w=innerWidth,h=innerHeight; ctx.save(); const sh=state?.shake||0; if(sh>0)ctx.translate((Math.random()-.5)*5,(Math.random()-.5)*4);
  ctx.fillStyle='#d9e4df';ctx.fillRect(0,0,w,h);const scene=state?stageBgs[state.stageIndex]:bg;if(scene&&scene.complete&&scene.width){const imgR=scene.width/scene.height,scrR=w/h;let dw,dh;const z=1.035+(state?.zoom||0)*.42+(state?.transition||0>0?Math.min(.34,state.zoom*.28):0);if(scrR>imgR){dw=w*z;dh=dw/imgR;}else{dh=h*z;dw=dh*imgR;}const targetY=h*.48;ctx.drawImage(scene,(w-dw)/2,(h-dh)/2-(z-1)*targetY*.55,dw,dh);}
  if(state){ctx.fillStyle=state.cfg.tint;ctx.fillRect(0,0,w,h); const grad=ctx.createLinearGradient(0,0,0,h);grad.addColorStop(0,'rgba(4,46,52,.10)');grad.addColorStop(.6,'rgba(4,46,52,0)');grad.addColorStop(1,'rgba(4,46,52,.18)');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);} ctx.restore();
}

function drawEnemy(e,t){
  const s=enemyScreen(e); const pulse=1+Math.sin(e.phase*2.2)*(.055+(e.base.pulse||0)*.018); const r=s.r*pulse; ctx.save(); ctx.translate(s.x,s.y); if(e.flash>0)ctx.globalCompositeOperation='screen';
  if(e.boss){ const aura=ctx.createRadialGradient(0,0,r*.2,0,0,r*1.55);aura.addColorStop(0,'rgba(255,93,145,.14)');aura.addColorStop(1,'rgba(255,93,145,0)');ctx.fillStyle=aura;ctx.beginPath();ctx.arc(0,0,r*1.55,0,Math.PI*2);ctx.fill(); }
  // shadow
  ctx.globalAlpha=.16;ctx.fillStyle='#06191b';ctx.beginPath();ctx.ellipse(0,r*.82,r*.78,r*.20,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  // organic body
  const lobes=e.boss?16:12;ctx.beginPath();for(let i=0;i<=lobes;i++){const a=i/lobes*Math.PI*2;const wob=1+.10*Math.sin(a*3+e.phase*2)+.06*Math.sin(a*5-e.phase*1.3);const rr=r*wob;const x=Math.cos(a)*rr,y=Math.sin(a)*rr*.86;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.closePath();
  const g=ctx.createRadialGradient(-r*.25,-r*.25,r*.08,0,0,r);g.addColorStop(0,'#f5ffff');g.addColorStop(.18,e.color);g.addColorStop(1,shade(e.color,-45));ctx.fillStyle=g;ctx.fill();ctx.lineWidth=Math.max(1.2,r*.035);ctx.strokeStyle='rgba(255,255,255,.58)';ctx.stroke();
  // spikes / flagella
  const spikeN=e.base.fly?6:e.base.wall?10:8;ctx.strokeStyle=shade(e.color,-20);ctx.lineWidth=Math.max(1.2,r*.05);for(let i=0;i<spikeN;i++){const a=i/spikeN*Math.PI*2+Math.sin(e.phase)*.05;const len=r*(.27+.12*Math.sin(e.phase*2+i));ctx.beginPath();ctx.moveTo(Math.cos(a)*r*.82,Math.sin(a)*r*.67);ctx.quadraticCurveTo(Math.cos(a+.2)*r*1.1,Math.sin(a+.2)*r*.9,Math.cos(a)*r+Math.cos(a)*len,Math.sin(a)*r*.82+Math.sin(a)*len);ctx.stroke();}
  // core
  const coreR=r*(e.base.core?.25:.18);ctx.fillStyle=e.base.core?'#fff06b':'rgba(255,255,255,.78)';ctx.beginPath();ctx.arc(0,0,coreR*(1+.08*Math.sin(e.phase*3)),0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(8,64,71,.52)';ctx.beginPath();ctx.arc(coreR*.18,-coreR*.1,coreR*.38,0,Math.PI*2);ctx.fill();
  if(!e.boss){
    // expressive 3D face so minor enemies read like living creatures rather than flat dots
    const eyeY=-r*.13,eyeX=r*.28,eyeR=Math.max(2.8,r*.13);
    for(const sx of [-1,1]){
      const eg=ctx.createRadialGradient(sx*eyeX-eyeR*.25,eyeY-eyeR*.25,1,sx*eyeX,eyeY,eyeR);eg.addColorStop(0,'#ffffff');eg.addColorStop(1,'#c7f7f3');ctx.fillStyle=eg;ctx.beginPath();ctx.ellipse(sx*eyeX,eyeY,eyeR*.86,eyeR,0,0,Math.PI*2);ctx.fill();
      const look=Math.max(-.25,Math.min(.25,(playerScreenX()-s.x)/Math.max(120,innerWidth*.18)));ctx.fillStyle='#08262b';ctx.beginPath();ctx.arc(sx*eyeX+look*eyeR,eyeY+eyeR*.1,eyeR*.42,0,Math.PI*2);ctx.fill();ctx.fillStyle='white';ctx.beginPath();ctx.arc(sx*eyeX+look*eyeR-eyeR*.12,eyeY-eyeR*.05,eyeR*.10,0,Math.PI*2);ctx.fill();
    }
    ctx.fillStyle='rgba(36,8,18,.72)';ctx.beginPath();ctx.ellipse(0,r*.24,r*.34,r*.18,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#f5ffff';for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(i*r*.105-r*.045,r*.12);ctx.lineTo(i*r*.105,r*.24);ctx.lineTo(i*r*.105+r*.045,r*.12);ctx.closePath();ctx.fill();}
    if(e.base.fly){ctx.globalAlpha=.38;ctx.fillStyle='#bffffa';for(const sx of [-1,1]){ctx.beginPath();ctx.ellipse(sx*r*.93,-r*.16,r*.42,r*.18,sx*.35,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
  }
  if(e.base.shield && e.hp>e.maxHp*.45){ctx.strokeStyle='rgba(126,240,255,.75)';ctx.lineWidth=3;ctx.shadowColor='#77fff5';ctx.shadowBlur=8;ctx.beginPath();ctx.arc(0,0,r*1.16,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;}
  if(e.boss){ctx.fillStyle='rgba(3,30,34,.82)';ctx.font=`800 ${Math.max(10,r*.17)}px system-ui`;ctx.textAlign='center';ctx.fillText(e.name,0,-r*1.32);}
  ctx.restore();
}

function shade(hex,amt){ const n=parseInt(hex.slice(1),16),r=Math.max(0,Math.min(255,(n>>16)+amt)),g=Math.max(0,Math.min(255,((n>>8)&255)+amt)),b=Math.max(0,Math.min(255,(n&255)+amt));return `rgb(${r},${g},${b})`; }

function drawPlayerShadow(t){
  if(!state)return;const w=innerWidth,h=innerHeight,x=playerScreenX();
  ctx.save();ctx.globalAlpha=.14;ctx.fillStyle='#071e20';ctx.beginPath();
  const stretch=1+Math.min(.28,Math.abs(state.playerVX)*.16);ctx.ellipse(x,h*.935,Math.max(34,w*.034)*stretch,Math.max(8,h*.015),0,0,Math.PI*2);ctx.fill();ctx.restore();
}

function drawWeapon(t){
  if(!state)return; const w=innerWidth,h=innerHeight,isMobile=matchMedia('(hover:none) and (pointer:coarse)').matches; const scale=Math.min(w/1100,h/700)*(isMobile?.86:1);
  const pv=gameplayViewport(),nx=Math.max(-1,Math.min(1,((pointer.x-pv.left)/pv.width-.5)*2)),ny=Math.max(-1,Math.min(1,(pointer.y/h-.48)*2));
  const walk=Math.sin(t*.009)*2.8,breathe=Math.sin(t*.0034)*2.1,recoil=state.recoil*18;
  const moveLean=Math.max(-.11,Math.min(.11,state.playerVX*.075)),tilt=nx*.085+state.dodgeTilt+moveLean;
  ctx.save();ctx.translate(playerScreenX()+nx*27,h+walk+breathe+recoil+ny*8);ctx.rotate(tilt);ctx.transform(1,ny*.025,nx*.035,1,0,0);ctx.scale(scale,scale);
  // 3D sleeves and hands
  let sg=ctx.createLinearGradient(-150,-70,-60,25);sg.addColorStop(0,'#ffffff');sg.addColorStop(.55,'#d8f2ef');sg.addColorStop(1,'#87bfc0');ctx.fillStyle=sg;ctx.strokeStyle='rgba(5,65,72,.38)';ctx.lineWidth=2;
  ctx.beginPath();ctx.roundRect(-150,-65,88,102,24);ctx.fill();ctx.stroke();ctx.beginPath();ctx.roundRect(62,-65,88,102,24);ctx.fill();ctx.stroke();
  let skin=ctx.createLinearGradient(-125,-88,-60,-10);skin.addColorStop(0,'#ffe0c9');skin.addColorStop(.5,'#edbd9f');skin.addColorStop(1,'#bd8167');ctx.fillStyle=skin;ctx.beginPath();ctx.roundRect(-126,-89,65,80,22);ctx.fill();ctx.beginPath();ctx.roundRect(61,-89,65,80,22);ctx.fill();
  // medical weapon body with depth
  const ww=WEAPONS[state.weapon]; const body=ctx.createLinearGradient(-86,-140,94,-28);body.addColorStop(0,'#ffffff');body.addColorStop(.28,'#dcffff');body.addColorStop(.64,'#7cd7d3');body.addColorStop(1,'#176f79');ctx.fillStyle=body;ctx.strokeStyle='rgba(3,55,63,.82)';ctx.lineWidth=3;ctx.beginPath();ctx.roundRect(-86,-132,174,96,23);ctx.fill();ctx.stroke();
  ctx.fillStyle='rgba(4,63,70,.24)';ctx.beginPath();ctx.roundRect(-73,-46,146,14,7);ctx.fill();
  const grip=ctx.createLinearGradient(-18,-52,24,30);grip.addColorStop(0,'#176f79');grip.addColorStop(1,'#063c45');ctx.fillStyle=grip;ctx.beginPath();ctx.roundRect(-20,-48,40,82,12);ctx.fill();
  // barrel / top rail
  ctx.fillStyle='#d9fffb';ctx.beginPath();ctx.roundRect(68,-113,48,34,10);ctx.fill();ctx.stroke();ctx.fillStyle='#0d7780';ctx.beginPath();ctx.roundRect(80,-104,43,16,6);ctx.fill();
  ctx.fillStyle='#eaffff';ctx.font='900 27px system-ui';ctx.textAlign='center';ctx.fillText(ww.icon,0,-78);ctx.fillStyle='rgba(5,57,65,.88)';ctx.font='900 11px system-ui';ctx.fillText('TRƯỜNG GPP',0,-52);
  if(logoIcon.complete){ctx.save();ctx.beginPath();ctx.arc(-55,-79,15,0,Math.PI*2);ctx.clip();ctx.drawImage(logoIcon,-70,-94,30,30);ctx.restore();}
  if(ww.kind==='pierce'){ctx.strokeStyle='#eaffff';ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(112,-96);ctx.lineTo(161,-96);ctx.stroke();ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(161,-96);ctx.lineTo(194,-96);ctx.stroke();}
  if(ww.kind==='spray'){const mist=ctx.createLinearGradient(105,-96,210,-96);mist.addColorStop(0,'rgba(185,255,250,.32)');mist.addColorStop(1,'rgba(185,255,250,0)');ctx.fillStyle=mist;ctx.beginPath();ctx.moveTo(105,-106);ctx.lineTo(210,-145);ctx.lineTo(210,-48);ctx.closePath();ctx.fill();}
  if(state.muzzleFlash>0){ctx.save();ctx.translate(119,-96);ctx.globalAlpha=state.muzzleFlash;const fg=ctx.createRadialGradient(0,0,0,0,0,34);fg.addColorStop(0,'#ffffff');fg.addColorStop(.25,ww.kind==='bomb'?'#ffd66b':'#9ffff4');fg.addColorStop(1,'rgba(120,255,240,0)');ctx.fillStyle=fg;ctx.beginPath();ctx.arc(0,0,34,0,Math.PI*2);ctx.fill();ctx.restore();}
  ctx.restore();
}

function drawCrosshair(){ if(!state||state.mode!=='playing')return; const x=pointer.x,y=pointer.y;ctx.save();ctx.strokeStyle='rgba(231,255,252,.92)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,12,0,Math.PI*2);ctx.moveTo(x-20,y);ctx.lineTo(x-6,y);ctx.moveTo(x+6,y);ctx.lineTo(x+20,y);ctx.moveTo(x,y-20);ctx.lineTo(x,y-6);ctx.moveTo(x,y+6);ctx.lineTo(x,y+20);ctx.stroke();ctx.restore(); }

function drawTracers(){
  for(const tr of state.tracers){
    const fade=Math.max(0,Math.min(1,tr.life/Math.max(.001,tr.max*.42)));
    const p=Math.min(1,tr.t/tr.travel);
    ctx.save();ctx.globalAlpha=fade;ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowColor=tr.color;ctx.shadowBlur=tr.kind==='beam'?22:14;
    if(tr.kind==='bomb'){
      const mx=(tr.x1+tr.x2)/2,my=Math.min(tr.y1,tr.y2)-125;
      ctx.strokeStyle='rgba(255,214,91,.34)';ctx.lineWidth=tr.width*2.2;ctx.beginPath();ctx.moveTo(tr.x1,tr.y1);ctx.quadraticCurveTo(mx,my,tr.x1+(tr.x2-tr.x1)*p,tr.y1+(tr.y2-tr.y1)*p-4*Math.sin(p*Math.PI));ctx.stroke();
      ctx.strokeStyle=tr.color;ctx.lineWidth=tr.width;ctx.beginPath();ctx.moveTo(tr.x1,tr.y1);ctx.quadraticCurveTo(mx,my,tr.x1+(tr.x2-tr.x1)*p,tr.y1+(tr.y2-tr.y1)*p-4*Math.sin(p*Math.PI));ctx.stroke();
    }else if(tr.kind==='spray'){
      for(let i=0;i<7;i++){const off=(i-3)*9+Math.sin(tr.seed+i)*5;const ex=tr.x1+(tr.x2-tr.x1)*p+off,ey=tr.y1+(tr.y2-tr.y1)*p+off*.22;ctx.strokeStyle=i===3?'rgba(236,255,252,.92)':tr.color;ctx.lineWidth=i===3?2.5:1.5;ctx.beginPath();ctx.moveTo(tr.x1,tr.y1);ctx.lineTo(ex,ey);ctx.stroke();}
    }else if(tr.kind==='beam'){
      ctx.strokeStyle='rgba(63,240,232,.35)';ctx.lineWidth=tr.width*2.1;ctx.beginPath();ctx.moveTo(tr.x1,tr.y1);ctx.lineTo(tr.x2,tr.y2);ctx.stroke();
      ctx.strokeStyle=tr.color;ctx.lineWidth=tr.width*(.82+.18*Math.sin(performance.now()*.03));ctx.beginPath();ctx.moveTo(tr.x1,tr.y1);ctx.lineTo(tr.x2,tr.y2);ctx.stroke();
      ctx.strokeStyle='white';ctx.lineWidth=2.2;ctx.stroke();
    }else{
      const tail=Math.max(0,p-.22),xA=tr.x1+(tr.x2-tr.x1)*tail,yA=tr.y1+(tr.y2-tr.y1)*tail,xB=tr.x1+(tr.x2-tr.x1)*p,yB=tr.y1+(tr.y2-tr.y1)*p;
      // Wide glow under the tracer.
      ctx.strokeStyle=tr.kind==='pierce'?'rgba(206,255,255,.40)':'rgba(58,255,235,.34)';ctx.lineWidth=tr.width*2.7;ctx.beginPath();ctx.moveTo(xA,yA);ctx.lineTo(xB,yB);ctx.stroke();
      // Bright body.
      ctx.strokeStyle=tr.color;ctx.lineWidth=tr.width;ctx.beginPath();ctx.moveTo(xA,yA);ctx.lineTo(xB,yB);ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,.98)';ctx.lineWidth=Math.max(1.2,tr.width*.36);ctx.stroke();
      // Visible projectile head so the player can follow the shot moving through space.
      const rr=tr.kind==='pierce'?3.2:4.8,grad=ctx.createRadialGradient(xB,yB,0,xB,yB,rr*3.6);grad.addColorStop(0,'#ffffff');grad.addColorStop(.25,tr.color);grad.addColorStop(1,'rgba(75,255,239,0)');ctx.fillStyle=grad;ctx.beginPath();ctx.arc(xB,yB,rr*3.6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(xB,yB,rr,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
}
function drawHitMarkers(){for(const hm of state.hitMarkers){const a=Math.max(0,hm.life/hm.max),r=hm.crit?18:12;ctx.save();ctx.translate(hm.x,hm.y);ctx.globalAlpha=a;ctx.strokeStyle=hm.crit?'#fff07a':'#eaffff';ctx.lineWidth=hm.crit?2.4:1.6;for(let i=0;i<4;i++){const ang=Math.PI/4+i*Math.PI/2;ctx.beginPath();ctx.moveTo(Math.cos(ang)*r*.45,Math.sin(ang)*r*.45);ctx.lineTo(Math.cos(ang)*r,Math.sin(ang)*r);ctx.stroke();}if(hm.crit){ctx.font='900 10px system-ui';ctx.fillStyle='#fff07a';ctx.textAlign='center';ctx.fillText('CORE',0,-20);}ctx.restore();}}
function drawEnemyShots(){ for(const s of state.enemyShots){ctx.save();const g=ctx.createRadialGradient(s.x,s.y,1,s.x,s.y,s.r*2.2);g.addColorStop(0,'#ffffff');g.addColorStop(.2,s.color);g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(s.x,s.y,s.r*2.2,0,Math.PI*2);ctx.fill();ctx.restore();}}
function drawParticles(){ for(const p of state.particles){ctx.globalAlpha=p.a;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1; }
function drawPowerups(){ for(const p of state.powerups){ctx.save();ctx.translate(p.x,p.y);const sc=1+Math.sin(p.t*4)*.08;ctx.scale(sc,sc);ctx.fillStyle=p.kind==='gpp'?'rgba(255,255,255,.94)':'rgba(5,58,63,.78)';ctx.strokeStyle=p.kind==='gpp'?'rgba(255,214,107,.95)':'rgba(196,255,248,.75)';ctx.lineWidth=p.kind==='gpp'?3:2;ctx.beginPath();ctx.arc(0,0,p.kind==='gpp'?29:25,0,Math.PI*2);ctx.fill();ctx.stroke();if(p.kind==='gpp'&&logoIcon.complete){ctx.save();ctx.beginPath();ctx.arc(0,0,23,0,Math.PI*2);ctx.clip();ctx.drawImage(logoIcon,-23,-23,46,46);ctx.restore();}else{ctx.font='25px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='white';ctx.fillText(p.kind==='heal'?'❤️':p.kind==='shield'?'🛡':'🤖',0,1);}ctx.restore();}}
function drawDrone(t){ if(!state||state.drone<=0)return;const x=Math.max(34,Math.min(innerWidth-34,playerScreenX()-innerWidth*.115+Math.sin(t*.004)*16)),y=innerHeight*.66+Math.sin(t*.006)*9;ctx.save();ctx.translate(x,y);ctx.fillStyle='#d8fffb';ctx.strokeStyle='#157a81';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(-25,-13,50,26,9);ctx.fill();ctx.stroke();ctx.fillStyle='#4ed8d2';ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(178,255,250,.7)';ctx.beginPath();ctx.moveTo(-31,-15);ctx.lineTo(-48,-23);ctx.moveTo(31,-15);ctx.lineTo(48,-23);ctx.stroke();ctx.restore();}



/* === v2.0.0 CONCEPT UI + BRAND LOCK OVERRIDES === */
// 6 stages have distinct identities; minor enemies never shoot. Only bosses use ranged attacks.
STAGES.splice(0, STAGES.length,
  {name:'KHOA PHỤ SẢN', env:'maternity', quota:16, spawn:.92, boss:'VIRUS MẸ', bossHp:32, bossKind:0, mix:['basic','flagella','breather','wall'], tint:'rgba(44,154,158,.025)'},
  {name:'PHÒNG XÉT NGHIỆM', env:'lab', quota:21, spawn:.79, boss:'VI KHUẨN CHÚA', bossHp:42, bossKind:1, mix:['breather','spore','shield','flagella'], tint:'rgba(43,191,212,.035)'},
  {name:'KHOA CẤP CỨU', env:'er', quota:25, spawn:.70, boss:'BÀO TỬ KHỔNG LỒ', bossHp:54, bossKind:2, mix:['charger','cluster','flyer','basic'], tint:'rgba(245,78,80,.035)'},
  {name:'KHU CÁCH LY', env:'isolation', quota:29, spawn:.64, boss:'SIÊU VI KHUẨN KHÁNG THUỐC', bossHp:66, bossKind:3, mix:['elite','wall','cluster','nucleus'], tint:'rgba(132,104,205,.045)'},
  {name:'KHOA ICU · CÔNG NGHỆ CAO', env:'icu', quota:33, spawn:.58, boss:'DỊ CHỦNG ĐỘT BIẾN', bossHp:82, bossKind:4, mix:['shield','nucleus','elite','flyer'], tint:'rgba(62,186,215,.04)'},
  {name:'TRUNG TÂM NGUỒN BỆNH', env:'source', quota:39, spawn:.50, boss:'NGUỒN BỆNH TỐI THƯỢNG', bossHp:112, bossKind:5, mix:['elite','nucleus','cluster','charger'], tint:'rgba(220,52,74,.05)', final:true}
);
Object.assign(DIFF.easy,{label:'DỄ',enemyHp:.88,enemySpeed:.82,damage:.72,spawn:1.22,quota:.82,bossHp:.94,bossRate:1.16,summons:.72});
Object.assign(DIFF.normal,{label:'THƯỜNG',enemyHp:1,enemySpeed:1,damage:1,spawn:1,quota:1,bossHp:1,bossRate:1,summons:1});
Object.assign(DIFF.hard,{label:'KHÓ',enemyHp:1.06,enemySpeed:1.17,damage:1.22,spawn:.82,quota:1.18,bossHp:1.08,bossRate:.82,summons:1.28});
for(const k of Object.keys(ENEMY)) ENEMY[k].ranged=false;
ENEMY.spitter.speed=.105; ENEMY.spitter.sway=1.9; // former ranged type now behaves as an evasive toxin crawler.

const BOSS_STYLE=[
  {color:'#cc4b76',accent:'#ff9db7',shot:'#ff5f86',rad:82},
  {color:'#6c65c9',accent:'#b8a7ff',shot:'#8e75ff',rad:88},
  {color:'#8c5a3f',accent:'#d7b05b',shot:'#d89a3f',rad:92},
  {color:'#536c8d',accent:'#8fe4ff',shot:'#62c9ff',rad:92},
  {color:'#387f82',accent:'#8affde',shot:'#5de2ca',rad:96},
  {color:'#761d38',accent:'#ff575f',shot:'#ff304f',rad:104},
  {color:'#274a62',accent:'#9eeeff',shot:'#64ddff',rad:112},
];
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function bossPhase(e){const r=e.hp/e.maxHp;return r>.67?1:r>.34?2:3;}
function sourceXFor(type){
  if(type==='wall')return Math.random()<.5?.08:.92;
  if(type==='flyer'||type==='spore')return .20+Math.random()*.60;
  const sources=[[.18,.30,.70,.82,.50],[.14,.28,.50,.72,.86],[.12,.34,.50,.66,.88],[.10,.26,.50,.74,.90],[.16,.38,.62,.84,.50],[.12,.30,.50,.70,.88],[.08,.22,.38,.50,.62,.78,.92]][state.stageIndex]||[.18,.34,.50,.66,.82];
  return clamp(sources[(Math.random()*sources.length)|0]+(Math.random()-.5)*.035,.07,.93);
}

spawnEnemy = function(type,boss=false){
  const base=ENEMY[type]||ENEMY.basic,d=DIFF[state.difficulty],style=BOSS_STYLE[state.stageIndex];
  const hp=(boss?state.cfg.bossHp*d.bossHp:base.hp*d.enemyHp);
  const x=boss?.5:sourceXFor(type), side=x<.5?-1:1;
  const e={id:Math.random(),type,boss,name:boss?state.cfg.boss:null,bossKind:boss?state.cfg.bossKind:null,x,baseX:x,depth:boss?.70:.92+Math.random()*.07,hp,maxHp:hp,
    speed:(boss?.026:base.speed)*d.enemySpeed*(.91+Math.random()*.16),rad:boss?style.rad:base.rad,color:boss?style.color:base.color,
    accent:boss?style.accent:null,shotColor:boss?style.shot:null,phase:Math.random()*6.28,wobble:Math.random()*1.8+1,attackTimer:boss?1.55:999,summon:boss?3.8:999,
    flash:0,dead:false,side,base,lastBossPhase:1,guard:0,orbit:Math.random()*6.28};
  state.enemies.push(e);
  if(boss){state.bossIntro=2.05;state.enemyShots.length=0;show(UI.bossBar);UI.bossName.textContent=state.cfg.boss;sfx.boss();toast(`⚠ ${state.cfg.boss}`,2);}
  return e;
};

function fireBossShot(e,targetOffset=0,damage=1.2,color=e.shotColor,speed=145,size=8){
  const s=enemyScreen(e),targetPlayerX=clamp(state.playerX+targetOffset,-1,1),tx=playerScreenX(targetPlayerX),ty=innerHeight*.78;
  const dx=tx-s.x,dy=ty-s.y,l=Math.hypot(dx,dy)||1;
  state.enemyShots.push({x:s.x,y:s.y,vx:dx/l*speed,vy:dy/l*speed,t:0,life:Math.max(.55,l/speed),r:size,damage,color,targetPlayerX,bossKind:e.bossKind});
}
fireEnemyShot = function(e){ if(e?.boss) fireBossShot(e); };

function bossAttack(e,phase,d){
  const k=e.bossKind,rate=d.bossRate;
  if(k===0){ // Virus Mother: precise pulse -> double -> triple spread
    const offsets=phase===1?[0]:phase===2?[-.16,.16]:[-.28,0,.28]; offsets.forEach((o,i)=>setTimeout(()=>state?.mode==='playing'&&!e.dead&&fireBossShot(e,o,1.0+.12*phase,e.shotColor,146+phase*10,8),i*90)); e.attackTimer=(1.32-.12*phase)*rate;
  }else if(k===1){ // Bacteria King: alternating acid fan
    const n=phase===1?3:phase===2?4:5; for(let i=0;i<n;i++)fireBossShot(e,(i-(n-1)/2)*.17,1.0+.1*phase,e.shotColor,138+phase*9,7); e.attackTimer=(1.58-.15*phase)*rate;
  }else if(k===2){ // Giant Spore: staggered falling-looking spores
    const n=phase+2; for(let i=0;i<n;i++)setTimeout(()=>state?.mode==='playing'&&!e.dead&&fireBossShot(e,(Math.random()-.5)*.65,1.0+.12*phase,e.shotColor,118+phase*8,10),i*125); e.attackTimer=(1.82-.13*phase)*rate;
  }else if(k===3){ // Resistant superbug: armored burst and narrow safe gaps
    const offsets=phase===1?[-.22,.22]:phase===2?[-.42,-.12,.18,.45]:[-.52,-.30,0,.28,.52]; offsets.forEach(o=>fireBossShot(e,o,1.08+.14*phase,e.shotColor,155,8)); e.guard=.42; e.attackTimer=(1.72-.16*phase)*rate;
  }else if(k===4){ // Mutant: oscillating targeted attacks
    fireBossShot(e,0,1.12+.12*phase,e.shotColor,165,8); if(phase>=2){fireBossShot(e,-.30,1.0,e.shotColor,145,7);fireBossShot(e,.30,1.0,e.shotColor,145,7);} if(phase===3){fireBossShot(e,(Math.random()<.5?-1:1)*.48,1.2,e.shotColor,172,9);} e.attackTimer=(1.38-.12*phase)*rate;
  }else{ // Ultimate source: mixed salvos, phase 3 is rage
    const n=phase===1?3:phase===2?5:7; for(let i=0;i<n;i++){const o=(i-(n-1)/2)*(phase===3?.15:.19);fireBossShot(e,o,1.0+.16*phase,e.shotColor,150+phase*10,phase===3?9:8);} e.attackTimer=(1.48-.18*phase)*rate;
  }
}
function updateBoss(e,dt,d){
  const phase=bossPhase(e); e.lastBossPhase=e.lastBossPhase||1;
  if(phase!==e.lastBossPhase){e.lastBossPhase=phase;sfx.boss();toast(phase===3?'🔥 BOSS CUỒNG NỘ!':`⚠ ${e.name} · PHASE ${phase}`,1.25);}
  e.phase+=dt*(1.4+phase*.35); e.flash=Math.max(0,e.flash-dt*6); e.guard=Math.max(0,(e.guard||0)-dt);
  const amp=[.12,.18,.14,.10,.22,.16,.20][e.bossKind]??.16; e.baseX=.5+Math.sin(e.phase*(.32+e.bossKind*.025))*amp; e.x=e.baseX; e.depth=.67+Math.sin(e.phase*.38)*.018;
  if(state.bossIntro>0)return;
  e.summon-=dt;
  const summonEvery=(4.4-.25*phase)/d.summons;
  if(e.summon<=0){e.summon=summonEvery;const maxSummon=state.difficulty==='easy'?1:state.difficulty==='hard'?Math.min(3,phase+1):Math.min(2,phase);for(let i=0;i<maxSummon;i++)spawnEnemy(state.cfg.mix[(Math.random()*state.cfg.mix.length)|0],false);}
  e.attackTimer-=dt;if(e.attackTimer<=0)bossAttack(e,phase,d);
}

update = function(dt){
  if(!state||state.mode!=='playing')return;const d=DIFF[state.difficulty];state.stageElapsed+=dt;
  if(!state.v13Init){state.v13Init=true;state.spawnLeft=Math.max(10,Math.round(state.cfg.quota*d.quota));state.contamination=100;}
  if(state.transition>0){state.transition+=dt;state.zoom=Math.min(1,state.transition/2.2);if(state.transition>2.15&&!state.nextPanel){state.nextPanel=true;stageCompletePanel();}return;}
  state.zoom=Math.min(.13,state.stageElapsed*.0025);if(state.shake>0)state.shake=Math.max(0,state.shake-dt);if(state.bossIntro>0)state.bossIntro=Math.max(0,state.bossIntro-dt);
  state.dashCooldown=Math.max(0,state.dashCooldown-dt);state.dashTimer=Math.max(0,state.dashTimer-dt);state.dodgeTilt*=Math.pow(.001,dt);state.recoil=Math.max(0,state.recoil-dt*7.5);state.muzzleFlash=Math.max(0,state.muzzleFlash-dt*10);state.dodgeMessage=Math.max(0,state.dodgeMessage-dt);
  const axis=movementAxis();if(Math.abs(axis)>.03)state.lastMoveDir=axis<0?-1:1;
  if(state.dashTimer>0)state.playerVX=state.dashDir*2.55;else{const accel=6.8,maxSpeed=1.12,friction=8.2;if(Math.abs(axis)>.03)state.playerVX+=axis*accel*dt;else state.playerVX*=Math.max(0,1-friction*dt);state.playerVX=clamp(state.playerVX,-maxSpeed,maxSpeed);}
  state.playerX=clamp(state.playerX+state.playerVX*dt,-1,1);if(Math.abs(state.playerX)>=1&&Math.sign(state.playerVX)===Math.sign(state.playerX))state.playerVX=0;
  if(state.toastTimer>0){state.toastTimer-=dt;if(state.toastTimer<=0)hide(UI.toast)}if(state.comboTimer>0){state.comboTimer-=dt;if(state.comboTimer<=0){state.combo=0;setCombo()}}
  if(state.shield>0)state.shield-=dt;if(state.drone>0)state.drone-=dt;state.beam=Math.min(100,state.beam+18*dt);
  if(state.spawnLeft>0){state.spawnTimer-=dt;if(state.spawnTimer<=0){const t=state.cfg.mix[(Math.random()*state.cfg.mix.length)|0];spawnEnemy(t,false);state.spawnLeft--;state.spawnTimer=state.cfg.spawn*d.spawn*(.74+Math.random()*.52);}}
  else if(!state.bossSpawned&&state.enemies.length===0){state.bossSpawned=true;spawnEnemy(state.cfg.mix[0],true);}
  for(const e of state.enemies){if(e.dead)continue;if(e.boss){updateBoss(e,dt,d);continue;}e.phase+=dt*(1.7+(e.base.pulse||0));e.flash=Math.max(0,e.flash-dt*6);
    const swayFactor=e.type==='flagella'?1.8:e.type==='spitter'?2.2:e.base.sway||.7;const sway=swayFactor*Math.sin(e.phase*e.wobble)*.012;e.x=clamp(e.baseX+sway,.04,.96);
    let motion=1;if(e.type==='breather')motion=.72+.42*(.5+.5*Math.sin(e.phase*1.7));if(e.base.charge&&e.depth<.46)motion=1.85;if(e.base.fly)motion*=1.06;e.depth-=e.speed*dt*motion;
    if(e.depth<=.08){const sc=enemyScreen(e),hitRadius=Math.max(46,Math.min(100,sc.r*.72+innerWidth*.022));if(Math.abs(playerScreenX()-sc.x)<hitRadius)damagePlayer(e.base.attack*d.damage);else{state.score+=35;sfx.dodgeSuccess();toast('↔ NÉ ĐƯỢC VIRUS!',.55);}e.dead=true;burstAt(sc.x,sc.y,e.color,8);}
  }
  state.enemies=state.enemies.filter(e=>!e.dead);
  // ONLY boss projectiles exist in v1.3.
  for(const sh of state.enemyShots){sh.t+=dt;sh.x+=sh.vx*dt;sh.y+=sh.vy*dt;sh.r+=18*dt;if(sh.t>=sh.life){const hitRadius=Math.max(42,Math.min(82,innerWidth*.052));if(Math.abs(playerScreenX()-playerScreenX(sh.targetPlayerX))<hitRadius)damagePlayer(sh.damage*d.damage);else{state.score+=20;sfx.dodgeSuccess();toast('↔ NÉ ĐÒN BOSS!',.5);}sh.dead=true;}}
  state.enemyShots=state.enemyShots.filter(s=>!s.dead);
  for(const p of state.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=12*dt;p.a=Math.max(0,p.life/p.max);}state.particles=state.particles.filter(p=>p.life>0);
  for(const tr of state.tracers){tr.t+=dt;tr.life-=dt;}state.tracers=state.tracers.filter(tr=>tr.life>0);for(const hm of state.hitMarkers)hm.life-=dt;state.hitMarkers=state.hitMarkers.filter(hm=>hm.life>0);
  for(const p of state.powerups){p.t+=dt;p.y+=Math.sin(p.t*3)*.15;p.life-=dt;if(p.life<=0)p.dead=true;}state.powerups=state.powerups.filter(p=>!p.dead);
  if(state.drone>0&&state.enemies.length){state._droneTimer=(state._droneTimer||0)-dt;if(state._droneTimer<=0){state._droneTimer=.42;const target=state.enemies.find(e=>!e.dead);if(target)hitEnemy(target,.75,false,true);}}
  if(state.bossSpawned&&!state.bossDefeated&&!state.enemies.some(e=>e.boss)&&state.spawnLeft<=0){state.bossDefeated=true;beginStageClear();}updateHUD();
};

// Boss armor is behavior based, not inflated HP.
const oldHitEnemyV13=hitEnemy;
hitEnemy = function(e,damage,countHit=true,drone=false,crit=false){
  if(e?.boss&&e.bossKind===3&&e.guard>0&&!crit)damage*=.42; // resistant boss guard window
  return oldHitEnemyV13(e,damage,countHit,drone,crit);
};

const ENV={
  lab:{sky:'#d9f5f5',wall:'#c5e4e5',floor:'#a7c4c6',accent:'#32a9b7',dark:'#1d6670'},
  er:{sky:'#edf0ed',wall:'#d7ddd9',floor:'#aeb7b4',accent:'#d34c4f',dark:'#7b3033'},
  isolation:{sky:'#cad8d8',wall:'#aebfc1',floor:'#869b9d',accent:'#e4b735',dark:'#4c5960'},
  icu:{sky:'#d7eef5',wall:'#b6d5df',floor:'#8faeb9',accent:'#2c8db0',dark:'#205568'},
  source:{sky:'#2b1c25',wall:'#3e202c',floor:'#25141b',accent:'#ff365a',dark:'#12090d'}
};
function drawPerspectiveRoom(env,t){
  const w=innerWidth,h=innerHeight,vx=w*.5,vy=h*.36,p=ENV[env];ctx.fillStyle=p.sky;ctx.fillRect(0,0,w,h);
  // ceiling, side walls, floor
  let g=ctx.createLinearGradient(0,0,0,vy);g.addColorStop(0,shade(p.sky,18));g.addColorStop(1,p.sky);ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(w,0);ctx.lineTo(vx+w*.11,vy);ctx.lineTo(vx-w*.11,vy);ctx.closePath();ctx.fill();
  ctx.fillStyle=p.wall;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(vx-w*.11,vy);ctx.lineTo(vx-w*.13,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(w,0);ctx.lineTo(vx+w*.11,vy);ctx.lineTo(vx+w*.13,h);ctx.lineTo(w,h);ctx.closePath();ctx.fill();
  g=ctx.createLinearGradient(0,vy,0,h);g.addColorStop(0,shade(p.floor,18));g.addColorStop(1,p.floor);ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(vx-w*.11,vy);ctx.lineTo(vx+w*.11,vy);ctx.lineTo(w,h);ctx.lineTo(0,h);ctx.closePath();ctx.fill();
  // perspective floor seams and ceiling lights
  ctx.strokeStyle='rgba(255,255,255,.24)';ctx.lineWidth=1;for(let i=-5;i<=5;i++){ctx.beginPath();ctx.moveTo(vx+i*w*.018,vy);ctx.lineTo(vx+i*w*.13,h);ctx.stroke();}
  for(let z=0;z<6;z++){const yy=vy-(z+1)*h*.055,ww=w*(.10+z*.035);ctx.fillStyle='rgba(255,255,255,.75)';ctx.fillRect(vx-ww/2,yy,ww,4+z*.3);}
  // doors / bays on both sides
  for(let i=0;i<5;i++){const q=(i+1)/6,yy=vy+(h-vy)*q*q*.9,doorH=26+q*95,doorW=20+q*58;for(const side of [-1,1]){const xx=vx+side*(w*.13+q*w*.34);ctx.fillStyle=shade(p.wall,-25);ctx.fillRect(xx-(side<0?doorW:0),yy-doorH,doorW,doorH);ctx.strokeStyle='rgba(255,255,255,.34)';ctx.strokeRect(xx-(side<0?doorW:0),yy-doorH,doorW,doorH);}}
  // environment identity
  if(env==='lab'){for(let side of [-1,1]){ctx.fillStyle='rgba(236,255,255,.82)';ctx.fillRect(side<0?0:w*.72,h*.57,w*.28,h*.16);ctx.fillStyle=p.dark;for(let i=0;i<3;i++)ctx.fillRect((side<0?25:w*.75)+i*w*.07,h*.59,w*.045,h*.055);ctx.fillStyle='#67e6ef';for(let i=0;i<7;i++)ctx.fillRect((side<0?20:w*.76)+i*13,h*.70-(i%2)*6,7,18+(i%3)*5);}}
  if(env==='er'){ctx.fillStyle='rgba(190,26,34,.90)';ctx.fillRect(vx-w*.11,vy-30,w*.22,24);ctx.fillStyle='white';ctx.textAlign='center';ctx.font='900 13px system-ui';ctx.fillText('CẤP CỨU',vx,vy-13);for(let side of [-1,1]){ctx.strokeStyle=p.accent;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(vx+side*w*.22,h*.72);ctx.lineTo(vx+side*w*.39,h*.82);ctx.stroke();ctx.fillStyle='#dce7e5';ctx.fillRect(vx+side*w*.23-(side<0?80:0),h*.77,80,18);}}
  if(env==='isolation'){ctx.fillStyle='rgba(17,28,30,.82)';ctx.fillRect(vx-w*.12,vy-28,w*.24,22);ctx.fillStyle='#ffd84a';ctx.textAlign='center';ctx.font='900 12px system-ui';ctx.fillText('KHU CÁCH LY',vx,vy-12);ctx.strokeStyle='#f2c43d';ctx.lineWidth=7;for(let y=h*.58;y<h*.85;y+=45){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w*.18,y+28);ctx.stroke();ctx.beginPath();ctx.moveTo(w,y);ctx.lineTo(w*.82,y+28);ctx.stroke();}}
  if(env==='icu'){for(let side of [-1,1]){const bx=vx+side*w*.29;ctx.fillStyle='rgba(236,250,253,.82)';ctx.fillRect(bx-(side<0?105:0),h*.68,105,30);ctx.fillStyle=p.dark;ctx.fillRect(bx-(side<0?92:-10),h*.60,82,54);ctx.strokeStyle='#73f1e3';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<6;i++){const xx=bx-(side<0?85:-17)+i*11,yy=h*.63+Math.sin(i*1.7+t*.005)*9;if(i===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);}ctx.stroke();}}
  if(env==='source'){const rg=ctx.createRadialGradient(vx,vy+25,10,vx,vy+25,w*.26);rg.addColorStop(0,'rgba(255,52,84,.48)');rg.addColorStop(.35,'rgba(120,18,43,.28)');rg.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=rg;ctx.fillRect(0,0,w,h);ctx.strokeStyle='rgba(255,70,94,.48)';ctx.lineWidth=4;for(let i=0;i<7;i++){ctx.beginPath();ctx.moveTo(i*w/6,0);ctx.quadraticCurveTo(vx+(i-3)*30,vy,vx,vy+35);ctx.stroke();}ctx.fillStyle='rgba(255,42,72,.75)';ctx.beginPath();ctx.arc(vx,vy+22,18+Math.sin(t*.004)*4,0,Math.PI*2);ctx.fill();}
  const fog=ctx.createLinearGradient(0,vy,0,h);fog.addColorStop(0,'rgba(255,255,255,.02)');fog.addColorStop(1,env==='source'?'rgba(35,3,12,.32)':'rgba(6,53,57,.10)');ctx.fillStyle=fog;ctx.fillRect(0,vy,w,h-vy);
}

drawBackground = function(t){
  const w=innerWidth,h=innerHeight;ctx.save();const sh=state?.shake||0;if(sh>0)ctx.translate((Math.random()-.5)*5,(Math.random()-.5)*4);
  if(!state||state.stageIndex===0){ctx.fillStyle='#d9e4df';ctx.fillRect(0,0,w,h);const scene=state?stageBgs[0]:bg;if(scene&&scene.complete&&scene.width){const imgR=scene.width/scene.height,scrR=w/h;let dw,dh;const z=1.035+(state?.zoom||0)*.42+(state?.transition||0>0?Math.min(.34,state.zoom*.28):0);if(scrR>imgR){dw=w*z;dh=dw/imgR}else{dh=h*z;dw=dh*imgR}const targetY=h*.48;ctx.drawImage(scene,(w-dw)/2,(h-dh)/2-(z-1)*targetY*.55,dw,dh);}}
  else drawPerspectiveRoom(state.cfg.env,t);
  if(state){ctx.fillStyle=state.cfg.tint;ctx.fillRect(0,0,w,h);const grad=ctx.createLinearGradient(0,0,0,h);grad.addColorStop(0,'rgba(4,46,52,.08)');grad.addColorStop(.62,'rgba(4,46,52,0)');grad.addColorStop(1,'rgba(4,46,52,.16)');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);}ctx.restore();
};

function drawBoss(e,t){
  const s=enemyScreen(e),r=s.r*(1+.04*Math.sin(e.phase*2.1)),k=e.bossKind,accent=e.accent||'#fff';ctx.save();ctx.translate(s.x,s.y);
  const aura=ctx.createRadialGradient(0,0,r*.18,0,0,r*1.65);aura.addColorStop(0,accent+'55');aura.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=aura;ctx.beginPath();ctx.arc(0,0,r*1.65,0,Math.PI*2);ctx.fill();
  ctx.globalAlpha=.18;ctx.fillStyle='#06191b';ctx.beginPath();ctx.ellipse(0,r*.92,r*.92,r*.19,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
  if(k===0){ // round mother with orbiting children
    const n=18;ctx.beginPath();for(let i=0;i<=n;i++){const a=i/n*Math.PI*2,rr=r*(1+.10*Math.sin(a*5+e.phase));const x=Math.cos(a)*rr,y=Math.sin(a)*rr*.87;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.fillStyle=e.color;ctx.fill();for(let i=0;i<8;i++){const a=i/8*Math.PI*2+e.phase*.16;ctx.fillStyle=accent;ctx.beginPath();ctx.arc(Math.cos(a)*r*1.18,Math.sin(a)*r*.94,r*.10,0,Math.PI*2);ctx.fill();}}
  else if(k===1){ // long segmented bacteria king
    ctx.lineCap='round';ctx.strokeStyle=e.color;ctx.lineWidth=r*.52;ctx.beginPath();for(let i=0;i<7;i++){const xx=(i-3)*r*.38,yy=Math.sin(e.phase+i*.8)*r*.26;i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)}ctx.stroke();ctx.strokeStyle=accent;ctx.lineWidth=r*.07;for(let i=0;i<9;i++){const xx=(i-4)*r*.31,yy=Math.sin(e.phase+i*.7)*r*.25;ctx.beginPath();ctx.moveTo(xx,yy);ctx.lineTo(xx+Math.sin(i)*r*.22,yy-r*.48);ctx.stroke();}}
  else if(k===2){ // giant spore flower
    ctx.fillStyle=e.color;for(let i=0;i<10;i++){const a=i/10*Math.PI*2+e.phase*.04;ctx.beginPath();ctx.ellipse(Math.cos(a)*r*.56,Math.sin(a)*r*.46,r*.48,r*.22,a,0,Math.PI*2);ctx.fill();}ctx.fillStyle=shade(e.color,-25);ctx.beginPath();ctx.arc(0,0,r*.60,0,Math.PI*2);ctx.fill();}
  else if(k===3){ // armored resistant superbug
    ctx.fillStyle=e.color;ctx.beginPath();for(let i=0;i<12;i++){const a=i/12*Math.PI*2,rr=i%2?r*.82:r*1.08;const x=Math.cos(a)*rr,y=Math.sin(a)*rr*.82;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.fill();ctx.strokeStyle=accent;ctx.lineWidth=r*.08;for(let i=0;i<6;i++){const a=i/6*Math.PI*2;ctx.beginPath();ctx.arc(Math.cos(a)*r*.54,Math.sin(a)*r*.44,r*.19,0,Math.PI*2);ctx.stroke();}}
  else if(k===4){ // multi-eye mutant
    ctx.fillStyle=e.color;ctx.beginPath();ctx.ellipse(0,0,r*.94,r*.78,Math.sin(e.phase*.2)*.08,0,Math.PI*2);ctx.fill();for(let i=0;i<7;i++){const a=i/7*Math.PI*2+e.phase*.08;ctx.fillStyle=accent;ctx.beginPath();ctx.arc(Math.cos(a)*r*.56,Math.sin(a)*r*.43,r*.16,0,Math.PI*2);ctx.fill();ctx.fillStyle='#0a3940';ctx.beginPath();ctx.arc(Math.cos(a)*r*.56,Math.sin(a)*r*.43,r*.07,0,Math.PI*2);ctx.fill();}}
  else { // ultimate multi-core source
    ctx.fillStyle=e.color;for(let i=0;i<6;i++){const a=i/6*Math.PI*2+e.phase*.03;ctx.beginPath();ctx.ellipse(Math.cos(a)*r*.46,Math.sin(a)*r*.40,r*.52,r*.30,a,0,Math.PI*2);ctx.fill();}ctx.fillStyle='#260711';ctx.beginPath();ctx.arc(0,0,r*.58,0,Math.PI*2);ctx.fill();for(let i=0;i<4;i++){const a=i/4*Math.PI*2+e.phase*.18;ctx.fillStyle=accent;ctx.beginPath();ctx.arc(Math.cos(a)*r*.31,Math.sin(a)*r*.25,r*.13,0,Math.PI*2);ctx.fill();}}
  // common weak core and phase ring
  const ph=bossPhase(e),corePulse=1+.11*Math.sin(e.phase*3);ctx.fillStyle=ph===3?'#fff36e':'#f5ffff';ctx.shadowColor=accent;ctx.shadowBlur=20;ctx.beginPath();ctx.ellipse(0,0,r*.22*corePulse,r*.17*corePulse,0,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#241020';ctx.beginPath();ctx.ellipse(Math.sin(e.phase*.35)*r*.028,0,r*.065,r*.115,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(-r*.022,-r*.052,r*.018,0,Math.PI*2);ctx.fill();ctx.strokeStyle=accent;ctx.lineWidth=3;ctx.shadowColor=accent;ctx.shadowBlur=8;ctx.beginPath();ctx.arc(0,0,r*(.30+.04*ph),0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;
  // boss mouth / lower facial plane adds readable 3D character
  ctx.fillStyle='rgba(30,4,12,.72)';ctx.beginPath();ctx.ellipse(0,r*.36,r*.34,r*.13,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(255,255,255,.88)';for(let i=-2;i<=2;i++){ctx.beginPath();ctx.moveTo(i*r*.11-r*.045,r*.27);ctx.lineTo(i*r*.11,r*.39);ctx.lineTo(i*r*.11+r*.045,r*.27);ctx.closePath();ctx.fill();}
  ctx.fillStyle='rgba(3,24,28,.84)';ctx.font=`900 ${Math.max(11,r*.16)}px system-ui`;ctx.textAlign='center';ctx.fillText(e.name,0,-r*1.28);ctx.restore();
}

const drawEnemyV12=drawEnemy;
drawEnemy = function(e,t){if(e.boss){drawBoss(e,t);return;}drawEnemyV12(e,t);};
const updateHUDV12=updateHUD;
updateHUD = function(){updateHUDV12();if(state&&UI.stageName)UI.stageName.textContent=`MÀN ${state.stageIndex+1} · ${state.cfg.name}`;if(state&&UI.diffBadge)UI.diffBadge.textContent=`${DIFF[state.difficulty].label} · ${state.difficulty==='easy'?'THƯ GIÃN':state.difficulty==='hard'?'THỬ THÁCH':'CÂN BẰNG'}`;};
function drawBossIntro(){if(!state?.bossIntro||state.bossIntro<=0)return;const a=Math.min(1,state.bossIntro/.45, (2.05-state.bossIntro)/.3);ctx.save();ctx.globalAlpha=clamp(a,0,1);ctx.fillStyle='rgba(3,20,24,.66)';ctx.fillRect(0,innerHeight*.39,innerWidth,innerHeight*.22);ctx.textAlign='center';ctx.fillStyle='#ffdd79';ctx.font=`900 ${Math.max(13,Math.min(22,innerWidth*.018))}px system-ui`;ctx.fillText('⚠ BOSS CUỐI MÀN',innerWidth/2,innerHeight*.455);ctx.fillStyle='white';ctx.font=`900 ${Math.max(24,Math.min(46,innerWidth*.042))}px system-ui`;ctx.fillText(state.cfg.boss,innerWidth/2,innerHeight*.525);ctx.fillStyle='#bcece7';ctx.font='800 12px system-ui';ctx.fillText('BẮN VÀO LÕI SÁNG · DI CHUYỂN NGANG ĐỂ NÉ ĐÒN',innerWidth/2,innerHeight*.57);ctx.restore();}

function render(t){ drawBackground(t); if(state){ const sorted=[...state.enemies].sort((a,b)=>b.depth-a.depth); for(const e of sorted)drawEnemy(e,t); drawEnemyShots(); drawTracers(); drawPowerups(); drawParticles(); drawHitMarkers(); drawDrone(t); drawPlayerShadow(t); drawWeapon(t); drawCrosshair(); drawBossIntro(); if(state.transition>0){const a=Math.min(.55,state.transition/2.3*.55);ctx.fillStyle=`rgba(225,255,249,${a})`;ctx.fillRect(0,0,innerWidth,innerHeight);} } }

function loop(now){ const dt=Math.min(.04,(now-last)/1000||.016);last=now;if(state?.mode==='playing')update(dt);render(now);raf=requestAnimationFrame(loop); }
function drawAttract(){ drawBackground(performance.now()); }
bg.onload=drawAttract;

function pointerPos(ev){ const r=canvas.getBoundingClientRect(); const t=ev.touches?.[0]||ev.changedTouches?.[0]||ev; return {x:(t.clientX-r.left),y:(t.clientY-r.top)}; }
canvas.addEventListener('pointermove',e=>{pointer=Object.assign(pointer,pointerPos(e));if(pointer.down && state?.mode==='playing' && [2,4].includes(state.weapon)){shoot(pointer.x,pointer.y)}});
canvas.addEventListener('pointerdown',e=>{e.preventDefault();const p=pointerPos(e);pointer.x=p.x;pointer.y=p.y;pointer.down=true;ensureAudio();if(collectPowerups(p.x,p.y))return;shoot(p.x,p.y)});
addEventListener('pointerup',()=>pointer.down=false);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
const lastTap={left:0,right:0};
function setMoveKey(dir,down){if(!state)return;if(dir<0)state.moveLeft=down;else state.moveRight=down;}
addEventListener('keydown',e=>{
  if(e.key>='1'&&e.key<='5')selectWeapon(+e.key-1);
  const left=e.key==='a'||e.key==='A'||e.key==='ArrowLeft',right=e.key==='d'||e.key==='D'||e.key==='ArrowRight';
  if(left||right){e.preventDefault();const dir=left?-1:1;setMoveKey(dir,true);if(!e.repeat){const key=dir<0?'left':'right',now=performance.now();if(lastTap[key]&&now-lastTap[key]<245)dash(dir);lastTap[key]=now;}}
  if(e.code==='Space'&&!e.repeat&&state?.mode==='playing'){e.preventDefault();dash(Math.sign(movementAxis())||state.lastMoveDir||1);}
  if(e.key==='Escape'){if(state?.mode==='playing')pauseGame();else if(state?.mode==='paused')resumeGame();}
});
addEventListener('keyup',e=>{const left=e.key==='a'||e.key==='A'||e.key==='ArrowLeft',right=e.key==='d'||e.key==='D'||e.key==='ArrowRight';if(left||right){e.preventDefault();setMoveKey(left?-1:1,false);}});
addEventListener('blur',()=>{if(state){state.moveLeft=false;state.moveRight=false;state.mobileMoveAxis=0;}});

window.__selectedStage=0;let settingsReturn='menu';
function stageMenuText(i){const c=STAGES[i]||STAGES[0];return c.menuLabel||`MÀN ${i+1} · ${c.name}`;}
function selectStageCard(i){window.__selectedStage=clamp(i,0,STAGES.length-1);$$('.stage-card').forEach((b,n)=>b.classList.toggle('selected',n===window.__selectedStage));const label=$('#selectedStageLabel');if(label)label.textContent=stageMenuText(window.__selectedStage);const start=$('#startBtn');if(start)start.textContent=`▶ BẮT ĐẦU · ${STAGES[window.__selectedStage].name}`;}
$$('.stage-card').forEach(b=>b.onclick=()=>selectStageCard(+b.dataset.stage));
$('#startBtn').onclick=()=>startGame(window.__selectedStage||0); $('#howBtn').onclick=()=>show(UI.help); $$('[data-close]').forEach(b=>b.onclick=()=>hide(document.getElementById(b.dataset.close)));
function openSettings(from='menu'){settingsReturn=from;if(from==='pause')hide(UI.pause);show($('#settingsPanel'));}
function closeSettings(){hide($('#settingsPanel'));if(settingsReturn==='pause'&&state?.mode==='paused')show(UI.pause);}
$('#settingsBtn').onclick=()=>openSettings('menu');$('#pauseSettingsBtn').onclick=()=>openSettings('pause');$('#settingsCloseBtn').onclick=closeSettings;$('#settingsBackBtn').onclick=closeSettings;
$('#pauseBtn').onclick=pauseGame; $('#resumeBtn').onclick=resumeGame;
$('#restartBtn').onclick=()=>{if(!state)return;if(confirm('Chơi lại màn này? Tiến trình hiện tại sẽ mất.'))startGame(state.stageIndex);};
$('#homeBtn').onclick=()=>{if(!state||confirm('Về Menu chính? Tiến trình màn hiện tại sẽ mất.'))goHome();}; $('#gameOverHomeBtn').onclick=goHome; $('#victoryHomeBtn').onclick=goHome;
$('#retryBtn').onclick=()=>startGame(state?.stageIndex||0); $('#victoryReplayBtn').onclick=()=>startGame(0);
$('#nextStageBtn').onclick=()=>startGame(Math.min(STAGES.length-1,(state?.stageIndex||0)+1));
$('#soundBtn').onclick=()=>{audioEnabled=!audioEnabled;$('#soundBtn').textContent=`${audioEnabled?'🔊':'🔇'} Âm thanh: ${audioEnabled?'Bật':'Tắt'}`};
$('#fullscreenBtn').onclick=async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch{toast('Trình duyệt không hỗ trợ toàn màn hình',1)}};
$$('.difficulty').forEach(b=>b.onclick=()=>{$$('.difficulty').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');window.__difficulty=b.dataset.difficulty});
selectStageCard(0);
$$('#weaponButtons button').forEach(b=>b.onclick=()=>selectWeapon(+b.dataset.weapon));
const movePad=$('#movePad'),moveKnob=$('#moveKnob'),dashBtn=$('#dashBtn');
let movePointerId=null;
function updateMovePad(clientX){
  if(!movePad||!state)return;const r=movePad.getBoundingClientRect(),center=r.left+r.width/2,max=Math.max(1,r.width*.34);let axis=(clientX-center)/max;axis=Math.max(-1,Math.min(1,axis));state.mobileMoveAxis=axis;if(Math.abs(axis)>.08)state.lastMoveDir=axis<0?-1:1;if(moveKnob)moveKnob.style.transform=`translateX(${axis*max}px)`;
}
function releaseMovePad(){if(state)state.mobileMoveAxis=0;if(moveKnob)moveKnob.style.transform='translateX(0px)';movePointerId=null;}
if(movePad){movePad.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();movePointerId=e.pointerId;movePad.setPointerCapture?.(e.pointerId);updateMovePad(e.clientX)});movePad.addEventListener('pointermove',e=>{if(e.pointerId===movePointerId){e.preventDefault();e.stopPropagation();updateMovePad(e.clientX)}});movePad.addEventListener('pointerup',e=>{if(e.pointerId===movePointerId)releaseMovePad()});movePad.addEventListener('pointercancel',releaseMovePad);}
if(dashBtn)dashBtn.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();dash(Math.sign(state?.mobileMoveAxis||0)||state?.lastMoveDir||1)});

addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;show($('#installBtn'))});
$('#installBtn').onclick=async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;hide($('#installBtn'))};
if('serviceWorker'in navigator) addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));


/* === v2.1.0 FINAL CAMPAIGN · SUPPLY NPC · ENVIRONMENT RECOVERY === */
const OFFICIAL_STAGE_BGS = Array.from({length:7},(_,i)=>{const im=new Image();im.src=`assets/stage${i+1}.jpg`;return im;});
const OFFICIAL_FINAL_BG = new Image(); OFFICIAL_FINAL_BG.src='assets/stage-final.jpg';

STAGES.splice(0,STAGES.length,
  {name:'KHOA DƯỢC', menuLabel:'MÀN 1 · KHOA DƯỢC', env:'pharmacy', quota:18, spawn:.88, boss:'VIRUS MẸ KHÁNG THUỐC', bossHp:34, bossKind:0, mix:['basic','flagella','shield','breather'], tint:'rgba(29,154,181,.010)'},
  {name:'KHOA CẤP CỨU', menuLabel:'MÀN 2 · KHOA CẤP CỨU', env:'er', quota:23, spawn:.75, boss:'VI KHUẨN XUNG KÍCH', bossHp:45, bossKind:1, mix:['charger','cluster','basic','wall'], tint:'rgba(171,73,153,.010)'},
  {name:'KHOA HÔ HẤP', menuLabel:'MÀN 3 · KHOA HÔ HẤP', env:'respiratory', quota:27, spawn:.68, boss:'BÀO TỬ HÔ HẤP KHỔNG LỒ', bossHp:58, bossKind:2, mix:['spore','flyer','breather','flagella'], tint:'rgba(56,174,121,.010)'},
  {name:'KHOA NHI', menuLabel:'MÀN 4 · KHOA NHI', env:'pediatrics', quota:31, spawn:.62, boss:'SIÊU VI KHUẨN BIẾN DỊ', bossHp:70, bossKind:3, mix:['wall','charger','cluster','spore'], tint:'rgba(231,98,145,.010)'},
  {name:'KHOA SẢN', menuLabel:'MÀN 5 · KHOA SẢN', env:'maternity', quota:35, spawn:.56, boss:'DỊ CHỦNG SẢN KHOA', bossHp:86, bossKind:4, mix:['shield','nucleus','elite','breather'], tint:'rgba(50,107,167,.010)'},
  {name:'KHOA THẦN KINH', menuLabel:'MÀN 6 · KHOA THẦN KINH', env:'neuro', quota:40, spawn:.49, boss:'DỊ CHỦNG THẦN KINH', bossHp:112, bossKind:5, mix:['nucleus','elite','flyer','charger'], tint:'rgba(225,148,72,.010)'},
  {name:'TRẬN CHIẾN CUỐI CÙNG', menuLabel:'MÀN 7 · TRẬN CHIẾN CUỐI CÙNG', env:'final', quota:46, spawn:.45, boss:'NGUỒN BỆNH TỐI THƯỢNG', bossHp:142, bossKind:6, mix:['elite','nucleus','cluster','charger','flyer','shield'], tint:'rgba(74,139,170,.008)', final:true}
);
Object.assign(DIFF.easy,{rewardEvery:8.2,rewardMax:4});Object.assign(DIFF.normal,{rewardEvery:10.0,rewardMax:3});Object.assign(DIFF.hard,{rewardEvery:11.8,rewardMax:3});

const SUPPORT_ITEMS={
  shield:{icon:'🛡',name:'KHIÊN',duration:6,field:'shield',color:'#62d9ff'},
  drone:{icon:'🤖',name:'DRONE',duration:10,field:'drone',color:'#5ff5e6'},
  adrenaline:{icon:'💉',name:'ADRENALINE',duration:5,field:'adrenaline',color:'#ff9b47'},
  vaccine:{icon:'🧬',name:'VACCINE',duration:7,field:'vaccine',color:'#b58cff'},
  sterile:{icon:'🧴',name:'STERILE',duration:6,field:'sterile',color:'#7debd7'},
  gpp:{icon:'✨',name:'GPP BOOST',duration:8,field:'gppBoost',color:'#ffd866'},
};
const SUPPORT_ORDER=['drone','shield','adrenaline','vaccine','sterile','gpp'];

const newStateV210Base=newState;
newState=function(stageIndex=0){
  const s=newStateV210Base(stageIndex),d=DIFF[s.difficulty];
  Object.assign(s,{rewardNpcs:[],rewardNpcTimer:5.5+Math.random()*2.5,rewardNpcCount:0,rewardNpcMax:d.rewardMax||3,
    adrenaline:0,vaccine:0,sterile:0,gppBoost:0,cleanMinorKills:0,environmentClean:0,bossCleanse:0,cleanSparkle:0,
    _supportHudKey:'',_rewardSerial:0});
  return s;
};

function supportExtend(field,amount,cap){state[field]=Math.min(cap,Math.max(0,state[field]||0)+amount);}
function chooseRewardKind(){
  if(state.health<=4 && Math.random()<.62)return 'heal';
  const active=k=>(state[SUPPORT_ITEMS[k]?.field]||0)>1.5;
  const pool=[];
  if(!active('shield'))pool.push('shield','shield');
  if(!active('drone'))pool.push('drone','drone');
  if(!active('adrenaline'))pool.push('adrenaline');
  if(!active('vaccine'))pool.push('vaccine');
  if(!active('sterile'))pool.push('sterile');
  if(state.stageIndex>=1)pool.push('vaccine','sterile');
  if(Math.random()<(state.stageIndex>=4?.10:.055))return 'gpp';
  if(state.health<8)pool.push('heal');
  return pool.length?pool[(Math.random()*pool.length)|0]:'drone';
}
function rewardNpcScreen(n){
  const v=gameplayViewport(),x=v.left+v.width*n.x,y=innerHeight*(n.baseY+Math.sin(n.t*2.9+n.seed)*.035);return{x,y,r:n.kind==='gpp'?30:25};
}
function spawnRewardNpc(){
  if(!state||state.bossSpawned||state.rewardNpcs.some(n=>!n.dead)||state.rewardNpcCount>=state.rewardNpcMax)return;
  const kind=chooseRewardKind(),fromLeft=Math.random()<.5;
  state.rewardNpcs.push({id:++state._rewardSerial,kind,x:fromLeft?-.03:1.03,vx:(fromLeft?1:-1)*(.105+Math.random()*.035),baseY:.43+Math.random()*.22,t:0,life:6.5+(kind==='gpp'?1.1:0),hp:kind==='gpp'?3.2:2.0,maxHp:kind==='gpp'?3.2:2.0,dead:false,seed:Math.random()*10});
  state.rewardNpcCount++;
  toast(kind==='gpp'?'✨ SUPPLY GPP HIẾM XUẤT HIỆN!':'🎁 SUPPLY TARGET!',.9);sfx.power();
}
function dropSpecificPowerup(kind,x,y){state.powerups.push({x,y,kind,t:0,life:7.5,dead:false,beam:1});}
function hitRewardNpc(n,damage){
  if(!n||n.dead)return;n.hp-=damage;const s=rewardNpcScreen(n);burstAt(s.x,s.y,n.kind==='gpp'?'#ffd866':'#70eee2',5);sfx.hit(s.x);
  if(n.hp<=0){n.dead=true;dropSpecificPowerup(n.kind,s.x,s.y+16);state.score+=n.kind==='gpp'?600:220;sfx.kill(s.x);toast(`🎁 ${n.kind==='gpp'?'TRƯỜNG GPP BOOST':'VẬT PHẨM'} ĐÃ RƠI`,.8);}
}
function drawRewardNpc(n,t){
  const s=rewardNpcScreen(n),r=s.r,kind=n.kind;ctx.save();ctx.translate(s.x,s.y);const pulse=1+Math.sin(n.t*5)*.05;ctx.scale(pulse,pulse);
  const color=kind==='heal'?'#64e58b':kind==='shield'?'#63cfff':kind==='drone'?'#5ceadf':kind==='adrenaline'?'#ff9550':kind==='vaccine'?'#a98aff':kind==='sterile'?'#6ee7cb':'#ffd65a';
  const aura=ctx.createRadialGradient(0,0,2,0,0,r*1.8);aura.addColorStop(0,color+'66');aura.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=aura;ctx.beginPath();ctx.arc(0,0,r*1.8,0,Math.PI*2);ctx.fill();
  ctx.shadowColor=color;ctx.shadowBlur=12;ctx.lineWidth=2.2;ctx.strokeStyle='rgba(255,255,255,.88)';ctx.fillStyle='rgba(4,44,49,.88)';
  if(kind==='shield'){ctx.beginPath();for(let i=0;i<6;i++){const a=-Math.PI/2+i*Math.PI/3,x=Math.cos(a)*r,y=Math.sin(a)*r;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.fill();ctx.stroke();}
  else if(kind==='drone'){ctx.beginPath();ctx.roundRect(-r,-r*.55,r*2,r*1.1,8);ctx.fill();ctx.stroke();ctx.strokeStyle=color;for(const sx of [-1,1]){ctx.beginPath();ctx.moveTo(sx*r*.72,-r*.45);ctx.lineTo(sx*r*1.35,-r*.9);ctx.stroke();ctx.beginPath();ctx.arc(sx*r*1.42,-r*.94,r*.28,0,Math.PI*2);ctx.stroke();}}
  else if(kind==='adrenaline'){ctx.rotate(-.35);ctx.beginPath();ctx.roundRect(-r*.9,-r*.38,r*1.8,r*.76,r*.38);ctx.fill();ctx.stroke();ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(r*.9,0);ctx.lineTo(r*1.45,0);ctx.stroke();}
  else if(kind==='vaccine'){ctx.beginPath();ctx.ellipse(0,0,r*.68,r,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle=color;for(let i=-2;i<=2;i++){const y=i*r*.3;ctx.beginPath();ctx.moveTo(-r*.42,y);ctx.bezierCurveTo(-r*.1,y-r*.18,r*.1,y+r*.18,r*.42,y);ctx.stroke();}}
  else if(kind==='sterile'){ctx.beginPath();ctx.arc(0,0,r*.86,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.strokeStyle=color;for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(0,0,r*(.42+i*.26),n.t+i,n.t+i+Math.PI*.9);ctx.stroke();}}
  else if(kind==='gpp'){ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ffe69b';ctx.lineWidth=3;ctx.stroke();if(logoIcon.complete){ctx.save();ctx.beginPath();ctx.arc(0,0,r*.76,0,Math.PI*2);ctx.clip();ctx.drawImage(logoIcon,-r*.76,-r*.76,r*1.52,r*1.52);ctx.restore();}}
  else {ctx.beginPath();ctx.arc(0,0,r*.92,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=color;ctx.font=`900 ${r*.8}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('♥',0,2);}
  ctx.shadowBlur=0;ctx.fillStyle='rgba(1,28,33,.88)';ctx.fillRect(-r*1.2,r*1.15,r*2.4,12);ctx.fillStyle='#fff5a2';ctx.font='900 7px system-ui';ctx.textAlign='center';ctx.fillText('SUPPLY',0,r*1.44);ctx.restore();
}

// Aim system prioritizes the exact object under the crosshair, including distinct reward NPCs.
aimHit=function(x,y,weapon){
  const rewardCandidates=state.rewardNpcs.filter(n=>!n.dead).map(n=>{const s=rewardNpcScreen(n);return{n,s,dist:Math.hypot(x-s.x,y-s.y)}}).filter(c=>c.dist<c.s.r*1.35).sort((a,b)=>a.dist-b.dist);
  const candidates=[];for(const e of state.enemies){const sc=enemyScreen(e),dist=Math.hypot(x-sc.x,y-sc.y);if(dist<sc.r*1.15)candidates.push({e,s:sc,dist});}candidates.sort((a,b)=>a.dist-b.dist);
  if(weapon.kind==='spray'){
    let hit=false,target=null;for(const c of rewardCandidates){if(c.dist<145){hitRewardNpc(c.n,weapon.damage*1.2);hit=true;target=target||c.s;}}
    for(const e of state.enemies){const sc=enemyScreen(e),dist=Math.hypot(x-sc.x,y-sc.y);if(dist<145&&e.depth<.62){hitEnemy(e,weapon.damage*(1.15-e.depth*.35),true,false,false);hit=true;target=target||sc;}}
    return{hit,x:target?.x||x,y:target?.y||y,crit:false};
  }
  if(weapon.kind==='bomb'){explode(x,y,weapon.damage);for(const c of state.rewardNpcs.filter(n=>!n.dead).map(n=>({n,s:rewardNpcScreen(n)}))){if(Math.hypot(x-c.s.x,y-c.s.y)<220)hitRewardNpc(c.n,weapon.damage*.7);}return{hit:true,x,y,crit:false};}
  const reward=rewardCandidates[0],enemy=candidates[0];if(reward && (!enemy||reward.dist<=enemy.dist)){hitRewardNpc(reward.n,weapon.damage*(weapon.kind==='pierce'?1.25:1));return{hit:true,x:reward.s.x,y:reward.s.y,crit:false};}
  if(weapon.kind==='beam'){if(enemy){const crit=enemy.dist<enemy.s.r*.30;hitEnemy(enemy.e,weapon.damage*(crit?1.35:1),true,false,crit);return{hit:true,x:enemy.s.x,y:enemy.s.y,crit};}return{hit:false,x,y,crit:false};}
  if(weapon.kind==='pierce'){if(!candidates.length)return{hit:false,x,y,crit:false};let hit=false,crit=false;for(const c of candidates.slice(0,2)){const cc=c.dist<c.s.r*.32||!!c.e.base.core;hitEnemy(c.e,weapon.damage*(cc?1.35:1),true,false,cc);hit=true;crit=crit||cc;}return{hit,x:enemy.s.x,y:enemy.s.y,crit};}
  if(enemy){const crit=enemy.dist<enemy.s.r*.35;hitEnemy(enemy.e,weapon.damage*(crit?1.6:1),true,false,crit);if(crit)toast('🎯 CORE HIT!',.7);return{hit:true,x:enemy.s.x,y:enemy.s.y,crit};}
  return{hit:false,x,y,crit:false};
};

const shootV210Base=shoot;
shoot=function(x,y){
  if(!state||state.mode!=='playing')return;const now=performance.now(),w=WEAPONS[state.weapon];let rate=1;if(state.adrenaline>0)rate*=.70;if(state.gppBoost>0)rate*=.86;
  if(now-state.lastFire<w.cooldown*rate)return;
  if(w.kind==='bomb'&&state.bombs<=0){toast('Bom vitamin đã hết',.9);return;}if(w.kind==='beam'&&state.beam<5){toast('Tia miễn dịch đang hồi',.8);return;}
  state.lastFire=now;state.shots++;if(w.kind==='bomb')state.bombs--;if(w.kind==='beam')state.beam=Math.max(0,state.beam-4.5);
  state.recoil=Math.min(1,state.recoil+(w.kind==='bomb'?.85:w.kind==='pierce'?.62:w.kind==='beam'?.20:w.kind==='spray'?.16:.36));state.muzzleFlash=1;sfx.weapon(w.kind,x);
  const result=aimHit(x,y,w);if(result.hit)state.hits++;addTracer(w.kind,result.x,result.y);const m=getMuzzlePoint();muzzleBurst(m.x,m.y,w.kind);
};

const hitEnemyV210Base=hitEnemy;
hitEnemy=function(e,damage,countHit=true,drone=false,crit=false){
  if(!e||e.dead)return;let mult=1;if(state?.vaccine>0)mult*=1.38;if(state?.gppBoost>0)mult*=1.45;if(drone&&e.boss)mult*=.40;
  const wasDead=e.dead,wasBoss=e.boss,counts=!!e.countsForClean,oldScore=state.score;
  hitEnemyV210Base(e,damage*mult,countHit,drone,crit);
  if(!wasDead&&e.dead){
    if(counts&&!wasBoss){state.cleanMinorKills++;const total=Math.max(1,state._minorCleanTarget||state.cfg.quota);state.environmentClean=Math.min(50,state.cleanMinorKills/total*50);}
    if(wasBoss){state.environmentClean=50;state.bossCleanse=0;state.cleanSparkle=0;}
    // The legacy random-drop/80% clean logic is overridden: visual + HUD clean state is authoritative here.
    state.contamination=100-state.environmentClean;
    if(state.gppBoost>0&&state.score>oldScore){state.score+=Math.round((state.score-oldScore)*.50);}
  }
};
// All support items now come from distinct SUPPLY NPCs; ordinary viruses never randomly drop items.
spawnPowerup=function(){};

// Guaranteed item application. Timed effects extend but are capped to preserve balance.
collectPowerups=function(x,y){
  for(const p of state.powerups){if(p.dead||Math.hypot(x-p.x,y-p.y)>=42)continue;p.dead=true;
    if(p.kind==='heal'){state.health=Math.min(10,state.health+2);toast('❤️ +2 SINH TỒN',1);sfx.power();}
    else if(p.kind==='shield'){supportExtend('shield',6,10);toast('🛡 KHIÊN KHỬ NHIỄM · 6s',1);sfx.power();}
    else if(p.kind==='drone'){supportExtend('drone',10,15);toast('🤖 DRONE Y TẾ · 10s',1);sfx.power();}
    else if(p.kind==='adrenaline'){supportExtend('adrenaline',5,8);toast('💉 ADRENALINE · 5s',1);sfx.power();}
    else if(p.kind==='vaccine'){supportExtend('vaccine',7,11);toast('🧬 VACCINE BOOST · 7s',1);sfx.power();}
    else if(p.kind==='sterile'){supportExtend('sterile',6,10);toast('🧴 STERILE FIELD · 6s',1);sfx.power();}
    else if(p.kind==='gpp'){
      state.health=Math.min(10,state.health+2);
      supportExtend('shield',6,10);supportExtend('drone',10,15);supportExtend('adrenaline',5,8);supportExtend('vaccine',7,11);supportExtend('sterile',6,10);supportExtend('gppBoost',8,12);
      toast('✨ LOGO TRƯỜNG GPP · KÍCH HOẠT TOÀN BỘ HỖ TRỢ!',1.65);sfx.gpp();
    }
    updateHUD();return true;
  }return false;
};

function supportActive(){return SUPPORT_ORDER.map(k=>({k,m:SUPPORT_ITEMS[k],left:state?.[SUPPORT_ITEMS[k].field]||0})).filter(x=>x.left>0);}
function updateSupportUI(){
  if(!state)return;const active=supportActive(),key=active.map(x=>`${x.k}:${Math.ceil(x.left*10)}`).join('|');if(key===state._supportHudKey)return;state._supportHudKey=key;
  if(UI.supportList){UI.supportList.innerHTML=active.length?active.map(({m,left})=>{const pct=Math.max(0,Math.min(100,left/m.duration*100)),exp=left<2?' expiring':'';return`<div class="support-row${exp}"><span class="support-icon">${m.icon}</span><b>${m.name}</b><strong>${left.toFixed(1)}s</strong><span class="support-track"><i style="width:${pct}%"></i></span></div>`}).join(''):'<div class="support-empty">CHƯA CÓ HỖ TRỢ</div>';}
  if(UI.mobileSupportStrip){UI.mobileSupportStrip.innerHTML=active.slice(0,4).map(({m,left})=>`<span class="mobile-support-chip${left<2?' expiring':''}">${m.icon} ${left.toFixed(0)}s</span>`).join('');}
}

const updateHUDV210Base=updateHUD;
updateHUD=function(){
  updateHUDV210Base();if(!state)return;const clean=Math.round(state.environmentClean||0);UI.cleanText.textContent=`KHỬ NHIỄM ${clean}%`;UI.cleanFill.style.width=clean+'%';
  UI.enemy.textContent=`Virus: ${state.enemies.length+state.spawnLeft}`;updateSupportUI();
};

// Stable, deterministic pollution layer cache for good mobile performance.
let infectionCache={stage:-1,w:0,h:0,canvas:null};
function seeded(seed){let x=(seed|0)||1;return()=>{x=(x*1664525+1013904223)|0;return((x>>>0)/4294967296)}}
function infectionLayer(stage,w,h){
  const cw=Math.min(960,Math.max(480,Math.round(w*.75))),ch=Math.min(540,Math.max(270,Math.round(h*.75)));
  if(infectionCache.canvas&&infectionCache.stage===stage&&infectionCache.w===cw&&infectionCache.h===ch)return infectionCache.canvas;
  const c=document.createElement('canvas');c.width=cw;c.height=ch;const g=c.getContext('2d'),rnd=seeded(8801+stage*771);
  const palettes=[['#5a7940','#9a7a31','#70548c'],['#54744a','#8d6748','#8265a0'],['#4e7d51','#91a242','#557a68'],['#7d536f','#9a6e4b','#5a7c76'],['#4d6883','#6e5d87','#567f82'],['#8b673a','#7d5163','#72734a'],['#466d78','#6e5f88','#718943']][stage]||['#5a7940','#9a7a31','#70548c'];
  // Uneven stains and greasy smears.
  for(let i=0;i<44;i++){const x=rnd()*cw,y=ch*(.16+rnd()*.82),rx=16+rnd()*105,ry=6+rnd()*38,rot=(rnd()-.5)*1.5;g.save();g.translate(x,y);g.rotate(rot);g.globalAlpha=.07+rnd()*.15;g.fillStyle=palettes[i%palettes.length];g.beginPath();g.ellipse(0,0,rx,ry,0,0,Math.PI*2);g.fill();g.restore();}
  // Slime drips: irregular vertical trails with glossy heads.
  for(let i=0;i<18;i++){const x=rnd()*cw,y=ch*(.12+rnd()*.62),len=22+rnd()*95,w0=2+rnd()*6;g.strokeStyle=`rgba(91,126,62,${.10+rnd()*.16})`;g.lineWidth=w0;g.lineCap='round';g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x+(rnd()-.5)*18,y+len*.35,x+(rnd()-.5)*12,y+len*.72,x+(rnd()-.5)*8,y+len);g.stroke();g.fillStyle=`rgba(187,207,126,${.10+rnd()*.16})`;g.beginPath();g.arc(x,y,3+rnd()*7,0,Math.PI*2);g.fill();}
  // Floor slime puddles, mostly lower half so signage remains readable.
  for(let i=0;i<15;i++){const x=rnd()*cw,y=ch*(.58+rnd()*.36),rx=22+rnd()*82,ry=5+rnd()*20;const gr=g.createRadialGradient(x-rx*.18,y-ry*.25,2,x,y,rx);gr.addColorStop(0,'rgba(222,235,166,.22)');gr.addColorStop(.4,`rgba(92,129,67,${.13+rnd()*.10})`);gr.addColorStop(1,'rgba(78,104,60,0)');g.fillStyle=gr;g.beginPath();g.ellipse(x,y,rx,ry,(rnd()-.5)*.5,0,Math.PI*2);g.fill();}
  // Small bubbles/spots reinforce contamination without darkening the whole scene.
  for(let i=0;i<86;i++){const x=rnd()*cw,y=ch*(.20+rnd()*.76),r=1+rnd()*4;g.fillStyle=`rgba(184,204,120,${.05+rnd()*.13})`;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();if(r>3){g.strokeStyle='rgba(240,248,207,.16)';g.lineWidth=1;g.stroke();}}
  infectionCache={stage,w:cw,h:ch,canvas:c};return c;
}
function drawCoverImage(img,w,h,z=1){if(!img||!img.complete||!img.width)return;const ir=img.width/img.height,sr=w/h;let dw,dh;if(sr>ir){dw=w*z;dh=dw/ir}else{dh=h*z;dw=dh*ir}ctx.drawImage(img,(w-dw)/2,(h-dh)/2-(z-1)*h*.20,dw,dh);}
function drawCleanSparkles(t,amount){if(amount<=0)return;const v=gameplayViewport(),n=Math.round(8+amount*24);ctx.save();for(let i=0;i<n;i++){const seed=i*93+state.stageIndex*41,x=v.left+((seed*37)%997)/997*v.width,y=innerHeight*(.18+((seed*71)%773)/773*.68),tw=.5+.5*Math.sin(t*.004+i*1.7),a=amount*tw*.8,r=1.5+tw*2.5;ctx.globalAlpha=a;ctx.strokeStyle=i%3?'#ffffff':'#fff0a7';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-r*2,y);ctx.lineTo(x+r*2,y);ctx.moveTo(x,y-r*2);ctx.lineTo(x,y+r*2);ctx.stroke();}ctx.restore();}

drawBackground=function(t){
  const w=innerWidth,h=innerHeight;ctx.save();const sh=state?.shake||0;if(sh>0)ctx.translate((Math.random()-.5)*5,(Math.random()-.5)*4);
  let img=bg,stageIndex=0;if(state){stageIndex=state.stageIndex;img=OFFICIAL_STAGE_BGS[stageIndex]||OFFICIAL_FINAL_BG;}
  ctx.fillStyle='#d9e4df';ctx.fillRect(0,0,w,h);const z=1.025+(state?.zoom||0)*.38;drawCoverImage(img,w,h,z);
  if(state){const clean=Math.max(0,Math.min(100,state.environmentClean||0)),dirty=1-clean/100;
    // Preserve the approved background brightness. Contamination is a local overlay, never a full-screen dark treatment.
    if(dirty>.02){ctx.globalAlpha=Math.min(.82,.24+dirty*.58);ctx.drawImage(infectionLayer(stageIndex,w,h),0,0,w,h);ctx.globalAlpha=1;}
    ctx.fillStyle=`rgba(16,37,39,${dirty*.055})`;ctx.fillRect(0,0,w,h);
    const dl=ctx.createRadialGradient(w*.54,h*.16,18,w*.54,h*.28,Math.max(w,h)*.82);dl.addColorStop(0,`rgba(255,249,224,${.035+clean/100*.085})`);dl.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=dl;ctx.fillRect(0,0,w,h);
    ctx.fillStyle=state.cfg.tint;ctx.fillRect(0,0,w,h);
    drawCleanSparkles(t,state.cleanSparkle||Math.max(0,(clean-82)/18));
  }
  ctx.restore();
};

// Power-ups have a clean vertical beam so the dropped item is readable over every supplied background.
drawPowerups=function(){for(const p of state.powerups){ctx.save();ctx.translate(p.x,p.y);const sc=1+Math.sin(p.t*4)*.08;ctx.scale(sc,sc);const m=SUPPORT_ITEMS[p.kind],isGpp=p.kind==='gpp',col=isGpp?'#ffd866':m?.color||'#68eee0';ctx.globalAlpha=.22;const beam=ctx.createLinearGradient(0,-92,0,20);beam.addColorStop(0,'rgba(255,255,255,0)');beam.addColorStop(.55,col+'88');beam.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=beam;ctx.fillRect(-8,-92,16,112);ctx.globalAlpha=1;ctx.fillStyle=isGpp?'rgba(255,255,255,.95)':'rgba(5,58,63,.88)';ctx.strokeStyle=col;ctx.lineWidth=isGpp?3:2;ctx.shadowColor=col;ctx.shadowBlur=12;ctx.beginPath();ctx.arc(0,0,isGpp?29:25,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;if(isGpp&&logoIcon.complete){ctx.save();ctx.beginPath();ctx.arc(0,0,23,0,Math.PI*2);ctx.clip();ctx.drawImage(logoIcon,-23,-23,46,46);ctx.restore();}else{ctx.font='24px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='white';ctx.fillText(p.kind==='heal'?'❤️':m?.icon||'🎁',0,1);}ctx.restore();}};

// Minor enemies remain melee/movement threats only. Bosses alone use enemyShots.
update=function(dt){
  if(!state||state.mode!=='playing')return;const d=DIFF[state.difficulty];state.stageElapsed+=dt;
  if(!state.v13Init){state.v13Init=true;state.spawnLeft=Math.max(10,Math.round(state.cfg.quota*d.quota));state._minorCleanTarget=state.spawnLeft;state.contamination=100;state.environmentClean=0;state.rewardNpcMax=d.rewardMax||3;}
  if(state.transition>0){state.transition+=dt;state.zoom=Math.min(1,state.transition/2.9);const p=clamp(state.transition/2.75,0,1);state.bossCleanse=p;state.environmentClean=50+50*(p*p*(3-2*p));state.contamination=100-state.environmentClean;state.cleanSparkle=Math.max(0,(p-.48)/.52);updateHUD();if(state.transition>3.15&&!state.nextPanel){state.nextPanel=true;stageCompletePanel();}return;}
  state.zoom=Math.min(.13,state.stageElapsed*.0025);if(state.shake>0)state.shake=Math.max(0,state.shake-dt);if(state.bossIntro>0)state.bossIntro=Math.max(0,state.bossIntro-dt);
  state.dashCooldown=Math.max(0,state.dashCooldown-dt);state.dashTimer=Math.max(0,state.dashTimer-dt);state.dodgeTilt*=Math.pow(.001,dt);state.recoil=Math.max(0,state.recoil-dt*7.5);state.muzzleFlash=Math.max(0,state.muzzleFlash-dt*10);state.dodgeMessage=Math.max(0,state.dodgeMessage-dt);
  const axis=movementAxis();if(Math.abs(axis)>.03)state.lastMoveDir=axis<0?-1:1;const speedBoost=state.adrenaline>0?1.28:1;
  if(state.dashTimer>0)state.playerVX=state.dashDir*2.55*speedBoost;else{const accel=6.8*speedBoost,maxSpeed=1.12*speedBoost,friction=8.2;if(Math.abs(axis)>.03)state.playerVX+=axis*accel*dt;else state.playerVX*=Math.max(0,1-friction*dt);state.playerVX=clamp(state.playerVX,-maxSpeed,maxSpeed);}state.playerX=clamp(state.playerX+state.playerVX*dt,-1,1);if(Math.abs(state.playerX)>=1&&Math.sign(state.playerVX)===Math.sign(state.playerX))state.playerVX=0;
  if(state.toastTimer>0){state.toastTimer-=dt;if(state.toastTimer<=0)hide(UI.toast)}if(state.comboTimer>0){state.comboTimer-=dt;if(state.comboTimer<=0){state.combo=0;setCombo()}}
  for(const f of ['shield','drone','adrenaline','vaccine','sterile','gppBoost'])if(state[f]>0)state[f]=Math.max(0,state[f]-dt);state.beam=Math.min(100,state.beam+18*dt);
  if(!state.bossSpawned&&state.rewardNpcCount<state.rewardNpcMax){state.rewardNpcTimer-=dt;if(state.rewardNpcTimer<=0&&!state.rewardNpcs.some(n=>!n.dead)){spawnRewardNpc();state.rewardNpcTimer=(d.rewardEvery||10)*(.82+Math.random()*.44);}}
  if(state.spawnLeft>0){state.spawnTimer-=dt;if(state.spawnTimer<=0){const typ=state.cfg.mix[(Math.random()*state.cfg.mix.length)|0],e=spawnEnemy(typ,false);if(e)e.countsForClean=true;state.spawnLeft--;state.spawnTimer=state.cfg.spawn*d.spawn*(.74+Math.random()*.52);}}
  else if(!state.bossSpawned&&state.enemies.length===0){state.environmentClean=50;state.contamination=50;state.bossSpawned=true;spawnEnemy(state.cfg.mix[0],true);}
  const slow=state.sterile>0?.56:1;
  for(const e of state.enemies){if(e.dead)continue;if(e.boss){updateBoss(e,dt,d);continue;}e.phase+=dt*(1.7+(e.base.pulse||0));e.flash=Math.max(0,e.flash-dt*6);const swayFactor=e.type==='flagella'?1.8:e.type==='spitter'?2.2:e.base.sway||.7,eSway=swayFactor*Math.sin(e.phase*e.wobble)*.012;e.x=clamp(e.baseX+eSway,.04,.96);let motion=1;if(e.type==='breather')motion=.72+.42*(.5+.5*Math.sin(e.phase*1.7));if(e.base.charge&&e.depth<.46)motion=1.85;if(e.base.fly)motion*=1.06;e.depth-=e.speed*dt*motion*slow;if(e.depth<=.08){const sc=enemyScreen(e),hitRadius=Math.max(46,Math.min(100,sc.r*.72+innerWidth*.022));if(Math.abs(playerScreenX()-sc.x)<hitRadius)damagePlayer(e.base.attack*d.damage);else{state.score+=35;sfx.dodgeSuccess();toast('↔ NÉ ĐƯỢC VIRUS!',.55);}e.dead=true;burstAt(sc.x,sc.y,e.color,8);}}
  state.enemies=state.enemies.filter(e=>!e.dead);
  for(const sh of state.enemyShots){sh.t+=dt;sh.x+=sh.vx*dt;sh.y+=sh.vy*dt;sh.r+=18*dt;if(sh.t>=sh.life){const hitRadius=Math.max(42,Math.min(82,innerWidth*.052));if(Math.abs(playerScreenX()-playerScreenX(sh.targetPlayerX))<hitRadius)damagePlayer(sh.damage*d.damage);else{state.score+=20;sfx.dodgeSuccess();toast('↔ NÉ ĐÒN BOSS!',.5);}sh.dead=true;}}state.enemyShots=state.enemyShots.filter(s=>!s.dead);
  for(const n of state.rewardNpcs){if(n.dead)continue;n.t+=dt;n.life-=dt;n.x+=n.vx*dt;if(n.life<=0||n.x<-.10||n.x>1.10)n.dead=true;}state.rewardNpcs=state.rewardNpcs.filter(n=>!n.dead);
  for(const p of state.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=12*dt;p.a=Math.max(0,p.life/p.max);}state.particles=state.particles.filter(p=>p.life>0);for(const tr of state.tracers){tr.t+=dt;tr.life-=dt;}state.tracers=state.tracers.filter(tr=>tr.life>0);for(const hm of state.hitMarkers)hm.life-=dt;state.hitMarkers=state.hitMarkers.filter(hm=>hm.life>0);for(const p of state.powerups){p.t+=dt;p.y+=Math.sin(p.t*3)*.15;p.life-=dt;if(p.life<=0)p.dead=true;}state.powerups=state.powerups.filter(p=>!p.dead);
  if(state.drone>0&&state.enemies.length){state._droneTimer=(state._droneTimer||0)-dt;if(state._droneTimer<=0){state._droneTimer=.38;let target=state.enemies.filter(e=>!e.dead&&!e.boss).sort((a,b)=>a.depth-b.depth)[0]||state.enemies.find(e=>!e.dead&&e.boss);if(target){const s=enemyScreen(target),dx=Math.max(34,Math.min(innerWidth-34,playerScreenX()-innerWidth*.115)),dy=innerHeight*.66;state.tracers.push({x1:dx,y1:dy,x2:s.x,y2:s.y,t:0,life:.16,max:.16,travel:.09,color:'#70fff0',width:3.2,kind:'drone',seed:Math.random()*99});hitEnemy(target,.72,false,true);}}}
  if(state.bossSpawned&&!state.bossDefeated&&!state.enemies.some(e=>e.boss)&&state.spawnLeft<=0){state.bossDefeated=true;beginStageClear();}updateHUD();
};

// Preserve the bar style, but progress now follows 0→50% minor enemies and 50→100% boss cleanse.
beginStageClear=function(){if(state.transition>0)return;state.transition=.001;state.mode='playing';state.environmentClean=Math.max(50,state.environmentClean);state.contamination=50;sfx.clear();toast('✨ ĐANG THANH TẨY TOÀN KHU...',2.4);};

// Final render order: environment -> enemies/reward NPC -> combat FX -> doctor.
render=function(t){drawBackground(t);if(state){const sorted=[...state.enemies].sort((a,b)=>b.depth-a.depth);for(const e of sorted)drawEnemy(e,t);for(const n of state.rewardNpcs)drawRewardNpc(n,t);drawEnemyShots();drawTracers();drawPowerups();drawParticles();drawHitMarkers();drawDrone(t);drawPlayerShadow(t);drawWeapon(t);drawCrosshair();drawBossIntro();if(state.transition>0){const p=clamp(state.transition/3.0,0,1),a=Math.sin(p*Math.PI)*.16;ctx.fillStyle=`rgba(226,255,246,${a})`;ctx.fillRect(0,0,innerWidth,innerHeight);}}};

// Final menu sync must happen after the authoritative 7-stage campaign replaces legacy stage data.
selectStageCard(window.__selectedStage||0);

})();
