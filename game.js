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
const WEAPON_FRAMES = [1,2,3,4].map(i=>{const im=new Image();im.src=`assets/weapon-vuk${i}.png`;return im;});
let weaponPressStarted=0, weaponSingleFlashUntil=0;

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
  state = newState(stage); hide(UI.menu); hide(UI.help); hide(UI.pause); hide(UI.stage); hide(UI.over); hide(UI.victory); show(UI.hud); UI.menu.classList.remove('active');
  updateWeaponUI(); updateHUD(); setCombo(); last=performance.now(); cancelAnimationFrame(raf); raf=requestAnimationFrame(loop);
}

function goHome(){
  if(state) state.mode='menu'; cancelAnimationFrame(raf); state=null; hide(UI.hud); hide(UI.pause); hide(UI.stage); hide(UI.over); hide(UI.victory); hide(UI.help); UI.menu.classList.add('active'); show(UI.menu); drawAttract();
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
];
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function bossPhase(e){const r=e.hp/e.maxHp;return r>.67?1:r>.34?2:3;}
function sourceXFor(type){
  if(type==='wall')return Math.random()<.5?.08:.92;
  if(type==='flyer'||type==='spore')return .20+Math.random()*.60;
  const sources=[[.18,.30,.70,.82,.50],[.14,.28,.50,.72,.86],[.12,.34,.50,.66,.88],[.10,.26,.50,.74,.90],[.16,.38,.62,.84,.50],[.12,.30,.50,.70,.88]][state.stageIndex];
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
  const amp=[.12,.18,.14,.10,.22,.16][e.bossKind]; e.baseX=.5+Math.sin(e.phase*(.32+e.bossKind*.025))*amp; e.x=e.baseX; e.depth=.67+Math.sin(e.phase*.38)*.018;
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
updateHUD = function(){updateHUDV12();if(state&&UI.stageName)UI.stageName.textContent=`${state.cfg.name} · ${DIFF[state.difficulty].label}`;if(state&&UI.diffBadge)UI.diffBadge.textContent=`${DIFF[state.difficulty].label} · ${state.difficulty==='easy'?'THƯ GIÃN':state.difficulty==='hard'?'THỬ THÁCH':'CÂN BẰNG'}`;};
function drawBossIntro(){if(!state?.bossIntro||state.bossIntro<=0)return;const a=Math.min(1,state.bossIntro/.45, (2.05-state.bossIntro)/.3);ctx.save();ctx.globalAlpha=clamp(a,0,1);ctx.fillStyle='rgba(3,20,24,.66)';ctx.fillRect(0,innerHeight*.39,innerWidth,innerHeight*.22);ctx.textAlign='center';ctx.fillStyle='#ffdd79';ctx.font=`900 ${Math.max(13,Math.min(22,innerWidth*.018))}px system-ui`;ctx.fillText('⚠ BOSS CUỐI MÀN',innerWidth/2,innerHeight*.455);ctx.fillStyle='white';ctx.font=`900 ${Math.max(24,Math.min(46,innerWidth*.042))}px system-ui`;ctx.fillText(state.cfg.boss,innerWidth/2,innerHeight*.525);ctx.fillStyle='#bcece7';ctx.font='800 12px system-ui';ctx.fillText('BẮN VÀO LÕI SÁNG · DI CHUYỂN NGANG ĐỂ NÉ ĐÒN',innerWidth/2,innerHeight*.57);ctx.restore();}

function render(t){ drawBackground(t); if(state){ const sorted=[...state.enemies].sort((a,b)=>b.depth-a.depth); for(const e of sorted)drawEnemy(e,t); drawEnemyShots(); drawTracers(); drawPowerups(); drawParticles(); drawHitMarkers(); drawDrone(t); drawPlayerShadow(t); drawWeapon(t); drawCrosshair(); drawBossIntro(); if(state.transition>0){const a=Math.min(.55,state.transition/2.3*.55);ctx.fillStyle=`rgba(225,255,249,${a})`;ctx.fillRect(0,0,innerWidth,innerHeight);} } }

function loop(now){ const dt=Math.min(.04,(now-last)/1000||.016);last=now;if(state?.mode==='playing')update(dt);render(now);raf=requestAnimationFrame(loop); }
function drawAttract(){ drawBackground(performance.now()); }
bg.onload=drawAttract;

function pointerPos(ev){ const r=canvas.getBoundingClientRect(); const t=ev.touches?.[0]||ev.changedTouches?.[0]||ev; return {x:(t.clientX-r.left),y:(t.clientY-r.top)}; }
canvas.addEventListener('pointermove',e=>{pointer=Object.assign(pointer,pointerPos(e));if(pointer.down && state?.mode==='playing' && [2,4].includes(state.weapon)){shoot(pointer.x,pointer.y)}});
canvas.addEventListener('pointerdown',e=>{e.preventDefault();const p=pointerPos(e);pointer.x=p.x;pointer.y=p.y;pointer.down=true;weaponPressStarted=performance.now();weaponSingleFlashUntil=weaponPressStarted+190;ensureAudio();if(collectPowerups(p.x,p.y))return;shoot(p.x,p.y)});
addEventListener('pointerup',()=>{pointer.down=false;weaponSingleFlashUntil=performance.now()+500;});
canvas.addEventListener('contextmenu',e=>e.preventDefault());
const lastTap={left:0,right:0};
function setMoveKey(dir,down){if(!state)return;if(dir<0)state.moveLeft=down;else state.moveRight=down;}
addEventListener('keydown',e=>{
  if(e.key>='1'&&e.key<='5')selectWeapon(+e.key-1);
  const left=e.key==='a'||e.key==='A'||e.key==='ArrowLeft',right=e.key==='d'||e.key==='D'||e.key==='ArrowRight';
  if(left||right){e.preventDefault();const dir=left?-1:1;setMoveKey(dir,true);if(!e.repeat){const key=dir<0?'left':'right',now=performance.now();if(lastTap[key]&&now-lastTap[key]<245)dash(dir);lastTap[key]=now;}}
  if(e.code==='Space'&&!e.repeat){e.preventDefault();if(state?.mode==='playing')pauseGame();else if(state?.mode==='paused')resumeGame();}
  if(e.key==='Escape'){if(state?.mode==='playing')pauseGame();else if(state?.mode==='paused')resumeGame();}
});
addEventListener('keyup',e=>{const left=e.key==='a'||e.key==='A'||e.key==='ArrowLeft',right=e.key==='d'||e.key==='D'||e.key==='ArrowRight';if(left||right){e.preventDefault();setMoveKey(left?-1:1,false);}});
addEventListener('blur',()=>{if(state){state.moveLeft=false;state.moveRight=false;state.mobileMoveAxis=0;}});

$('#startBtn').onclick=()=>startGame(0); $('#howBtn').onclick=()=>show(UI.help); $$('[data-close]').forEach(b=>b.onclick=()=>hide(document.getElementById(b.dataset.close)));
$('#pauseBtn').onclick=pauseGame; $('#resumeBtn').onclick=resumeGame; $('#homeBtn').onclick=goHome; $('#gameOverHomeBtn').onclick=goHome; $('#victoryHomeBtn').onclick=goHome;
$('#retryBtn').onclick=()=>startGame(state?.stageIndex||0); $('#victoryReplayBtn').onclick=()=>startGame(0);
$('#nextStageBtn').onclick=()=>startGame((state?.stageIndex||0)+1);
$('#soundBtn').onclick=()=>{audioEnabled=!audioEnabled;$('#soundBtn').textContent=`${audioEnabled?'🔊':'🔇'} Âm thanh: ${audioEnabled?'Bật':'Tắt'}`};
$('#fullscreenBtn').onclick=async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch{toast('Trình duyệt không hỗ trợ toàn màn hình',1)}};
$$('.difficulty').forEach(b=>b.onclick=()=>{$$('.difficulty').forEach(x=>x.classList.remove('selected'));b.classList.add('selected');window.__difficulty=b.dataset.difficulty});
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
const OFFICIAL_STAGE_BGS = Array.from({length:6},(_,i)=>{const im=new Image();im.src=`assets/stage${i+1}.jpg`;return im;});
const OFFICIAL_FINAL_BG = new Image(); OFFICIAL_FINAL_BG.src='assets/stage-final.jpg';

STAGES.splice(0,STAGES.length,
  {name:'KHOA DƯỢC', env:'pharmacy', quota:18, spawn:.88, boss:'VIRUS MẸ KHÁNG THUỐC', bossHp:34, bossKind:0, mix:['basic','flagella','shield','breather'], tint:'rgba(29,154,181,.018)'},
  {name:'KHOA CẤP CỨU', env:'er', quota:23, spawn:.75, boss:'VI KHUẨN XUNG KÍCH', bossHp:45, bossKind:1, mix:['charger','cluster','basic','wall'], tint:'rgba(171,73,153,.020)'},
  {name:'KHOA HÔ HẤP', env:'respiratory', quota:27, spawn:.68, boss:'BÀO TỬ HÔ HẤP KHỔNG LỒ', bossHp:58, bossKind:2, mix:['spore','flyer','breather','flagella'], tint:'rgba(56,174,121,.018)'},
  {name:'KHOA NHI', env:'pediatrics', quota:31, spawn:.62, boss:'SIÊU VI KHUẨN BIẾN DỊ', bossHp:70, bossKind:3, mix:['wall','charger','cluster','spore'], tint:'rgba(231,98,145,.018)'},
  {name:'KHOA SẢN', env:'maternity', quota:35, spawn:.56, boss:'DỊ CHỦNG ĐỘT BIẾN', bossHp:86, bossKind:4, mix:['shield','nucleus','elite','breather'], tint:'rgba(50,107,167,.018)'},
  {name:'KHOA THẦN KINH', env:'neuro', quota:40, spawn:.49, boss:'NGUỒN BỆNH TỐI THƯỢNG', bossHp:118, bossKind:5, mix:['nucleus','elite','flyer','charger'], tint:'rgba(225,148,72,.018)', final:true}
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
    else if(p.kind==='gpp'){supportExtend('gppBoost',8,12);state.health=Math.min(10,state.health+1);toast('✨ TRƯỜNG GPP BOOST · 8s',1.35);sfx.gpp();}
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
  const palettes=[['#304b37','#61561f','#472b52'],['#3b2a4b','#65455d','#274a42'],['#274b35','#4a6b36','#40542c'],['#5d344a','#634a31','#2d4e50'],['#203d4d','#3c315b','#2c5156'],['#613421','#5e2940','#423017']][stage];
  for(let i=0;i<38;i++){const x=rnd()*cw,y=ch*(.20+rnd()*.78),rx=18+rnd()*100,ry=8+rnd()*44,rot=(rnd()-.5)*1.4;g.save();g.translate(x,y);g.rotate(rot);g.globalAlpha=.05+rnd()*.15;g.fillStyle=palettes[i%palettes.length];g.beginPath();g.ellipse(0,0,rx,ry,0,0,Math.PI*2);g.fill();g.restore();}
  g.strokeStyle='rgba(54,80,45,.17)';g.lineWidth=2;for(let i=0;i<16;i++){let x=rnd()*cw,y=ch*(.35+rnd()*.6);g.beginPath();g.moveTo(x,y);for(let j=0;j<4;j++){x+=(rnd()-.5)*80;y+=(rnd()-.5)*45;g.lineTo(x,y)}g.stroke();}
  for(let i=0;i<70;i++){g.fillStyle=`rgba(178,197,116,${.04+rnd()*.11})`;g.beginPath();g.arc(rnd()*cw,rnd()*ch,1+rnd()*3,0,Math.PI*2);g.fill();}
  const vg=g.createRadialGradient(cw*.5,ch*.5,ch*.1,cw*.5,ch*.5,Math.max(cw,ch)*.72);vg.addColorStop(.45,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(11,24,18,.48)');g.fillStyle=vg;g.fillRect(0,0,cw,ch);
  infectionCache={stage,w:cw,h:ch,canvas:c};return c;
}
function drawCoverImage(img,w,h,z=1){if(!img||!img.complete||!img.width)return;const ir=img.width/img.height,sr=w/h;let dw,dh;if(sr>ir){dw=w*z;dh=dw/ir}else{dh=h*z;dw=dh*ir}ctx.drawImage(img,(w-dw)/2,(h-dh)/2-(z-1)*h*.20,dw,dh);}
function drawCleanSparkles(t,amount){if(amount<=0)return;const v=gameplayViewport(),n=Math.round(8+amount*24);ctx.save();for(let i=0;i<n;i++){const seed=i*93+state.stageIndex*41,x=v.left+((seed*37)%997)/997*v.width,y=innerHeight*(.18+((seed*71)%773)/773*.68),tw=.5+.5*Math.sin(t*.004+i*1.7),a=amount*tw*.8,r=1.5+tw*2.5;ctx.globalAlpha=a;ctx.strokeStyle=i%3?'#ffffff':'#fff0a7';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x-r*2,y);ctx.lineTo(x+r*2,y);ctx.moveTo(x,y-r*2);ctx.lineTo(x,y+r*2);ctx.stroke();}ctx.restore();}

drawBackground=function(t){
  const w=innerWidth,h=innerHeight;ctx.save();const sh=state?.shake||0;if(sh>0)ctx.translate((Math.random()-.5)*5,(Math.random()-.5)*4);
  let img=bg,stageIndex=0;if(state){stageIndex=state.stageIndex;img=(state.cfg.final&&state.mode==='stage'&&state.nextPanel)?OFFICIAL_FINAL_BG:OFFICIAL_STAGE_BGS[stageIndex];}
  ctx.fillStyle='#d9e4df';ctx.fillRect(0,0,w,h);const z=1.025+(state?.zoom||0)*.38;drawCoverImage(img,w,h,z);
  if(state){const clean=Math.max(0,Math.min(100,state.environmentClean||0)),dirty=1-clean/100;
    // night -> daylight transition follows decontamination, not a repetitive loop.
    ctx.fillStyle=`rgba(3,18,29,${.06+dirty*.43})`;ctx.fillRect(0,0,w,h);
    const dl=ctx.createRadialGradient(w*.56,h*.15,20,w*.56,h*.25,Math.max(w,h)*.78);dl.addColorStop(0,`rgba(255,245,207,${clean/100*.20})`);dl.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=dl;ctx.fillRect(0,0,w,h);
    if(dirty>.02){ctx.globalAlpha=Math.min(.98,.28+dirty*.72);ctx.drawImage(infectionLayer(stageIndex,w,h),0,0,w,h);ctx.globalAlpha=1;}
    ctx.fillStyle=state.cfg.tint;ctx.fillRect(0,0,w,h);
    const fog=ctx.createLinearGradient(0,h*.42,0,h);fog.addColorStop(0,'rgba(0,0,0,0)');fog.addColorStop(1,`rgba(3,35,30,${dirty*.18})`);ctx.fillStyle=fog;ctx.fillRect(0,0,w,h);
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


/* === v2.4.0 A1+B1 FINAL · 8 STAGES · CLEAN/DIRTY DUAL LAYER · PROGRESSION LOCK === */
const A1_STAGE_COUNT=8;
const A1_PROGRESS_KEY='bstq-a1-unlocked-stage-v230';
const A1_CLEAN_BGS=Array.from({length:A1_STAGE_COUNT},(_,i)=>{const im=new Image();im.src=`assets/stage${i+1}-clean.jpg`;return im;});
const A1_DIRTY_BGS=Array.from({length:A1_STAGE_COUNT},(_,i)=>{const im=new Image();im.src=`assets/stage${i+1}-dirty.jpg`;return im;});
logoIcon.src='assets/logo-gpp.png';

STAGES.splice(0,STAGES.length,
  {name:'KHOA DƯỢC',env:'pharmacy',quota:18,spawn:.88,boss:'VIRUS MẸ KHÁNG THUỐC',bossHp:34,bossKind:0,mix:['basic','flagella','shield','breather'],tint:'rgba(29,154,181,.010)'},
  {name:'KHOA CẤP CỨU',env:'er',quota:23,spawn:.75,boss:'VI KHUẨN XUNG KÍCH',bossHp:45,bossKind:1,mix:['charger','cluster','basic','wall'],tint:'rgba(171,73,153,.010)'},
  {name:'KHOA HÔ HẤP',env:'respiratory',quota:27,spawn:.68,boss:'BÀO TỬ HÔ HẤP KHỔNG LỒ',bossHp:58,bossKind:2,mix:['spore','flyer','breather','flagella'],tint:'rgba(56,174,121,.010)'},
  {name:'KHOA NHI',env:'pediatrics',quota:31,spawn:.62,boss:'SIÊU VI KHUẨN BIẾN DỊ',bossHp:70,bossKind:3,mix:['wall','charger','cluster','spore'],tint:'rgba(231,98,145,.010)'},
  {name:'KHOA SẢN',env:'maternity',quota:35,spawn:.56,boss:'DỊ CHỦNG ĐỘT BIẾN',bossHp:86,bossKind:4,mix:['shield','nucleus','elite','breather'],tint:'rgba(50,107,167,.010)'},
  {name:'KHOA THẦN KINH',env:'neuro',quota:39,spawn:.51,boss:'MẠNG THẦN KINH NHIỄM ĐỘC',bossHp:102,bossKind:4,mix:['nucleus','elite','flyer','charger'],tint:'rgba(114,91,180,.010)'},
  {name:'KHOA XÉT NGHIỆM',env:'laboratory',quota:42,spawn:.48,boss:'LÕI MẪU BỆNH ĐỘT BIẾN',bossHp:114,bossKind:1,mix:['spore','shield','spitter','nucleus','elite'],tint:'rgba(46,155,176,.010)'},
  {name:'TRẬN CHIẾN CUỐI CÙNG',env:'final',quota:48,spawn:.44,boss:'NGUỒN BỆNH TỐI THƯỢNG',bossHp:138,bossKind:5,mix:['elite','nucleus','cluster','charger','flyer','spitter'],tint:'rgba(176,62,90,.010)',final:true}
);
BOSS_STYLE.push(
  {color:'#5a6a9d',accent:'#9de6ff',shot:'#68c9ff',rad:100},
  {color:'#761d38',accent:'#ff6c76',shot:'#ff3854',rad:108}
);
sourceXFor=function(type){
  if(type==='wall')return Math.random()<.5?.08:.92;
  if(type==='flyer'||type==='spore')return .20+Math.random()*.60;
  const banks=[
    [.18,.30,.70,.82,.50],[.14,.28,.50,.72,.86],[.12,.34,.50,.66,.88],[.10,.26,.50,.74,.90],
    [.16,.38,.62,.84,.50],[.12,.32,.50,.68,.88],[.14,.29,.50,.71,.86],[.10,.26,.50,.74,.90]
  ];
  const sources=banks[state?.stageIndex||0]||banks[0];
  return clamp(sources[(Math.random()*sources.length)|0]+(Math.random()-.5)*.035,.07,.93);
};

const newStateA1Base=newState;
newState=function(stageIndex=0){
  const s=newStateA1Base(clamp(stageIndex,0,A1_STAGE_COUNT-1));
  s.rewardNpcTimer=3.2+Math.random()*1.2;
  s.rewardNpcMax=Math.max(4,s.rewardNpcMax||0);
  s.stageIntro=1.9;
  return s;
};

function a1Unlocked(){
  try{const raw=parseInt(localStorage.getItem(A1_PROGRESS_KEY)||'1',10);return clamp(Number.isFinite(raw)?raw:1,1,A1_STAGE_COUNT);}catch{return 1;}
}
function a1SaveUnlocked(n){try{localStorage.setItem(A1_PROGRESS_KEY,String(clamp(n,1,A1_STAGE_COUNT)));}catch{}}
let a1SelectedStage=0,a1NewlyUnlocked=-1;
function a1RenderStageMenu(){
  const unlocked=a1Unlocked();
  const cards=$$('.stage-thumb');
  if(a1SelectedStage>=unlocked)a1SelectedStage=Math.max(0,unlocked-1);
  cards.forEach((card,i)=>{
    const open=i<unlocked;
    card.classList.toggle('locked',!open);card.classList.toggle('unlocked',open);card.classList.toggle('selected',open&&i===a1SelectedStage);
    card.disabled=false;card.setAttribute('aria-disabled',String(!open));
    card.classList.toggle('just-unlocked',open&&i===a1NewlyUnlocked);
    card.title=open?`Màn ${i+1} · ${STAGES[i].name}`:'Hoàn thành màn trước để mở khóa';
  });
  const sb=$('#startBtn');if(sb)sb.textContent=`▶ BẮT ĐẦU · MÀN ${a1SelectedStage+1}`;
}
$$('.stage-thumb').forEach((card,i)=>card.onclick=()=>{if(i>=a1Unlocked()){card.classList.remove('lock-pulse');void card.offsetWidth;card.classList.add('lock-pulse');setTimeout(()=>card.classList.remove('lock-pulse'),420);return;}a1NewlyUnlocked=-1;a1SelectedStage=i;a1RenderStageMenu();});
$('#startBtn').onclick=()=>{if(a1SelectedStage<a1Unlocked())startGame(a1SelectedStage);};

// Hidden QA shortcut. It is intentionally not surfaced anywhere in the UI.
addEventListener('keydown',e=>{
  if(e.ctrlKey&&e.shiftKey&&e.altKey&&e.code==='KeyO'&&UI.menu.classList.contains('active')&&!UI.menu.classList.contains('hidden')){
    e.preventDefault();e.stopPropagation();a1SaveUnlocked(A1_STAGE_COUNT);a1RenderStageMenu();
  }
},true);

const startGameA1Base=startGame;
startGame=function(stage=0){
  const maxOpen=a1Unlocked()-1;
  const target=clamp(stage,0,Math.max(0,maxOpen));
  a1SelectedStage=target;
  startGameA1Base(target);
};
const goHomeA1Base=goHome;
goHome=function(){goHomeA1Base();a1RenderStageMenu();};

function a1ConfirmHome(){
  if(!state){goHome();return;}
  if(confirm('Về Menu chính? Tiến trình màn hiện tại sẽ mất.'))goHome();
}
const quickHome=$('#homeQuickBtn');if(quickHome)quickHome.onclick=a1ConfirmHome;
if($('#homeBtn'))$('#homeBtn').onclick=a1ConfirmHome;
if($('#stageHomeBtn'))$('#stageHomeBtn').onclick=goHome;
if($('#pauseRetryBtn'))$('#pauseRetryBtn').onclick=()=>{if(!state)return;const idx=state.stageIndex;if(confirm('Chơi lại màn này từ đầu?'))startGame(idx);};

const stageCompletePanelA1Base=stageCompletePanel;
stageCompletePanel=function(){
  if(!state)return;
  const completed=state.stageIndex;
  if(completed<A1_STAGE_COUNT-1){a1SaveUnlocked(Math.max(a1Unlocked(),completed+2));a1NewlyUnlocked=completed+1;a1SelectedStage=completed+1;}
  else{a1SaveUnlocked(A1_STAGE_COUNT);a1SelectedStage=A1_STAGE_COUNT-1;}
  stageCompletePanelA1Base();
  const next=$('#nextStageBtn');
  if(next){next.classList.toggle('hidden',completed>=A1_STAGE_COUNT-1);next.textContent=completed<A1_STAGE_COUNT-1?`MỞ MÀN ${completed+2} · TIẾP TỤC ›`:'HOÀN TẤT';}
};
$('#nextStageBtn').onclick=()=>{if(!state)return;const next=Math.min(A1_STAGE_COUNT-1,state.stageIndex+1);startGame(next);};

function a1FormatTime(sec){const n=Math.max(0,Math.floor(sec||0)),m=Math.floor(n/60),s=n%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}
const updateHUDA1Base=updateHUD;
updateHUD=function(){
  updateHUDA1Base();if(!state)return;
  const stageLabel=`MÀN ${state.stageIndex+1} · ${state.cfg.name}`;
  UI.stageName.textContent=stageLabel;
  const hp=`${Math.max(0,state.health).toFixed(state.health%1?1:0)}/10`,hpPct=clamp(state.health/state.maxHealth*100,0,100);
  if($('#leftHealthText'))$('#leftHealthText').textContent=hp;if($('#leftHealthFill'))$('#leftHealthFill').style.width=hpPct+'%';
  if($('#leftStageNo'))$('#leftStageNo').textContent=`MÀN ${state.stageIndex+1}`;if($('#leftStageName'))$('#leftStageName').textContent=state.cfg.name;
  const time=a1FormatTime(state.stageElapsed),enemyCount=Math.max(0,state.enemies.length+state.spawnLeft);
  if($('#rightScoreText'))$('#rightScoreText').textContent=state.score.toLocaleString('vi-VN');if($('#rightTimeText'))$('#rightTimeText').textContent=time;if($('#rightEnemyText'))$('#rightEnemyText').textContent=enemyCount;if($('#rightComboText'))$('#rightComboText').textContent=`×${state.combo||0}`;
  if($('#timeTextMobile'))$('#timeTextMobile').textContent=time;
};

// The logo is the special all-in-one item: it carries every support effect.
const collectPowerupsA1Base=collectPowerups;
collectPowerups=function(x,y){
  for(const p of state.powerups){
    if(p.dead||Math.hypot(x-p.x,y-p.y)>=42)continue;
    if(p.kind!=='gpp')return collectPowerupsA1Base(x,y);
    p.dead=true;
    state.health=Math.min(state.maxHealth,state.health+2);
    supportExtend('shield',6,10);supportExtend('drone',10,15);supportExtend('adrenaline',5,8);supportExtend('vaccine',7,11);supportExtend('sterile',6,10);supportExtend('gppBoost',8,12);
    for(const e of [...state.enemies])if(!e.boss&&!e.dead)hitEnemy(e,1.20,false,true,false);
    toast('✨ TRƯỜNG GPP · TOÀN BỘ HỖ TRỢ KÍCH HOẠT!',1.65);sfx.gpp();updateHUD();return true;
  }
  return false;
};

// Dual image system: clean background below, supplied dirty background above.
// The dirty layer recedes very slowly from the outside edges toward the centre.
let a1DirtyCanvas=null,a1DirtyCtx=null,a1DirtyW=0,a1DirtyH=0;
function a1EnsureDirtyCanvas(w,h){
  if(!a1DirtyCanvas){a1DirtyCanvas=document.createElement('canvas');a1DirtyCtx=a1DirtyCanvas.getContext('2d');}
  if(a1DirtyW!==w||a1DirtyH!==h){a1DirtyW=w;a1DirtyH=h;a1DirtyCanvas.width=Math.max(1,Math.round(w));a1DirtyCanvas.height=Math.max(1,Math.round(h));}
  return a1DirtyCtx;
}
function a1DrawCover(g,img,w,h,z=1){
  if(!img||!img.complete||!img.width)return false;const ir=img.width/img.height,sr=w/h;let dw,dh;if(sr>ir){dw=w*z;dh=dw/ir}else{dh=h*z;dw=dh*ir}g.drawImage(img,(w-dw)/2,(h-dh)/2-(z-1)*h*.20,dw,dh);return true;
}
function a1DrawDirtyMask(img,w,h,clean,z){
  if(clean>=99.95||!img||!img.complete||!img.width)return;
  const g=a1EnsureDirtyCanvas(w,h);g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,w,h);g.globalCompositeOperation='source-over';g.globalAlpha=1;
  if(!a1DrawCover(g,img,w,h,z))return;
  const c=clamp(clean/100,0,1);
  // First half only cleans a thin outer ring; after the Boss falls the mask closes decisively to the centre.
  const erased=c<=.5?(c/.5)*.16:.16+((c-.5)/.5)*.84;
  const maxR=Math.hypot(w*.5,h*.5)*1.08,remain=Math.max(0,1-erased),radius=maxR*remain,soft=Math.max(24,maxR*.075);
  g.globalCompositeOperation='destination-in';
  const cx=w*.50,cy=h*.52,grad=g.createRadialGradient(cx,cy,Math.max(0,radius-soft),cx,cy,Math.max(1,radius+soft));
  grad.addColorStop(0,'rgba(255,255,255,1)');grad.addColorStop(.72,'rgba(255,255,255,.98)');grad.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=grad;g.fillRect(0,0,w,h);g.globalCompositeOperation='source-over';
  ctx.drawImage(a1DirtyCanvas,0,0,w,h);
}
drawBackground=function(t){
  const w=innerWidth,h=innerHeight;ctx.save();const sh=state?.shake||0;if(sh>0)ctx.translate((Math.random()-.5)*5,(Math.random()-.5)*4);
  ctx.fillStyle='#e8f2f2';ctx.fillRect(0,0,w,h);
  if(!state){drawCoverImage(bg,w,h,1.01);ctx.restore();return;}
  const idx=clamp(state.stageIndex,0,A1_STAGE_COUNT-1),clean=clamp(state.environmentClean||0,0,100),z=1.02+(state.zoom||0)*.34;
  drawCoverImage(A1_CLEAN_BGS[idx],w,h,z);
  a1DrawDirtyMask(A1_DIRTY_BGS[idx],w,h,clean,z);
  if(state.cfg.tint){ctx.fillStyle=state.cfg.tint;ctx.fillRect(0,0,w,h);}
  drawCleanSparkles(t,state.cleanSparkle||Math.max(0,(clean-88)/12));ctx.restore();
};

// Balanced safe gameplay corridor between equal desktop rails.
gameplayViewport=function(){
  const desktop=matchMedia('(min-width:1180px) and (hover:hover) and (pointer:fine)').matches;
  const left=desktop?192:0,right=desktop?192:0,width=Math.max(260,innerWidth-left-right);return{desktop,left,right,width,center:left+width/2};
};

a1RenderStageMenu();

/* === v2.4.0 merged A1 + B1 + supplied weapon animation === */
function b1WeaponFrame(t){
  // All visual frame changes run at 4 changes per second.
  const step=250;
  if(pointer.down){
    const held=Math.max(0,t-weaponPressStarted);
    // A normal click flashes vuk2 <-> vuk4.
    if(held<360)return (Math.floor(held/step)%2===0)?1:3;
    // When the mouse is held, all four supplied frames rotate 1 -> 2 -> 3 -> 4.
    return Math.floor((held-360)/step)%4;
  }
  // Keep a short vuk2 <-> vuk4 firing tail after release so a fast click remains visible.
  if(t<weaponSingleFlashUntil)return (Math.floor(t/step)%2===0)?1:3;
  // Idle breathing/energy animation: vuk1 <-> vuk3.
  return (Math.floor(t/step)%2===0)?0:2;
}

function b1DrawWeaponScreen(imgX,imgY,drawW,drawH){
  if(!state)return;
  const ww=WEAPONS[state.weapon]||WEAPONS[0];
  // The supplied VUK art has a real centre monitor. Overlay the selected medical weapon there.
  const sx=imgX+drawW*.500, sy=imgY+drawH*.475;
  const sw=drawW*.128, sh=drawH*.175;
  ctx.save();
  ctx.translate(sx,sy);
  ctx.fillStyle='rgba(2,18,24,.76)';
  ctx.strokeStyle='rgba(109,242,234,.78)';
  ctx.lineWidth=Math.max(1,drawW*.0018);
  ctx.beginPath();ctx.roundRect(-sw/2,-sh/2,sw,sh,Math.max(4,drawW*.006));ctx.fill();ctx.stroke();
  ctx.shadowColor='#75fff2';ctx.shadowBlur=Math.max(3,drawW*.009);
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#ffffff';
  ctx.font=`900 ${Math.max(17,drawW*.040)}px system-ui, sans-serif`;
  ctx.fillText(ww.icon,0,-sh*.10);
  ctx.shadowBlur=0;ctx.fillStyle='#bffff8';
  ctx.font=`900 ${Math.max(6.5,drawW*.011)}px system-ui, sans-serif`;
  const shortNames=['THUỐC VIÊN','KIM TIÊM','KHỬ KHUẨN','BOM VITAMIN','TIA MIỄN DỊCH'];
  ctx.fillText(shortNames[state.weapon]||ww.name,0,sh*.28);
  ctx.restore();
}

// Replace the old procedural character/weapon with the supplied four aligned frames.
drawWeapon=function(t){
  if(!state)return;
  const img=WEAPON_FRAMES[b1WeaponFrame(t)];
  if(!img||!img.complete||!img.naturalWidth)return;
  const w=innerWidth,h=innerHeight,pv=gameplayViewport();
  const mobile=matchMedia('(hover:none) and (pointer:coarse)').matches;
  // v2.5: deliberately smaller so the hospital, enemies and pickups remain visible.
  const drawW=Math.min(pv.width*(mobile?.62:.58),h*(mobile?1.10:1.18),mobile?650:790);
  const drawH=drawW*(img.naturalHeight/img.naturalWidth);
  const nx=Math.max(-1,Math.min(1,((pointer.x-pv.left)/Math.max(1,pv.width)-.5)*2));
  const bob=Math.sin(t*.0034)*(mobile?1.8:2.5), sway=Math.sin(t*.0021)*(mobile?1.3:2.0);
  const moveSway=Math.max(-3,Math.min(3,(state.playerVX||0)*2.5));
  const recoilY=-(state.recoil||0)*(mobile?5:8);
  const x=pv.center-drawW/2+sway+nx*(mobile?4:6)+moveSway;
  const y=h-drawH+bob+recoilY+(mobile?9:14);
  const tilt=Math.sin(t*.00155)*.003+nx*.0045+(state.dodgeTilt||0)*.065;
  ctx.save();
  ctx.translate(pv.center,y+drawH*.78);
  ctx.rotate(tilt);
  const pulse=1+Math.sin(t*.0027)*.0018;
  ctx.scale(pulse,pulse);
  const imgX=x-pv.center,imgY=-drawH*.78;
  ctx.drawImage(img,imgX,imgY,drawW,drawH);
  b1DrawWeaponScreen(imgX,imgY,drawW,drawH);
  ctx.restore();
};

function drawB1StageIntro(){
  if(!state||!state.stageIntro||state.stageIntro<=0)return;
  const total=1.9,elapsed=total-state.stageIntro;
  let a=1;
  if(elapsed<.22)a=elapsed/.22;
  if(state.stageIntro<.45)a=Math.min(a,state.stageIntro/.45);
  a=clamp(a,0,1);
  const y=innerHeight*.44;
  ctx.save();ctx.globalAlpha=a;
  const width=Math.min(620,innerWidth*.66),height=72;
  const g=ctx.createLinearGradient(innerWidth/2-width/2,0,innerWidth/2+width/2,0);
  g.addColorStop(0,'rgba(2,38,43,0)');g.addColorStop(.18,'rgba(2,38,43,.72)');g.addColorStop(.82,'rgba(2,38,43,.72)');g.addColorStop(1,'rgba(2,38,43,0)');
  ctx.fillStyle=g;ctx.fillRect(innerWidth/2-width/2,y-height/2,width,height);
  ctx.textAlign='center';ctx.fillStyle='#9ff8ee';ctx.font=`900 ${Math.max(11,Math.min(16,innerWidth*.012))}px system-ui`;ctx.fillText(`MÀN ${state.stageIndex+1}`,innerWidth/2,y-8);
  ctx.fillStyle='#ffffff';ctx.font=`1000 ${Math.max(18,Math.min(32,innerWidth*.026))}px system-ui`;ctx.fillText(state.cfg.name,innerWidth/2,y+22);
  ctx.restore();
}

const updateB1MergedBase=update;
update=function(dt){
  updateB1MergedBase(dt);
  if(state?.mode==='playing'){
    if(state.stageIntro>0)state.stageIntro=Math.max(0,state.stageIntro-dt);
    if(pointer.down&&performance.now()-weaponPressStarted>120)shoot(pointer.x,pointer.y);
  }
};
const renderB1MergedBase=render;
render=function(t){renderB1MergedBase(t);drawB1StageIntro();};

// Keep lower centre clean: no fixed contact/intro dock. Pause/Home stay on the left control rail.
const b1ContactDock=document.querySelector('.contact-dock');if(b1ContactDock)b1ContactDock.remove();


/* === v2.6.0 weapon scale + synchronized muzzle/tracer final === */
let v260WeaponMuzzles=null;
let v260ActiveMuzzleSide='right';

b1WeaponFrame=function(t){
  const step=250; // 4 visual changes per second
  if(pointer.down){
    const held=Math.max(0,t-weaponPressStarted);
    // Firing is intentionally only vuk2 <-> vuk4. The 1-2-3-4 loop looked visually noisy.
    return (Math.floor(held/step)%2===0)?1:3;
  }
  // Brief firing tail makes a short click visibly animate vuk2 <-> vuk4.
  if(t<weaponSingleFlashUntil)return (Math.floor(t/step)%2===0)?1:3;
  // Idle energy/breathing state: vuk1 <-> vuk3.
  return (Math.floor(t/step)%2===0)?0:2;
};

function v260TransformPoint(m,x,y){
  return {x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f};
}

function v260PickMuzzle(targetX){
  if(!v260WeaponMuzzles)return null;
  const mid=(v260WeaponMuzzles.left.x+v260WeaponMuzzles.right.x)/2;
  if(Number.isFinite(targetX)){
    const dead=Math.max(26,innerWidth*.025);
    if(targetX<mid-dead)v260ActiveMuzzleSide='left';
    else if(targetX>mid+dead)v260ActiveMuzzleSide='right';
    else v260ActiveMuzzleSide=((state?.shots||0)%2?'left':'right');
  }
  return v260WeaponMuzzles[v260ActiveMuzzleSide]||v260WeaponMuzzles.right;
}

getMuzzlePoint=function(targetX){
  const p=v260PickMuzzle(Number.isFinite(targetX)?targetX:pointer.x);
  if(p)return {x:p.x,y:p.y};
  // Safe fallback before the first rendered weapon frame.
  const pv=gameplayViewport();
  return {x:pv.center,y:innerHeight-Math.max(92,innerHeight*.17)};
};

addTracer=function(kind,x,y){
  if(!state)return;
  const m=getMuzzlePoint(x);
  const specs={shot:[.28,.18,'#56fff0',4.2],pierce:[.30,.16,'#f2ffff',3.7],spray:[.20,.14,'#8cffe9',5.2],bomb:[.44,.31,'#ffd45f',5.8],beam:[.13,.085,'#c9ffff',7.2]};
  const q=specs[kind]||specs.shot;
  state.tracers.push({x1:m.x,y1:m.y,x2:x,y2:y,t:0,life:q[0],max:q[0],travel:q[1],color:q[2],width:q[3],kind,seed:Math.random()*99});
};

drawWeapon=function(t){
  if(!state)return;
  const frameIndex=b1WeaponFrame(t),img=WEAPON_FRAMES[frameIndex];
  if(!img||!img.complete||!img.naturalWidth)return;
  const w=innerWidth,h=innerHeight,pv=gameplayViewport();
  const mobile=matchMedia('(hover:none) and (pointer:coarse)').matches;

  // v2.6: another ~24% reduction vs v2.5 so the corridor, enemies and pickups remain dominant.
  const drawW=Math.min(pv.width*(mobile?.50:.44),h*(mobile?.84:.88),mobile?520:610);
  const drawH=drawW*(img.naturalHeight/img.naturalWidth);
  const nx=Math.max(-1,Math.min(1,((pointer.x-pv.left)/Math.max(1,pv.width)-.5)*2));

  // Visible but restrained FPS motion: horizontal sway + vertical breathing + movement lean.
  const swayX=Math.sin(t*.00235)*(mobile?5.5:9.0)+Math.sin(t*.0047)*(mobile?1.2:2.0);
  const bobY=Math.sin(t*.00305)*(mobile?2.8:4.6)+Math.sin(t*.00155)*(mobile?1.1:1.7);
  const moveSway=Math.max(-5.5,Math.min(5.5,(state.playerVX||0)*3.8));
  const aimSway=nx*(mobile?4.5:7.0);
  const recoil=(state.recoil||0);
  const recoilY=-recoil*(mobile?5.5:8.5);
  const recoilX=(v260ActiveMuzzleSide==='left'?1:-1)*recoil*(mobile?1.2:2.0);
  const x=pv.center-drawW/2+swayX+moveSway+aimSway+recoilX;
  const y=h-drawH+bobY+recoilY+(mobile?14:20);
  const tilt=Math.sin(t*.00165)*(mobile?.0025:.0042)+nx*(mobile?.0028:.0045)+(state.dodgeTilt||0)*.055;

  ctx.save();
  ctx.translate(pv.center,y+drawH*.78);
  ctx.rotate(tilt);
  const pulse=1+Math.sin(t*.00265)*.0012;
  ctx.scale(pulse,pulse);
  const imgX=x-pv.center,imgY=-drawH*.78;
  ctx.drawImage(img,imgX,imgY,drawW,drawH);
  b1DrawWeaponScreen(imgX,imgY,drawW,drawH);

  // Muzzle anchors are measured from the supplied art itself. Store their transformed screen
  // positions every frame so projectile origin, flash and weapon motion are one coherent system.
  const m=ctx.getTransform();
  const leftLocal={x:imgX+drawW*.078,y:imgY+drawH*.485};
  const rightLocal={x:imgX+drawW*.922,y:imgY+drawH*.485};
  v260WeaponMuzzles={
    left:v260TransformPoint(m,leftLocal.x,leftLocal.y),
    right:v260TransformPoint(m,rightLocal.x,rightLocal.y),
    frame:frameIndex
  };
  ctx.restore();

  // Small muzzle flash follows the exact active barrel instead of floating independently.
  if(state.muzzleFlash>0&&v260WeaponMuzzles){
    const mp=v260WeaponMuzzles[v260ActiveMuzzleSide]||v260WeaponMuzzles.right;
    const ww=WEAPONS[state.weapon]||WEAPONS[0];
    const r=(mobile?13:18)*(0.55+0.45*state.muzzleFlash);
    ctx.save();ctx.globalAlpha=Math.min(1,state.muzzleFlash*.92);ctx.globalCompositeOperation='screen';
    const g=ctx.createRadialGradient(mp.x,mp.y,0,mp.x,mp.y,r*2.5);
    g.addColorStop(0,'#ffffff');g.addColorStop(.22,ww.kind==='bomb'?'#ffd66b':'#9ffff4');g.addColorStop(1,'rgba(120,255,240,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(mp.x,mp.y,r*2.5,0,Math.PI*2);ctx.fill();ctx.restore();
  }
};



/* === v2.7.0 dodge-synced compact weapon + concealed centre-shot origin === */
let v270WeaponPose=null;

function v270WeaponPoseFor(t=performance.now()){
  if(!state)return null;
  const frameIndex=b1WeaponFrame(t),img=WEAPON_FRAMES[frameIndex];
  if(!img||!img.complete||!img.naturalWidth)return null;
  const h=innerHeight,pv=gameplayViewport();
  const mobile=matchMedia('(hover:none) and (pointer:coarse)').matches;

  // Smaller again than v2.6.0: preserve the FPS cue but keep the hospital/NPC field dominant.
  const drawW=Math.min(pv.width*(mobile?.40:.32),h*(mobile?.70:.68),mobile?470:500);
  const drawH=drawW*(img.naturalHeight/img.naturalWidth);
  const nx=Math.max(-1,Math.min(1,((pointer.x-pv.left)/Math.max(1,pv.width)-.5)*2));

  // The weapon now follows the real dodge position, not just a cosmetic 2–5 px sway.
  const minAnchor=pv.left+drawW*.50+8,maxAnchor=pv.left+pv.width-drawW*.50-8;
  const dodgeAnchor=clamp(playerScreenX(state.playerX),Math.min(minAnchor,maxAnchor),Math.max(minAnchor,maxAnchor));
  const swayX=Math.sin(t*.00235)*(mobile?5.0:8.0)+Math.sin(t*.0047)*(mobile?1.1:1.8);
  const bobY=Math.sin(t*.00305)*(mobile?2.6:4.2)+Math.sin(t*.00155)*(mobile?1.0:1.6);
  const moveLean=clamp((state.playerVX||0)*(mobile?4.4:6.0),mobile?-8:-12,mobile?8:12);
  const aimSway=nx*(mobile?3.0:4.8);
  const recoil=state.recoil||0;
  const recoilY=-recoil*(mobile?4.5:7.0);
  const recoilX=-Math.sign(state.playerVX||state.lastMoveDir||1)*recoil*(mobile?1.0:1.5);
  const anchor=dodgeAnchor+swayX+moveLean+aimSway+recoilX;
  const x=anchor-drawW/2;
  const y=h-drawH+bobY+recoilY+(mobile?16:22);
  const tilt=Math.sin(t*.00165)*(mobile?.0024:.0038)+nx*(mobile?.0024:.0038)+(state.dodgeTilt||0)*.050+clamp((state.playerVX||0)*.003,-.010,.010);
  const pulse=1+Math.sin(t*.00265)*.0010;
  const pivotX=anchor,pivotY=y+drawH*.78;
  const imgX=-drawW/2,imgY=-drawH*.78;

  // Centre monitor geometry from the supplied VUK artwork.
  const monitorLocal={x:imgX+drawW*.500,y:imgY+drawH*.475};
  const monitorW=drawW*.128,monitorH=drawH*.175;
  const c=Math.cos(tilt),si=Math.sin(tilt);
  const map=(lx,ly)=>({x:pivotX+(c*lx-si*ly)*pulse,y:pivotY+(si*lx+c*ly)*pulse});
  const monitorCenter=map(monitorLocal.x,monitorLocal.y);

  return {t,frameIndex,img,mobile,pv,drawW,drawH,nx,anchor,x,y,tilt,pulse,pivotX,pivotY,imgX,imgY,monitorCenter,monitorW,monitorH,map};
}

function v270PrepareWeaponPose(t=performance.now()){
  v270WeaponPose=v270WeaponPoseFor(t);
  return v270WeaponPose;
}

// Logical shot origin sits behind the centre monitor. Since tracers/particles render BEFORE
// the foreground weapon image, the source is physically occluded by the artwork and no
// artificial spawn point is visible to the player.
getMuzzlePoint=function(targetX,targetY){
  const p=v270PrepareWeaponPose(performance.now());
  if(p?.monitorCenter)return {x:p.monitorCenter.x,y:p.monitorCenter.y,hidden:true};
  const pv=gameplayViewport();return{x:pv.center,y:innerHeight-Math.max(86,innerHeight*.16),hidden:true};
};

addTracer=function(kind,x,y){
  if(!state)return;
  const m=getMuzzlePoint(x,y);
  const specs={shot:[.28,.18,'#56fff0',4.2],pierce:[.30,.16,'#f2ffff',3.7],spray:[.20,.14,'#8cffe9',5.2],bomb:[.44,.31,'#ffd45f',5.8],beam:[.13,.085,'#c9ffff',7.2]};
  const q=specs[kind]||specs.shot;
  state.tracers.push({x1:m.x,y1:m.y,x2:x,y2:y,t:0,life:q[0],max:q[0],travel:q[1],color:q[2],width:q[3],kind,seed:Math.random()*99,weaponLinked:true});
};

// Keep every active player-shot tail attached to the moving concealed monitor origin.
// This removes the old visual disconnect during A/D dodge or dash movement.
const v270DrawTracersBase=drawTracers;
drawTracers=function(){
  if(state&&v270WeaponPose?.monitorCenter){
    for(const tr of state.tracers){
      if(tr.weaponLinked){tr.x1=v270WeaponPose.monitorCenter.x;tr.y1=v270WeaponPose.monitorCenter.y;}
    }
  }
  v270DrawTracersBase();
};

// Final foreground weapon renderer: dodge position + idle sway/bob + recoil all share one pose.
drawWeapon=function(t){
  if(!state)return;
  const p=v270PrepareWeaponPose(t);
  if(!p)return;
  ctx.save();
  ctx.translate(p.pivotX,p.pivotY);ctx.rotate(p.tilt);ctx.scale(p.pulse,p.pulse);
  ctx.drawImage(p.img,p.imgX,p.imgY,p.drawW,p.drawH);
  b1DrawWeaponScreen(p.imgX,p.imgY,p.drawW,p.drawH);

  // Do NOT draw an exposed muzzle point. A very soft monitor-energy pulse gives firing feedback
  // while the actual shot source remains hidden behind the monitor as requested.
  if(state.muzzleFlash>0){
    const ww=WEAPONS[state.weapon]||WEAPONS[0],r=Math.max(7,p.monitorH*.42);
    ctx.save();ctx.translate(p.imgX+p.drawW*.500,p.imgY+p.drawH*.475);ctx.globalAlpha=Math.min(.34,state.muzzleFlash*.34);ctx.globalCompositeOperation='screen';
    const g=ctx.createRadialGradient(0,0,0,0,0,r*2.1);g.addColorStop(0,'rgba(255,255,255,.82)');g.addColorStop(.32,ww.kind==='bomb'?'rgba(255,214,107,.58)':'rgba(140,255,239,.55)');g.addColorStop(1,'rgba(120,255,240,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r*2.1,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  ctx.restore();
};

// Prepare the current weapon pose before the scene draws tracers, so line origin and weapon
// movement use the same frame even during fast dodge/dash.
const v270RenderBase=render;
render=function(t){v270PrepareWeaponPose(t);v270RenderBase(t);};

/* === v3.1.0 D1 FINAL · 90s pressure curve · 3 boss summons · cinematic projectiles · reward confirmation === */
const D1_BOSS_TIME=90;
const D1_SPEED_TARGETS={
  easy:[.38,.42,.46,.50,.55,.59,.63,.68],
  normal:[.55,.58,.61,.64,.68,.72,.76,.80],
  hard:[.68,.71,.74,.77,.80,.84,.88,.92]
};
const D1_EXPECTED_KILLS={easy:[28,30,32,34,36,38,40,42],normal:[32,34,36,38,40,42,44,46],hard:[35,37,39,41,43,45,47,49]};
const D1_REWARD_META={
  heal:{icon:'❤️',name:'HỒI PHỤC +2',color:'#70f09b',duration:0,rarity:'HỖ TRỢ'},
  shield:{icon:'🛡',name:'KHIÊN KHỬ NHIỄM',color:'#63d8ff',duration:6,rarity:'PHÒNG THỦ'},
  drone:{icon:'🤖',name:'DRONE Y TẾ',color:'#5ff5e6',duration:10,rarity:'HỖ TRỢ'},
  adrenaline:{icon:'💉',name:'ADRENALINE',color:'#ff9b47',duration:5,rarity:'TỐC ĐỘ'},
  vaccine:{icon:'🧬',name:'VACCINE BOOST',color:'#bd91ff',duration:7,rarity:'SÁT THƯƠNG'},
  sterile:{icon:'🧴',name:'STERILE FIELD',color:'#74efd2',duration:6,rarity:'KIỂM SOÁT'},
  gpp:{icon:'✨',name:'TRƯỜNG GPP BOOST',color:'#ffd76b',duration:8,rarity:'ĐẶC BIỆT'}
};
Object.assign(DIFF.easy,{label:'DỄ',enemyHp:.80,damage:.68,bossHp:.88,bossRate:1.18,rewardEvery:7.2,rewardMax:5});
Object.assign(DIFF.normal,{label:'TRUNG BÌNH',enemyHp:1,damage:.90,bossHp:1,bossRate:1.02,rewardEvery:8.8,rewardMax:4});
Object.assign(DIFF.hard,{label:'KHÓ',enemyHp:1.14,damage:1.08,bossHp:1.12,bossRate:.90,rewardEvery:10.2,rewardMax:3});

function d1Smooth(x){x=clamp(x,0,1);return x*x*(3-2*x)}
function d1Pressure(elapsed=state?.stageElapsed||0){return .68+.32*d1Smooth(clamp(elapsed/D1_BOSS_TIME,0,1));}
function d1SpeedTarget(diff=state?.difficulty||'normal',stage=state?.stageIndex||0){return (D1_SPEED_TARGETS[diff]||D1_SPEED_TARGETS.normal)[clamp(stage,0,7)];}
function d1SpawnInterval(){
  const stage=state.stageIndex,diff=state.difficulty,p=d1Smooth(clamp(state.stageElapsed/D1_BOSS_TIME,0,1));
  const base=diff==='easy'?1.78:diff==='hard'?1.34:1.55;
  const stageCut=stage*.035,pressureCut=p*(diff==='easy'?.42:diff==='hard'?.48:.45);
  return Math.max(diff==='easy'?.84:diff==='hard'?.62:.72,base-stageCut-pressureCut)*( .88+Math.random()*.28 );
}
function d1ActiveCap(){const s=state.stageIndex,d=state.difficulty;return (d==='easy'?4:d==='hard'?6:5)+Math.floor(s/3)+(state.stageElapsed>60?1:0);}
function d1Countdown(){return Math.max(0,D1_BOSS_TIME-(state?.stageElapsed||0));}
function d1FormatClock(sec){const n=Math.max(0,Math.ceil(sec)),m=Math.floor(n/60),s=n%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}

// D1 state: the stage is a 90-second survival ramp. Natural NPC spawning stops at Boss time.
const newStateD1Base=newState;
newState=function(stageIndex=0){
  const s=newStateD1Base(stageIndex),d=s.difficulty;
  s.spawnLeft=0;s.spawnTimer=.72;s.d1BossAt=D1_BOSS_TIME;s.d1NaturalSpawns=0;s.d1MinorKills=0;s.d1BossStartedAt=0;
  s._minorCleanTarget=(D1_EXPECTED_KILLS[d]||D1_EXPECTED_KILLS.normal)[s.stageIndex];
  s.rewardNpcMax=DIFF[d].rewardMax;s.rewardNpcTimer=d==='easy'?4.0:4.8;
  s.pickupFx=[];s.rewardBanner=null;s._supportJustAdded=null;s._supportJustUntil=0;
  return s;
};

// D1 spawn model: small/far NPCs, slower baseline and perspective-aware movement.
spawnEnemy=function(type,boss=false){
  const base=ENEMY[type]||ENEMY.basic,d=DIFF[state.difficulty],style=BOSS_STYLE[state.stageIndex]||BOSS_STYLE[BOSS_STYLE.length-1];
  const hp=(boss?state.cfg.bossHp*d.bossHp:base.hp*d.enemyHp)*(boss?1:(1+state.stageIndex*.025));
  const x=boss?.5:sourceXFor(type),side=x<.5?-1:1;
  const e={id:Math.random(),type,boss,name:boss?state.cfg.boss:null,bossKind:boss?state.cfg.bossKind:null,x,baseX:x,depth:boss?.69:.955+Math.random()*.035,hp,maxHp:hp,
    speedBase:base.speed*(.90+Math.random()*.16),speed:base.speed*d1SpeedTarget()*.8,rad:boss?style.rad:base.rad,color:boss?style.color:base.color,
    accent:boss?style.accent:null,shotColor:boss?style.shot:null,phase:Math.random()*6.28,wobble:Math.random()*1.8+1,attackTimer:boss?1.65:999,summon:999,
    flash:0,dead:false,side,base,lastBossPhase:1,guard:0,orbit:Math.random()*6.28,bossSummoned:false,countsForClean:false,d1SummonDone:[false,false,false]};
  state.enemies.push(e);
  if(boss){state.bossIntro=2.05;state.d1BossStartedAt=state.stageElapsed;state.enemyShots.length=0;show(UI.bossBar);UI.bossName.textContent=state.cfg.boss;sfx.boss();toast('⚠ GIÂY 180 · BOSS XUẤT HIỆN!',2);}
  return e;
};

function d1SummonCount(wave){
  const d=state.difficulty;
  const table=d==='easy'?[1,1,2]:d==='hard'?[2,3,4]:[2,2,3];
  return table[wave]+(state.stageIndex>=6&&d!=='easy'&&wave===2?1:0);
}
function d1BossSummon(e,wave){
  const count=d1SummonCount(wave);e.d1SummonDone[wave]=true;sfx.boss();
  toast(`👹 BOSS TRIỆU HỒI · ĐỢT ${wave+1}/3`,1.35);
  for(let i=0;i<count;i++){
    const typ=state.cfg.mix[(Math.random()*state.cfg.mix.length)|0],n=spawnEnemy(typ,false);
    if(n){n.bossSummoned=true;n.countsForClean=false;n.depth=.96+Math.random()*.025;n.baseX=clamp(.16+Math.random()*.68,.08,.92);n.x=n.baseX;}
  }
}
function d1BossVisualPhase(e){const r=Math.max(0,e.hp/e.maxHp);return r>.75?1:r>.50?2:r>.25?3:4;}
updateBoss=function(e,dt,d){
  const ratio=Math.max(0,e.hp/e.maxHp),attackPhase=ratio>.67?1:ratio>.34?2:3,visualPhase=d1BossVisualPhase(e);
  if(visualPhase!==e.d1VisualPhase){e.d1VisualPhase=visualPhase;if(visualPhase>1){sfx.boss();toast(visualPhase===4?'☣ BOSS BIẾN DẠNG TỐI ĐA!':`⚠ BOSS BIẾN DẠNG · CẤP ${visualPhase}`,1.0);}}
  e.phase+=dt*(1.12+visualPhase*.22);e.flash=Math.max(0,e.flash-dt*6);e.guard=Math.max(0,(e.guard||0)-dt);
  const amp=.11+state.stageIndex*.008;e.baseX=.5+Math.sin(e.phase*(.28+state.stageIndex*.008))*amp;e.x=e.baseX;e.depth=.68+Math.sin(e.phase*.31)*.014;
  if(state.bossIntro>0)return;
  const thresholds=[.75,.50,.25];for(let i=0;i<3;i++)if(!e.d1SummonDone[i]&&ratio<=thresholds[i])d1BossSummon(e,i);
  e.attackTimer-=dt;if(e.attackTimer<=0)bossAttack(e,attackPhase,d);
};

// Perspective projection: small in the distance, steadily larger toward the player.
enemyScreen=function(e){
  const h=innerHeight,horizon=h*.405;
  if(e.boss){const y=horizon+h*.195+Math.sin(e.phase*.5)*3,scale=.86+.035*Math.sin(e.phase*.6);const v=gameplayViewport();return{x:v.center+(e.x-.5)*v.width*.74,y,scale,r:e.rad*scale*1.03};}
  const prog=Math.pow(clamp(1-e.depth,0,1),1.34),y=horizon+prog*h*.535+(e.base.fly?Math.sin(e.phase*2)*13-30:0)+(e.base.wall?(e.side<0?-18:7):0);
  const spread=.20+.80*prog,v=gameplayViewport(),x=v.center+(e.x-.5)*v.width*spread*1.42,scale=.20+prog*1.02;
  return{x,y,scale,r:e.rad*scale};
};

// D1 main update loop.
update=function(dt){
  if(!state||state.mode!=='playing')return;const d=DIFF[state.difficulty];state.stageElapsed+=dt;
  if(state.stageIntro>0)state.stageIntro=Math.max(0,state.stageIntro-dt);
  if(state.transition>0){state.transition+=dt;state.zoom=Math.min(1,state.transition/2.9);const p=clamp(state.transition/2.75,0,1);state.bossCleanse=p;state.environmentClean=50+50*(p*p*(3-2*p));state.contamination=100-state.environmentClean;state.cleanSparkle=Math.max(0,(p-.48)/.52);updateHUD();if(state.transition>3.15&&!state.nextPanel){state.nextPanel=true;stageCompletePanel();}return;}
  state.zoom=Math.min(.10,state.stageElapsed*.00125);if(state.shake>0)state.shake=Math.max(0,state.shake-dt);if(state.bossIntro>0)state.bossIntro=Math.max(0,state.bossIntro-dt);
  state.dashCooldown=Math.max(0,state.dashCooldown-dt);state.dashTimer=Math.max(0,state.dashTimer-dt);state.dodgeTilt*=Math.pow(.001,dt);state.recoil=Math.max(0,state.recoil-dt*7.5);state.muzzleFlash=Math.max(0,state.muzzleFlash-dt*10);state.dodgeMessage=Math.max(0,state.dodgeMessage-dt);
  const axis=movementAxis();if(Math.abs(axis)>.03)state.lastMoveDir=axis<0?-1:1;const speedBoost=state.adrenaline>0?1.24:1;
  if(state.dashTimer>0)state.playerVX=state.dashDir*2.42*speedBoost;else{const accel=6.3*speedBoost,maxSpeed=1.05*speedBoost,friction=8.0;if(Math.abs(axis)>.03)state.playerVX+=axis*accel*dt;else state.playerVX*=Math.max(0,1-friction*dt);state.playerVX=clamp(state.playerVX,-maxSpeed,maxSpeed);}state.playerX=clamp(state.playerX+state.playerVX*dt,-1,1);if(Math.abs(state.playerX)>=1&&Math.sign(state.playerVX)===Math.sign(state.playerX))state.playerVX=0;
  if(state.toastTimer>0){state.toastTimer-=dt;if(state.toastTimer<=0)hide(UI.toast)}if(state.comboTimer>0){state.comboTimer-=dt;if(state.comboTimer<=0){state.combo=0;setCombo()}}
  for(const f of ['shield','drone','adrenaline','vaccine','sterile','gppBoost'])if(state[f]>0)state[f]=Math.max(0,state[f]-dt);state.beam=Math.min(100,state.beam+18*dt);

  // SUPPLY remains generous on Easy and stops naturally when the Boss appears.
  if(!state.bossSpawned&&state.rewardNpcCount<state.rewardNpcMax){state.rewardNpcTimer-=dt;if(state.rewardNpcTimer<=0&&!state.rewardNpcs.some(n=>!n.dead)){spawnRewardNpc();state.rewardNpcTimer=(d.rewardEvery||9)*(.86+Math.random()*.30);}}

  // Natural virus pressure exists only during the 90-second survival phase.
  if(!state.bossSpawned&&state.stageElapsed<D1_BOSS_TIME){
    const active=state.enemies.filter(e=>!e.dead&&!e.boss).length;state.spawnTimer-=dt;
    if(state.spawnTimer<=0&&active<d1ActiveCap()){
      const typ=state.cfg.mix[(Math.random()*state.cfg.mix.length)|0],e=spawnEnemy(typ,false);if(e)e.countsForClean=true;state.d1NaturalSpawns++;state.spawnTimer=d1SpawnInterval();
    }
  }
  if(!state.bossSpawned&&state.stageElapsed>=D1_BOSS_TIME){state.environmentClean=50;state.contamination=50;state.bossSpawned=true;state.spawnLeft=0;spawnEnemy(state.cfg.mix[0],true);}

  const speedFactor=d1SpeedTarget()*d1Pressure(),slow=state.sterile>0?.58:1;
  for(const e of state.enemies){
    if(e.dead)continue;if(e.boss){updateBoss(e,dt,d);continue;}
    e.phase+=dt*(1.35+(e.base.pulse||0)*.7);e.flash=Math.max(0,e.flash-dt*6);const swayFactor=e.type==='flagella'?1.5:e.type==='spitter'?1.8:e.base.sway||.7,eSway=swayFactor*Math.sin(e.phase*e.wobble)*.010;e.x=clamp(e.baseX+eSway,.04,.96);
    const perspective=.67+Math.pow(clamp(1-e.depth,0,1),1.05)*.50;let motion=perspective;if(e.type==='breather')motion*=.78+.26*(.5+.5*Math.sin(e.phase*1.7));if(e.base.charge&&e.depth<.42)motion*=1.30;if(e.base.fly)motion*=1.03;if(e.bossSummoned)motion*=.94;
    e.depth-=e.speedBase*speedFactor*dt*motion*slow;
    if(e.depth<=.055){const sc=enemyScreen(e),hitRadius=Math.max(38,Math.min(82,sc.r*.70+innerWidth*.018));if(Math.abs(playerScreenX()-sc.x)<hitRadius)damagePlayer(e.base.attack*d.damage);else{state.score+=35;sfx.dodgeSuccess();toast('↔ NÉ ĐƯỢC VIRUS!',.50);}e.dead=true;burstAt(sc.x,sc.y,e.color,7);}
  }
  state.enemies=state.enemies.filter(e=>!e.dead);

  for(const sh of state.enemyShots){sh.t+=dt;sh.x+=sh.vx*dt;sh.y+=sh.vy*dt;sh.r+=16*dt;if(sh.t>=sh.life){const hitRadius=Math.max(40,Math.min(76,innerWidth*.048));if(Math.abs(playerScreenX()-playerScreenX(sh.targetPlayerX))<hitRadius)damagePlayer(sh.damage*d.damage);else{state.score+=20;sfx.dodgeSuccess();toast('↔ NÉ ĐÒN BOSS!',.48);}sh.dead=true;}}state.enemyShots=state.enemyShots.filter(s=>!s.dead);
  for(const n of state.rewardNpcs){if(n.dead)continue;n.t+=dt;n.life-=dt;n.x+=n.vx*dt;if(n.life<=0||n.x<-.10||n.x>1.10)n.dead=true;}state.rewardNpcs=state.rewardNpcs.filter(n=>!n.dead);
  for(const p of state.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=12*dt;p.a=Math.max(0,p.life/p.max);}state.particles=state.particles.filter(p=>p.life>0);
  for(const tr of state.tracers){tr.t+=dt;tr.life-=dt;}state.tracers=state.tracers.filter(tr=>tr.life>0);for(const hm of state.hitMarkers)hm.life-=dt;state.hitMarkers=state.hitMarkers.filter(hm=>hm.life>0);
  for(const p of state.powerups){p.t+=dt;p.y+=Math.sin(p.t*3)*.12;p.life-=dt;if(p.life<=0)p.dead=true;}state.powerups=state.powerups.filter(p=>!p.dead);
  if(state.drone>0&&state.enemies.length){state._droneTimer=(state._droneTimer||0)-dt;if(state._droneTimer<=0){state._droneTimer=.40;let target=state.enemies.filter(e=>!e.dead&&!e.boss).sort((a,b)=>a.depth-b.depth)[0]||state.enemies.find(e=>!e.dead&&e.boss);if(target){const s=enemyScreen(target),dx=Math.max(34,Math.min(innerWidth-34,playerScreenX()-innerWidth*.10)),dy=innerHeight*.66;state.tracers.push({x1:dx,y1:dy,x2:s.x,y2:s.y,t:0,life:.18,max:.18,travel:.10,color:'#70fff0',width:3.2,kind:'drone',seed:Math.random()*99});hitEnemy(target,.72,false,true);}}}

  // 0→50% is earned during the 90-second survival phase; Boss death owns 50→100%.
  if(!state.bossSpawned){const killClean=clamp((state.cleanMinorKills||0)/Math.max(1,state._minorCleanTarget)*50,0,49.5),timeFloor=clamp(state.stageElapsed/D1_BOSS_TIME*15,0,15);state.environmentClean=Math.max(killClean,timeFloor);state.contamination=100-state.environmentClean;}
  if(state.bossSpawned&&!state.bossDefeated&&!state.enemies.some(e=>e.boss)){state.bossDefeated=true;beginStageClear();}
  if(pointer.down&&performance.now()-weaponPressStarted>120)shoot(pointer.x,pointer.y);
  updateHUD();
};

// Cinematic, deliberately different projectile languages for all five weapons.
addTracer=function(kind,x,y){
  if(!state)return;const m=getMuzzlePoint(x,y);
  const specs={shot:[.34,.21,4.4],pierce:[.30,.17,3.6],spray:[.25,.17,5.0],bomb:[.52,.36,6.0],beam:[.15,.09,7.4]};const q=specs[kind]||specs.shot;
  state.tracers.push({x1:m.x,y1:m.y,x2:x,y2:y,t:0,life:q[0],max:q[0],travel:q[1],width:q[2],kind,seed:Math.random()*99,weaponLinked:true});
};
function d1Point(tr,p){return{x:tr.x1+(tr.x2-tr.x1)*p,y:tr.y1+(tr.y2-tr.y1)*p};}
function d1Line(a,b,color,width,alpha=1,blur=0){ctx.globalAlpha*=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.shadowColor=color;ctx.shadowBlur=blur;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.shadowBlur=0;ctx.globalAlpha/=alpha||1;}
drawTracers=function(){
  if(!state)return;if(v270WeaponPose?.monitorCenter){for(const tr of state.tracers)if(tr.weaponLinked){tr.x1=v270WeaponPose.monitorCenter.x;tr.y1=v270WeaponPose.monitorCenter.y;}}
  const now=performance.now();
  for(const tr of state.tracers){const fade=clamp(tr.life/Math.max(.001,tr.max*.42),0,1),p=clamp(tr.t/tr.travel,0,1),head=d1Point(tr,p),tail=d1Point(tr,Math.max(0,p-.25));ctx.save();ctx.globalAlpha=fade;ctx.lineCap='round';ctx.lineJoin='round';ctx.globalCompositeOperation='screen';
    if(tr.kind==='shot'){
      // Pill cannon: cyan/magenta double-helix comet around a white medical core.
      d1Line(tail,head,'rgba(88,255,237,.36)',tr.width*3.5,1,18);d1Line(tail,head,'rgba(255,255,255,.96)',tr.width*.62,1,10);
      const dx=head.x-tail.x,dy=head.y-tail.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;for(let i=0;i<6;i++){const u=i/5,base=d1Point({x1:tail.x,y1:tail.y,x2:head.x,y2:head.y},u),osc=Math.sin(u*16+tr.seed+now*.012)*7*(.35+.65*u);ctx.fillStyle=i%2?'#ff62d9':'#54fff0';ctx.beginPath();ctx.arc(base.x+nx*osc,base.y+ny*osc,1.8+u*1.5,0,Math.PI*2);ctx.fill();}
      const g=ctx.createRadialGradient(head.x,head.y,0,head.x,head.y,18);g.addColorStop(0,'#fff');g.addColorStop(.22,'#6ffff2');g.addColorStop(.58,'rgba(255,80,220,.52)');g.addColorStop(1,'rgba(90,255,240,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(head.x,head.y,18,0,Math.PI*2);ctx.fill();
    }else if(tr.kind==='pierce'){
      // Injection rail: needle-straight violet/ice lance with moving chevrons.
      d1Line(tail,head,'rgba(140,101,255,.28)',tr.width*4.6,1,24);d1Line(tail,head,'#8fe9ff',tr.width*1.55,1,13);d1Line(tail,head,'#ffffff',tr.width*.42,1,6);
      const dx=head.x-tail.x,dy=head.y-tail.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len,nx=-uy,ny=ux;ctx.strokeStyle='#d8a6ff';ctx.lineWidth=1.2;for(let i=0;i<4;i++){const back=12+i*14,px=head.x-ux*back,py=head.y-uy*back;ctx.beginPath();ctx.moveTo(px-nx*5,py-ny*5);ctx.lineTo(px+ux*6,py+uy*6);ctx.lineTo(px+nx*5,py+ny*5);ctx.stroke();}
    }else if(tr.kind==='spray'){
      // Sterile mist: aurora fan + luminous droplets, never a flat single line.
      const dx=head.x-tr.x1,dy=head.y-tr.y1,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;const cols=['#63fff0','#a5ff78','#7bb8ff','#d99bff','#ffffff'];for(let i=-4;i<=4;i++){const off=i*6+Math.sin(tr.seed+i*1.7+now*.01)*3,ex=head.x+nx*off,ey=head.y+ny*off;ctx.strokeStyle=cols[(i+8)%cols.length];ctx.globalAlpha=fade*(.22+(.7-Math.abs(i)*.07));ctx.lineWidth=1.2+(4-Math.abs(i))*.3;ctx.beginPath();ctx.moveTo(tr.x1,tr.y1);ctx.quadraticCurveTo((tr.x1+ex)/2+nx*off*.4,(tr.y1+ey)/2+ny*off*.4,ex,ey);ctx.stroke();ctx.beginPath();ctx.arc(ex,ey,1.5+Math.abs(Math.sin(i+tr.seed))*2,0,Math.PI*2);ctx.fillStyle=cols[(i+8)%cols.length];ctx.fill();}ctx.globalAlpha=fade;
    }else if(tr.kind==='bomb'){
      // Vitamin bomb: arcing solar-plasma comet with spiral sparks.
      const mx=(tr.x1+tr.x2)/2,my=Math.min(tr.y1,tr.y2)-135,cp={x:(1-p)*(1-p)*tr.x1+2*(1-p)*p*mx+p*p*tr.x2,y:(1-p)*(1-p)*tr.y1+2*(1-p)*p*my+p*p*tr.y2};
      ctx.strokeStyle='rgba(255,87,187,.22)';ctx.lineWidth=tr.width*4;ctx.shadowColor='#ffb64e';ctx.shadowBlur=24;ctx.beginPath();ctx.moveTo(tr.x1,tr.y1);ctx.quadraticCurveTo(mx,my,cp.x,cp.y);ctx.stroke();ctx.strokeStyle='#ffb84f';ctx.lineWidth=tr.width*1.25;ctx.stroke();ctx.strokeStyle='#fff7b2';ctx.lineWidth=tr.width*.38;ctx.stroke();
      const rg=ctx.createRadialGradient(cp.x,cp.y,0,cp.x,cp.y,24);rg.addColorStop(0,'#fff');rg.addColorStop(.25,'#fff06f');rg.addColorStop(.55,'#ff884d');rg.addColorStop(.78,'rgba(255,73,176,.55)');rg.addColorStop(1,'rgba(255,95,80,0)');ctx.fillStyle=rg;ctx.beginPath();ctx.arc(cp.x,cp.y,24,0,Math.PI*2);ctx.fill();for(let i=0;i<6;i++){const a=now*.012+i*Math.PI/3+tr.seed,r=9+i*1.6;ctx.fillStyle=i%2?'#ff6ec7':'#fff3a0';ctx.beginPath();ctx.arc(cp.x+Math.cos(a)*r,cp.y+Math.sin(a)*r,1.7,0,Math.PI*2);ctx.fill();}
    }else if(tr.kind==='beam'){
      // Immunity beam: continuous rainbow aurora with electric white core.
      const dx=tr.x2-tr.x1,dy=tr.y2-tr.y1,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;const cols=['rgba(78,255,232,.36)','rgba(103,178,255,.32)','rgba(221,112,255,.26)'];for(let k=0;k<3;k++){ctx.strokeStyle=cols[k];ctx.lineWidth=tr.width*(2.8-k*.55);ctx.shadowColor=k===0?'#5ffff0':'#b987ff';ctx.shadowBlur=20;ctx.beginPath();const seg=18;for(let i=0;i<=seg;i++){const u=i/seg,off=Math.sin(u*20+now*.025+k*2+tr.seed)*(4+k*2);const x=tr.x1+dx*u+nx*off,y=tr.y1+dy*u+ny*off;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();}d1Line({x:tr.x1,y:tr.y1},{x:tr.x2,y:tr.y2},'#ffffff',2.1,1,8);
    }else{d1Line(tail,head,tr.color||'#70fff0',tr.width||3,1,10);}
    ctx.restore();
  }
};
// Keep the concealed origin concealed: no exposed muzzle particles.
muzzleBurst=function(){};

// Bosses become asymmetric infected organisms, progressively deformed rather than flower-like.
drawBoss=function(e,t){
  const s=enemyScreen(e),r=s.r,phase=d1BossVisualPhase(e),ratio=Math.max(0,e.hp/e.maxHp),accent=e.accent||'#ff6f94',seed=(state.stageIndex+1)*1.73;
  ctx.save();ctx.translate(s.x,s.y);ctx.rotate(Math.sin(e.phase*.31)*.055+(phase-1)*.012);ctx.globalCompositeOperation='source-over';
  const aura=ctx.createRadialGradient(0,0,r*.08,0,0,r*1.75);aura.addColorStop(0,accent+'66');aura.addColorStop(.48,e.color+'33');aura.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=aura;ctx.beginPath();ctx.arc(0,0,r*1.75,0,Math.PI*2);ctx.fill();
  // Uneven tendrils; deliberately not radial/symmetric.
  ctx.lineCap='round';for(let i=0;i<5+phase;i++){const a=-2.65+i*.72+Math.sin(seed+i)*.23,len=r*(.65+i%3*.18+phase*.08),sx=Math.cos(a)*r*.48,sy=Math.sin(a)*r*.35,ex=Math.cos(a+.18*Math.sin(e.phase+i))*len,ey=Math.sin(a-.13)*len*.72;ctx.strokeStyle=i%2?shade(e.color,-25):accent;ctx.globalAlpha=.68;ctx.lineWidth=Math.max(3,r*(.07-(i%3)*.012));ctx.beginPath();ctx.moveTo(sx,sy);ctx.bezierCurveTo(sx*1.8+Math.sin(e.phase+i)*r*.28,sy*1.4,ex*.72,ey*1.12,ex,ey);ctx.stroke();}
  ctx.globalAlpha=1;
  // Crooked infected torso silhouette.
  const pts=19;ctx.beginPath();for(let i=0;i<=pts;i++){const a=i/pts*Math.PI*2,bulge=.88+.12*Math.sin(a*3+seed)+.08*Math.sin(a*7-e.phase)+(i>2&&i<6?.16*phase/4:0)+(i>11&&i<14?-.10:0),xx=Math.cos(a)*r*bulge,yy=Math.sin(a)*r*(.72+.05*Math.sin(a*2+seed))*bulge;i?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy);}ctx.closePath();const body=ctx.createRadialGradient(-r*.28,-r*.30,r*.05,r*.12,r*.12,r*1.2);body.addColorStop(0,'#d9ffff');body.addColorStop(.16,e.color);body.addColorStop(.65,shade(e.color,-35));body.addColorStop(1,'#170b18');ctx.fillStyle=body;ctx.shadowColor=accent;ctx.shadowBlur=16;ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,255,255,.30)';ctx.lineWidth=2;ctx.stroke();
  // Asymmetric eyes / lesions.
  const eyes=[[-.38,-.20,.16],[.12,-.31,.12],[.42,.02,.14],[-.16,.12,.10]];for(let i=0;i<Math.min(eyes.length,phase+1);i++){const [ex,ey,er]=eyes[i],px=ex*r+Math.sin(e.phase*.7+i)*r*.025,py=ey*r;ctx.fillStyle='#ecfff9';ctx.beginPath();ctx.ellipse(px,py,r*er,r*er*.80,.2*i,0,Math.PI*2);ctx.fill();ctx.fillStyle=i%2?'#2b0718':'#071f29';ctx.beginPath();ctx.arc(px+Math.sin(e.phase+i)*r*.018,py,r*er*.43,0,Math.PI*2);ctx.fill();ctx.fillStyle=accent;ctx.beginPath();ctx.arc(px-r*er*.12,py-r*er*.18,r*er*.10,0,Math.PI*2);ctx.fill();}
  // Split jaw gets wider and more jagged as HP drops.
  ctx.fillStyle='rgba(18,2,12,.88)';ctx.beginPath();ctx.moveTo(-r*.38,r*.18);ctx.bezierCurveTo(-r*.18,r*(.42+.035*phase),r*.18,r*(.38+.04*phase),r*.43,r*.13);ctx.bezierCurveTo(r*.18,r*.58,-r*.16,r*.60,-r*.38,r*.18);ctx.fill();ctx.fillStyle='#f2ffff';const teeth=5+phase;for(let i=0;i<teeth;i++){const x=-r*.31+i*(r*.62/(teeth-1));ctx.beginPath();ctx.moveTo(x-r*.035,r*.23);ctx.lineTo(x,r*(.36+(i%2)*.07));ctx.lineTo(x+r*.035,r*.23);ctx.closePath();ctx.fill();}
  // Infected core and cracks.
  const corePulse=1+.08*Math.sin(e.phase*3.1);ctx.shadowColor=phase===4?'#fff36e':accent;ctx.shadowBlur=22;ctx.fillStyle=phase===4?'#fff36e':'#eaffff';ctx.beginPath();ctx.ellipse(-r*.05,-r*.02,r*.18*corePulse,r*.13*corePulse,-.25,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;if(phase>=2){ctx.strokeStyle=accent;ctx.lineWidth=1.5+phase*.35;for(let i=0;i<phase+2;i++){const a=i*1.37+seed;ctx.beginPath();ctx.moveTo(-r*.05,-r*.02);ctx.lineTo(Math.cos(a)*r*(.36+.1*i),Math.sin(a)*r*(.28+.06*i));ctx.stroke();}}
  ctx.fillStyle='rgba(2,22,28,.88)';ctx.font=`900 ${Math.max(10,r*.135)}px system-ui`;ctx.textAlign='center';ctx.fillText(e.name,0,-r*1.30);ctx.fillStyle=ratio<=.25?'#ffdf78':'#bff7f2';ctx.font=`800 ${Math.max(8,r*.09)}px system-ui`;ctx.fillText(`DỊ DẠNG ${phase}/4`,0,-r*1.12);ctx.restore();
};

// Reward pickup presentation: cinematic orb, unique pickup sound, icon flight and explicit confirmation.
function d1PickupSound(kind){
  const pan=0;if(kind==='shield'){tone(620,.11,'triangle',.028,230,pan,.12);tone(980,.09,'sine',.018,130,pan,.10);}else if(kind==='drone'){tone(440,.07,'square',.018,220,pan,.08);setTimeout(()=>tone(760,.08,'triangle',.018,180,pan,.08),55);}else if(kind==='heal'){tone(520,.13,'sine',.025,350,pan,.12);setTimeout(()=>tone(820,.14,'sine',.022,240,pan,.12),70);}else if(kind==='adrenaline'){tone(310,.08,'sawtooth',.022,310,pan,.10);tone(690,.09,'triangle',.018,240,pan,.08);}else if(kind==='vaccine'){tone(730,.12,'sine',.022,300,pan,.14);tone(1090,.10,'triangle',.014,160,pan,.12);}else if(kind==='sterile'){tone(860,.13,'sine',.020,-150,pan,.16);noiseBurst(.05,.010,2800,pan,.10);}else{sfx.gpp();setTimeout(()=>tone(1260,.16,'sine',.025,280,0,.16),80);}}
function d1PickupTarget(kind){const el=kind==='heal'?$('#leftHealthText')||$('#healthText'):UI.supportList;if(el){const r=el.getBoundingClientRect();return{x:r.left+Math.min(26,r.width*.20),y:r.top+Math.min(28,r.height*.35)}}const v=gameplayViewport();return{x:v.left+18,y:innerHeight*.24};}
function d1PickupFeedback(kind,x,y){if(!state)return;const m=D1_REWARD_META[kind]||D1_REWARD_META.drone,target=d1PickupTarget(kind),now=performance.now();state.pickupFx=state.pickupFx||[];state.pickupFx.push({kind,x,y,tx:target.x,ty:target.y,start:now,dur:kind==='gpp'?1050:820,icon:m.icon,color:m.color});state.rewardBanner={kind,name:m.name,rarity:m.rarity,icon:m.icon,color:m.color,until:now+(kind==='gpp'?1750:1250),start:now};state._supportJustAdded=kind;state._supportJustUntil=now+700;burstAt(x,y,m.color,kind==='gpp'?28:16);d1PickupSound(kind);}
function d1RoundRect(x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function drawD1PickupFeedback(t){if(!state)return;state.pickupFx=(state.pickupFx||[]).filter(f=>t-f.start<f.dur);for(const f of state.pickupFx){const p=clamp((t-f.start)/f.dur,0,1),e=1-Math.pow(1-p,3),x=f.x+(f.tx-f.x)*e,y=f.y+(f.ty-f.y)*e-Math.sin(p*Math.PI)*70,sc=.75+.35*Math.sin(p*Math.PI);ctx.save();ctx.translate(x,y);ctx.scale(sc,sc);ctx.globalCompositeOperation='screen';ctx.shadowColor=f.color;ctx.shadowBlur=18;ctx.fillStyle='rgba(5,35,42,.86)';ctx.strokeStyle=f.color;ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,19,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.font='19px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText(f.icon,0,1);ctx.restore();}
  const b=state.rewardBanner;if(b&&t<b.until){const life=b.until-t,total=b.until-b.start,a=Math.min(1,(t-b.start)/150,life/220),v=gameplayViewport(),mobile=!v.desktop,w=Math.min(300,innerWidth*.40),x=mobile?(innerWidth-w)/2:v.left+14,y=mobile?70:innerHeight*.22;ctx.save();ctx.globalAlpha=clamp(a,0,1);ctx.shadowColor=b.color;ctx.shadowBlur=16;ctx.fillStyle='rgba(2,28,34,.92)';ctx.strokeStyle=b.color;ctx.lineWidth=1.5;d1RoundRect(x,y,w,58,12);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.font='22px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText(b.icon,x+31,y+29);ctx.textAlign='left';ctx.fillStyle=b.color;ctx.font='900 8px system-ui';ctx.fillText(`ĐÃ NHẬN · ${b.rarity}`,x+56,y+19);ctx.fillStyle='#fff';ctx.font='1000 12px system-ui';ctx.fillText(b.name,x+56,y+37);
    if(b.kind==='gpp'){
      const boosts=['shield','drone','adrenaline','vaccine','sterile'];
      const stripY=y+50,step=Math.min(38,(w-70)/boosts.length),sx=x+61;
      ctx.textAlign='center';ctx.textBaseline='middle';
      boosts.forEach((k,i)=>{const mm=D1_REWARD_META[k],delay=i*.085,pp=clamp((t-b.start)/1000-delay,0,1),pop=Math.sin(Math.min(1,pp)*Math.PI*.5);ctx.save();ctx.globalAlpha=pop;ctx.translate(sx+i*step,stripY);ctx.scale(.70+.30*pop,.70+.30*pop);ctx.shadowColor=mm.color;ctx.shadowBlur=9*pop;ctx.fillStyle='rgba(4,43,48,.90)';ctx.strokeStyle=mm.color;ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,10,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.font='11px system-ui';ctx.fillStyle='#fff';ctx.fillText(mm.icon,0,1);ctx.restore();});
    }
    ctx.restore();}}

// Premium item rendering: layered aura + orbit rings + readable icon/label.
drawPowerups=function(){if(!state)return;for(const p of state.powerups){const m=D1_REWARD_META[p.kind]||D1_REWARD_META.drone,isGpp=p.kind==='gpp',r=isGpp?31:26,pulse=1+Math.sin(p.t*4.2)*.055;ctx.save();ctx.translate(p.x,p.y);ctx.scale(pulse,pulse);ctx.globalCompositeOperation='screen';const beam=ctx.createLinearGradient(0,-115,0,36);beam.addColorStop(0,'rgba(255,255,255,0)');beam.addColorStop(.42,m.color+'38');beam.addColorStop(.72,m.color+'88');beam.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=beam;ctx.fillRect(-15,-115,30,150);ctx.shadowColor=m.color;ctx.shadowBlur=isGpp?28:18;for(let k=0;k<(isGpp?3:2);k++){ctx.save();ctx.rotate(p.t*(k%2?-.8:.65)+k);ctx.strokeStyle=k===0?m.color:'rgba(255,255,255,.64)';ctx.lineWidth=k===0?2:1;ctx.setLineDash([5+k*2,5]);ctx.beginPath();ctx.ellipse(0,0,r*(1.35+k*.22),r*(.72+k*.13),.35*k,0,Math.PI*2);ctx.stroke();ctx.restore();}ctx.setLineDash([]);const orb=ctx.createRadialGradient(-r*.28,-r*.28,2,0,0,r*1.15);orb.addColorStop(0,'#ffffff');orb.addColorStop(.22,m.color);orb.addColorStop(1,'rgba(4,35,41,.96)');ctx.fillStyle=orb;ctx.strokeStyle='rgba(255,255,255,.82)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;if(isGpp&&logoIcon.complete){ctx.save();ctx.beginPath();ctx.arc(0,0,r*.72,0,Math.PI*2);ctx.clip();ctx.drawImage(logoIcon,-r*.72,-r*.72,r*1.44,r*1.44);ctx.restore();}else{ctx.font=`${r*.86}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText(m.icon,0,1);}for(let i=0;i<(isGpp?7:4);i++){const a=p.t*(1.2+i*.07)+i*Math.PI*2/(isGpp?7:4),rr=r*(1.42+(i%2)*.23);ctx.fillStyle=i%2?'#fff':m.color;ctx.beginPath();ctx.arc(Math.cos(a)*rr,Math.sin(a)*rr*.64,1.2+(i%3)*.5,0,Math.PI*2);ctx.fill();}ctx.globalCompositeOperation='source-over';ctx.fillStyle='rgba(2,27,33,.88)';d1RoundRect(-54,r+10,108,20,8);ctx.fill();ctx.strokeStyle=m.color;ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#fff';ctx.font='900 7px system-ui';ctx.textAlign='center';ctx.fillText(m.name,0,r+23);ctx.restore();}};

collectPowerups=function(x,y){if(!state)return false;for(const p of state.powerups){if(p.dead||Math.hypot(x-p.x,y-p.y)>=48)continue;const kind=p.kind,px=p.x,py=p.y;p.dead=true;
  if(kind==='heal')state.health=Math.min(state.maxHealth,state.health+2);
  else if(kind==='shield')supportExtend('shield',6,10);
  else if(kind==='drone')supportExtend('drone',10,15);
  else if(kind==='adrenaline')supportExtend('adrenaline',5,8);
  else if(kind==='vaccine')supportExtend('vaccine',7,11);
  else if(kind==='sterile')supportExtend('sterile',6,10);
  else if(kind==='gpp'){state.health=Math.min(state.maxHealth,state.health+2);supportExtend('shield',6,10);supportExtend('drone',10,15);supportExtend('adrenaline',5,8);supportExtend('vaccine',7,11);supportExtend('sterile',6,10);supportExtend('gppBoost',8,12);for(const e of [...state.enemies])if(!e.boss&&!e.dead)hitEnemy(e,1.20,false,true,false);}
  d1PickupFeedback(kind,px,py);updateHUD();return true;}return false;};

// Active support HUD: circular countdown around icon + one-time arrival animation.
updateSupportUI=function(){if(!state)return;const active=supportActive(),now=performance.now(),key=active.map(x=>`${x.k}:${Math.ceil(x.left*4)}`).join('|');if(key===state._supportHudKey)return;state._supportHudKey=key;
  if(UI.supportList){UI.supportList.innerHTML=active.length?active.map(({k,m,left})=>{const pct=clamp(left/m.duration*100,0,100),fresh=state._supportJustAdded===k&&now<state._supportJustUntil?' support-new':'',exp=left<2?' expiring':'';return`<div class="support-row${fresh}${exp}" style="--support-color:${m.color};--support-pct:${pct}%"><span class="support-icon"><i>${m.icon}</i></span><b>${m.name}</b><strong>${left.toFixed(1)}s</strong><span class="support-track"><i style="width:${pct}%"></i></span></div>`}).join(''):'<div class="support-empty">CHƯA CÓ HỖ TRỢ</div>';}
  if(UI.mobileSupportStrip)UI.mobileSupportStrip.innerHTML=active.slice(0,4).map(({m,left})=>`<span class="mobile-support-chip${left<2?' expiring':''}">${m.icon} ${left.toFixed(0)}s</span>`).join('');
  if(state._supportJustAdded&&now<state._supportJustUntil)state._supportJustAdded=null;
};

// D1 HUD: countdown to the exact Boss second and professional difficulty labels.
const updateHUDD1Base=updateHUD;
updateHUD=function(){updateHUDD1Base();if(!state)return;const boss=state.bossSpawned,timeText=boss?'BOSS':d1FormatClock(d1Countdown()),minor=state.enemies.filter(e=>!e.dead&&!e.boss).length;
  if($('#rightTimeText'))$('#rightTimeText').textContent=timeText;if($('#timeTextMobile'))$('#timeTextMobile').textContent=timeText;if($('#rightEnemyText'))$('#rightEnemyText').textContent=minor;if(UI.enemy)UI.enemy.textContent=`Virus: ${minor}`;
  if(UI.diffBadge){const label=DIFF[state.difficulty].label,s=state.difficulty==='easy'?'🛡 LÀM QUEN':state.difficulty==='hard'?'☣ THỬ THÁCH':'⚠ CÂN BẰNG';UI.diffBadge.textContent=`${label} · ${s}`;}
};

// Rank tuned for a mandatory 90-second survival phase + Boss fight.
rankFor=function(acc,hp,time){const bossTime=Math.max(0,time-D1_BOSS_TIME),v=acc*.52+hp*3.7+(bossTime<24?14:bossTime<40?9:bossTime<60?5:2);return v>=84?'S+':v>=72?'S':v>=57?'A':'B';};

// Strong but natural weapon lean follows left/right strafe. Recompute the concealed monitor origin after tilt.
const d1PoseBase=v270WeaponPoseFor;
v270WeaponPoseFor=function(t=performance.now()){
  const p=d1PoseBase(t);if(!p||!state)return p;const movementTilt=clamp((state.playerVX||0)*.055,-.070,.070),dashTilt=(state.dashTimer>0?state.dashDir*.030:0);p.tilt+=movementTilt+dashTilt;
  const c=Math.cos(p.tilt),si=Math.sin(p.tilt),map=(lx,ly)=>({x:p.pivotX+(c*lx-si*ly)*p.pulse,y:p.pivotY+(si*lx+c*ly)*p.pulse});p.map=map;p.monitorCenter=map(p.imgX+p.drawW*.500,p.imgY+p.drawH*.475);return p;
};

// Menu interaction: main screen stays clean; 8 thumbnails live in a dedicated selector.
const d1StagePanel=$('#stageSelectPanel'),d1StageBtn=$('#stageSelectBtn'),d1StageDone=$('#stageSelectDoneBtn'),d1StageHero=$('#selectedStageHero');
if(d1StageBtn)d1StageBtn.onclick=()=>{a1RenderStageMenu();show(d1StagePanel);};if(d1StageHero)d1StageHero.onclick=()=>{a1RenderStageMenu();show(d1StagePanel);};if(d1StageDone)d1StageDone.onclick=()=>hide(d1StagePanel);
const d1RenderStageMenuBase=a1RenderStageMenu;
a1RenderStageMenu=function(){d1RenderStageMenuBase();const img=$('#selectedStageHeroImg'),no=$('#selectedStageHeroNo'),name=$('#selectedStageHeroName');if(img){img.src=`assets/stage${a1SelectedStage+1}-clean.jpg`;img.alt=STAGES[a1SelectedStage].name;}if(no)no.textContent=`MÀN ${a1SelectedStage+1}`;if(name)name.textContent=STAGES[a1SelectedStage].name;};
$$('.difficulty').forEach(b=>b.addEventListener('click',()=>{const box=$('#difficultyDetail'),key=b.dataset.difficulty;if(!box)return;const map={easy:['🛡 DỄ · LÀM QUEN','NPC chậm hơn rõ rệt · Supply nhiều · phù hợp người chơi mới'],normal:['⚠ TRUNG BÌNH · CÂN BẰNG','Màn 1 bắt đầu xấp xỉ Màn 5 cấp Dễ · áp lực tăng liên tục 1→90s'],hard:['☣ KHÓ · THỬ THÁCH','Màn 1 bắt đầu xấp xỉ Màn 5 Trung bình · mật độ và hành vi khắt khe hơn']};box.innerHTML=`<b>${map[key][0]}</b><span>${map[key][1]}</span>`;}));
const d1GoHomeBase=goHome;goHome=function(){if(d1StagePanel)hide(d1StagePanel);d1GoHomeBase();a1RenderStageMenu();};

// Draw pickup confirmation over the completed scene without occupying the lower centre.
const d1RenderBase=render;
render=function(t){d1RenderBase(t);drawD1PickupFeedback(t);};

a1RenderStageMenu();



/* === v3.1.0 F1 FINAL · boss odour · 5s cleanse + 2s sparkle · persistent boss rewards · QA hardening === */
const F1_CLEAN_SECONDS=5;
const F1_SPARKLE_SECONDS=2;
const F1_REWARD_STORE='bstq-f1-boss-inventory-v1';
const F1_UPGRADE_STORE='bstq-f1-upgrades-v1';
const F1_UPGRADE_POINTS='bstq-f1-upgrade-points-v1';
const F1_BOSS_REWARD_META={
  survival:{icon:'❤️',name:'HỘP SINH TỒN +5',short:'HỒI 5 SINH TỒN',color:'#72f3a2'},
  eliteDrone:{icon:'🛸',name:'DRONE ĐẶC BIỆT 20s',short:'DRONE NGOÀI · HỎA LỰC 20s',color:'#c18cff'},
  annihilator:{icon:'💥',name:'BƠM HỦY DIỆT',short:'QUÉT 50% KHU VỰC',color:'#ff9b58'},
  bossGpp:{icon:'✨',name:'LOGO GPP TỔNG HỢP',short:'TẤT CẢ PHẦN THƯỞNG',color:'#ffe16f'}
};
const F1_REWARD_ORDER=['survival','eliteDrone','annihilator','bossGpp'];
const F1_REWARD_KEYS={KeyQ:'survival',KeyW:'eliteDrone',KeyE:'annihilator',KeyR:'bossGpp'};
const F1_UPGRADES={
  damage:{icon:'🎯',name:'SÁT THƯƠNG',desc:'+5% sát thương mỗi cấp',max:5},
  fireRate:{icon:'⚡',name:'TỐC BẮN',desc:'-4% hồi bắn mỗi cấp',max:5},
  survival:{icon:'❤️',name:'SINH TỒN',desc:'+1 sinh tồn tối đa mỗi cấp',max:3},
  drone:{icon:'🛸',name:'DRONE',desc:'+8% sát thương Drone mỗi cấp',max:5},
  supply:{icon:'🎁',name:'SUPPLY',desc:'SUPPLY xuất hiện sớm hơn',max:4}
};
function f1LoadJson(key,fallback){try{const v=JSON.parse(localStorage.getItem(key)||'null');return v&&typeof v==='object'?v:fallback}catch{return fallback}}
function f1SaveJson(key,v){try{localStorage.setItem(key,JSON.stringify(v))}catch{}}
function f1Inventory(){const raw=f1LoadJson(F1_REWARD_STORE,{}),out={};for(const k of F1_REWARD_ORDER)out[k]=Math.max(0,Math.floor(Number(raw[k])||0));return out}
function f1SaveInventory(inv){f1SaveJson(F1_REWARD_STORE,inv);f1UpdateRewardRail()}
function f1UpgradeState(){const raw=f1LoadJson(F1_UPGRADE_STORE,{}),out={};for(const k of Object.keys(F1_UPGRADES))out[k]=clamp(Math.floor(Number(raw[k])||0),0,F1_UPGRADES[k].max);return out}
function f1UpgradePoints(){try{return Math.max(0,parseInt(localStorage.getItem(F1_UPGRADE_POINTS)||'0',10)||0)}catch{return 0}}
function f1SetUpgradePoints(n){try{localStorage.setItem(F1_UPGRADE_POINTS,String(Math.max(0,n|0)))}catch{} f1RenderUpgradePanel()}
function f1RewardTarget(){const rail=$('#bossRewardRail');if(rail){const r=rail.getBoundingClientRect();return{x:r.left+r.width*.5,y:r.top+r.height*.5}}const v=gameplayViewport();return{x:v.left+v.width-24,y:innerHeight*.55}}
function f1UpdateRewardRail(){const inv=f1Inventory();for(const k of F1_REWARD_ORDER){const count=inv[k]||0,el=document.getElementById(`bossRewardCount-${k}`),btn=document.querySelector(`[data-boss-reward="${k}"]`);if(el)el.textContent=`×${count}`;if(btn){btn.classList.toggle('empty',count<=0);btn.classList.toggle('ready',count>0);btn.setAttribute('aria-disabled',String(count<=0));}}}
function f1ApplyUpgradesToState(s){const u=f1UpgradeState();s.f1Upgrades=u;s.maxHealth=10+(u.survival||0);s.health=Math.min(s.maxHealth,s.health+(u.survival||0));s.rewardNpcTimer=Math.max(2.6,(s.rewardNpcTimer||4.8)*(1-(u.supply||0)*.06));}
const f1NewStateBase=newState;
newState=function(stageIndex=0){const s=f1NewStateBase(stageIndex);f1ApplyUpgradesToState(s);Object.assign(s,{bossDrone:0,bossRewardFx:null,bossRewardPending:null,bossRewardShown:false,f1WeaponEffect:null,f1WeaponEffectUntil:0,f1AnnihilatorFx:0,f1CleanChimeMark:0,f1SparkleChime:false,f1BossKilledAt:0,f1BossKillDuration:0});return s;};

function f1RewardWeaponPulse(kind,duration=900){if(!state)return;state.f1WeaponEffect=kind;state.f1WeaponEffectUntil=performance.now()+duration;}
function f1UseReward(kind,fromCombo=false){if(!state||!['playing'].includes(state.mode)||state.transition>0)return false;const inv=f1Inventory();if((inv[kind]||0)<=0){toast('Vật phẩm Boss chưa sẵn sàng',.7);return false}
  if(kind==='survival'){
    if(state.health>=state.maxHealth-.01){toast('❤️ SINH TỒN ĐÃ ĐẦY',.9);return false}
    state.health=Math.min(state.maxHealth,state.health+5);f1RewardWeaponPulse('survival',1100);tone(510,.13,'sine',.028,300,0,.13);setTimeout(()=>tone(840,.15,'sine',.020,260,0,.12),70);toast('❤️ HỘP SINH TỒN · +5',1.0);
  }else if(kind==='eliteDrone'){
    state.bossDrone=Math.max(state.bossDrone||0,20);state._bossDroneTimer=.05;f1RewardWeaponPulse('eliteDrone',20000);tone(450,.08,'square',.018,280,0,.10);setTimeout(()=>tone(920,.12,'triangle',.020,220,0,.12),70);toast('🛸 DRONE ĐẶC BIỆT NGOÀI · 20s',1.1);
  }else if(kind==='annihilator'){
    const v=gameplayViewport(),cx=playerScreenX(),cy=innerHeight*.70,range=Math.max(v.width*.50,innerHeight*.42),targets=state.enemies.filter(e=>!e.dead&&!e.boss).filter(e=>{const sc=enemyScreen(e);return Math.hypot(sc.x-cx,(sc.y-cy)*.82)<=range});
    if(!targets.length){toast('💥 CHƯA CÓ NPC TRONG VÙNG HỦY DIỆT',1.0);return false}
    state.f1AnnihilatorFx=1;f1RewardWeaponPulse('annihilator',1000);for(const e of targets){const sc=enemyScreen(e);e.dead=true;state.kills++;state.score+=e.base?.score||90;burstAt(sc.x,sc.y,'#ff9b58',18);}state.enemies=state.enemies.filter(e=>!e.dead);tone(145,.32,'sawtooth',.045,-65,0,.20);noiseBurst(.15,.035,560,0,.18);toast(`💥 BƠM HỦY DIỆT · ${targets.length} NPC`,1.15);
  }else if(kind==='bossGpp'){
    // One Logo equals the complete Boss reward kit in one activation.
    if(state.health<state.maxHealth)state.health=Math.min(state.maxHealth,state.health+5);state.bossDrone=Math.max(state.bossDrone||0,20);state._bossDroneTimer=.04;const v=gameplayViewport(),cx=playerScreenX(),cy=innerHeight*.70,range=Math.max(v.width*.50,innerHeight*.42);const targets=state.enemies.filter(e=>!e.dead&&!e.boss).filter(e=>{const sc=enemyScreen(e);return Math.hypot(sc.x-cx,(sc.y-cy)*.82)<=range});for(const e of targets){const sc=enemyScreen(e);e.dead=true;state.kills++;state.score+=e.base?.score||90;burstAt(sc.x,sc.y,'#ffe16f',22)}state.enemies=state.enemies.filter(e=>!e.dead);state.f1AnnihilatorFx=1;f1RewardWeaponPulse('bossGpp',20000);sfx.gpp();setTimeout(()=>tone(1320,.18,'sine',.026,260,0,.18),90);toast('✨ GPP TỔNG HỢP · +5 + DRONE + HỦY DIỆT',1.5);
  }
  inv[kind]--;f1SaveInventory(inv);updateHUD();return true;
}
for(const btn of document.querySelectorAll('[data-boss-reward]'))btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();f1UseReward(btn.dataset.bossReward)});
addEventListener('keydown',e=>{const kind=F1_REWARD_KEYS[e.code];if(!kind||e.ctrlKey||e.altKey||e.metaKey)return;if(state?.mode==='playing'){e.preventDefault();f1UseReward(kind)}},true);

// Make every dropped SUPPLY item usable by aiming/shooting at it, not only on the first pointerdown.
const f1ShootBase=shoot;
shoot=function(x,y){if(!state||state.mode!=='playing'||state.transition>0)return;if(collectPowerups(x,y)){state.lastFire=performance.now();return}return f1ShootBase(x,y);};
canvas.addEventListener('pointercancel',()=>{pointer.down=false;});
addEventListener('visibilitychange',()=>{if(document.hidden&&state){pointer.down=false;state.moveLeft=false;state.moveRight=false;state.mobileMoveAxis=0;}});

// Boss odour: layered rear/front vapour and drifting smell motes around the infected body.
function f1BossOdour(e,t,front=false){if(!e?.boss||e.dead)return;const s=enemyScreen(e),r=s.r,phase=d1BossVisualPhase(e),layer=front?1:0;ctx.save();ctx.translate(s.x,s.y);ctx.globalCompositeOperation='screen';const cols=['#b7ff68','#d8c95b','#85d968','#b88cff'];const count=front?8:13;for(let i=0;i<count;i++){const seed=(state.stageIndex+1)*9.7+i*2.31+layer*11.1,tt=t*.00024*(.78+(i%4)*.09)+seed,ang=tt+Math.sin(seed)*2.2,rad=r*(front?.48:.75)+((tt*37+i*29)%(r*(front?1.15:1.75))),x=Math.cos(ang*.72+i)*rad*.72,y=-r*.15-Math.abs(Math.sin(ang*.83+i*.8))*r*(front?.76:1.25)+Math.sin(tt*2.2+i)*r*.14,sz=r*(front?.030:.045)*(1+(i%3)*.42);ctx.globalAlpha=(front?.16:.11)+phase*.018;ctx.shadowColor=cols[i%cols.length];ctx.shadowBlur=front?10:16;ctx.fillStyle=cols[i%cols.length];ctx.beginPath();ctx.arc(x,y,sz,0,Math.PI*2);ctx.fill();ctx.globalAlpha*=.55;ctx.strokeStyle=cols[(i+1)%cols.length];ctx.lineWidth=Math.max(1,sz*.28);ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+r*.10*Math.sin(tt+i),y-r*.20,x-r*.09*Math.cos(tt*.9+i),y-r*.36,x+r*.04*Math.sin(tt*1.3),y-r*.54);ctx.stroke();}
  // gaseous ring close to boss, subtle enough to keep the hit area readable
  const g=ctx.createRadialGradient(0,0,r*.72,0,0,r*(front?1.25:1.62));g.addColorStop(0,'rgba(176,255,96,0)');g.addColorStop(.58,front?'rgba(173,231,86,.06)':'rgba(132,198,74,.075)');g.addColorStop(1,'rgba(109,92,170,0)');ctx.fillStyle=g;ctx.globalAlpha=1;ctx.beginPath();ctx.arc(0,0,r*(front?1.28:1.65),0,Math.PI*2);ctx.fill();ctx.restore();}
const f1DrawBossBase=drawBoss;
drawBoss=function(e,t){f1BossOdour(e,t,false);f1DrawBossBase(e,t);f1BossOdour(e,t,true);};

function f1GenerateBossReward(){const duration=Math.max(0,Number(state.f1BossKillDuration)||((state.stageElapsed||0)-(state.d1BossStartedAt||D1_BOSS_TIME))),fastLimit=state.difficulty==='easy'?30:state.difficulty==='hard'?22:26,count=duration<=fastLimit?2:1,pool=['survival','survival','eliteDrone','eliteDrone','annihilator','annihilator','bossGpp'];const out=[];for(let i=0;i<count;i++){let choices=pool.filter(k=>!out.includes(k));if(!choices.length)choices=pool;let k=choices[(Math.random()*choices.length)|0];if(k==='bossGpp'&&Math.random()>.42)k=choices[(Math.random()*choices.length)|0];out.push(k)}state.f1BossKillDuration=duration;return out;}
function f1RewardCard(kind){const m=F1_BOSS_REWARD_META[kind];return `<div class="f1-boss-drop" style="--reward-color:${m.color}"><div class="f1-boss-drop-core"><span class="f1-boss-drop-icon">${m.icon}</span></div><div class="f1-boss-drop-copy"><b>${m.name}</b><small>${m.short}</small></div></div>`}
function f1ShowBossRewards(){if(!state||state.bossRewardShown)return;state.bossRewardShown=true;state.mode='bossReward';state.bossRewardPending=f1GenerateBossReward();const holder=$('#bossRewardDrops');if(holder)holder.innerHTML=state.bossRewardPending.map(f1RewardCard).join('');show($('#bossRewardPanel'));tone(620,.12,'sine',.022,240,0,.12);setTimeout(()=>tone(920,.16,'triangle',.020,280,0,.12),90);}
function f1ClaimBossRewards(){if(!state||!state.bossRewardPending)return;const inv=f1Inventory();for(const k of state.bossRewardPending)inv[k]=(inv[k]||0)+1;f1SaveInventory(inv);state.bossRewardPending=null;hide($('#bossRewardPanel'));f1SetUpgradePoints(f1UpgradePoints()+1);stageCompletePanel();}
const claimBossRewardBtn=$('#claimBossRewardBtn');if(claimBossRewardBtn)claimBossRewardBtn.onclick=f1ClaimBossRewards;

// 5 seconds of visible cleansing, followed by 2 seconds of clean sparkle. Only then reveal Boss rewards.
beginStageClear=function(){if(!state||state.transition>0||state.bossRewardShown)return;state.transition=.001;state.mode='playing';state.environmentClean=Math.max(50,state.environmentClean||0);state.contamination=50;state.cleanSparkle=0;state.nextPanel=false;state.f1CleanChimeMark=0;state.f1SparkleChime=false;state.f1BossKilledAt=state.stageElapsed;state.f1BossKillDuration=Math.max(0,(state.stageElapsed||0)-(state.d1BossStartedAt||D1_BOSS_TIME));sfx.clear();toast('🧼 ĐANG LÀM SẠCH TOÀN KHU...',1.7);};

// Override D1 update only for the post-Boss transition and F1 inventory timers; delegate normal combat untouched.
const f1UpdateCombatBase=update;
update=function(dt){
  if(!state||state.mode!=='playing')return;
  if(state.transition>0){
    state.transition+=dt;const cleanP=clamp(state.transition/F1_CLEAN_SECONDS,0,1);state.environmentClean=50+50*d1Smooth(cleanP);state.contamination=100-state.environmentClean;state.zoom=Math.min(1,state.transition/F1_CLEAN_SECONDS);state.cleanSparkle=state.transition>F1_CLEAN_SECONDS?clamp((state.transition-F1_CLEAN_SECONDS)/F1_SPARKLE_SECONDS,0,1):0;
    const mark=Math.floor(cleanP*5);if(mark>state.f1CleanChimeMark&&mark<=5){state.f1CleanChimeMark=mark;tone(420+mark*105,.11,'sine',.010+mark*.002,90,0,.08)}
    if(state.transition>=F1_CLEAN_SECONDS&&!state.f1SparkleChime){state.f1SparkleChime=true;tone(880,.16,'sine',.020,220,0,.12);setTimeout(()=>tone(1180,.17,'triangle',.018,250,0,.12),100);setTimeout(()=>tone(1460,.20,'sine',.014,120,0,.10),210)}
    if(state.transition>=F1_CLEAN_SECONDS+F1_SPARKLE_SECONDS&&!state.nextPanel){state.nextPanel=true;state.environmentClean=100;state.contamination=0;state.cleanSparkle=1;f1ShowBossRewards()}
    updateHUD();return;
  }
  f1UpdateCombatBase(dt);
  if(state?.mode!=='playing')return;
  if(state.bossDrone>0){state.bossDrone=Math.max(0,state.bossDrone-dt);state._bossDroneTimer=(state._bossDroneTimer||0)-dt;if(state._bossDroneTimer<=0){state._bossDroneTimer=.22;const target=state.enemies.filter(e=>!e.dead&&!e.boss).sort((a,b)=>a.depth-b.depth)[0]||state.enemies.find(e=>!e.dead&&e.boss);if(target){const sc=enemyScreen(target),p=v270WeaponPose?.monitorCenter||{x:playerScreenX(),y:innerHeight*.66},u=f1UpgradeState();state.tracers.push({x1:p.x-22,y1:p.y-52,x2:sc.x,y2:sc.y,t:0,life:.24,max:.24,travel:.13,width:5.2,kind:'eliteDrone',seed:Math.random()*99});hitEnemy(target,1.25*(1+(u.drone||0)*.08),false,true,false)}}}
  if(state.f1AnnihilatorFx>0)state.f1AnnihilatorFx=Math.max(0,state.f1AnnihilatorFx-dt*1.8);
};

// Persistent upgrades affect player weapon damage/rate without changing enemy progression logic.
const f1HitEnemyBase=hitEnemy;
hitEnemy=function(e,damage,countHit=true,drone=false,crit=false){const u=state?.f1Upgrades||f1UpgradeState(),mult=1+(u.damage||0)*.05;return f1HitEnemyBase(e,damage*mult,countHit,drone,crit)};
const f1ShootUpgradeBase=shoot;
shoot=function(x,y){if(!state||state.mode!=='playing'||state.transition>0)return;const u=state.f1Upgrades||f1UpgradeState(),w=WEAPONS[state.weapon],old=w.cooldown;if(u.fireRate)w.cooldown=old*(1-(u.fireRate||0)*.04);try{return f1ShootUpgradeBase(x,y)}finally{w.cooldown=old}};

function f1DrawWeaponRewardFx(t){if(!state||!v270WeaponPose)return;const p=v270WeaponPose,kind=(state.bossDrone>0&&(state.f1WeaponEffect==='eliteDrone'||state.f1WeaponEffect==='bossGpp'))?state.f1WeaponEffect:(performance.now()<state.f1WeaponEffectUntil?state.f1WeaponEffect:null);if(!kind&&!state.f1AnnihilatorFx)return;const meta=kind?F1_BOSS_REWARD_META[kind]:F1_BOSS_REWARD_META.annihilator;ctx.save();ctx.translate(p.pivotX,p.pivotY);ctx.rotate(p.tilt);ctx.scale(p.pulse,p.pulse);ctx.globalCompositeOperation='screen';const cx=p.imgX+p.drawW*.50,cy=p.imgY+p.drawH*.49,r=Math.max(18,p.drawW*.10),pulse=.5+.5*Math.sin(t*.008);ctx.globalAlpha=kind==='bossGpp'?.34:.26;ctx.strokeStyle=meta.color;ctx.lineWidth=Math.max(1.5,p.drawW*.004);ctx.shadowColor=meta.color;ctx.shadowBlur=16;for(let i=0;i<3;i++){ctx.beginPath();ctx.ellipse(cx,cy,r*(1+i*.34)+pulse*5,r*(.55+i*.18),t*.0008*(i%2?1:-1)+i,0,Math.PI*2);ctx.stroke()}for(let i=0;i<7;i++){const a=t*.0018+i*.9,rr=r*(.75+(i%3)*.25);ctx.fillStyle=i%2?'#fff':meta.color;ctx.beginPath();ctx.arc(cx+Math.cos(a)*rr,cy+Math.sin(a*1.3)*rr*.55,1.2+(i%3)*.6,0,Math.PI*2);ctx.fill()}ctx.shadowBlur=0;ctx.restore();
  if(state.f1AnnihilatorFx>0){const v=gameplayViewport(),cx2=playerScreenX(),cy2=innerHeight*.70,rr=Math.max(v.width*.50,innerHeight*.42)*(1-state.f1AnnihilatorFx*.25);ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=state.f1AnnihilatorFx*.34;ctx.strokeStyle='#ffb45e';ctx.lineWidth=8*(state.f1AnnihilatorFx+.2);ctx.shadowColor='#ff785b';ctx.shadowBlur=26;ctx.beginPath();ctx.arc(cx2,cy2,rr,0,Math.PI*2);ctx.stroke();ctx.restore();}}
const f1DrawWeaponBase=drawWeapon;drawWeapon=function(t){f1DrawWeaponBase(t);f1DrawWeaponRewardFx(t)};

// Elite Drone tracer has a distinct gold-violet plasma language.
const f1DrawTracersBase=drawTracers;
drawTracers=function(){f1DrawTracersBase();if(!state)return;for(const tr of state.tracers){if(tr.kind!=='eliteDrone')continue;const p=clamp(tr.t/tr.travel,0,1),head=d1Point(tr,p),tail=d1Point(tr,Math.max(0,p-.32)),fade=clamp(tr.life/tr.max,0,1);ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=fade;ctx.lineCap='round';d1Line(tail,head,'rgba(198,118,255,.30)',11,1,22);d1Line(tail,head,'#ffd86b',4.1,1,12);d1Line(tail,head,'#ffffff',1.2,1,5);for(let i=0;i<5;i++){const u=i/4,q=d1Point({x1:tail.x,y1:tail.y,x2:head.x,y2:head.y},u),a=tr.seed+i*1.8+performance.now()*.012;ctx.fillStyle=i%2?'#d49aff':'#fff1a1';ctx.beginPath();ctx.arc(q.x+Math.cos(a)*5,q.y+Math.sin(a)*5,1.3+i*.18,0,Math.PI*2);ctx.fill()}ctx.restore()}};

function f1RenderUpgradePanel(){const pts=f1UpgradePoints(),u=f1UpgradeState(),p=$('#upgradePoints'),grid=$('#upgradeGrid');if(p)p.textContent=`ĐIỂM NÂNG CẤP: ${pts}`;if(!grid)return;grid.innerHTML=Object.entries(F1_UPGRADES).map(([k,m])=>`<button class="f1-upgrade-card" data-upgrade="${k}" ${pts<=0||u[k]>=m.max?'disabled':''}><span>${m.icon}</span><span><b>${m.name}</b><small>${m.desc}</small></span><em>${u[k]}/${m.max}</em></button>`).join('');grid.querySelectorAll('[data-upgrade]').forEach(b=>b.onclick=()=>{const key=b.dataset.upgrade,cur=f1UpgradeState(),points=f1UpgradePoints();if(points<=0||cur[key]>=F1_UPGRADES[key].max)return;cur[key]++;f1SaveJson(F1_UPGRADE_STORE,cur);f1SetUpgradePoints(points-1);tone(720,.12,'triangle',.018,260,0,.10);f1RenderUpgradePanel()})}
function f1OpenUpgrade(){f1RenderUpgradePanel();show($('#upgradePanel'))}
for(const id of ['upgradeBtn','victoryUpgradeBtn']){const b=document.getElementById(id);if(b)b.onclick=f1OpenUpgrade}

async function f1InstallGame(){ensureAudio();if(deferredInstall){deferredInstall.prompt();try{await deferredInstall.userChoice}catch{}deferredInstall=null;hide($('#installBtn'));return}const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent);toast(isIOS?'📲 Safari: Chia sẻ → Thêm vào Màn hình chính':'📲 Nếu đã cài, hãy mở game từ biểu tượng ngoài màn hình',2.2)}
const mainInstall=$('#installBtn');if(mainInstall)mainInstall.onclick=f1InstallGame;for(const id of ['stageInstallBtn','victoryInstallBtn']){const b=document.getElementById(id);if(b)b.onclick=f1InstallGame}

// Result panel wording stays familiar after the separate Boss reward moment.
const f1StageCompleteBase=stageCompletePanel;
stageCompletePanel=function(){f1StageCompleteBase();a1RenderStageMenu();const next=$('#nextStageBtn');if(next&&!state.cfg.final)next.textContent='TIẾN VÀO KHU TIẾP THEO ›';};


/* === v3.3.0 G1 FINAL · 180s campaign · diverse bacteria AI · anti-stall · mysterious Boss aura · correct PWA install/update === */
const G1_BOSS_TIME=180;
const G1_VERSION='3.3.0';

// Slower, readable global speed curve. Difficulty comes from behavior/mix as well as speed.
D1_SPEED_TARGETS.easy=[.28,.31,.34,.37,.40,.43,.46,.49];
D1_SPEED_TARGETS.normal=[.40,.43,.46,.49,.52,.55,.59,.63];
D1_SPEED_TARGETS.hard=[.50,.53,.56,.59,.62,.66,.69,.73];

d1Pressure=function(elapsed=state?.stageElapsed||0){
  const t=clamp(elapsed/G1_BOSS_TIME,0,1);
  // 0–60s gentle, 61–120s medium, 121–180s highest pressure.
  if(t<1/3)return .62+.12*d1Smooth(t*3);
  if(t<2/3)return .74+.13*d1Smooth((t-1/3)*3);
  return .87+.13*d1Smooth((t-2/3)*3);
};
d1SpeedTarget=function(diff=state?.difficulty||'normal',stage=state?.stageIndex||0){return (D1_SPEED_TARGETS[diff]||D1_SPEED_TARGETS.normal)[clamp(stage,0,7)];};
d1Countdown=function(){return Math.max(0,G1_BOSS_TIME-(state?.stageElapsed||0));};
d1SpawnInterval=function(){
  const t=clamp(state.stageElapsed/G1_BOSS_TIME,0,1),d=state.difficulty,s=state.stageIndex;
  const base=d==='easy'?2.05:d==='hard'?1.56:1.78;
  const pressure=t<1/3?0.08*d1Smooth(t*3):t<2/3?.23+.15*d1Smooth((t-1/3)*3):.40+.20*d1Smooth((t-2/3)*3);
  return Math.max(d==='easy'?1.02:d==='hard'?.72:.84,base-s*.028-pressure)*(.88+Math.random()*.28);
};
d1ActiveCap=function(){const d=state.difficulty,s=state.stageIndex,t=state.stageElapsed;return (d==='easy'?4:d==='hard'?6:5)+Math.floor(s/3)+(t>120?1:0);};

// G1 bacteria family inspired by the user's reference silhouettes, rebuilt procedurally for the game.
Object.assign(ENEMY,{
  crawler:{hp:6.8,speed:.052,rad:39,color:'#62b86c',score:350,attack:1.15,g1Motion:'crawler',g1Morph:'heavy'},
  sprinter:{hp:1.7,speed:.132,rad:19,color:'#ff8a53',score:210,attack:.72,g1Motion:'sprinter',g1Morph:'rod'},
  zigzag:{hp:2.8,speed:.086,rad:25,color:'#48c9bd',score:240,attack:.85,g1Motion:'zigzag',g1Morph:'flagella'},
  sweeper:{hp:3.5,speed:.073,rad:27,color:'#6b9ee8',score:270,attack:.92,g1Motion:'sweeper',g1Morph:'wing'},
  ambusher:{hp:3.8,speed:.092,rad:28,color:'#e46ca3',score:300,attack:1.0,g1Motion:'ambusher',g1Morph:'spike'},
  dodger:{hp:3.1,speed:.080,rad:25,color:'#9e78df',score:320,attack:.92,g1Motion:'dodger',g1Morph:'eye'},
  arc:{hp:4.0,speed:.070,rad:29,color:'#e0bd55',score:330,attack:1.0,g1Motion:'arc',g1Morph:'chain'},
  support:{hp:3.6,speed:.058,rad:26,color:'#61dbc8',score:380,attack:.75,g1Motion:'support',g1Morph:'support',support:true},
  feint:{hp:3.4,speed:.082,rad:25,color:'#dc73d3',score:360,attack:.9,g1Motion:'feint',g1Morph:'ghost'}
});

// Each stage introduces more behaviors rather than simply making every enemy faster.
const G1_STAGE_MIXES=[
  ['basic','flagella','crawler','zigzag'],
  ['basic','crawler','sprinter','zigzag','cluster'],
  ['breather','zigzag','sweeper','spore','flyer'],
  ['wall','crawler','ambusher','zigzag','cluster','sprinter'],
  ['shield','nucleus','dodger','arc','support','breather'],
  ['nucleus','elite','sweeper','dodger','feint','charger','support'],
  ['spore','shield','spitter','zigzag','arc','support','feint','dodger'],
  ['elite','nucleus','cluster','charger','flyer','sprinter','zigzag','sweeper','ambusher','dodger','arc','support','feint']
];
for(let i=0;i<Math.min(STAGES.length,G1_STAGE_MIXES.length);i++)STAGES[i].mix=G1_STAGE_MIXES[i].slice();

const g1NewStateBase=newState;
newState=function(stageIndex=0){
  const s=g1NewStateBase(stageIndex),baseTarget=(D1_EXPECTED_KILLS[s.difficulty]||D1_EXPECTED_KILLS.normal)[s.stageIndex]||36;
  s.d1BossAt=G1_BOSS_TIME;s._minorCleanTarget=baseTarget*3;s.g1LastValidSpawnAt=0;s.g1StallWatch=0;s.g1SpawnRepairs=0;
  // The old "campaign upgrade" was a misunderstanding. Do not apply stored gameplay stat upgrades.
  s.f1Upgrades={damage:0,fireRate:0,survival:0,drone:0,supply:0};s.maxHealth=10;s.health=Math.min(10,s.health);
  s.rewardNpcTimer=s.difficulty==='easy'?4.2:4.9;
  return s;
};

// Fully D1-compatible mini spawn; fixes the old cluster NaN/stall bug in stages 2/4/8.
spawnMini=function(px,py){
  if(!state)return null;const base=ENEMY.spore,x=clamp(.32+Math.random()*.36,.08,.92);
  const e={id:Math.random(),type:'spore',boss:false,name:null,x,baseX:x,depth:.46+Math.random()*.09,hp:1.1,maxHp:1.1,
    speedBase:base.speed*(.82+Math.random()*.16),speed:base.speed*d1SpeedTarget()*.72,rad:14,color:base.color,phase:Math.random()*6.28,wobble:1.8,
    attackTimer:999,summon:999,flash:0,dead:false,side:x<.5?-1:1,base,lastBossPhase:1,guard:0,orbit:Math.random()*6.28,bossSummoned:false,countsForClean:false,d1SummonDone:[false,false,false],g1Motion:'mini'};
  state.enemies.push(e);return e;
};

const g1SpawnEnemyD1Base=spawnEnemy;
spawnEnemy=function(type,boss=false){
  const e=g1SpawnEnemyD1Base(type,boss);if(!e)return e;
  if(boss){toast('⚠ GIÂY 180 · BOSS XUẤT HIỆN!',2);e.g1DarkIntro=2.2;return e;}
  e.g1Motion=e.base?.g1Motion||type;e.g1Lane=e.baseX;e.g1TargetX=e.baseX;e.g1Decision=.55+Math.random()*1.3;e.g1Pause=Math.random()*.5;e.g1Burst=0;e.g1GhostX=e.baseX;
  return e;
};

// Ensure newly summoned Boss minions are valid and visible even if a future archetype is malformed.
function g1RepairEnemy(e){
  if(!e||e.boss)return true;let repaired=false;
  if(!Number.isFinite(e.depth)){e.depth=.92+Math.random()*.05;repaired=true;}
  if(!Number.isFinite(e.baseX)){e.baseX=.18+Math.random()*.64;repaired=true;}
  if(!Number.isFinite(e.x)){e.x=e.baseX;repaired=true;}
  if(!Number.isFinite(e.speedBase)||e.speedBase<=0){e.speedBase=(e.base?.speed||ENEMY.basic.speed)*(.88+Math.random()*.18);repaired=true;}
  if(!e.base)e.base=ENEMY[e.type]||ENEMY.basic;
  if(repaired&&state)state.g1SpawnRepairs=(state.g1SpawnRepairs||0)+1;return true;
}
function g1Behavior(e,dt,speedFactor,slow){
  g1RepairEnemy(e);e.phase+=dt*(1.22+(e.base.pulse||0)*.58);e.flash=Math.max(0,e.flash-dt*6);
  const prog=clamp(1-e.depth,0,1),m=e.g1Motion||e.base?.g1Motion||e.type;
  let lateral=0,motion=1;
  if(m==='crawler'){lateral=Math.sin(e.phase*.55)*.008;motion=.73;}
  else if(m==='sprinter'){lateral=Math.sin(e.phase*1.8)*.018;motion=1.06+(prog>.48?.14:0);}
  else if(m==='zigzag'){lateral=Math.sin(e.phase*2.65)*(.038+.028*prog);motion=.91;}
  else if(m==='sweeper'){lateral=Math.sin(e.phase*.88)*(.10+.06*prog);motion=.82;}
  else if(m==='ambusher'){const cyc=(e.phase*.52)%1;motion=cyc<.30?.18:cyc<.48?1.34:.78;lateral=Math.sin(e.phase*1.2)*.025;}
  else if(m==='dodger'){
    e.g1Decision=(e.g1Decision||0)-dt;if(e.g1Decision<=0){e.g1Decision=.45+Math.random()*.65;const aim=(pointer.x-gameplayViewport().left)/Math.max(1,gameplayViewport().width);const dx=e.baseX-aim;e.g1TargetX=clamp(e.baseX+(Math.abs(dx)<.18?(dx<=0?-.15:.15):(Math.random()-.5)*.08),.10,.90);}
    e.baseX+=(e.g1TargetX-e.baseX)*Math.min(1,dt*3.8);lateral=Math.sin(e.phase*1.7)*.012;motion=.86;
  }else if(m==='arc'){const side=e.side||1;lateral=side*Math.sin(Math.min(Math.PI,prog*Math.PI))*.13+Math.sin(e.phase*.6)*.012;motion=.80;}
  else if(m==='support'){lateral=Math.sin(e.phase*.75)*.035;motion=.70;}
  else if(m==='feint'){
    e.g1Decision=(e.g1Decision||0)-dt;if(e.g1Decision<=0){e.g1Decision=.75+Math.random()*1.05;e.g1GhostX=e.baseX;e.g1TargetX=clamp(e.baseX+(Math.random()<.5?-1:1)*(.10+Math.random()*.08),.10,.90);}
    e.baseX+=(e.g1TargetX-e.baseX)*Math.min(1,dt*4.6);lateral=Math.sin(e.phase*2.0)*.018;motion=.84;
  }else{
    const swayFactor=e.type==='flagella'?1.5:e.type==='spitter'?1.8:e.base.sway||.7;lateral=swayFactor*Math.sin(e.phase*e.wobble)*.010;
    if(e.type==='breather')motion*=.78+.26*(.5+.5*Math.sin(e.phase*1.7));if(e.base.charge&&e.depth<.42)motion*=1.26;if(e.base.fly)motion*=1.02;
  }
  // Support bacteria lightly accelerate nearby allies; killing them becomes a tactical priority.
  if(m!=='support'&&state.enemies.some(o=>!o.dead&&!o.boss&&o.base?.support&&Math.abs(o.x-e.x)<.20&&Math.abs(o.depth-e.depth)<.18))motion*=1.10;
  if(e.bossSummoned)motion*=.92;
  const perspective=.65+Math.pow(prog,1.05)*.48;e.x=clamp(e.baseX+lateral,.035,.965);e.depth-=e.speedBase*speedFactor*dt*motion*perspective*slow;
}

// Final G1 update combines F1 post-boss flow with 180s survival, anti-stall and varied NPC AI.
update=function(dt){
  if(!state||state.mode!=='playing')return;const d=DIFF[state.difficulty];
  if(state.transition>0){
    state.transition+=dt;const cleanP=clamp(state.transition/F1_CLEAN_SECONDS,0,1);state.environmentClean=50+50*d1Smooth(cleanP);state.contamination=100-state.environmentClean;state.zoom=Math.min(1,state.transition/F1_CLEAN_SECONDS);state.cleanSparkle=state.transition>F1_CLEAN_SECONDS?clamp((state.transition-F1_CLEAN_SECONDS)/F1_SPARKLE_SECONDS,0,1):0;
    const mark=Math.floor(cleanP*5);if(mark>state.f1CleanChimeMark&&mark<=5){state.f1CleanChimeMark=mark;tone(420+mark*105,.11,'sine',.010+mark*.002,90,0,.08)}
    if(state.transition>=F1_CLEAN_SECONDS&&!state.f1SparkleChime){state.f1SparkleChime=true;tone(880,.16,'sine',.020,220,0,.12);setTimeout(()=>tone(1180,.17,'triangle',.018,250,0,.12),100);setTimeout(()=>tone(1460,.20,'sine',.014,120,0,.10),210)}
    if(state.transition>=F1_CLEAN_SECONDS+F1_SPARKLE_SECONDS&&!state.nextPanel){state.nextPanel=true;state.environmentClean=100;state.contamination=0;state.cleanSparkle=1;f1ShowBossRewards()}updateHUD();return;
  }
  state.stageElapsed+=dt;if(state.stageIntro>0)state.stageIntro=Math.max(0,state.stageIntro-dt);state.zoom=Math.min(.10,state.stageElapsed*.00072);
  if(state.shake>0)state.shake=Math.max(0,state.shake-dt);if(state.bossIntro>0)state.bossIntro=Math.max(0,state.bossIntro-dt);state.dashCooldown=Math.max(0,state.dashCooldown-dt);state.dashTimer=Math.max(0,state.dashTimer-dt);state.dodgeTilt*=Math.pow(.001,dt);state.recoil=Math.max(0,state.recoil-dt*7.5);state.muzzleFlash=Math.max(0,state.muzzleFlash-dt*10);state.dodgeMessage=Math.max(0,state.dodgeMessage-dt);
  const axis=movementAxis();if(Math.abs(axis)>.03)state.lastMoveDir=axis<0?-1:1;const speedBoost=state.adrenaline>0?1.24:1;if(state.dashTimer>0)state.playerVX=state.dashDir*2.42*speedBoost;else{const accel=6.3*speedBoost,maxSpeed=1.05*speedBoost,friction=8.0;if(Math.abs(axis)>.03)state.playerVX+=axis*accel*dt;else state.playerVX*=Math.max(0,1-friction*dt);state.playerVX=clamp(state.playerVX,-maxSpeed,maxSpeed);}state.playerX=clamp(state.playerX+state.playerVX*dt,-1,1);if(Math.abs(state.playerX)>=1&&Math.sign(state.playerVX)===Math.sign(state.playerX))state.playerVX=0;
  if(state.toastTimer>0){state.toastTimer-=dt;if(state.toastTimer<=0)hide(UI.toast)}if(state.comboTimer>0){state.comboTimer-=dt;if(state.comboTimer<=0){state.combo=0;setCombo()}}for(const f of ['shield','drone','adrenaline','vaccine','sterile','gppBoost'])if(state[f]>0)state[f]=Math.max(0,state[f]-dt);state.beam=Math.min(100,state.beam+18*dt);

  if(!state.bossSpawned&&state.rewardNpcCount<state.rewardNpcMax){state.rewardNpcTimer-=dt;if(state.rewardNpcTimer<=0&&!state.rewardNpcs.some(n=>!n.dead)){spawnRewardNpc();state.rewardNpcTimer=(d.rewardEvery||9)*(.88+Math.random()*.28);}}
  if(!state.bossSpawned&&state.stageElapsed<G1_BOSS_TIME){
    const active=state.enemies.filter(e=>!e.dead&&!e.boss).length;state.spawnTimer-=dt;
    // Anti-stall: never leave the player with an empty stage because a child NPC became invalid.
    if(active===0&&state.spawnTimer>.75)state.spawnTimer=Math.min(state.spawnTimer,.32);
    if(state.spawnTimer<=0&&active<d1ActiveCap()){const typ=state.cfg.mix[(Math.random()*state.cfg.mix.length)|0],e=spawnEnemy(typ,false);if(e)e.countsForClean=true;state.d1NaturalSpawns++;state.spawnTimer=d1SpawnInterval();}
  }
  if(!state.bossSpawned&&state.stageElapsed>=G1_BOSS_TIME-.001){state.environmentClean=50;state.contamination=50;state.bossSpawned=true;state.spawnLeft=0;spawnEnemy(state.cfg.mix[0],true);}

  const speedFactor=d1SpeedTarget()*d1Pressure(),slow=state.sterile>0?.58:1;
  for(const e of state.enemies){
    if(e.dead)continue;if(e.boss){updateBoss(e,dt,d);continue;}g1Behavior(e,dt,speedFactor,slow);
    if(e.depth<=.055){const sc=enemyScreen(e),hitRadius=Math.max(36,Math.min(78,sc.r*.68+innerWidth*.016));if(Math.abs(playerScreenX()-sc.x)<hitRadius)damagePlayer(e.base.attack*d.damage);else{state.score+=35;sfx.dodgeSuccess();toast('↔ NÉ ĐƯỢC VI KHUẨN!',.48);}e.dead=true;burstAt(sc.x,sc.y,e.color,7);}
  }
  state.enemies=state.enemies.filter(e=>!e.dead);
  for(const sh of state.enemyShots){sh.t+=dt;sh.x+=sh.vx*dt;sh.y+=sh.vy*dt;sh.r+=16*dt;if(sh.t>=sh.life){const hitRadius=Math.max(40,Math.min(76,innerWidth*.048));if(Math.abs(playerScreenX()-playerScreenX(sh.targetPlayerX))<hitRadius)damagePlayer(sh.damage*d.damage);else{state.score+=20;sfx.dodgeSuccess();toast('↔ NÉ ĐÒN BOSS!',.48);}sh.dead=true;}}state.enemyShots=state.enemyShots.filter(s=>!s.dead);
  for(const n of state.rewardNpcs){if(n.dead)continue;n.t+=dt;n.life-=dt;n.x+=n.vx*dt;if(n.life<=0||n.x<-.10||n.x>1.10)n.dead=true;}state.rewardNpcs=state.rewardNpcs.filter(n=>!n.dead);
  for(const p of state.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=12*dt;p.a=Math.max(0,p.life/p.max);}state.particles=state.particles.filter(p=>p.life>0);
  for(const tr of state.tracers){tr.t+=dt;tr.life-=dt;}state.tracers=state.tracers.filter(tr=>tr.life>0);for(const hm of state.hitMarkers)hm.life-=dt;state.hitMarkers=state.hitMarkers.filter(hm=>hm.life>0);
  for(const p of state.powerups){p.t+=dt;p.y+=Math.sin(p.t*3)*.12;p.life-=dt;if(p.life<=0)p.dead=true;}state.powerups=state.powerups.filter(p=>!p.dead);
  if(state.drone>0&&state.enemies.length){state._droneTimer=(state._droneTimer||0)-dt;if(state._droneTimer<=0){state._droneTimer=.40;let target=state.enemies.filter(e=>!e.dead&&!e.boss).sort((a,b)=>a.depth-b.depth)[0]||state.enemies.find(e=>!e.dead&&e.boss);if(target){const s=enemyScreen(target),dx=Math.max(34,Math.min(innerWidth-34,playerScreenX()-innerWidth*.10)),dy=innerHeight*.66;state.tracers.push({x1:dx,y1:dy,x2:s.x,y2:s.y,t:0,life:.18,max:.18,travel:.10,color:'#70fff0',width:3.2,kind:'drone',seed:Math.random()*99});hitEnemy(target,.72,false,true);}}}
  if(state.bossDrone>0){state.bossDrone=Math.max(0,state.bossDrone-dt);state._bossDroneTimer=(state._bossDroneTimer||0)-dt;if(state._bossDroneTimer<=0){state._bossDroneTimer=.22;const target=state.enemies.filter(e=>!e.dead&&!e.boss).sort((a,b)=>a.depth-b.depth)[0]||state.enemies.find(e=>!e.dead&&e.boss);if(target){const sc=enemyScreen(target),p=v270WeaponPose?.monitorCenter||{x:playerScreenX(),y:innerHeight*.66};state.tracers.push({x1:p.x-22,y1:p.y-52,x2:sc.x,y2:sc.y,t:0,life:.24,max:.24,travel:.13,width:5.2,kind:'eliteDrone',seed:Math.random()*99});hitEnemy(target,1.25,false,true,false)}}}
  if(state.f1AnnihilatorFx>0)state.f1AnnihilatorFx=Math.max(0,state.f1AnnihilatorFx-dt*1.8);

  // G1 cleansing: the old kill quota is tripled and time gates prevent reaching 50% too early.
  if(!state.bossSpawned){const t=clamp(state.stageElapsed/G1_BOSS_TIME,0,1),killRatio=clamp((state.cleanMinorKills||0)/Math.max(1,state._minorCleanTarget),0,1),timePart=36*t,killPart=Math.min(13.5*t,49.5*killRatio);state.environmentClean=clamp(timePart+killPart,0,49.5);state.contamination=100-state.environmentClean;}
  if(state.bossSpawned&&!state.bossDefeated&&!state.enemies.some(e=>e.boss)){state.bossDefeated=true;beginStageClear();}
  if(pointer.down&&performance.now()-weaponPressStarted>120)shoot(pointer.x,pointer.y);updateHUD();
};

// Rank now measures Boss speed after a mandatory three-minute survival phase.
rankFor=function(acc,hp,time){const bossTime=Math.max(0,time-G1_BOSS_TIME),v=acc*.52+hp*3.7+(bossTime<24?14:bossTime<40?9:bossTime<60?5:2);return v>=84?'S+':v>=72?'S':v>=57?'A':'B';};

// More recognizable silhouettes/particles for G1 bacteria archetypes.
const g1DrawEnemyBase=drawEnemy;
drawEnemy=function(e,t){
  if(!e?.boss){const s=enemyScreen(e),r=s.r,m=e.g1Motion||e.base?.g1Motion;ctx.save();ctx.translate(s.x,s.y);ctx.globalCompositeOperation='screen';
    if(m==='sprinter'){ctx.globalAlpha=.18;ctx.strokeStyle=e.color;ctx.lineWidth=Math.max(2,r*.14);for(let i=1;i<=3;i++){ctx.beginPath();ctx.moveTo(0,r*.2);ctx.lineTo((e.side||1)*-r*(.55+i*.28),r*(.15+i*.06));ctx.stroke();}}
    if(m==='support'){ctx.globalAlpha=.18+.05*Math.sin(t*.006);ctx.strokeStyle='#9affdf';ctx.lineWidth=2;ctx.shadowColor='#75ffe3';ctx.shadowBlur=16;ctx.beginPath();ctx.arc(0,0,r*1.55,0,Math.PI*2);ctx.stroke();for(let i=0;i<4;i++){const a=t*.0014+i*Math.PI/2;ctx.fillStyle='#dcfff7';ctx.fillRect(Math.cos(a)*r*1.35-2,Math.sin(a)*r*.9-7,4,14);ctx.fillRect(Math.cos(a)*r*1.35-7,Math.sin(a)*r*.9-2,14,4);}}
    if(m==='feint'){ctx.globalAlpha=.09;ctx.fillStyle=e.color;ctx.beginPath();ctx.arc((e.g1GhostX-e.x)*innerWidth*.10,0,r*.88,0,Math.PI*2);ctx.fill();}
    if(m==='arc'){ctx.globalAlpha=.18;ctx.strokeStyle='#fff0a2';ctx.lineWidth=1.5;ctx.setLineDash([3,5]);ctx.beginPath();ctx.arc(0,0,r*1.32,t*.001,t*.001+Math.PI*1.55);ctx.stroke();ctx.setLineDash([]);}
    ctx.restore();}
  g1DrawEnemyBase(e,t);
};

// Mysterious local darkness around Boss + toxic drifting haze, without darkening the whole hospital.
function g1BossDarkAura(e,t,front=false){if(!e?.boss||e.dead)return;const s=enemyScreen(e),r=s.r;ctx.save();ctx.translate(s.x,s.y);
  if(!front){ctx.globalCompositeOperation='multiply';const g=ctx.createRadialGradient(0,0,r*.48,0,0,r*2.65);g.addColorStop(0,'rgba(17,8,27,.06)');g.addColorStop(.42,'rgba(12,10,27,.28)');g.addColorStop(.78,'rgba(12,19,28,.18)');g.addColorStop(1,'rgba(10,22,27,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r*2.7,0,Math.PI*2);ctx.fill();}
  else{ctx.globalCompositeOperation='screen';for(let i=0;i<6;i++){const a=t*.00035+i*1.04,rr=r*(1.05+(i%3)*.30),x=Math.cos(a+i)*rr,y=-r*.25+Math.sin(a*.8+i)*r*.82;ctx.globalAlpha=.07+.02*Math.sin(a*3+i);ctx.fillStyle=i%2?'#7f69a7':'#748b53';ctx.beginPath();ctx.arc(x,y,r*(.06+(i%2)*.02),0,Math.PI*2);ctx.fill();}}
  ctx.restore();}
const g1DrawBossBase=drawBoss;drawBoss=function(e,t){g1BossDarkAura(e,t,false);g1DrawBossBase(e,t);g1BossDarkAura(e,t,true);};

// Rich circular/expanding color feedback on the weapon for ALL active items, not just Boss rewards.
const G1_ITEM_FX={
  shield:{color:'#63d8ff',color2:'#bff7ff'},drone:{color:'#5ff5e6',color2:'#a47dff'},adrenaline:{color:'#ff8d45',color2:'#ffdf75'},vaccine:{color:'#b787ff',color2:'#6de7ff'},sterile:{color:'#74efd2',color2:'#e8fff8'},gppBoost:{color:'#ffe16f',color2:'#9b7dff'},
  eliteDrone:{color:'#c18cff',color2:'#ffe16f'},annihilator:{color:'#ff8958',color2:'#ffe59b'},bossGpp:{color:'#ffe16f',color2:'#73f5ff'}
};
function g1ActiveFxKind(){if(!state)return null;if(performance.now()<(state.f1WeaponEffectUntil||0)&&state.f1WeaponEffect)return state.f1WeaponEffect;if(state.gppBoost>0)return'gppBoost';if(state.vaccine>0)return'vaccine';if(state.adrenaline>0)return'adrenaline';if(state.shield>0)return'shield';if(state.drone>0)return'drone';if(state.sterile>0)return'sterile';return null;}
function g1DrawWeaponItemFx(t){if(!state||!v270WeaponPose)return;const kind=g1ActiveFxKind();if(!kind)return;const fx=G1_ITEM_FX[kind]||G1_ITEM_FX.gppBoost,p=v270WeaponPose,c=p.monitorCenter,r=Math.max(22,p.drawW*.085),pulse=.5+.5*Math.sin(t*.009);ctx.save();ctx.globalCompositeOperation='screen';
  const glow=ctx.createRadialGradient(c.x,c.y,2,c.x,c.y,r*2.2);glow.addColorStop(0,'rgba(255,255,255,.24)');glow.addColorStop(.30,fx.color+'44');glow.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(c.x,c.y,r*2.2,0,Math.PI*2);ctx.fill();
  for(let i=0;i<4;i++){const expand=((t*.0007+i*.24)%1),rr=r*(.75+expand*1.55);ctx.globalAlpha=(1-expand)*.30;ctx.strokeStyle=i%2?fx.color2:fx.color;ctx.lineWidth=Math.max(1.2,p.drawW*.0025);ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=14;ctx.beginPath();ctx.ellipse(c.x,c.y,rr,rr*(.48+.08*Math.sin(t*.004+i)),t*.00055*(i%2?-1:1)+i*.4,0,Math.PI*2);ctx.stroke();}
  ctx.globalAlpha=.55;for(let i=0;i<10;i++){const a=t*.0018+i*.63,rr=r*(1.0+(i%3)*.28);ctx.fillStyle=i%2?fx.color2:fx.color;ctx.beginPath();ctx.arc(c.x+Math.cos(a*(i%2?1:-1))*rr,c.y+Math.sin(a*1.18+i)*rr*.54,1.1+(i%3)*.55,0,Math.PI*2);ctx.fill();}
  ctx.restore();}
const g1DrawWeaponBase=drawWeapon;drawWeapon=function(t){g1DrawWeaponBase(t);g1DrawWeaponItemFx(t);};

// Correct semantics: INSTALL = PWA/shortcut. UPDATE = new deployed version/service worker only.
const G1_INSTALL_IDS=['installBtn','stageInstallBtn','victoryInstallBtn'];
const G1_UPDATE_IDS=['updateBtn','upgradeBtn','victoryUpgradeBtn'];
let g1SwReg=null,g1WaitingWorker=null,g1Reloading=false;
function g1Standalone(){return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;}
function g1SetVisible(ids,visible){for(const id of ids){const el=document.getElementById(id);if(el)el.classList.toggle('hidden',!visible);}}
function g1RefreshInstallUI(){const ios=/iPad|iPhone|iPod/.test(navigator.userAgent),eligible=!g1Standalone()&&(!!deferredInstall||ios);g1SetVisible(G1_INSTALL_IDS,eligible);}
function g1RefreshUpdateUI(){g1SetVisible(G1_UPDATE_IDS,!!g1WaitingWorker);}
async function g1InstallGame(){ensureAudio();if(g1Standalone()){g1RefreshInstallUI();return}if(deferredInstall){const p=deferredInstall;deferredInstall=null;await p.prompt();try{await p.userChoice}catch{}g1RefreshInstallUI();return}if(/iPad|iPhone|iPod/.test(navigator.userAgent))toast('📲 Safari: Chia sẻ → Thêm vào Màn hình chính',2.4);}
for(const id of G1_INSTALL_IDS){const b=document.getElementById(id);if(b)b.onclick=g1InstallGame;}
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;g1RefreshInstallUI();});addEventListener('appinstalled',()=>{deferredInstall=null;g1RefreshInstallUI();});
async function g1ApplyUpdate(){if(!g1WaitingWorker){g1RefreshUpdateUI();return}g1Reloading=true;g1WaitingWorker.postMessage({type:'SKIP_WAITING'});}
for(const id of G1_UPDATE_IDS){const b=document.getElementById(id);if(b)b.onclick=g1ApplyUpdate;}
if('serviceWorker'in navigator){addEventListener('load',async()=>{try{g1SwReg=await navigator.serviceWorker.register('./sw.js');const inspect=()=>{if(g1SwReg.waiting&&navigator.serviceWorker.controller){g1WaitingWorker=g1SwReg.waiting;g1RefreshUpdateUI();}};inspect();g1SwReg.addEventListener('updatefound',()=>{const w=g1SwReg.installing;if(w)w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller){g1WaitingWorker=w;g1RefreshUpdateUI();}})});navigator.serviceWorker.addEventListener('controllerchange',()=>{if(g1Reloading)location.reload();});setTimeout(()=>g1SwReg.update().catch(()=>{}),1500);}catch{}});}
g1RefreshInstallUI();g1RefreshUpdateUI();

// Boss reward claim no longer awards gameplay-upgrade points; rewards remain Q/W/E/R inventory only.
f1ClaimBossRewards=function(){if(!state||!state.bossRewardPending)return;const inv=f1Inventory();for(const k of state.bossRewardPending)inv[k]=(inv[k]||0)+1;f1SaveInventory(inv);state.bossRewardPending=null;hide($('#bossRewardPanel'));stageCompletePanel();};
if(claimBossRewardBtn)claimBossRewardBtn.onclick=f1ClaimBossRewards;
const oldUpgradePanel=document.getElementById('upgradePanel');if(oldUpgradePanel){oldUpgradePanel.hidden=true;oldUpgradePanel.classList.add('hidden');}

// Final menu/HUD wording for G1.
const g1UpdateHUDBase=updateHUD;updateHUD=function(){g1UpdateHUDBase();if(!state)return;const t=state.bossSpawned?'BOSS':d1FormatClock(d1Countdown());if($('#rightTimeText'))$('#rightTimeText').textContent=t;if($('#timeTextMobile'))$('#timeTextMobile').textContent=t;};
for(const b of $$('.difficulty'))b.addEventListener('click',()=>{const box=$('#difficultyDetail'),key=b.dataset.difficulty;if(!box)return;const map={easy:['🛡 DỄ · LÀM QUEN','NPC chậm · từng loại hành vi được giới thiệu dần trong 3 phút'],normal:['⚠ TRUNG BÌNH · CÂN BẰNG','Tổ hợp nhiều kiểu vi khuẩn · áp lực tăng theo 3 chặng tới giây 180'],hard:['☣ KHÓ · THỬ THÁCH','AI phối hợp nhiều hành vi hơn nhưng tốc độ vẫn có giới hạn để xử lý']};box.innerHTML=`<b>${map[key][0]}</b><span>${map[key][1]}</span>`;});



// Production build: G1 final UI init.
f1UpdateRewardRail();g1RefreshInstallUI();g1RefreshUpdateUI();


/* === v3.3.0 G1 HARDENING · Boss endurance ×3 · tracer cleanup · left rewards · 20s elite Drone · branded item screens === */
const G2_VERSION='3.3.0';
const G2_BOSS_HP_MULT=3;
const G2_INSTALL_MARK='bstq-pwa-installed-v1';

// Boss is now a real endurance encounter. HP is tripled after all stage/difficulty scaling.
const g2SpawnEnemyBase=spawnEnemy;
spawnEnemy=function(type,boss=false){
  const e=g2SpawnEnemyBase(type,boss);
  if(boss&&e&&!e.g2BossScaled){e.hp*=G2_BOSS_HP_MULT;e.maxHp*=G2_BOSS_HP_MULT;e.g2BossScaled=true;}
  return e;
};

// Fast-Boss reward windows scale with the tougher encounter so two-item rewards remain achievable.
f1GenerateBossReward=function(){
  const duration=Math.max(0,Number(state.f1BossKillDuration)||((state.stageElapsed||0)-(state.d1BossStartedAt||G1_BOSS_TIME)));
  const fastLimit=state.difficulty==='easy'?90:state.difficulty==='hard'?66:78,count=duration<=fastLimit?2:1;
  const pool=['survival','survival','eliteDrone','eliteDrone','annihilator','annihilator','bossGpp'],out=[];
  for(let i=0;i<count;i++){let choices=pool.filter(k=>!out.includes(k));if(!choices.length)choices=pool;let k=choices[(Math.random()*choices.length)|0];if(k==='bossGpp'&&Math.random()>.42)k=choices[(Math.random()*choices.length)|0];out.push(k)}
  state.f1BossKillDuration=duration;return out;
};

// Brand is immutable: every GPP reward representation uses the supplied logo-gpp.png.
F1_BOSS_REWARD_META.eliteDrone.name='DRONE ĐẶC BIỆT 20s';
F1_BOSS_REWARD_META.eliteDrone.short='DRONE NGOÀI · HỎA LỰC 20s';
F1_BOSS_REWARD_META.bossGpp.name='LOGO TRƯỜNG GPP TỔNG HỢP';
f1RewardCard=function(kind){
  const m=F1_BOSS_REWARD_META[kind],brand=kind==='bossGpp';
  const visual=brand?`<span class="f1-boss-drop-icon logo-real"><img src="assets/logo-gpp.png" alt="Logo TRƯỜNG GPP"></span>`:`<span class="f1-boss-drop-icon">${m.icon}</span>`;
  return `<div class="f1-boss-drop" style="--reward-color:${m.color}"><div class="f1-boss-drop-core">${visual}</div><div class="f1-boss-drop-copy"><b>${m.name}</b><small>${m.short}</small></div></div>`;
};

function g2SetWeaponScreenFx(kind,ms=1300){if(!state)return;state.g2ScreenFx=kind;state.g2ScreenFxUntil=performance.now()+ms;}
const g2CollectPowerupsBase=collectPowerups;
collectPowerups=function(x,y){
  const target=state?.powerups?.find(p=>!p.dead&&Math.hypot(x-p.x,y-p.y)<48),kind=target?.kind;
  const ok=g2CollectPowerupsBase(x,y);
  if(ok&&kind)g2SetWeaponScreenFx(kind,kind==='heal'?1500:1900);
  return ok;
};

const g2UseRewardBase=f1UseReward;
f1UseReward=function(kind,fromCombo=false){
  const ok=g2UseRewardBase(kind,fromCombo);if(!ok)return false;
  if(kind==='eliteDrone'){
    state.bossDrone=Math.max(state.bossDrone||0,20);state.f1WeaponEffect='eliteDrone';state.f1WeaponEffectUntil=performance.now()+20000;g2SetWeaponScreenFx('eliteDrone',20000);toast('🛸 DRONE ĐẶC BIỆT NGOÀI · 20s',1.15);
  }else if(kind==='bossGpp'){
    state.bossDrone=Math.max(state.bossDrone||0,20);state.f1WeaponEffect='bossGpp';state.f1WeaponEffectUntil=performance.now()+20000;g2SetWeaponScreenFx('bossGpp',20000);
  }else g2SetWeaponScreenFx(kind,kind==='annihilator'?1500:1800);
  return true;
};

const G2_SCREEN_STYLE={
  heal:{a:'#68f29a',b:'#dffff0',name:'HỒI PHỤC'},shield:{a:'#59d9ff',b:'#d5f9ff',name:'KHIÊN'},drone:{a:'#58f0df',b:'#a48cff',name:'DRONE'},adrenaline:{a:'#ff8148',b:'#ffe26f',name:'ADRENALINE'},vaccine:{a:'#b883ff',b:'#69e8ff',name:'VACCINE'},sterile:{a:'#6ff1cf',b:'#effff9',name:'STERILE'},gpp:{a:'#ffe06c',b:'#62eaff',name:'GPP'},gppBoost:{a:'#ffe06c',b:'#9c79ff',name:'GPP'},survival:{a:'#68f29a',b:'#ffffff',name:'+5'},eliteDrone:{a:'#c17cff',b:'#ffe06c',name:'DRONE 20s'},annihilator:{a:'#ff714e',b:'#ffd873',name:'HỦY DIỆT'},bossGpp:{a:'#ffe06c',b:'#62eaff',name:'GPP'}
};
function g2ActiveScreenKind(){
  if(!state)return null;const now=performance.now();
  if(now<(state.g2ScreenFxUntil||0)&&state.g2ScreenFx)return state.g2ScreenFx;
  if(state.bossDrone>0&&(state.f1WeaponEffect==='eliteDrone'||state.f1WeaponEffect==='bossGpp'))return state.f1WeaponEffect;
  if(state.gppBoost>0)return'gppBoost';if(state.vaccine>0)return'vaccine';if(state.adrenaline>0)return'adrenaline';if(state.shield>0)return'shield';if(state.drone>0)return'drone';if(state.sterile>0)return'sterile';return null;
}
function g2DrawWeaponScreenFx(t){
  if(!state||!v270WeaponPose?.monitorCenter)return;const kind=g2ActiveScreenKind();if(!kind)return;const st=G2_SCREEN_STYLE[kind]||G2_SCREEN_STYLE.gppBoost,c=v270WeaponPose.monitorCenter,w=Math.max(34,v270WeaponPose.drawW*.115),h=Math.max(22,v270WeaponPose.drawH*.072),tt=t*.001;
  ctx.save();ctx.translate(c.x,c.y);ctx.globalCompositeOperation='screen';
  ctx.fillStyle='rgba(1,18,28,.74)';ctx.strokeStyle=st.a;ctx.lineWidth=1.2;ctx.shadowColor=st.a;ctx.shadowBlur=12;ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,Math.max(5,h*.24));ctx.fill();ctx.stroke();ctx.shadowBlur=0;
  const pulse=.5+.5*Math.sin(tt*6.2);for(let i=0;i<3;i++){const q=((tt*.42+i*.31)%1),rx=w*(.18+q*.37),ry=h*(.20+q*.26);ctx.globalAlpha=(1-q)*(.36+.12*pulse);ctx.strokeStyle=i%2?st.b:st.a;ctx.lineWidth=1.15;ctx.beginPath();ctx.ellipse(0,0,rx,ry,tt*(i%2?-.7:.8)+i*.7,0,Math.PI*2);ctx.stroke();}
  ctx.globalAlpha=.85;
  if(kind==='gpp'||kind==='gppBoost'||kind==='bossGpp'){
    if(logoIcon.complete){ctx.save();ctx.beginPath();ctx.roundRect(-h*.32,-h*.32,h*.64,h*.64,4);ctx.clip();ctx.fillStyle='#fff';ctx.fillRect(-h*.32,-h*.32,h*.64,h*.64);ctx.drawImage(logoIcon,-h*.32,-h*.32,h*.64,h*.64);ctx.restore();}
  }else if(kind==='heal'||kind==='survival'){
    ctx.strokeStyle=st.b;ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(-w*.23,0);ctx.lineTo(-w*.10,0);ctx.lineTo(-w*.045,-h*.20);ctx.lineTo(w*.03,h*.20);ctx.lineTo(w*.09,-h*.08);ctx.lineTo(w*.16,0);ctx.lineTo(w*.25,0);ctx.stroke();
  }else if(kind==='shield'){
    ctx.strokeStyle=st.b;ctx.lineWidth=1.6;ctx.beginPath();for(let i=0;i<6;i++){const a=-Math.PI/2+i*Math.PI/3,x=Math.cos(a)*h*.28,y=Math.sin(a)*h*.28;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.closePath();ctx.stroke();
  }else if(kind==='drone'||kind==='eliteDrone'){
    ctx.strokeStyle=st.b;ctx.lineWidth=1.5;for(let i=0;i<4;i++){const a=tt*2.2+i*Math.PI/2;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*h*.30,Math.sin(a)*h*.30);ctx.stroke();ctx.beginPath();ctx.arc(Math.cos(a)*h*.30,Math.sin(a)*h*.30,h*.065,0,Math.PI*2);ctx.fillStyle=st.a;ctx.fill();}
  }else if(kind==='adrenaline'){
    ctx.strokeStyle=st.b;ctx.lineWidth=1.7;for(let i=-1;i<=1;i++){const x=i*w*.12;ctx.beginPath();ctx.moveTo(x-h*.10,h*.15);ctx.lineTo(x+h*.04,0);ctx.lineTo(x-h*.10,-h*.15);ctx.stroke();}
  }else if(kind==='vaccine'){
    ctx.strokeStyle=st.b;ctx.lineWidth=1.3;for(let i=0;i<8;i++){const x=-w*.20+i*w*.055,y=Math.sin(tt*5+i*.9)*h*.18;ctx.beginPath();ctx.arc(x,y,1.2,0,Math.PI*2);ctx.fillStyle=i%2?st.a:st.b;ctx.fill();ctx.beginPath();ctx.arc(x,-y,1.2,0,Math.PI*2);ctx.fill();if(i<7){ctx.moveTo(x,y);ctx.lineTo(x,-y);ctx.stroke();}}
  }else if(kind==='sterile'){
    ctx.strokeStyle=st.b;ctx.lineWidth=1.2;for(let i=1;i<=3;i++){ctx.beginPath();ctx.arc(0,0,h*.08*i+Math.sin(tt*4+i)*1.5,0,Math.PI*2);ctx.stroke();}
  }else if(kind==='annihilator'){
    ctx.strokeStyle=st.b;ctx.lineWidth=1.7;for(let i=0;i<8;i++){const a=tt*2+i*Math.PI/4,r1=h*.12,r2=h*.31;ctx.beginPath();ctx.moveTo(Math.cos(a)*r1,Math.sin(a)*r1);ctx.lineTo(Math.cos(a)*r2,Math.sin(a)*r2);ctx.stroke();}
  }
  ctx.globalAlpha=.8;ctx.fillStyle=st.b;ctx.font=`900 ${Math.max(5,h*.18)}px system-ui`;ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(st.name,0,h*.47);ctx.restore();
}
const g2DrawWeaponBase=drawWeapon;drawWeapon=function(t){g2DrawWeaponBase(t);g2DrawWeaponScreenFx(t);};

// The elite Boss-reward Drone is visibly outside the weapon and flies a different figure-eight patrol.
function g2EliteDronePose(t=performance.now()){
  const v=gameplayViewport(),a=t*.00105,x=v.center+Math.sin(a)*v.width*.27,y=innerHeight*(.27+.055*Math.sin(a*2.0+1.1));return{x,y,bank:Math.cos(a)*.18,phase:a};
}
function g2DrawEliteDrone(t){if(!state||state.bossDrone<=0)return;const p=g2EliteDronePose(t),r=Math.max(12,Math.min(20,innerWidth*.012));ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.bank);ctx.globalCompositeOperation='screen';
  for(let i=4;i>=1;i--){ctx.globalAlpha=.05*i;ctx.fillStyle=i%2?'#bb7cff':'#ffe079';ctx.beginPath();ctx.ellipse(-Math.cos(p.phase)*i*7,Math.sin(p.phase*1.7)*i*2,r*(1+.08*i),r*.38,0,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;ctx.shadowColor='#bb7cff';ctx.shadowBlur=18;const g=ctx.createLinearGradient(-r,0,r,0);g.addColorStop(0,'#9b70ff');g.addColorStop(.48,'#eefcff');g.addColorStop(1,'#ffd968');ctx.fillStyle=g;ctx.strokeStyle='#fff2ac';ctx.lineWidth=1.4;ctx.beginPath();ctx.roundRect(-r*1.2,-r*.42,r*2.4,r*.84,r*.34);ctx.fill();ctx.stroke();ctx.shadowBlur=0;
  ctx.strokeStyle='#dcb6ff';for(const sx of [-1,1]){ctx.beginPath();ctx.moveTo(sx*r*.82,-r*.28);ctx.lineTo(sx*r*1.58,-r*.76);ctx.stroke();ctx.beginPath();ctx.ellipse(sx*r*1.72,-r*.82,r*.52,r*.16,p.phase*(sx),0,Math.PI*2);ctx.stroke();}
  ctx.fillStyle='#fff4a1';ctx.beginPath();ctx.arc(0,0,r*.18,0,Math.PI*2);ctx.fill();ctx.fillStyle='rgba(2,23,31,.78)';ctx.font=`900 ${Math.max(5,r*.34)}px system-ui`;ctx.textAlign='center';ctx.fillText(`${Math.ceil(state.bossDrone)}s`,0,r*.92);ctx.restore();}

// Final shot/tracer must fade normally after Boss death; never freeze through the cleansing sequence.
const g2UpdateBase=update;
update=function(dt){
  const wasTransition=!!(state&&state.mode==='playing'&&state.transition>0);g2UpdateBase(dt);if(!state)return;
  if(wasTransition){for(const tr of state.tracers){tr.t+=dt;tr.life-=dt;}state.tracers=state.tracers.filter(tr=>tr.life>0);for(const hm of state.hitMarkers)hm.life-=dt;state.hitMarkers=state.hitMarkers.filter(hm=>hm.life>0);}
  if(state.bossDrone>0){const p=g2EliteDronePose(performance.now());for(const tr of state.tracers)if(tr.kind==='eliteDrone'){tr.x1=p.x;tr.y1=p.y;}}
};

// Layer the visible elite Drone and brand overlays above the scene but below DOM HUD.
function g2DrawGppPickupBrand(t){if(!state||!logoIcon.complete)return;for(const f of state.pickupFx||[]){if(f.kind!=='gpp'||t-f.start>=f.dur)continue;const q=clamp((t-f.start)/f.dur,0,1),e=1-Math.pow(1-q,3),x=f.x+(f.tx-f.x)*e,y=f.y+(f.ty-f.y)*e-Math.sin(q*Math.PI)*70,sc=.75+.35*Math.sin(q*Math.PI);ctx.save();ctx.translate(x,y);ctx.scale(sc,sc);ctx.beginPath();ctx.arc(0,0,15,0,Math.PI*2);ctx.clip();ctx.fillStyle='#fff';ctx.fillRect(-15,-15,30,30);ctx.drawImage(logoIcon,-15,-15,30,30);ctx.restore();}
  const b=state.rewardBanner;if(b?.kind==='gpp'&&t<b.until){const v=gameplayViewport(),mobile=!v.desktop,w=Math.min(300,innerWidth*.40),x=mobile?(innerWidth-w)/2:v.left+14,y=mobile?70:innerHeight*.22;ctx.save();ctx.beginPath();ctx.roundRect(x+17,y+15,28,28,7);ctx.clip();ctx.fillStyle='#fff';ctx.fillRect(x+17,y+15,28,28);ctx.drawImage(logoIcon,x+17,y+15,28,28);ctx.restore();}}

const g2RenderBase=render;render=function(t){g2RenderBase(t);g2DrawEliteDrone(t);g2DrawGppPickupBrand(t);};

// GPP is a brand asset, not an emoji, including the active-support HUD.
updateSupportUI=function(){
  if(!state)return;const active=supportActive(),now=performance.now(),key=active.map(x=>`${x.k}:${Math.ceil(x.left*4)}`).join('|');if(key===state._supportHudKey)return;state._supportHudKey=key;
  if(UI.supportList){UI.supportList.innerHTML=active.length?active.map(({k,m,left})=>{const pct=clamp(left/m.duration*100,0,100),fresh=state._supportJustAdded===k&&now<state._supportJustUntil?' support-new':'',exp=left<2?' expiring':'',icon=k==='gpp'?'<img class="gpp-support-logo" src="assets/logo-gpp.png" alt="TRƯỜNG GPP">':`<i>${m.icon}</i>`;return`<div class="support-row${fresh}${exp}" style="--support-color:${m.color};--support-pct:${pct}%"><span class="support-icon">${icon}</span><b>${m.name}</b><strong>${left.toFixed(1)}s</strong><span class="support-track"><i style="width:${pct}%"></i></span></div>`}).join(''):'<div class="support-empty">CHƯA CÓ HỖ TRỢ</div>'}
  if(UI.mobileSupportStrip){UI.mobileSupportStrip.innerHTML=active.slice(0,4).map(({k,m,left})=>`<span class="mobile-support-chip${left<2?' expiring':''}">${k==='gpp'?'<img class="gpp-support-logo" src="assets/logo-gpp.png" alt="GPP">':m.icon} ${left.toFixed(0)}s</span>`).join('')}
};

// Move Boss reward inventory into the left information rail on desktop; keep it visible on the left on mobile.
const g2RewardRail=$('#bossRewardRail'),g2Hud=$('#hud'),g2StatusRail=document.querySelector('.status-rail'),g2StatusNote=document.querySelector('.status-rail-note'),g2DesktopMq=matchMedia('(min-width:1180px) and (hover:hover) and (pointer:fine)');
function g2PlaceRewardRail(){if(!g2RewardRail)return;if(g2DesktopMq.matches&&g2StatusRail){g2StatusRail.insertBefore(g2RewardRail,g2StatusNote||null)}else if(g2Hud&&g2RewardRail.parentElement!==g2Hud)g2Hud.appendChild(g2RewardRail)}
g2PlaceRewardRail();g2DesktopMq.addEventListener?.('change',g2PlaceRewardRail);

// INSTALL is always offered on the main menu until the shortcut/PWA is installed.
function g2Installed(){let marked=false;try{marked=localStorage.getItem(G2_INSTALL_MARK)==='1'}catch{}return g1Standalone()||marked;}
g1RefreshInstallUI=function(){g1SetVisible(G1_INSTALL_IDS,!g2Installed());};
g1InstallGame=async function(){ensureAudio();if(g1Standalone()){try{localStorage.setItem(G2_INSTALL_MARK,'1')}catch{}g1RefreshInstallUI();return}
  if(deferredInstall){const p=deferredInstall;deferredInstall=null;await p.prompt();let choice=null;try{choice=await p.userChoice}catch{}if(choice?.outcome==='accepted'){try{localStorage.setItem(G2_INSTALL_MARK,'1')}catch{}}g1RefreshInstallUI();return}
  if(/iPad|iPhone|iPod/.test(navigator.userAgent))toast('📲 Safari: Chia sẻ → Thêm vào Màn hình chính',2.5);else toast('📲 Trình duyệt: mở menu ⋮ → Cài ứng dụng / Tạo lối tắt',2.5);
};
for(const id of G1_INSTALL_IDS){const b=document.getElementById(id);if(b)b.onclick=g1InstallGame;}
addEventListener('appinstalled',()=>{try{localStorage.setItem(G2_INSTALL_MARK,'1')}catch{}deferredInstall=null;g1RefreshInstallUI();});

// UPDATE appears only when a newer deployed version or waiting service worker is detected.
let g2RemoteUpdate=false;
function g2VerParts(v){return String(v||'').split('.').map(x=>parseInt(x,10)||0)}
function g2IsNewer(v,cur=G2_VERSION){const a=g2VerParts(v),b=g2VerParts(cur);for(let i=0;i<Math.max(a.length,b.length);i++){if((a[i]||0)!==(b[i]||0))return(a[i]||0)>(b[i]||0)}return false}
g1RefreshUpdateUI=function(){g1SetVisible(G1_UPDATE_IDS,!!g1WaitingWorker||g2RemoteUpdate);};
async function g2CheckVersion(){try{const r=await fetch(`./version.json?t=${Date.now()}`,{cache:'no-store'});if(r.ok){const v=await r.json();g2RemoteUpdate=g2IsNewer(v.version);g1RefreshUpdateUI();}}catch{}}
g1ApplyUpdate=async function(){ensureAudio();if(g1WaitingWorker){g1Reloading=true;g1WaitingWorker.postMessage({type:'SKIP_WAITING'});return}if(g1SwReg){try{await g1SwReg.update()}catch{}if(g1SwReg.waiting){g1WaitingWorker=g1SwReg.waiting;g1Reloading=true;g1WaitingWorker.postMessage({type:'SKIP_WAITING'});return}}if(g2RemoteUpdate)location.reload();else g1RefreshUpdateUI();};
for(const id of G1_UPDATE_IDS){const b=document.getElementById(id);if(b)b.onclick=g1ApplyUpdate;}
setTimeout(g2CheckVersion,900);setInterval(g2CheckVersion,180000);

g1RefreshInstallUI();g1RefreshUpdateUI();f1UpdateRewardRail();




/* === v3.4.0 H1 FINAL · interactive campaign map · briefing gate · harder distant Boss · 2× NPC pressure · full cleanup · expanded item FX === */
const H1_VERSION='3.4.0';
const H1_BOSS_EXTRA_MULT=2;
const H1_NPC_SPEED_MULT=2;
const H1_NPC_SPAWN_MULT=2;
const H1_STORIES=[
  'Nguồn thuốc của bệnh viện đã bị nhiễm khuẩn. Làm sạch Khoa Dược trước khi mầm bệnh lan sang các khu khác.',
  'Khu Cấp Cứu đang bị quá tải. Mầm bệnh đã xâm nhập tuyến phòng thủ đầu tiên — phải giành lại khu vực ngay.',
  'Một chủng vi khuẩn mới đang phát tán theo không khí. Hãy ngăn chúng trước khi toàn bộ bệnh viện bị lây nhiễm.',
  'Khu Nhi đã bị bao vây. Những mầm bệnh nhỏ nhưng cực kỳ linh hoạt đang tiến sâu vào khu điều trị.',
  'Hệ thống bảo vệ Khoa Sản đang suy yếu. Đây là khu vực phải được bảo vệ bằng mọi giá.',
  'Mầm bệnh đã tiến vào trung tâm thần kinh của bệnh viện. Chúng bắt đầu biến đổi và phản ứng thông minh hơn.',
  'Phòng xét nghiệm đã xác định được nguồn đột biến. Nhưng chính nơi này đang chứa mật độ mầm bệnh nguy hiểm nhất.',
  'Lối ra chỉ còn ở phía trước. Nguồn bệnh cuối cùng đã tập trung tại cổng bệnh viện — tiêu diệt nó để kết thúc cuộc truy quét.'
];
const H1_MAP_NAMES=['KHOA DƯỢC','KHOA CẤP CỨU','KHOA HÔ HẤP','KHOA NHI','KHOA SẢN','KHOA THẦN KINH','KHOA XÉT NGHIỆM','CỔNG RA BỆNH VIỆN'];

// --- Interactive hospital map replaces the old static hero image on the main menu. ---
const h1MapHotspots=[...document.querySelectorAll('[data-map-stage]')];
function h1MapStageState(i){const unlocked=a1Unlocked(),open=i<unlocked,completed=i<Math.max(0,unlocked-1);return{open,completed};}
function h1RenderMapPreview(i=a1SelectedStage){
  i=clamp(Number(i)||0,0,7);const st=h1MapStageState(i),img=$('#h1MapPreviewImg'),no=$('#h1MapPreviewNo'),name=$('#h1MapPreviewName'),story=$('#h1MapPreviewStory'),status=$('#h1MapPreviewState');
  if(img){img.src=`assets/stage${i+1}-clean.jpg`;img.alt=H1_MAP_NAMES[i];}if(no)no.textContent=`MÀN ${i+1}`;if(name)name.textContent=H1_MAP_NAMES[i];if(story)story.textContent=H1_STORIES[i];if(status){status.textContent=st.completed?'✓ ĐÃ KHỬ NHIỄM':st.open?'● ĐÃ MỞ':'🔒 CHƯA MỞ KHÓA';status.style.color=st.completed?'#8dffc1':st.open?'#8dffe8':'#c0c7cb';}
}
function h1RefreshMap(){
  const unlocked=a1Unlocked();h1MapHotspots.forEach((b,i)=>{const open=i<unlocked,completed=i<Math.max(0,unlocked-1);b.classList.toggle('locked',!open);b.classList.toggle('completed',completed);b.classList.toggle('selected',open&&i===a1SelectedStage);b.setAttribute('aria-disabled',String(!open));});h1RenderMapPreview(a1SelectedStage);
}
for(const b of h1MapHotspots){const i=Number(b.dataset.mapStage)||0;b.addEventListener('mouseenter',()=>h1RenderMapPreview(i));b.addEventListener('focus',()=>h1RenderMapPreview(i));b.addEventListener('mouseleave',()=>h1RenderMapPreview(a1SelectedStage));b.addEventListener('click',e=>{e.preventDefault();const st=h1MapStageState(i);if(!st.open){b.classList.remove('lock-pulse');void b.offsetWidth;b.classList.add('lock-pulse');setTimeout(()=>b.classList.remove('lock-pulse'),450);h1RenderMapPreview(i);return;}a1SelectedStage=i;a1NewlyUnlocked=-1;a1RenderStageMenu();});}
const h1RenderStageMenuBase=a1RenderStageMenu;
a1RenderStageMenu=function(){h1RenderStageMenuBase();h1RefreshMap();};

// --- Story briefing gate: the 3-minute timer does NOT start until the user presses VÀO NGHÊNH CHIẾN. ---
let h1PendingStage=null;
const h1StartGameImmediate=startGame;
function h1PopulateBrief(stage){
  const i=clamp(stage,0,7),img=$('#missionBriefImg'),no=$('#missionBriefNo'),title=$('#missionBriefTitle'),story=$('#missionBriefStory');
  if(img){img.src=`assets/stage${i+1}-clean.jpg`;img.alt=H1_MAP_NAMES[i];}if(no)no.textContent=i===7?'MÀN 8 · CỔNG RA BỆNH VIỆN':`MÀN ${i+1} · ${H1_MAP_NAMES[i]}`;if(title)title.textContent=i===7?'TRẬN CHIẾN CUỐI CÙNG':H1_MAP_NAMES[i];if(story)story.textContent=H1_STORIES[i];
}
startGame=function(stage=0){
  const maxOpen=Math.max(0,a1Unlocked()-1),target=clamp(stage,0,maxOpen);h1PendingStage=target;a1SelectedStage=target;h1PopulateBrief(target);hide($('#stageSelectPanel'));show($('#missionBriefPanel'));ensureAudio();
};
const h1Engage=$('#engageBtn');if(h1Engage)h1Engage.onclick=()=>{if(h1PendingStage===null)return;const target=h1PendingStage;h1PendingStage=null;hide($('#missionBriefPanel'));h1StartGameImmediate(target);};
const h1BriefBack=$('#briefBackBtn');if(h1BriefBack)h1BriefBack.onclick=()=>{h1PendingStage=null;hide($('#missionBriefPanel'));goHome();};
const h1GoHomeBase=goHome;goHome=function(){h1PendingStage=null;hide($('#missionBriefPanel'));h1GoHomeBase();h1RefreshMap();};

// --- H1 Boss: twice as durable as v3.3 (therefore 6× the pre-hardening baseline), visually farther yet larger. ---
const h1SpawnEnemyBase=spawnEnemy;
spawnEnemy=function(type,boss=false){const e=h1SpawnEnemyBase(type,boss);if(boss&&e&&!e.h1BossScaled){e.hp*=H1_BOSS_EXTRA_MULT;e.maxHp*=H1_BOSS_EXTRA_MULT;e.h1BossScaled=true;e.attackTimer=Math.min(e.attackTimer||1.3,1.15);}return e;};
const h1EnemyScreenBase=enemyScreen;
enemyScreen=function(e){
  if(!e?.boss)return h1EnemyScreenBase(e);const h=innerHeight,horizon=h*.405,v=gameplayViewport(),phase=e.phase||0,scale=1.10+.045*Math.sin(phase*.58);return{x:v.center+(e.x-.5)*v.width*.66,y:horizon+h*.115+Math.sin(phase*.47)*2.5,scale,r:e.rad*scale*1.13};
};
const h1UpdateBossBase=updateBoss;
updateBoss=function(e,dt,d){h1UpdateBossBase(e,dt,d);if(!e||e.dead||state?.bossIntro>0)return;const ratio=Math.max(0,e.hp/e.maxHp),phase=ratio>.75?1:ratio>.50?2:ratio>.25?3:4;const cap=Math.max(.48,1.12-phase*.12);if(Number.isFinite(e.attackTimer))e.attackTimer=Math.min(e.attackTimer,cap);};

// --- H1 natural NPC pressure: at least 2× speed and 2× spawn frequency versus v3.3, while preserving archetype differences. ---
const h1SpeedTargetBase=d1SpeedTarget;d1SpeedTarget=function(diff=state?.difficulty||'normal',stage=state?.stageIndex||0){return h1SpeedTargetBase(diff,stage)*H1_NPC_SPEED_MULT;};
const h1SpawnIntervalBase=d1SpawnInterval;d1SpawnInterval=function(){return Math.max(.30,h1SpawnIntervalBase()/H1_NPC_SPAWN_MULT);};
const h1ActiveCapBase=d1ActiveCap;d1ActiveCap=function(){return Math.min(20,Math.max(6,Math.round(h1ActiveCapBase()*1.9)));};

// --- Capture the last Boss position, then hard-clean every combat layer before the 5s cleanse begins. ---
const h1HitEnemyBase=hitEnemy;
hitEnemy=function(e,...args){if(e?.boss&&state){try{const s=enemyScreen(e);state.h1LastBossScreen={x:s.x,y:s.y,r:s.r};}catch{}}return h1HitEnemyBase(e,...args);};
function h1CombatCleanup(){
  if(!state)return;const p=state.h1LastBossScreen||{x:gameplayViewport().center,y:innerHeight*.50,r:90};state.h1BossDeathFx={start:performance.now(),dur:760,x:p.x,y:p.y,r:p.r};
  state.enemyShots.length=0;state.tracers.length=0;state.hitMarkers.length=0;state.particles.length=0;state.powerups.length=0;state.rewardNpcs.length=0;state.enemies.length=0;state.muzzleFlash=0;state.recoil=0;state.shake=0;state._bossDroneTimer=999;pointer.down=false;
}
const h1BeginStageClearBase=beginStageClear;
beginStageClear=function(){if(!state||state.transition>0||state.bossRewardShown)return;h1CombatCleanup();h1BeginStageClearBase();};
function h1DrawBossDeathFx(t){const f=state?.h1BossDeathFx;if(!f)return;const q=clamp((t-f.start)/f.dur,0,1);if(q>=1){state.h1BossDeathFx=null;return;}ctx.save();ctx.globalCompositeOperation='screen';const a=1-q,r=f.r*(.8+q*2.2);for(let i=0;i<4;i++){ctx.globalAlpha=a*(.22-i*.035);ctx.strokeStyle=i%2?'#9c6cff':'#80ffce';ctx.lineWidth=Math.max(1,4-i);ctx.beginPath();ctx.arc(f.x,f.y,r*(.55+i*.19),0,Math.PI*2);ctx.stroke();}for(let i=0;i<18;i++){const ang=i*.349+t*.0006*(i%2?1:-1),rr=r*(.35+q*(.45+(i%4)*.08));ctx.globalAlpha=a*.28;ctx.fillStyle=i%3===0?'#ffe680':i%2?'#8effd5':'#a679ff';ctx.beginPath();ctx.arc(f.x+Math.cos(ang)*rr,f.y+Math.sin(ang)*rr*.65,1.5+(i%3),0,Math.PI*2);ctx.fill();}ctx.restore();}

// --- H1 item presentation: 3× standard / 4× special expansion from the weapon monitor. Shield becomes a full player field for 12s. ---
SUPPORT_ITEMS.shield.duration=12;D1_REWARD_META.shield.duration=12;
const h1CollectPowerupsBase=collectPowerups;
collectPowerups=function(x,y){const p=state?.powerups?.find(o=>!o.dead&&Math.hypot(x-o.x,y-o.y)<48),kind=p?.kind,ok=h1CollectPowerupsBase(x,y);if(ok&&state&&(kind==='shield'||kind==='gpp')){state.shield=Math.max(state.shield||0,12);state._supportHudKey='';}return ok;};
const h1SetWeaponScreenFxBase=g2SetWeaponScreenFx;
g2SetWeaponScreenFx=function(kind,ms=1300){if(state){state.h1FxKind=kind;state.h1FxStart=performance.now();state.h1FxBurstUntil=state.h1FxStart+Math.min(2600,Math.max(1500,ms));}return h1SetWeaponScreenFxBase(kind,ms);};
function h1DrawExpandedItemFx(t){
  if(!state||state.transition>0||!v270WeaponPose?.monitorCenter)return;const kind=g2ActiveScreenKind();if(!kind)return;const st=G2_SCREEN_STYLE[kind]||G2_SCREEN_STYLE.gppBoost,c=v270WeaponPose.monitorCenter,v=gameplayViewport(),special=['eliteDrone','annihilator','bossGpp','gpp','gppBoost'].includes(kind),factor=special?4:3,base=Math.max(24,v270WeaponPose.drawW*.10),now=performance.now(),age=Math.max(0,(now-(state.h1FxStart||now))/1000),fresh=now<(state.h1FxBurstUntil||0);ctx.save();ctx.beginPath();ctx.rect(v.left,0,v.width,innerHeight);ctx.clip();ctx.globalCompositeOperation='screen';
  const maxR=Math.min(Math.hypot(v.width,innerHeight)*.34,base*(special?8.0:6.2));const glow=ctx.createRadialGradient(c.x,c.y,base*.3,c.x,c.y,maxR);glow.addColorStop(0,'rgba(255,255,255,.11)');glow.addColorStop(.18,st.a+'2e');glow.addColorStop(.58,st.b+'14');glow.addColorStop(1,'rgba(0,0,0,0)');ctx.globalAlpha=fresh?.8:.34;ctx.fillStyle=glow;ctx.beginPath();ctx.arc(c.x,c.y,maxR,0,Math.PI*2);ctx.fill();
  const rings=special?5:4;for(let i=0;i<rings;i++){const q=(age*.42+i/rings)%1,rr=base*(.85+q*(factor*1.75));ctx.globalAlpha=(1-q)*(fresh?.34:.15);ctx.strokeStyle=i%2?st.b:st.a;ctx.lineWidth=Math.max(1.2,v270WeaponPose.drawW*.0027);ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=18;ctx.beginPath();ctx.ellipse(c.x,c.y,rr,rr*(.48+.08*Math.sin(t*.003+i)),t*.00035*(i%2?-1:1)+i*.52,0,Math.PI*2);ctx.stroke();}
  const dots=special?22:15;for(let i=0;i<dots;i++){const a=t*.0011*(i%2?1:-1)+i*6.283/dots,rr=base*(1.25+(i%5)*.48);ctx.globalAlpha=fresh?.34:.16;ctx.fillStyle=i%3?st.a:st.b;ctx.beginPath();ctx.arc(c.x+Math.cos(a)*rr,c.y+Math.sin(a*1.15)*rr*.55,1+(i%3)*.7,0,Math.PI*2);ctx.fill();}ctx.restore();
}
function h1DrawShieldField(t){if(!state||state.transition>0||state.shield<=0)return;const v=gameplayViewport(),cx=playerScreenX(),cy=innerHeight*.68,rx=Math.min(v.width*.40,innerHeight*.52),ry=innerHeight*.48,pulse=.5+.5*Math.sin(t*.006);ctx.save();ctx.beginPath();ctx.rect(v.left,0,v.width,innerHeight);ctx.clip();ctx.globalCompositeOperation='screen';const g=ctx.createRadialGradient(cx,cy,rx*.18,cx,cy,rx);g.addColorStop(0,'rgba(125,238,255,.02)');g.addColorStop(.62,'rgba(83,211,255,.035)');g.addColorStop(.90,'rgba(92,225,255,.10)');g.addColorStop(1,'rgba(170,249,255,.18)');ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,Math.PI,Math.PI*2);ctx.lineTo(cx+rx,cy);ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI);ctx.closePath();ctx.fill();ctx.strokeStyle=`rgba(151,246,255,${.30+.12*pulse})`;ctx.lineWidth=2.2;ctx.shadowColor='#67e7ff';ctx.shadowBlur=20;ctx.beginPath();ctx.ellipse(cx,cy,rx,ry,0,Math.PI,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;for(let i=1;i<=3;i++){ctx.globalAlpha=.08+.03*pulse;ctx.strokeStyle=i%2?'#9ff6ff':'#60cfff';ctx.beginPath();ctx.ellipse(cx,cy,rx*(.58+i*.12),ry*(.58+i*.12),0,t*.00015*i,t*.00015*i+Math.PI*1.35);ctx.stroke();}ctx.restore();}

// Final H1 render: existing G1/G2 scene first, then transient Boss death and large but readable item fields.
const h1RenderBase=render;render=function(t){h1RenderBase(t);h1DrawBossDeathFx(t);h1DrawExpandedItemFx(t);h1DrawShieldField(t);};

// Version comparison must use this H1 build so UPDATE stays hidden until a genuinely newer deployment exists.
g2IsNewer=function(v,cur=H1_VERSION){const a=g2VerParts(v),b=g2VerParts(cur);for(let i=0;i<Math.max(a.length,b.length);i++){if((a[i]||0)!==(b[i]||0))return(a[i]||0)>(b[i]||0)}return false;};

// H1 menu initial state.
a1RenderStageMenu();h1RefreshMap();g1RefreshInstallUI();g1RefreshUpdateUI();


// H1 install race hardening: one user click is enough on browsers that expose the PWA install prompt.
async function h1InstallShortcut(){
  ensureAudio();if(g1Standalone()){try{localStorage.setItem(G2_INSTALL_MARK,'1')}catch{}g1RefreshInstallUI();return;}
  if(/iPad|iPhone|iPod/.test(navigator.userAgent)){toast('📲 iPhone/iPad yêu cầu xác nhận của Safari để thêm ứng dụng vào Màn hình chính',2.4);return;}
  if(!deferredInstall){toast('📲 ĐANG CHUẨN BỊ TRÌNH CÀI ĐẶT...',1.2);for(let i=0;i<24&&!deferredInstall;i++)await new Promise(r=>setTimeout(r,100));}
  if(deferredInstall){const p=deferredInstall;deferredInstall=null;await p.prompt();let choice=null;try{choice=await p.userChoice}catch{}if(choice?.outcome==='accepted'){try{localStorage.setItem(G2_INSTALL_MARK,'1')}catch{}}g1RefreshInstallUI();return;}
  toast('📲 Trình duyệt này chưa cấp quyền cài PWA tự động',2.0);
}
for(const id of G1_INSTALL_IDS){const b=document.getElementById(id);if(b)b.onclick=h1InstallShortcut;}


/* === v3.5.0 H1 BALANCE · sparse Boss patterns · smart map preview · richer SUPPLY · leaderboard client === */
const H15_VERSION='3.8.0';

// --- Boss fire: fewer, more legible projectiles with a visible telegraph and real breathing room. ---
function h15BossShotCount(phase,diff){
  if(diff==='easy')return phase>=3?2:1;
  if(diff==='hard'){if(phase>=3&&Math.random()<.16)return 4;return phase>=2?3:2;}
  return phase>=3?3:2;
}
function h15BossRest(diff,phase){const base=diff==='easy'?2.45:diff==='hard'?1.92:2.18;return Math.max(1.58,base-(phase-1)*.10);}
function h15BossWarning(diff){return diff==='easy'?.88:diff==='hard'?.66:.76;}
function h15FirePattern(e,phase,diff,serial){
  if(!state||state.mode!=='playing'||state.transition>0||e.dead||e.h15AttackSerial!==serial)return;
  const n=h15BossShotCount(phase,diff),idx=(e.h15PatternIndex=(e.h15PatternIndex||0)+1)%4;
  let offsets=[],speed=126,size=8,damage=1.0+.10*phase;
  if(n===1){offsets=[0];speed=102;size=13;damage+=.18;}
  else if(n===2){offsets=idx%2?[-.24,.24]:[-.16,.18];speed=122;size=9;}
  else if(n===3){offsets=idx===0?[-.34,0,.34]:[-.30,.08,.38];speed=128;size=8.5;}
  else {offsets=[-.42,-.14,.16,.44];speed=122;size=8;}
  // Keep an escape corridor: never fire more than one projectile exactly at the current lane.
  offsets.forEach((o,i)=>setTimeout(()=>{
    if(!state||state.mode!=='playing'||state.transition>0||e.dead||e.h15AttackSerial!==serial)return;
    fireBossShot(e,o,damage,e.shotColor,speed+(i%2)*5,size);
  },i*95));
}
bossAttack=function(e,phase,d){
  const diff=state?.difficulty||'normal',warning=h15BossWarning(diff),serial=(e.h15AttackSerial||0)+1;e.h15AttackSerial=serial;
  e.h15TelegraphUntil=performance.now()+warning*1000;e.h15TelegraphStart=performance.now();e.h15TelegraphPhase=phase;
  tone(diff==='hard'?235:285,.075,'triangle',.012,80,0,.04);
  setTimeout(()=>h15FirePattern(e,phase,diff,serial),warning*1000);
  e.attackTimer=warning+h15BossRest(diff,phase);
};
// Replace H1's rapid clamp with the D1/G1 Boss logic so the longer attack rest is respected.
updateBoss=function(e,dt,d){
  h1UpdateBossBase(e,dt,d);
  if(!e||e.dead||state?.bossIntro>0)return;
  // Keep Boss fire predictable after each summon wave.
  if(e.h15SummonPauseUntil&&performance.now()<e.h15SummonPauseUntil)e.attackTimer=Math.max(e.attackTimer,.12);
};
const h15SummonBase=d1BossSummon;
d1BossSummon=function(e,wave){
  e.h15AttackSerial=(e.h15AttackSerial||0)+1; // cancel any telegraphed shot that has not left yet
  h15SummonBase(e,wave);e.attackTimer=Math.max(e.attackTimer,1.45);e.h15SummonPauseUntil=performance.now()+1300;
};
function h15DrawBossTelegraph(t){
  if(!state||state.transition>0)return;const e=state.enemies.find(x=>x.boss&&!x.dead);if(!e||!e.h15TelegraphUntil)return;const now=performance.now();if(now>=e.h15TelegraphUntil)return;
  const s=enemyScreen(e),start=e.h15TelegraphStart||now,dur=Math.max(1,e.h15TelegraphUntil-start),q=clamp((now-start)/dur,0,1),pulse=.5+.5*Math.sin(t*.018);
  ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.26+.30*q;ctx.strokeStyle=q>.62?'#ff6b72':'#ffd56b';ctx.lineWidth=2.2+2*q;ctx.shadowColor=ctx.strokeStyle;ctx.shadowBlur=18+12*pulse;
  ctx.beginPath();ctx.arc(s.x,s.y,s.r*(1.28+.30*q),0,Math.PI*2);ctx.stroke();ctx.globalAlpha=.65+.25*pulse;ctx.font=`900 ${Math.max(14,s.r*.20)}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#fff2b8';ctx.fillText('⚠',s.x,s.y-s.r*1.45);ctx.restore();
}

// --- Smart map preview: position opposite the hovered department so it never covers that department. ---
const h15Map=$('#h1CampaignMap'),h15Preview=$('#h1MapPreview');if(h15Preview)h15Preview.classList.add('h15-smart-preview');
function h15PlaceMapPreview(i){
  if(!h15Map||!h15Preview||getComputedStyle(h15Preview).display==='none')return;const b=h1MapHotspots[i];if(!b)return;
  const map=h15Map.getBoundingClientRect(),spot=b.getBoundingClientRect(),pw=h15Preview.offsetWidth||300,ph=h15Preview.offsetHeight||92,gap=38;
  const sx=spot.left-map.left+spot.width/2,sy=spot.top-map.top+spot.height/2,mw=map.width,mh=map.height;
  let side=sx>mw*.55?'left':'right';if(sy<mh*.27)side='bottom';else if(sy>mh*.76)side='top';
  let left,top;
  if(side==='left'){left=sx-pw-gap;top=sy-ph/2;}
  else if(side==='right'){left=sx+gap;top=sy-ph/2;}
  else if(side==='top'){left=sx-pw/2;top=sy-ph-gap;}
  else {left=sx-pw/2;top=sy+gap;}
  left=clamp(left,8,Math.max(8,mw-pw-8));top=clamp(top,8,Math.max(8,mh-ph-8));
  h15Preview.style.left=`${left}px`;h15Preview.style.top=`${top}px`;h15Preview.style.right='auto';h15Preview.style.bottom='auto';h15Preview.dataset.side=side;
}
const h15MapPreviewBase=h1RenderMapPreview;
h1RenderMapPreview=function(i=a1SelectedStage){h15MapPreviewBase(i);requestAnimationFrame(()=>h15PlaceMapPreview(clamp(Number(i)||0,0,7)));};
window.addEventListener('resize',()=>requestAnimationFrame(()=>h15PlaceMapPreview(a1SelectedStage)),{passive:true});

// --- More support without random droughts: higher cap plus a guaranteed SUPPLY window. ---
Object.assign(DIFF.easy,{rewardEvery:10.0,rewardMax:13});Object.assign(DIFF.normal,{rewardEvery:12.0,rewardMax:11});Object.assign(DIFF.hard,{rewardEvery:14.0,rewardMax:9});
const h15NewStateBase=newState;
newState=function(stageIndex=0){const s=h15NewStateBase(stageIndex),d=s.difficulty;s.rewardNpcMax=DIFF[d].rewardMax;s.rewardNpcTimer=d==='easy'?3.0:d==='hard'?4.2:3.6;s.h15LastSupplyAt=0;s.h15SupplyGuarantee=d==='easy'?14:d==='hard'?20:17;return s;};
const h15SpawnRewardBase=spawnRewardNpc;
spawnRewardNpc=function(){const before=state?.rewardNpcs?.length||0,r=h15SpawnRewardBase();if(state&&(state.rewardNpcs.length>before||state.rewardNpcs.some(n=>!n.dead)))state.h15LastSupplyAt=state.stageElapsed||0;return r;};
const h15UpdateBase=update;
update=function(dt){h15UpdateBase(dt);if(!state||state.mode!=='playing'||state.transition>0||state.bossSpawned)return;const active=state.rewardNpcs?.some(n=>!n.dead);if(!active&&state.rewardNpcCount<state.rewardNpcMax&&(state.stageElapsed-(state.h15LastSupplyAt||0))>=(state.h15SupplyGuarantee||18)){spawnRewardNpc();state.rewardNpcTimer=Math.max(state.rewardNpcTimer||0,4.5);}};

// --- Optional leaderboard client. Cross-device sharing automatically activates once a HTTPS endpoint is configured. ---
const H15_LB_KEY='bstqLeaderboardV1',H15_LB_ENDPOINT=(window.BSTQ_LEADERBOARD_ENDPOINT||'').trim();let h15PendingRecord=null;
function h15LoadLocalScores(){try{const a=JSON.parse(localStorage.getItem(H15_LB_KEY)||'[]');return Array.isArray(a)?a:[]}catch{return[]}}
function h15StoreLocalScore(rec){const a=h15LoadLocalScores();a.push(rec);a.sort((x,y)=>y.score-x.score||x.bossSeconds-y.bossSeconds);localStorage.setItem(H15_LB_KEY,JSON.stringify(a.slice(0,120)));}
function h15SafeName(v){return String(v||'').replace(/[<>\\/]/g,'').trim().slice(0,16)||'Bác sĩ ẩn danh';}
function h15CurrentFilters(){return{difficulty:$('#leaderboardDifficulty')?.value||'normal',stage:$('#leaderboardStage')?.value||'all'};}
async function h15FetchScores(){
  const f=h15CurrentFilters();if(H15_LB_ENDPOINT){try{const u=new URL(H15_LB_ENDPOINT,location.href);u.searchParams.set('difficulty',f.difficulty);if(f.stage!=='all')u.searchParams.set('stage',f.stage);const r=await fetch(u,{cache:'no-store'});if(r.ok){const j=await r.json();if(Array.isArray(j.entries))return{mode:'online',entries:j.entries};}}catch{}}
  let a=h15LoadLocalScores().filter(x=>x.difficulty===f.difficulty&&(f.stage==='all'||String(x.stage)===f.stage));return{mode:'local',entries:a};
}
function h15RenderLeaderRows(entries){const box=$('#leaderboardList');if(!box)return;box.replaceChildren();const list=[...entries].sort((a,b)=>Number(b.score)-Number(a.score)||Number(a.bossSeconds||999)-Number(b.bossSeconds||999)).slice(0,30);if(!list.length){const e=document.createElement('div');e.className='h15-leader-row';e.textContent='Chưa có thành tích ở mục này.';box.appendChild(e);return;}list.forEach((r,i)=>{const row=document.createElement('div');row.className='h15-leader-row'+(i<3?' top3':'');const pos=document.createElement('span');pos.className='pos';pos.textContent=i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`;const who=document.createElement('span');who.className='who';const b=document.createElement('b');b.textContent=h15SafeName(r.name);const sm=document.createElement('small');sm.textContent=`Màn ${Number(r.stage)+1} · ${h18DiffLabel(r.difficulty||'normal')}`;who.append(b,sm);const sc=document.createElement('span');sc.className='score';sc.textContent=Number(r.score||0).toLocaleString('vi-VN');const rk=document.createElement('span');rk.className='rank';rk.textContent=r.rank||'A';row.append(pos,who,sc,rk);box.appendChild(row);});}
async function h15RefreshLeaderboard(){const mode=$('#leaderboardMode');if(mode)mode.textContent='ĐANG TẢI…';const r=await h15FetchScores();if(mode)mode.textContent=r.mode==='online'?'🌐 BẢNG XẾP HẠNG ONLINE · NHIỀU THIẾT BỊ':'💾 BẢNG XẾP HẠNG TRÊN THIẾT BỊ NÀY';h15RenderLeaderRows(r.entries);}
function h15OpenLeaderboard(record=false){const p=$('#leaderboardPanel');if(!p)return;show(p);const pr=$('#leaderboardRecordPrompt');if(pr)pr.classList.toggle('hidden',!(record&&h15PendingRecord));h15RefreshLeaderboard();}
$('#leaderboardBtn')?.addEventListener('click',()=>h15OpenLeaderboard(false));$('#leaderboardDifficulty')?.addEventListener('change',h15RefreshLeaderboard);$('#leaderboardStage')?.addEventListener('change',h15RefreshLeaderboard);$('#leaderboardRecordBtn')?.addEventListener('click',()=>h15OpenLeaderboard(true));$('#victoryLeaderboardRecordBtn')?.addEventListener('click',()=>h15OpenLeaderboard(true));
$('#leaderboardSaveBtn')?.addEventListener('click',async()=>{if(!h15PendingRecord)return;const rec={...h15PendingRecord,name:h15SafeName($('#leaderboardName')?.value),createdAt:new Date().toISOString(),version:H15_VERSION};let online=false;if(H15_LB_ENDPOINT){try{const r=await fetch(H15_LB_ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(rec)});online=r.ok;}catch{}}h15StoreLocalScore(rec);h15PendingRecord=null;$('#leaderboardRecordPrompt')?.classList.add('hidden');$('#leaderboardRecordBtn')?.classList.add('hidden');$('#victoryLeaderboardRecordBtn')?.classList.add('hidden');toast(online?'🏆 ĐÃ GHI TÊN LÊN BẢNG ONLINE!':'🏆 ĐÃ LƯU KỶ LỤC TRÊN MÁY!',1.5);h15RefreshLeaderboard();});
function h15ConsiderRecord(){if(!state)return;const acc=state.shots?Math.round(state.hits/state.shots*100):100,rank=rankFor(acc,state.health,state.stageElapsed),bossSeconds=Math.max(0,state.stageElapsed-G1_BOSS_TIME),keyScores=h15LoadLocalScores().filter(r=>r.difficulty===state.difficulty&&Number(r.stage)===state.stageIndex),best=Math.max(-1,...keyScores.map(r=>Number(r.score)||0));if(state.score>best){h15PendingRecord={score:Math.round(state.score),stage:state.stageIndex,difficulty:state.difficulty,rank,accuracy:acc,bossSeconds:Math.round(bossSeconds*10)/10};const btn=state.cfg.final?$('#victoryLeaderboardRecordBtn'):$('#leaderboardRecordBtn');btn?.classList.remove('hidden');toast('🏆 KỶ LỤC MỚI · CÓ THỂ GHI TÊN LÊN BẢNG XẾP HẠNG',1.8);}else{$('#leaderboardRecordBtn')?.classList.add('hidden');$('#victoryLeaderboardRecordBtn')?.classList.add('hidden');}}
const h15StageCompleteBase=stageCompletePanel;stageCompletePanel=function(){h15StageCompleteBase();h15ConsiderRecord();};

// Final render layer for the Boss telegraph.
const h15RenderBase=render;render=function(t){h15RenderBase(t);h15DrawBossTelegraph(t);};

// Version UI must compare against this build.
g2IsNewer=function(v,cur=H15_VERSION){const a=g2VerParts(v),b=g2VerParts(cur);for(let i=0;i<Math.max(a.length,b.length);i++){if((a[i]||0)!==(b[i]||0))return(a[i]||0)>(b[i]||0)}return false;};



/* === v3.6.0 H1 CONTROL · mobile AUTO FIRE · PC AUTO/MANUAL · tap/click target lock === */
const H16_FIRE_MODE_KEY='bstq-h16-fire-mode-v1';
function h16IsMobileControl(){return matchMedia('(hover:none) and (pointer:coarse)').matches || (innerWidth<900 && navigator.maxTouchPoints>0);}
function h16ReadFireMode(){if(h16IsMobileControl())return'auto';try{return localStorage.getItem(H16_FIRE_MODE_KEY)==='manual'?'manual':'auto'}catch{return'auto'}}
let h16PreferredFireMode=h16ReadFireMode();
function h16CurrentFireMode(){return h16IsMobileControl()?'auto':(state?.h16FireMode||h16PreferredFireMode||'auto');}
function h16UpdateFireModeUI(){
  const mode=h16CurrentFireMode(),mobile=h16IsMobileControl();
  for(const b of document.querySelectorAll('[data-fire-mode]')){const m=b.dataset.fireMode;b.classList.toggle('active',m===mode);if(b.id==='pauseFireModeManual')b.disabled=mobile;}
  const hint=$('#pauseFireModeHint');if(hint)hint.textContent=mobile?'Điện thoại: AUTO cố định · chạm NPC/Boss để khóa mục tiêu.':'PC: AUTO tự bắn hoặc THỦ CÔNG bằng chuột · đổi được ngay khi Pause.';
  const hud=$('#fireModeHud');if(hud){hud.classList.toggle('manual',mode==='manual');hud.textContent=mode==='auto'?(mobile?'⚡ AUTO · CHẠM ĐỂ KHÓA':'⚡ AUTO · CLICK ĐỂ KHÓA'):'🎯 THỦ CÔNG · CHUỘT NGẮM/BẮN';}
}
function h16SetFireMode(mode,{persist=true,announce=true}={}){
  if(h16IsMobileControl())mode='auto';mode=mode==='manual'?'manual':'auto';h16PreferredFireMode=mode;
  if(persist&&!h16IsMobileControl()){try{localStorage.setItem(H16_FIRE_MODE_KEY,mode)}catch{}}
  if(state){state.h16FireMode=mode;state.h16ManualLock=null;state.h16AutoTarget=null;pointer.down=false;}
  h16UpdateFireModeUI();if(announce&&state?.mode==='playing')toast(mode==='auto'?'⚡ AUTO FIRE · CLICK/CHẠM ĐỂ KHÓA':'🎯 BẮN THỦ CÔNG · CHUỘT NGẮM/BẮN',1.15);
}
for(const b of document.querySelectorAll('[data-fire-mode]'))b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();h16SetFireMode(b.dataset.fireMode);});

const h16NewStateBase=newState;
newState=function(stageIndex=0){const s=h16NewStateBase(stageIndex);s.h16FireMode=h16IsMobileControl()?'auto':h16PreferredFireMode;s.h16ManualLock=null;s.h16AutoTarget=null;s.h16LockFxUntil=0;s.h16LockSerial=0;s.h16AutoBombAt=0;return s;};

function h16TargetRef(kind,entity){return entity?{kind,id:entity.id}:null;}
function h16ResolveTarget(ref){
  if(!state||!ref)return null;
  if(ref.kind==='reward'){const n=state.rewardNpcs?.find(x=>x.id===ref.id&&!x.dead);return n?{kind:'reward',entity:n,screen:rewardNpcScreen(n)}:null;}
  const e=state.enemies?.find(x=>x.id===ref.id&&!x.dead);return e?{kind:'enemy',entity:e,screen:enemyScreen(e)}:null;
}
function h16TargetAt(x,y){
  if(!state)return null;const hits=[];
  for(const n of state.rewardNpcs||[]){if(n.dead)continue;const s=rewardNpcScreen(n),dist=Math.hypot(x-s.x,y-s.y),r=Math.max(34,s.r*1.55);if(dist<=r)hits.push({kind:'reward',entity:n,screen:s,dist,priority:2});}
  for(const e of state.enemies||[]){if(e.dead)continue;const s=enemyScreen(e),dist=Math.hypot(x-s.x,y-s.y),r=Math.max(e.boss?52:34,s.r*(e.boss?1.38:1.48));if(dist<=r)hits.push({kind:'enemy',entity:e,screen:s,dist,priority:e.boss?1:0});}
  hits.sort((a,b)=>a.dist-b.dist||a.priority-b.priority);return hits[0]||null;
}
function h16CriticalMinor(){const gate=state?.difficulty==='easy'?.84:state?.difficulty==='hard'?.76:.80;return(state?.enemies||[]).filter(e=>!e.dead&&!e.boss&&e.depth<=gate).sort((a,b)=>{
  const wa=(a.base?.charge?-.18:0)+(a.type==='spitter'?-.10:0)+(a.type==='elite'?-.08:0),wb=(b.base?.charge?-.18:0)+(b.type==='spitter'?-.10:0)+(b.type==='elite'?-.08:0);return(a.depth+wa)-(b.depth+wb);
})[0]||null;}
function h16ChooseAutoTarget(){
  if(!state)return null;
  const manual=h16ResolveTarget(state.h16ManualLock);if(manual)return manual;if(state.h16ManualLock)state.h16ManualLock=null;
  let sticky=h16ResolveTarget(state.h16AutoTarget);const critical=h16CriticalMinor();
  if(sticky?.entity?.boss&&critical&&critical.depth<.46)sticky=null;
  if(sticky)return sticky;
  if(critical){state.h16AutoTarget=h16TargetRef('enemy',critical);return h16ResolveTarget(state.h16AutoTarget);}
  const boss=(state.enemies||[]).find(e=>!e.dead&&e.boss);if(boss){state.h16AutoTarget=h16TargetRef('enemy',boss);return h16ResolveTarget(state.h16AutoTarget);}
  // SUPPLY becomes an automatic fallback only when combat is clear; players may always tap it to prioritize it immediately.
  const supply=(state.rewardNpcs||[]).filter(n=>!n.dead).sort((a,b)=>a.life-b.life)[0];if(supply){state.h16AutoTarget=h16TargetRef('reward',supply);return h16ResolveTarget(state.h16AutoTarget);}
  state.h16AutoTarget=null;return null;
}
function h16LockTarget(target){
  if(!state)return;if(!target){state.h16ManualLock=null;state.h16AutoTarget=null;return;}
  state.h16ManualLock=h16TargetRef(target.kind,target.entity);state.h16AutoTarget=null;state.h16LockFxUntil=performance.now()+520;state.h16LockSerial=(state.h16LockSerial||0)+1;
  const label=target.kind==='reward'?'SUPPLY':target.entity.boss?'BOSS':target.entity.type==='elite'?'NPC ELITE':'NPC';tone(target.entity?.boss?330:690,.055,'triangle',.014,150,0,.05);toast(`🔒 ĐÃ KHÓA ${label}`,0.72);
}
canvas.addEventListener('pointerdown',e=>{
  if(!state||state.mode!=='playing'||h16CurrentFireMode()!=='auto')return;const p=pointerPos(e);pointer.x=p.x;pointer.y=p.y;
  if(collectPowerups(p.x,p.y)){state.lastFire=performance.now();e.preventDefault();e.stopImmediatePropagation();return;}
  const target=h16TargetAt(p.x,p.y);if(target){h16LockTarget(target);e.preventDefault();e.stopImmediatePropagation();}
},true);

// Existing mouse/touch listeners remain installed for MANUAL mode. In AUTO mode their shot calls are suppressed.
const h16ShootBase=shoot;
shoot=function(x,y){if(!state||state.mode!=='playing'||state.transition>0)return;if(h16CurrentFireMode()==='auto'&&!state.h16AutoShot)return;return h16ShootBase(x,y);};
function h16AutoFireTick(){
  if(!state||state.mode!=='playing'||state.transition>0||h16CurrentFireMode()!=='auto'||state.stageIntro>0||state.bossIntro>0)return;const t=h16ChooseAutoTarget();if(!t)return;
  const s=t.kind==='reward'?rewardNpcScreen(t.entity):enemyScreen(t.entity),w=WEAPONS[state.weapon],now=performance.now();
  if(h16IsMobileControl()){pointer.x=s.x;pointer.y=s.y;}
  // Bombs remain automatic but are paced so AUTO does not throw all three in a second.
  if(w.kind==='bomb'&&now-(state.h16AutoBombAt||0)<1450)return;
  const before=state.lastFire;state.h16AutoShot=true;try{shoot(s.x,s.y)}finally{state.h16AutoShot=false;}
  if(state.lastFire!==before){weaponSingleFlashUntil=now+420;if(w.kind==='bomb')state.h16AutoBombAt=now;}
}
const h16UpdateBase=update;
update=function(dt){h16UpdateBase(dt);if(state?.mode==='playing')h16AutoFireTick();};

const h16CrosshairBase=drawCrosshair;
drawCrosshair=function(){if(state&&h16CurrentFireMode()==='auto'&&h16IsMobileControl())return;h16CrosshairBase();};
function h16DrawTargetLock(t){
  if(!state||state.mode!=='playing'||state.transition>0||h16CurrentFireMode()!=='auto')return;const manual=h16ResolveTarget(state.h16ManualLock),target=manual||h16ChooseAutoTarget();if(!target)return;
  const s=target.kind==='reward'?rewardNpcScreen(target.entity):enemyScreen(target.entity),boss=target.kind==='enemy'&&target.entity.boss,r=Math.max(target.kind==='reward'?35:boss?66:32,s.r*(boss?1.32:1.42)),pulse=.5+.5*Math.sin(t*.010),locked=!!manual,col=target.kind==='reward'?'#7dfff0':boss?'#ffcf6a':locked?'#ffe77d':'#7fffe8';
  ctx.save();ctx.translate(s.x,s.y);ctx.globalCompositeOperation='screen';ctx.strokeStyle=col;ctx.shadowColor=col;ctx.shadowBlur=locked?20:12;ctx.lineCap='round';ctx.lineWidth=locked?2.8:1.8;ctx.globalAlpha=locked?.88:.56;
  const rot=t*.0012*(boss?.55:1);for(let i=0;i<3;i++){ctx.beginPath();ctx.arc(0,0,r*(1+i*.14)+pulse*2.5,rot+i*2.1,rot+i*2.1+1.05);ctx.stroke();}
  ctx.rotate(-rot*.65);const br=r*1.05,ln=Math.max(8,r*.24);for(const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){ctx.beginPath();ctx.moveTo(sx*br,sy*(br-ln));ctx.lineTo(sx*br,sy*br);ctx.lineTo(sx*(br-ln),sy*br);ctx.stroke();}
  ctx.rotate(rot*.65);ctx.globalAlpha=.82;ctx.beginPath();ctx.arc(0,0,Math.max(5,r*.12),0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(-r*.22,0);ctx.lineTo(r*.22,0);ctx.moveTo(0,-r*.22);ctx.lineTo(0,r*.22);ctx.stroke();
  if(performance.now()<(state.h16LockFxUntil||0)){const q=1-(state.h16LockFxUntil-performance.now())/520;ctx.globalAlpha=.46*(1-q);ctx.lineWidth=5*(1-q)+1;ctx.beginPath();ctx.arc(0,0,r*(.72+q*.82),0,Math.PI*2);ctx.stroke();}
  ctx.shadowBlur=8;ctx.globalAlpha=.92;ctx.fillStyle='rgba(2,25,30,.86)';const label=target.kind==='reward'?'🔒 SUPPLY':boss?'🔒 BOSS LOCK':locked?'🔒 ĐÃ KHÓA':'⚡ AUTO LOCK';ctx.font=`1000 ${Math.max(7,Math.min(12,r*.16))}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';const tw=ctx.measureText(label).width+14;ctx.beginPath();ctx.roundRect(-tw/2,-r*1.48,tw,18,8);ctx.fill();ctx.fillStyle=col;ctx.fillText(label,0,-r*1.48+9);ctx.restore();
}
const h16RenderBase=render;render=function(t){h16RenderBase(t);h16DrawTargetLock(t);};

// Re-apply the remembered mode when resuming and force AUTO whenever the device uses coarse touch controls.
// newState() already applies the correct mode when VÀO NGHÊNH CHIẾN creates a stage.
const h16ResumeBase=resumeGame;resumeGame=function(){const r=h16ResumeBase();if(state&&h16IsMobileControl())state.h16FireMode='auto';h16UpdateFireModeUI();return r;};
window.addEventListener('resize',()=>{if(h16IsMobileControl()&&state)state.h16FireMode='auto';h16UpdateFireModeUI();},{passive:true});

// Current build version for PWA update checks and leaderboard records.
g2IsNewer=function(v,cur=H15_VERSION){const a=g2VerParts(v),b=g2VerParts(cur);for(let i=0;i<Math.max(a.length,b.length);i++){if((a[i]||0)!==(b[i]||0))return(a[i]||0)>(b[i]||0)}return false;};
h16UpdateFireModeUI();

h1RefreshMap();h15PlaceMapPreview(a1SelectedStage);g1RefreshInstallUI();g1RefreshUpdateUI();

/* === v3.7.0 H1 · REAL MOBILE AUTO TARGET/FIRE + PC LIVE MODE + NPC COUNTERFIRE + ITEM/HIT REPAIR === */
const H17_VERSION='3.7.0';
function h17IsMobileGameplay(){
  const ua=navigator.userAgent||'', uaMobile=!!navigator.userAgentData?.mobile || /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(ua);
  const touch=Number(navigator.maxTouchPoints||0)>0;
  let smallScreen=false;try{smallScreen=Math.min(screen.width||innerWidth,screen.height||innerHeight)<900}catch{smallScreen=Math.min(innerWidth,innerHeight)<900}
  return uaMobile || (touch&&smallScreen) || (touch&&Math.min(innerWidth,innerHeight)<700);
}
// Real phones/tablets are always AUTO even when a browser reports a mouse/fine pointer in landscape/PWA mode.
h16IsMobileControl=h17IsMobileGameplay;

const h17NewStateBase=newState;
newState=function(stageIndex=0){
  const s=h17NewStateBase(stageIndex);s.h17NpcShots=[];s.h17DamageIFrame=0;s.h17PlayerHitFx=null;s.h17LastAutoShotAt=0;
  if(h17IsMobileGameplay())s.h16FireMode='auto';return s;
};

// Faster NPC pressure, but only a moderate step above v3.6 so motion remains readable.
const h17SpeedTargetBase=d1SpeedTarget;
d1SpeedTarget=function(diff=state?.difficulty||'normal',stage=state?.stageIndex||0){return h17SpeedTargetBase(diff,stage)*1.18;};

function h17ShooterChance(type){
  return ({spitter:.95,flyer:.62,elite:.70,support:.58,nucleus:.40,flagella:.28,shield:.18,basic:.08,zigzag:.12,sprinter:.14,dodger:.12,arc:.10}[type]||0);
}
const h17SpawnEnemyBase=spawnEnemy;
spawnEnemy=function(type,boss=false){
  const e=h17SpawnEnemyBase(type,boss);if(!e||boss)return e;
  const diff=state?.difficulty||'normal',scale=diff==='easy'?.62:diff==='hard'?1:.82;
  e.h17Ranged=!e.bossSummoned&&Math.random()<h17ShooterChance(type)*scale;
  e.h17ShotCooldown=2.4+Math.random()*2.2;e.h17ShotWarn=0;e.h17ShotQueued=false;e.h17ThreatPulse=0;return e;
};
function h17MaxNpcShots(){const mobile=h17IsMobileGameplay(),diff=state?.difficulty||'normal';return diff==='hard'?(mobile?3:3):(mobile?2:3);}
function h17NpcShotDamage(){const diff=state?.difficulty||'normal';return diff==='easy'?.07:diff==='hard'?.12:.09;}
function h17NpcWarnSeconds(){const diff=state?.difficulty||'normal';return diff==='easy'?.60:diff==='hard'?.44:.52;}
function h17LaunchNpcShot(e){
  if(!state||!e||e.dead||e.boss||state.transition>0)return;const s=enemyScreen(e),tx=playerScreenX(),ty=innerHeight*.76,dx=tx-s.x,dy=ty-s.y,l=Math.hypot(dx,dy)||1;
  const speed=150+(state.difficulty==='hard'?16:state.difficulty==='easy'?-8:0),life=Math.max(.62,l/speed);
  state.h17NpcShots.push({x:s.x,y:s.y,px:s.x,py:s.y,vx:dx/l*speed,vy:dy/l*speed,t:0,life,r:2.2,damage:h17NpcShotDamage(),targetPlayerX:state.playerX,color:'#dc83ff',dead:false,sourceX:s.x});
  e.h17ThreatPulse=.38;
}
function h17UpdateNpcCounterfire(dt){
  if(!state||state.mode!=='playing'||state.transition>0)return;state.h17DamageIFrame=Math.max(0,(state.h17DamageIFrame||0)-dt);
  const shots=state.h17NpcShots||(state.h17NpcShots=[]),cap=h17MaxNpcShots();
  if(!state.bossIntro){
    const candidates=state.enemies.filter(e=>!e.dead&&!e.boss&&!e.bossSummoned&&e.h17Ranged&&e.depth<.76&&e.depth>.10).sort((a,b)=>a.depth-b.depth);
    let pending=candidates.filter(e=>e.h17ShotWarn>0||e.h17ShotQueued).length+shots.filter(s=>!s.dead).length;
    for(const e of candidates){
      e.h17ThreatPulse=Math.max(0,(e.h17ThreatPulse||0)-dt);e.h17ShotCooldown=(e.h17ShotCooldown||0)-dt;
      if(e.h17ShotWarn>0){e.h17ShotWarn-=dt;if(e.h17ShotWarn<=0&&e.h17ShotQueued){e.h17ShotQueued=false;h17LaunchNpcShot(e);e.h17ShotCooldown=3.1+Math.random()*2.4;pending++;}continue;}
      if(e.h17ShotCooldown<=0&&pending<cap){e.h17ShotWarn=h17NpcWarnSeconds();e.h17ShotQueued=true;e.h17ShotCooldown=99;pending++;}
    }
  }
  for(const sh of shots){
    if(sh.dead)continue;sh.t+=dt;sh.px=sh.x;sh.py=sh.y;sh.x+=sh.vx*dt;sh.y+=sh.vy*dt;
    if(sh.t>=sh.life){
      const hitRadius=Math.max(28,Math.min(52,innerWidth*.032));
      if(Math.abs(playerScreenX()-playerScreenX(sh.targetPlayerX))<hitRadius){state.h17IncomingHit=true;state.h17IncomingFromX=sh.sourceX;damagePlayer(sh.damage);state.h17IncomingHit=false;}
      else state.score+=3;sh.dead=true;
    }
  }
  state.h17NpcShots=shots.filter(s=>!s.dead&&s.t<s.life+.2);
}

// Tiny counterfire has a short damage grace window so overlapping low-damage bullets never melt the player.
const h17DamagePlayerBase=damagePlayer;
damagePlayer=function(amount){
  if(!state)return;if(state.h17IncomingHit){
    if((state.h17DamageIFrame||0)>0)return;let dmg=Math.max(0,Number(amount)||0),shielded=state.shield>0;if(shielded)dmg*=.35;
    const before=state.health;state.health=Math.max(0,state.health-dmg);if(state.health<before){state.h17DamageIFrame=.34;state.shake=Math.max(state.shake||0,.055);state.h17PlayerHitFx={start:performance.now(),dur:360,fromX:state.h17IncomingFromX||gameplayViewport().center,shielded};tone(shielded?690:210,.045,'triangle',.010,shielded?110:-55,0,.03);try{navigator.vibrate?.(10)}catch{}}
    if(state.health<=0){state.mode='over';show(UI.over);}return;
  }
  return h17DamagePlayerBase(amount);
};

// Mobile AUTO target hierarchy: manual tap lock > current sticky target > ranged threat > closest dangerous NPC > Boss > SUPPLY.
function h17ThreatScore(e){
  const shooter=e.h17Ranged?120:0,warning=e.h17ShotWarn>0?220:0,fast=(e.g1Motion==='sprinter'||e.type==='charger'||e.type==='sprinter')?70:0,support=e.base?.support?65:0,close=(1-clamp(e.depth,0,1))*180;return warning+shooter+fast+support+close;
}
const h17ChooseAutoTargetBase=h16ChooseAutoTarget;
h16ChooseAutoTarget=function(){
  if(!state)return null;const manual=h16ResolveTarget(state.h16ManualLock);if(manual)return manual;if(state.h16ManualLock)state.h16ManualLock=null;
  if(h17IsMobileGameplay()){
    let sticky=h16ResolveTarget(state.h16AutoTarget);
    const minors=(state.enemies||[]).filter(e=>!e.dead&&!e.boss).sort((a,b)=>h17ThreatScore(b)-h17ThreatScore(a));
    if(sticky&&sticky.kind==='enemy'&&!sticky.entity.dead){const best=minors[0];if(!best||best.id===sticky.entity.id||h17ThreatScore(best)<h17ThreatScore(sticky.entity)+145)return sticky;}
    if(minors[0]){state.h16AutoTarget=h16TargetRef('enemy',minors[0]);return h16ResolveTarget(state.h16AutoTarget);}
    const boss=(state.enemies||[]).find(e=>!e.dead&&e.boss);if(boss){state.h16AutoTarget=h16TargetRef('enemy',boss);return h16ResolveTarget(state.h16AutoTarget);}
    const supply=(state.rewardNpcs||[]).filter(n=>!n.dead).sort((a,b)=>a.life-b.life)[0];if(supply){state.h16AutoTarget=h16TargetRef('reward',supply);return h16ResolveTarget(state.h16AutoTarget);}
    state.h16AutoTarget=null;return null;
  }
  return h17ChooseAutoTargetBase();
};
// No post-briefing dead time on mobile: once gameplay begins it immediately selects a target and fires.
h16AutoFireTick=function(){
  if(!state||state.mode!=='playing'||state.transition>0||h16CurrentFireMode()!=='auto'||state.bossIntro>0)return;const t=h16ChooseAutoTarget();if(!t)return;
  const s=t.screen|| (t.kind==='reward'?rewardNpcScreen(t.entity):enemyScreen(t.entity));if(!s)return;pointer.x=s.x;pointer.y=s.y;
  const w=WEAPONS[state.weapon],now=performance.now();if(w.kind==='bomb'&&now-(state.h16AutoBombAt||0)<1450)return;
  const before=state.lastFire;state.h16AutoShot=true;try{shoot(s.x,s.y)}finally{state.h16AutoShot=false;}
  if(state.lastFire!==before){state.h17LastAutoShotAt=now;weaponSingleFlashUntil=now+420;if(w.kind==='bomb')state.h16AutoBombAt=now;}
};

// Capture AUTO taps before the legacy manual pointer handler: power-up tap uses the item; NPC/Boss tap only locks target.
canvas.addEventListener('pointerdown',e=>{
  if(!state||state.mode!=='playing'||h16CurrentFireMode()!=='auto')return;const p=pointerPos(e);pointer.x=p.x;pointer.y=p.y;ensureAudio();
  if(collectPowerups(p.x,p.y)){state.lastFire=performance.now();e.preventDefault();e.stopImmediatePropagation();return;}
  const target=h16TargetAt(p.x,p.y);if(target){h16LockTarget(target);e.preventDefault();e.stopImmediatePropagation();}
},true);

// Ensure every ordinary support item has both a gameplay function and a fresh weapon-monitor effect.
const h17CollectPowerupsBase=collectPowerups;
collectPowerups=function(x,y){
  const p=state?.powerups?.find(o=>!o.dead&&Math.hypot(x-o.x,y-o.y)<48),kind=p?.kind,before=state?{health:state.health,shield:state.shield,drone:state.drone,adrenaline:state.adrenaline,vaccine:state.vaccine,sterile:state.sterile,gppBoost:state.gppBoost}:null;
  const ok=h17CollectPowerupsBase(x,y);if(!ok||!state||!kind)return ok;
  // Repair guards: guarantee the intended minimum effect even if an older override did not extend it.
  if(kind==='heal')state.health=Math.min(state.maxHealth||10,Math.max(state.health,(before?.health||0)+2));
  if(kind==='shield')state.shield=Math.max(state.shield||0,12);
  if(kind==='drone')state.drone=Math.max(state.drone||0,10);
  if(kind==='adrenaline')state.adrenaline=Math.max(state.adrenaline||0,5);
  if(kind==='vaccine')state.vaccine=Math.max(state.vaccine||0,7);
  if(kind==='sterile')state.sterile=Math.max(state.sterile||0,6);
  if(kind==='gpp'){state.shield=Math.max(state.shield||0,12);state.drone=Math.max(state.drone||0,10);state.adrenaline=Math.max(state.adrenaline||0,5);state.vaccine=Math.max(state.vaccine||0,7);state.sterile=Math.max(state.sterile||0,6);state.gppBoost=Math.max(state.gppBoost||0,8);}
  g2SetWeaponScreenFx(kind,kind==='heal'?1700:2200);state._supportHudKey='';updateHUD();return true;
};

function h17DrawNpcCounterfire(t){
  if(!state)return;ctx.save();ctx.beginPath();const v=gameplayViewport();ctx.rect(v.left,0,v.width,innerHeight);ctx.clip();
  for(const e of state.enemies){if(e.dead||e.boss||!e.h17Ranged)continue;const s=enemyScreen(e);if(e.h17ShotWarn>0){const q=1-clamp(e.h17ShotWarn/h17NpcWarnSeconds(),0,1),pulse=.55+.45*Math.sin(t*.025);ctx.globalCompositeOperation='screen';ctx.globalAlpha=.25+.35*q;ctx.strokeStyle='#ff9fe8';ctx.lineWidth=1.3+q;ctx.shadowColor='#ff6ed7';ctx.shadowBlur=9;ctx.beginPath();ctx.arc(s.x,s.y,s.r*(1.10+.18*q),0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle=`rgba(255,220,245,${.55+.3*pulse})`;ctx.font=`900 ${Math.max(7,Math.min(12,s.r*.17))}px system-ui`;ctx.textAlign='center';ctx.fillText('⚠ PHẢN KÍCH',s.x,s.y-s.r*1.24);}}
  for(const sh of state.h17NpcShots||[]){const a=clamp(1-sh.t/sh.life,0,1);ctx.globalCompositeOperation='screen';ctx.globalAlpha=.80*a+.16;ctx.strokeStyle='#e59bff';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(sh.px,sh.py);ctx.lineTo(sh.x,sh.y);ctx.stroke();ctx.fillStyle='#fff0ff';ctx.shadowColor='#ce65ff';ctx.shadowBlur=7;ctx.beginPath();ctx.arc(sh.x,sh.y,Math.max(1.5,sh.r),0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
  ctx.restore();
}
function h17DrawPlayerHitFx(t){
  const f=state?.h17PlayerHitFx;if(!f)return;const q=clamp((t-f.start)/f.dur,0,1);if(q>=1){state.h17PlayerHitFx=null;return;}const v=gameplayViewport(),cx=playerScreenX(),cy=innerHeight*.70,side=f.fromX<cx?-1:1,col=f.shielded?'#8cf5ff':'#ff8fa3';ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=(1-q)*.55;ctx.strokeStyle=col;ctx.lineWidth=2.5;ctx.shadowColor=col;ctx.shadowBlur=12;ctx.beginPath();ctx.arc(cx,cy,32+q*34,side<0?Math.PI*.55:-Math.PI*.45,side<0?Math.PI*1.45:Math.PI*.45);ctx.stroke();ctx.shadowBlur=0;for(let i=0;i<5;i++){const yy=innerHeight*(.30+i*.095),x=side<0?v.left+5:v.left+v.width-5;ctx.globalAlpha=(1-q)*(.17+i*.025);ctx.fillStyle=col;ctx.fillRect(side<0?x:x-4,yy,4,22);}ctx.restore();
}
const h17DrawTargetLockBase=h16DrawTargetLock;
h16DrawTargetLock=function(t){h17DrawTargetLockBase(t);if(!state||h16CurrentFireMode()!=='auto')return;const tar=h16ResolveTarget(state.h16ManualLock)||h16ResolveTarget(state.h16AutoTarget);if(!tar||tar.kind!=='enemy'||!tar.entity.h17Ranged)return;const s=tar.screen||enemyScreen(tar.entity);ctx.save();ctx.globalCompositeOperation='screen';ctx.fillStyle='#ff9fe8';ctx.font=`1000 ${Math.max(8,Math.min(13,s.r*.18))}px system-ui`;ctx.textAlign='center';ctx.fillText('↯ PHẢN KÍCH',s.x,s.y+s.r*1.47);ctx.restore();};

const h17CombatCleanupBase=h1CombatCleanup;
h1CombatCleanup=function(){if(state){if(state.h17NpcShots)state.h17NpcShots.length=0;state.h17PlayerHitFx=null;state.h17DamageIFrame=0;for(const e of state.enemies||[]){e.h17ShotWarn=0;e.h17ShotQueued=false;}}return h17CombatCleanupBase();};

const h17UpdateBase=update;
update=function(dt){h17UpdateBase(dt);if(state?.mode==='playing')h17UpdateNpcCounterfire(dt);};
const h17RenderBase=render;
render=function(t){h17RenderBase(t);h17DrawNpcCounterfire(t);h17DrawPlayerHitFx(t);};

// Keep live PC mode buttons synced and force true mobile state after orientation/resume changes.
const h17UpdateFireModeUIBase=h16UpdateFireModeUI;
h16UpdateFireModeUI=function(){h17UpdateFireModeUIBase();const mode=h16CurrentFireMode();for(const b of document.querySelectorAll('#gameFireModeBlock [data-fire-mode]'))b.classList.toggle('active',b.dataset.fireMode===mode);const hud=$('#fireModeHud');if(hud&&h17IsMobileGameplay())hud.textContent='⚡ AUTO · TỰ CHỌN MỤC TIÊU · CHẠM ĐỂ KHÓA';};
function h17ForceMobileAuto(){if(!h17IsMobileGameplay())return;if(state){state.h16FireMode='auto';state.h16AutoTarget=null;}h16PreferredFireMode='auto';h16UpdateFireModeUI();}
window.addEventListener('orientationchange',()=>setTimeout(h17ForceMobileAuto,80),{passive:true});window.addEventListener('pageshow',h17ForceMobileAuto,{passive:true});
const h17ResumeBase=resumeGame;resumeGame=function(){const r=h17ResumeBase();h17ForceMobileAuto();return r;};

// Update build comparison and UI now that v3.7 is active.
g2IsNewer=function(v,cur=H17_VERSION){const a=g2VerParts(v),b=g2VerParts(cur);for(let i=0;i<Math.max(a.length,b.length);i++){if((a[i]||0)!==(b[i]||0))return(a[i]||0)>(b[i]||0)}return false;};
h16UpdateFireModeUI();g1RefreshInstallUI();g1RefreshUpdateUI();

/* === v3.8.0 H1 · CONTROL SIDE + ITEM GUARANTEE + END-RESULT LEADERBOARD PREVIEW === */
const H18_VERSION='3.9.0',H18_CONTROL_SIDE_KEY='bstq-h18-mobile-control-side-v1';
let h18PendingShare=null,h18PreviewOnly=false;
function h18ReadControlSide(){try{return localStorage.getItem(H18_CONTROL_SIDE_KEY)==='right'?'right':'left'}catch{return'left'}}
let h18ControlSide=h18ReadControlSide();
function h18ApplyControlSide(side,{persist=true,announce=false}={}){
  h18ControlSide=side==='right'?'right':'left';document.documentElement.dataset.mobileControls=h18ControlSide;
  if(persist){try{localStorage.setItem(H18_CONTROL_SIDE_KEY,h18ControlSide)}catch{}}
  for(const b of document.querySelectorAll('[data-mobile-control-side]'))b.classList.toggle('active',b.dataset.mobileControlSide===h18ControlSide);
  try{releaseMovePad()}catch{}
  if(announce&&state?.mode==='playing')toast(`🕹 ĐIỀU KHIỂN · ${h18ControlSide==='right'?'BÊN PHẢI':'BÊN TRÁI'}`,1.0);
}
for(const b of document.querySelectorAll('[data-mobile-control-side]'))b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();h18ApplyControlSide(b.dataset.mobileControlSide,{announce:true});});
h18ApplyControlSide(h18ControlSide,{persist:false});
window.addEventListener('orientationchange',()=>setTimeout(()=>h18ApplyControlSide(h18ControlSide,{persist:false}),100),{passive:true});
window.addEventListener('pageshow',()=>h18ApplyControlSide(h18ControlSide,{persist:false}),{passive:true});

// Always expose the exact running build on the main menu.
function h18RefreshVersion(){const v=$('#menuVersion'),b=$('#menuVersionBadge');if(v)v.textContent=`PHIÊN BẢN · v${H18_VERSION} H1`;if(b)b.textContent=`v${H18_VERSION} H1`;document.title=`Bác Sĩ Truy Quét · TRƯỜNG GPP · v${H18_VERSION} H1`;}
h18RefreshVersion();

// Final ordinary-item guarantee. Every pickup must change real gameplay state AND refresh its monitor/expanded FX.
const h18CollectPowerupsBase=collectPowerups;
collectPowerups=function(x,y){
  const p=state?.powerups?.find(o=>!o.dead&&Math.hypot(x-o.x,y-o.y)<48),kind=p?.kind,before=state?{health:state.health,shield:state.shield,drone:state.drone,adrenaline:state.adrenaline,vaccine:state.vaccine,sterile:state.sterile,gppBoost:state.gppBoost}:null;
  const ok=h18CollectPowerupsBase(x,y);if(!ok||!state||!kind)return ok;const max=state.maxHealth||10;
  if(kind==='heal')state.health=Math.min(max,Math.max(state.health,(before?.health||0)+2));
  else if(kind==='shield')state.shield=Math.max(state.shield||0,12);
  else if(kind==='drone')state.drone=Math.max(state.drone||0,10);
  else if(kind==='adrenaline')state.adrenaline=Math.max(state.adrenaline||0,5);
  else if(kind==='vaccine')state.vaccine=Math.max(state.vaccine||0,7);
  else if(kind==='sterile')state.sterile=Math.max(state.sterile||0,6);
  else if(kind==='gpp'){
    state.health=Math.min(max,Math.max(state.health,(before?.health||0)+2));state.shield=Math.max(state.shield||0,12);state.drone=Math.max(state.drone||0,10);state.adrenaline=Math.max(state.adrenaline||0,5);state.vaccine=Math.max(state.vaccine||0,7);state.sterile=Math.max(state.sterile||0,6);state.gppBoost=Math.max(state.gppBoost||0,8);
  }
  g2SetWeaponScreenFx(kind,kind==='heal'?1800:2300);state.h1FxKind=kind;state.h1FxStart=performance.now();state.h1FxBurstUntil=performance.now()+2300;state._supportHudKey='';updateHUD();return true;
};

function h18ScoreRecord(){if(!state)return null;const acc=state.shots?Math.round(state.hits/state.shots*100):100,rank=rankFor(acc,state.health,state.stageElapsed),bossSeconds=Math.max(0,state.stageElapsed-G1_BOSS_TIME);return{score:Math.round(state.score),stage:state.stageIndex,difficulty:state.difficulty,rank,accuracy:acc,bossSeconds:Math.round(bossSeconds*10)/10,version:H18_VERSION,__preview:true};}
function h18PreviewMatches(rec){const f=h15CurrentFilters();return !!rec&&rec.difficulty===f.difficulty&&(f.stage==='all'||String(rec.stage)===String(f.stage));}
function h18DiffLabel(d){return d==='easy'?'DỄ':d==='hard'?'KHÓ':'TRUNG BÌNH';}
function h18RenderCurrentResult(position,total){const box=$('#leaderboardCurrentResult');if(!box)return;if(!h18PendingShare){box.classList.add('hidden');box.replaceChildren();return;}box.classList.remove('hidden');const pos=Number.isFinite(position)?`#${position}`:'—';box.innerHTML=`<div><b>ĐIỂM VỪA ĐẠT</b><span>Màn ${h18PendingShare.stage+1} · ${h18DiffLabel(h18PendingShare.difficulty)} · ${h18PendingShare.rank}</span></div><div><strong>${Number(h18PendingShare.score).toLocaleString('vi-VN')}</strong><em>${pos} TẠM TÍNH</em></div>`;}
const h18LeaderRowsBase=h15RenderLeaderRows;
h15RenderLeaderRows=function(entries){
  const box=$('#leaderboardList');if(!box)return;let all=[...(Array.isArray(entries)?entries:[])],preview=h18PreviewMatches(h18PendingShare)?{...h18PendingShare,name:'BẠN · CHƯA CÔNG KHAI',__preview:true}:null;
  if(preview)all.push(preview);all.sort((a,b)=>Number(b.score)-Number(a.score)||Number(a.bossSeconds||999)-Number(b.bossSeconds||999));const pidx=preview?all.indexOf(preview):-1;h18RenderCurrentResult(pidx>=0?pidx+1:null,all.length);
  let list=all.slice(0,30);if(preview&&pidx>=30){list=all.slice(0,29);list.push(preview);}box.replaceChildren();if(!list.length){const e=document.createElement('div');e.className='h15-leader-row';e.textContent='Chưa có thành tích ở mục này.';box.appendChild(e);return;}
  for(const r of list){const actual=all.indexOf(r),row=document.createElement('div');row.className='h15-leader-row'+(actual<3?' top3':'')+(r.__preview?' h18-you-preview':'');const pos=document.createElement('span');pos.className='pos';pos.textContent=actual===0?'🥇':actual===1?'🥈':actual===2?'🥉':`#${actual+1}`;const who=document.createElement('span');who.className='who';const b=document.createElement('b');b.textContent=r.__preview?'BẠN · CHƯA CÔNG KHAI':h15SafeName(r.name);if(r.__preview){const tag=document.createElement('i');tag.className='h18-preview-tag';tag.textContent='XEM TRƯỚC';b.appendChild(tag);}const sm=document.createElement('small');sm.textContent=`Màn ${Number(r.stage)+1} · ${h18DiffLabel(r.difficulty||'normal')}`;who.append(b,sm);const sc=document.createElement('span');sc.className='score';sc.textContent=Number(r.score||0).toLocaleString('vi-VN');const rk=document.createElement('span');rk.className='rank';rk.textContent=r.rank||'A';row.append(pos,who,sc,rk);box.appendChild(row);}
};
function h18PrepareEndLeaderboard(){
  const rec=h18ScoreRecord();if(!rec)return;h18PendingShare=rec;h18PreviewOnly=false;h15PendingRecord={...rec};const d=$('#leaderboardDifficulty'),s=$('#leaderboardStage');if(d)d.value=rec.difficulty;if(s)s.value=String(rec.stage);const resultBtn=state?.cfg?.final?$('#victoryLeaderboardRecordBtn'):$('#leaderboardRecordBtn');if(resultBtn){resultBtn.textContent='🏆 XEM BXH / KHOE THÀNH TÍCH';resultBtn.classList.remove('hidden');}const hint=$('#leaderboardShareHint');if(hint)hint.textContent=H15_LB_ENDPOINT?'Điểm của bạn đang nằm thử đúng vị trí. Chỉ khi bấm KHOE THÀNH TÍCH mới gửi lên bảng online.':'Điểm của bạn đang nằm thử đúng vị trí. Chưa có máy chủ online: bấm KHOE sẽ lưu trên thiết bị này; CHỈ XEM sẽ không lưu.';show($('#leaderboardRecordPrompt'));h15OpenLeaderboard(true);
}
const h18StageCompleteBase=stageCompletePanel;
stageCompletePanel=function(){h18StageCompleteBase();setTimeout(h18PrepareEndLeaderboard,120);};

$('#leaderboardShareBtn')?.addEventListener('click',async()=>{
  if(!h18PendingShare)return;const rec={...h18PendingShare,name:h15SafeName($('#leaderboardName')?.value),createdAt:new Date().toISOString(),version:H18_VERSION};delete rec.__preview;let online=false;
  if(H15_LB_ENDPOINT){try{const r=await fetch(H15_LB_ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(rec)});online=r.ok;}catch{}}
  h15StoreLocalScore(rec);h18PendingShare=null;h15PendingRecord=null;h18PreviewOnly=false;$('#leaderboardRecordPrompt')?.classList.add('hidden');const rb=state?.cfg?.final?$('#victoryLeaderboardRecordBtn'):$('#leaderboardRecordBtn');if(rb){rb.textContent='🏆 XEM BẢNG XẾP HẠNG';rb.classList.remove('hidden');}toast(online?'🏆 ĐÃ KHOE THÀNH TÍCH TRÊN BẢNG ONLINE!':'🏆 ĐÃ LƯU THÀNH TÍCH TRÊN THIẾT BỊ!',1.45);h15RefreshLeaderboard();
});
$('#leaderboardSkipShareBtn')?.addEventListener('click',()=>{if(!h18PendingShare)return;h18PreviewOnly=true;h15PendingRecord=null;$('#leaderboardRecordPrompt')?.classList.add('hidden');const rb=state?.cfg?.final?$('#victoryLeaderboardRecordBtn'):$('#leaderboardRecordBtn');if(rb){rb.textContent='🏆 XEM BẢNG XẾP HẠNG';rb.classList.remove('hidden');}toast('👀 CHỈ XEM · THÀNH TÍCH CHƯA ĐƯỢC CÔNG KHAI',1.1);h15RefreshLeaderboard();});

// A new round clears the previous unsaved preview; saved scores remain untouched.
const h18NewStateBase=newState;
newState=function(stageIndex=0){const s=h18NewStateBase(stageIndex);h18PendingShare=null;h18PreviewOnly=false;h15PendingRecord=null;$('#leaderboardCurrentResult')?.classList.add('hidden');return s;};

// PC live mode selector remains visible in the right combat rail; mobile remains AUTO-only.
const h18UpdateFireModeUIBase=h16UpdateFireModeUI;
h16UpdateFireModeUI=function(){h18UpdateFireModeUIBase();const block=$('#gameFireModeBlock');if(block)block.classList.toggle('hidden',h17IsMobileGameplay());for(const b of document.querySelectorAll('#gameFireModeBlock [data-fire-mode]'))b.classList.toggle('active',b.dataset.fireMode===h16CurrentFireMode());};

// Version/update comparison uses this build.
g2IsNewer=function(v,cur=H18_VERSION){const a=g2VerParts(v),b=g2VerParts(cur);for(let i=0;i<Math.max(a.length,b.length);i++){if((a[i]||0)!==(b[i]||0))return(a[i]||0)>(b[i]||0)}return false;};
h18ApplyControlSide(h18ControlSide,{persist:false});h18RefreshVersion();h16UpdateFireModeUI();g1RefreshInstallUI();g1RefreshUpdateUI();


/* === v3.9.0 J1 FINAL · NPC visibility · gameplay-only fire mode · 3s item queue · balanced UI/footer === */
const J1_VERSION='3.9.0';
const J1_ITEM_DELAY_MS=3000;

function j1RefreshVersion(){
  const v=$('#menuVersion'),b=$('#menuVersionBadge');
  if(v)v.textContent=`PHIÊN BẢN · v${J1_VERSION} J1`;
  if(b)b.textContent=`v${J1_VERSION} J1`;
  document.title=`Bác Sĩ Truy Quét · TRƯỜNG GPP · v${J1_VERSION} J1`;
}

// Fire-mode controls are a gameplay control only. Mobile is always AUTO.
const j1UpdateFireModeUIBase=h16UpdateFireModeUI;
h16UpdateFireModeUI=function(){
  j1UpdateFireModeUIBase();
  const mobile=h17IsMobileGameplay(),mode=h16CurrentFireMode(),playing=state?.mode==='playing';
  const block=$('#gameFireModeBlock');if(block){block.classList.toggle('hidden',mobile||!playing);block.style.display=(!mobile&&playing)?'grid':'none';}
  for(const b of document.querySelectorAll('#gameFireModeBlock [data-fire-mode]'))b.classList.toggle('active',b.dataset.fireMode===mode);
  const hud=$('#fireModeHud');if(hud){hud.classList.toggle('hidden',!playing);hud.textContent=mobile?'⚡ AUTO · TỰ CHỌN MỤC TIÊU · CHẠM ĐỂ KHÓA':mode==='auto'?'⚡ AUTO · CLICK ĐỂ KHÓA':'🎯 THỦ CÔNG · CHUỘT NGẮM/BẮN';}
};

// NPC must enter a readable part of the corridor before AUTO can shoot it.
function j1EnemyReadable(e){
  if(!e||e.dead)return false;if(e.boss)return true;
  const sc=enemyScreen(e),v=gameplayViewport();
  const depthGate=state?.difficulty==='hard'?.89:state?.difficulty==='easy'?.84:.865;
  return e.depth<=depthGate && sc.r>=7 && sc.x>=v.left-12 && sc.x<=v.left+v.width+12 && sc.y>=innerHeight*.36 && sc.y<=innerHeight*.91;
}
function j1ThreatScore(e){
  const shooter=e.h17Ranged?120:0,warning=e.h17ShotWarn>0?220:0,fast=(e.g1Motion==='sprinter'||e.type==='charger'||e.type==='sprinter')?70:0,support=e.base?.support?65:0,close=(1-clamp(e.depth,0,1))*180;
  return warning+shooter+fast+support+close;
}
h16ChooseAutoTarget=function(){
  if(!state)return null;
  const manual=h16ResolveTarget(state.h16ManualLock);if(manual)return manual;if(state.h16ManualLock)state.h16ManualLock=null;
  let sticky=h16ResolveTarget(state.h16AutoTarget);
  if(sticky?.kind==='enemy'&&!j1EnemyReadable(sticky.entity)&&!sticky.entity.boss)sticky=null;
  if(sticky?.kind==='reward')return sticky;
  const minors=(state.enemies||[]).filter(e=>!e.dead&&!e.boss&&j1EnemyReadable(e)).sort((a,b)=>j1ThreatScore(b)-j1ThreatScore(a)||a.depth-b.depth);
  if(sticky?.kind==='enemy'&&sticky.entity&&!sticky.entity.dead){const best=minors[0];if(!best||best.id===sticky.entity.id||j1ThreatScore(best)<j1ThreatScore(sticky.entity)+145)return sticky;}
  if(minors[0]){state.h16AutoTarget=h16TargetRef('enemy',minors[0]);return h16ResolveTarget(state.h16AutoTarget);}
  const boss=(state.enemies||[]).find(e=>!e.dead&&e.boss);if(boss){state.h16AutoTarget=h16TargetRef('enemy',boss);return h16ResolveTarget(state.h16AutoTarget);}
  const supply=(state.rewardNpcs||[]).filter(n=>!n.dead).sort((a,b)=>a.life-b.life)[0];if(supply){state.h16AutoTarget=h16TargetRef('reward',supply);return h16ResolveTarget(state.h16AutoTarget);}
  state.h16AutoTarget=null;return null;
};

// Pending support queue: pickup first, activate manually or automatically after 3 seconds.
function j1ItemMeta(kind){
  if(kind==='heal')return{icon:'❤️',name:'SINH TỒN +2'};
  const m=SUPPORT_ITEMS[kind];return{icon:kind==='gpp'?'✨':(m?.icon||'🎁'),name:m?.name||String(kind||'VẬT PHẨM').toUpperCase()};
}
function j1CanActivate(kind){
  if(!state)return false;const max=state.maxHealth||10;
  if(kind==='heal')return state.health<max;
  if(kind==='shield')return (state.shield||0)<12;
  if(kind==='drone')return (state.drone||0)<15;
  if(kind==='adrenaline')return (state.adrenaline||0)<8;
  if(kind==='vaccine')return (state.vaccine||0)<11;
  if(kind==='sterile')return (state.sterile||0)<10;
  if(kind==='gpp')return state.health<max||(state.shield||0)<12||(state.drone||0)<15||(state.adrenaline||0)<8||(state.vaccine||0)<11||(state.sterile||0)<10||(state.gppBoost||0)<12;
  return true;
}
function j1ApplyItem(kind){
  if(!state||!j1CanActivate(kind))return false;const max=state.maxHealth||10;
  if(kind==='heal'){state.health=Math.min(max,state.health+2);toast('❤️ +2 SINH TỒN',1);sfx.power();}
  else if(kind==='shield'){supportExtend('shield',12,12);toast('🛡 KHIÊN KHỬ NHIỄM · 12s',1);sfx.power();}
  else if(kind==='drone'){supportExtend('drone',10,15);toast('🤖 DRONE Y TẾ · 10s',1);sfx.power();}
  else if(kind==='adrenaline'){supportExtend('adrenaline',5,8);toast('💉 ADRENALINE · 5s',1);sfx.power();}
  else if(kind==='vaccine'){supportExtend('vaccine',7,11);toast('🧬 VACCINE BOOST · 7s',1);sfx.power();}
  else if(kind==='sterile'){supportExtend('sterile',6,10);toast('🧴 STERILE FIELD · 6s',1);sfx.power();}
  else if(kind==='gpp'){
    supportExtend('gppBoost',8,12);state.health=Math.min(max,state.health+2);state.shield=Math.max(state.shield||0,12);state.drone=Math.max(state.drone||0,10);state.adrenaline=Math.max(state.adrenaline||0,5);state.vaccine=Math.max(state.vaccine||0,7);state.sterile=Math.max(state.sterile||0,6);toast('✨ TRƯỜNG GPP TỔNG HỢP · KÍCH HOẠT',1.3);sfx.gpp();
  }
  g2SetWeaponScreenFx(kind,kind==='heal'?1800:2300);state.h1FxKind=kind;state.h1FxStart=performance.now();state.h1FxBurstUntil=performance.now()+2300;state._supportHudKey='';updateHUD();return true;
}
function j1QueueItem(kind){
  if(!state)return false;if(!Array.isArray(state.j1PendingItems))state.j1PendingItems=[];
  const now=performance.now(),id=++state.j1PendingSerial;state.j1PendingItems.push({id,kind,pickedAt:now,dueAt:now+J1_ITEM_DELAY_MS});
  const m=j1ItemMeta(kind);toast(`${m.icon} ${m.name} · TỰ KÍCH HOẠT SAU 3 GIÂY`,1.05);sfx.power();j1RenderPendingItems();return true;
}
function j1ActivatePending(id,manual=false){
  if(!state||!Array.isArray(state.j1PendingItems))return false;const i=state.j1PendingItems.findIndex(x=>x.id===id);if(i<0)return false;const item=state.j1PendingItems[i];
  if(!j1CanActivate(item.kind)){if(manual)toast('⏳ CHƯA THỂ DÙNG · VẬT PHẨM ĐƯỢC GIỮ LẠI',.9);item.dueAt=performance.now()+650;return false;}
  if(!j1ApplyItem(item.kind))return false;state.j1PendingItems.splice(i,1);j1RenderPendingItems();return true;
}
function j1ProcessPending(){
  if(!state||state.mode!=='playing'||!Array.isArray(state.j1PendingItems)||!state.j1PendingItems.length)return;const now=performance.now();
  for(const item of [...state.j1PendingItems])if(now>=item.dueAt){if(!j1ActivatePending(item.id,false))item.dueAt=now+650;}
  if(now-(state.j1PendingLastRender||0)>90){state.j1PendingLastRender=now;j1RenderPendingItems();}
}
function j1RenderPendingItems(){
  if(!state)return;const list=state.j1PendingItems||[],now=performance.now(),desktop=$('#pendingItemList'),mobile=$('#mobilePendingStrip');
  const rows=list.map(it=>{const m=j1ItemMeta(it.kind),left=Math.max(0,(it.dueAt-now)/1000),pct=clamp((it.dueAt-now)/J1_ITEM_DELAY_MS*100,0,100),valid=j1CanActivate(it.kind);return`<button class="j1-pending-item ${valid?'waiting':'invalid'}" data-j1-pending="${it.id}" style="--j1-pct:${pct}%"><span class="icon">${m.icon}</span><b>${m.name}</b><strong>${valid?(left>0?left.toFixed(1)+'s':'DÙNG'):'ĐANG GIỮ'}</strong><i></i></button>`;}).join('');
  if(desktop)desktop.innerHTML=rows||'<div class="support-empty">CHƯA CÓ VẬT PHẨM CHỜ</div>';
  if(mobile)mobile.innerHTML=list.slice(0,4).map(it=>{const m=j1ItemMeta(it.kind),left=Math.max(0,(it.dueAt-now)/1000);return`<button data-j1-pending="${it.id}">${m.icon} ${j1CanActivate(it.kind)?(left>0?left.toFixed(1)+'s':'DÙNG'):'GIỮ'}</button>`;}).join('');
}
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-j1-pending]');if(!b)return;e.preventDefault();e.stopPropagation();j1ActivatePending(Number(b.dataset.j1Pending),true);},true);

// Replace the final direct-activation pickup handler with the J1 queue.
collectPowerups=function(x,y){
  if(!state)return false;const p=(state.powerups||[]).find(o=>!o.dead&&Math.hypot(x-o.x,y-o.y)<48);if(!p)return false;
  p.dead=true;j1QueueItem(p.kind);return true;
};

const j1NewStateBase=newState;
newState=function(stageIndex=0){const s=j1NewStateBase(stageIndex);s.j1PendingItems=[];s.j1PendingSerial=0;s.j1PendingLastRender=0;s.j1LastFireUiKey='';if(h17IsMobileGameplay())s.h16FireMode='auto';return s;};
const j1UpdateBase=update;
update=function(dt){j1UpdateBase(dt);j1ProcessPending();if(state?.mode==='playing'){const key=`${h17IsMobileGameplay()?'m':'d'}:${h16CurrentFireMode()}:${state.mode}`;if(state.j1LastFireUiKey!==key){state.j1LastFireUiKey=key;h16UpdateFireModeUI();}}};
const j1ResumeBase=resumeGame;
resumeGame=function(){const r=j1ResumeBase();if(state&&h17IsMobileGameplay())state.h16FireMode='auto';h16UpdateFireModeUI();return r;};
const j1PauseBase=pauseGame;
pauseGame=function(){const r=j1PauseBase();h16UpdateFireModeUI();return r;};

// Cleanup pending UI and keep author/footer from intercepting gameplay.
const j1CombatCleanupBase=h1CombatCleanup;
h1CombatCleanup=function(){if(state){state.j1PendingItems=[];state.j1PendingSerial=0;}j1RenderPendingItems();return j1CombatCleanupBase();};

g2IsNewer=function(v,cur=J1_VERSION){const a=g2VerParts(v),b=g2VerParts(cur);for(let i=0;i<Math.max(a.length,b.length);i++){if((a[i]||0)!==(b[i]||0))return(a[i]||0)>(b[i]||0)}return false;};
// Sync gameplay-only controls even when legacy button handlers hold older function references.
const j1PausePanel=$('#pausePanel');
if(j1PausePanel&&typeof MutationObserver!=='undefined'){new MutationObserver(()=>h16UpdateFireModeUI()).observe(j1PausePanel,{attributes:true,attributeFilter:['class']});}
$('#pauseBtn')?.addEventListener('click',()=>queueMicrotask(h16UpdateFireModeUI));
$('#resumeBtn')?.addEventListener('click',()=>queueMicrotask(h16UpdateFireModeUI));

j1RefreshVersion();h16UpdateFireModeUI();g1RefreshInstallUI();g1RefreshUpdateUI();

})();
