(() => {
'use strict';

const L1_VERSION='4.2.0';
const L1_BUILD='W1';

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

/* L1 consolidated: legacy newState implementation removed */

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

/* L1 consolidated: legacy spawnEnemy implementation removed */

/* L1 consolidated: legacy update implementation removed */

function fireEnemyShot(e){
  const s=enemyScreen(e),targetPlayerX=state.playerX,tx=playerScreenX(targetPlayerX),ty=innerHeight*.78;
  const dx=tx-s.x,dy=ty-s.y,l=Math.hypot(dx,dy)||1,speed=e.boss?135:112;
  state.enemyShots.push({x:s.x,y:s.y,vx:dx/l*speed,vy:dy/l*speed,t:0,life:Math.max(.62,l/speed),r:7,damage:e.boss?1.2:e.base.attack,color:e.boss?'#ff5477':'#9d63d8',targetPlayerX});
}

function damagePlayer(amount){
  if(!state||state.mode!=='playing')return;
  const npcShot=!!state.h17IncomingHit;
  if(npcShot&&(state.h17DamageIFrame||0)>0)return;
  let dmg=Math.max(0,Number(amount)||0),shielded=state.shield>0;if(shielded)dmg*=.35;
  const before=state.health;state.health=Math.max(0,state.health-dmg);
  if(state.health<before){
    if(npcShot){state.h17DamageIFrame=.34;state.shake=Math.max(state.shake||0,.07);state.h17PlayerHitFx={start:performance.now(),dur:390,fromX:state.h17IncomingFromX||gameplayViewport().center,shielded};tone(shielded?690:210,.045,'triangle',.010,shielded?110:-55,0,.03);try{navigator.vibrate?.(10)}catch{}}
    else{state.shake=.16;UI.damage.classList.add('hit');setTimeout(()=>UI.damage.classList.remove('hit'),110);sfx.hurt();}
  }
  if(state.health<=0){state.mode='over';show(UI.over);w1PrepareEndLeaderboard('gameover');}
}

function beginStageClear(){ if(state.transition>0)return; state.transition=.001; state.mode='playing'; sfx.clear(); toast('✅ KHU VỰC ĐÃ KHỬ NHIỄM',2); }

function stageCompletePanel(){
  if(!state)return;
  const completed=state.stageIndex;
  if(completed<A1_STAGE_COUNT-1){a1SaveUnlocked(Math.max(a1Unlocked(),completed+2));a1NewlyUnlocked=completed+1;a1SelectedStage=completed+1;}
  else{a1SaveUnlocked(A1_STAGE_COUNT);a1SelectedStage=A1_STAGE_COUNT-1;}
  state.mode='stage';hide(UI.bossBar);
  const acc=state.shots?Math.round(state.hits/state.shots*100):100,rank=rankFor(acc,state.health,state.stageElapsed);
  $('#stageResultTitle').textContent=state.cfg.name;$('#stageScore').textContent=state.score.toLocaleString('vi-VN');$('#stageAccuracy').textContent=acc+'%';$('#stageHealth').textContent=`${Math.ceil(state.health)}/10`;$('#stageRank').textContent=rank;
  
  const next=$('#nextStageBtn');if(next){next.classList.toggle('hidden',completed>=A1_STAGE_COUNT-1);next.textContent=completed<A1_STAGE_COUNT-1?'TIẾN VÀO KHU TIẾP THEO ›':'HOÀN TẤT';}
  a1RenderStageMenu();
  if(state.cfg.final){hide(UI.stage);$('#victoryText').textContent=`Tổng điểm ${state.score.toLocaleString('vi-VN')} · Chính xác ${acc}% · Xếp hạng ${rank}`;show(UI.victory);w1PrepareEndLeaderboard('victory');}
  else show(UI.stage);
}
function rankFor(acc,hp,time){ const v=acc*.55+hp*4+(time<80?12:time<110?7:2); return v>=85?'S+':v>=72?'S':v>=56?'A':'B'; }

function enemyScreen(e){
  const h=innerHeight,horizon=h*.405,v=gameplayViewport();
  if(e?.boss){const phase=e.phase||0,scale=.82+.026*Math.sin(phase*.58);return{x:v.center+(e.x-.5)*v.width*.50,y:h*.458+Math.sin(phase*.47)*2.0,scale,r:e.rad*scale*1.04};}
  const prog=Math.pow(clamp(1-e.depth,0,1),1.34),y=horizon+prog*h*.535+(e.base.fly?Math.sin(e.phase*2)*13-30:0)+(e.base.wall?(e.side<0?-18:7):0),spread=.20+.80*prog,x=v.center+(e.x-.5)*v.width*spread*1.42,scale=.20+prog*1.02,minR=(typeof j1IsRealMobile==='function'&&j1IsRealMobile())?11:9;
  return{x,y,scale,r:Math.max(e.rad*scale,minR)};
}

/* L1 consolidated: legacy aimHit implementation removed */

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
/* L1 consolidated: legacy shoot implementation removed */

/* L1 consolidated: legacy hitEnemy implementation removed */

/* L1 consolidated: legacy spawnMini implementation removed */

function explode(x,y,damage){
  for(const e of state.enemies){const s=enemyScreen(e);const dist=Math.hypot(x-s.x,y-s.y);if(dist<220)hitEnemy(e,damage*(1-dist/300),true);} burstAt(x,y,'#ffd66b',35); toast('🟠 BOM VITAMIN KHỬ NHIỄM!',1.1);
}
function muzzleBurst(x,y,kind){ const c=kind==='beam'?'#b7ffff':kind==='bomb'?'#ffd66b':'#d9fff9'; for(let i=0;i<4;i++)state.particles.push({x:x+(Math.random()-.5)*8,y:y+(Math.random()-.5)*8,vx:(Math.random()-.5)*40,vy:(Math.random()-.5)*40,life:.22,max:.22,a:1,size:2+Math.random()*3,color:c}); }
function burstAt(x,y,color,count=8){ for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,sp=25+Math.random()*100;state.particles.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:.35+Math.random()*.45,max:.8,a:1,size:2+Math.random()*4,color});}}

function spawnPowerup(x,y){ const kinds=['heal','shield','drone','heal','shield','drone','gpp']; const kind=kinds[(Math.random()*kinds.length)|0]; state.powerups.push({x,y,kind,t:0,life:6,dead:false}); }
/* L1 consolidated: legacy collectPowerups implementation removed */

/* L1 consolidated: legacy updateHUD implementation removed */
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
/* L1 consolidated: legacy drawPowerups implementation removed */
function q1DroneScreen(t=performance.now()){return{x:Math.max(34,Math.min(innerWidth-34,playerScreenX()-innerWidth*.115+Math.sin(t*.004)*16)),y:innerHeight*.66+Math.sin(t*.006)*9};}
function q1DroneTracer(target,elite=false){if(!state||!target)return;const a=q1DroneScreen(),b=enemyScreen(target),life=elite?.18:.24;state.tracers.push({x1:a.x,y1:a.y,x2:b.x,y2:b.y,t:0,life,max:life,travel:elite?.10:.14,color:elite?'#ffe177':'#7dfff4',width:elite?5.6:4.2,kind:elite?'bossDrone':'drone',seed:Math.random()*99});}
function drawDrone(t){ if(!state||state.drone<=0)return;const {x,y}=q1DroneScreen(t);ctx.save();ctx.translate(x,y);ctx.fillStyle='#d8fffb';ctx.strokeStyle='#157a81';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(-25,-13,50,26,9);ctx.fill();ctx.stroke();ctx.fillStyle='#4ed8d2';ctx.beginPath();ctx.arc(0,0,6,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(178,255,250,.7)';ctx.beginPath();ctx.moveTo(-31,-15);ctx.lineTo(-48,-23);ctx.moveTo(31,-15);ctx.lineTo(48,-23);ctx.stroke();ctx.restore();}



/* === v2.0.0 CONCEPT UI + BRAND LOCK OVERRIDES === */
// Historical stage identity block. W1 later enables staggered NPC counterfire under a global projectile cap.
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

/* L1 consolidated: legacy spawnEnemy implementation removed */

function fireBossShot(e,targetOffset=0,damage=1.2,color=e.shotColor,speed=145,size=8){
  if(!state||!e||e.dead)return;
  const src=enemyScreen(e),targetPlayerX=clamp(state.playerX+targetOffset,-1,1),tx=playerScreenX(targetPlayerX),ty=innerHeight*.78;
  const dx=tx-src.x,dy=ty-src.y,l=Math.hypot(dx,dy)||1,travelSpeed=Math.max(170,speed*1.16);
  state.enemyShots.push({kind:'boss',boss:true,x:src.x,y:src.y,px:src.x,py:src.y,vx:dx/l*travelSpeed,vy:dy/l*travelSpeed,t:0,life:Math.max(.50,l/travelSpeed),r:size,damage,color,targetPlayerX,bossKind:e.bossKind,sourceX:src.x,nearMiss:false});
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
/* Q1 consolidated: early legacy updateBoss removed; canonical Boss update is defined with the D1/H15 combat rules below. */

/* L1 consolidated: legacy update implementation removed */

// Boss armor is behavior based, not inflated HP.
const oldHitEnemyV13=hitEnemy;
/* L1 consolidated: legacy hitEnemy implementation removed */

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
/* L1 consolidated: legacy updateHUD implementation removed */
function drawBossIntro(){if(!state?.bossIntro||state.bossIntro<=0)return;const a=Math.min(1,state.bossIntro/.45, (2.05-state.bossIntro)/.3);ctx.save();ctx.globalAlpha=clamp(a,0,1);ctx.fillStyle='rgba(3,20,24,.66)';ctx.fillRect(0,innerHeight*.39,innerWidth,innerHeight*.22);ctx.textAlign='center';ctx.fillStyle='#ffdd79';ctx.font=`900 ${Math.max(13,Math.min(22,innerWidth*.018))}px system-ui`;ctx.fillText('⚠ BOSS CUỐI MÀN',innerWidth/2,innerHeight*.455);ctx.fillStyle='white';ctx.font=`900 ${Math.max(24,Math.min(46,innerWidth*.042))}px system-ui`;ctx.fillText(state.cfg.boss,innerWidth/2,innerHeight*.525);ctx.fillStyle='#bcece7';ctx.font='800 12px system-ui';ctx.fillText('BẮN VÀO LÕI SÁNG · DI CHUYỂN NGANG ĐỂ NÉ ĐÒN',innerWidth/2,innerHeight*.57);ctx.restore();}

/* L1 consolidated: legacy render implementation removed */

function loop(now){ const dt=Math.min(.04,(now-last)/1000||.016);last=now;if(state?.mode==='playing')update(dt);render(now);raf=requestAnimationFrame(loop); }
function drawAttract(){ drawBackground(performance.now()); }
bg.onload=drawAttract;

function pointerPos(ev){ const r=canvas.getBoundingClientRect(); const t=ev.touches?.[0]||ev.changedTouches?.[0]||ev; return {x:(t.clientX-r.left),y:(t.clientY-r.top)}; }
canvas.addEventListener('pointermove',e=>{pointer=Object.assign(pointer,pointerPos(e));if(pointer.down && state?.mode==='playing' && [2,4].includes(state.weapon)){shoot(pointer.x,pointer.y)}});
/* L1 consolidated: legacy canvas pointerdown removed */
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


/* L1 consolidated: legacy newState implementation removed */

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
/* L1 consolidated: legacy dropSpecificPowerup implementation removed */
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
/* L1 consolidated: legacy aimHit implementation removed */


/* L1 consolidated: legacy shoot implementation removed */


/* L1 consolidated: legacy hitEnemy implementation removed */
// All support items now come from distinct SUPPLY NPCs; ordinary viruses never randomly drop items.
spawnPowerup=function(){};

// Guaranteed item application. Timed effects extend but are capped to preserve balance.
/* L1 consolidated: legacy collectPowerups implementation removed */

function supportActive(){return SUPPORT_ORDER.map(k=>({k,m:SUPPORT_ITEMS[k],left:state?.[SUPPORT_ITEMS[k].field]||0})).filter(x=>x.left>0);}
function updateSupportUI(){
  if(!state)return;const active=supportActive(),key=active.map(x=>`${x.k}:${Math.ceil(x.left*10)}`).join('|');if(key===state._supportHudKey)return;state._supportHudKey=key;
  if(UI.supportList){UI.supportList.innerHTML=active.length?active.map(({m,left})=>{const pct=Math.max(0,Math.min(100,left/m.duration*100)),exp=left<2?' expiring':'';return`<div class="support-row${exp}"><span class="support-icon">${m.icon}</span><b>${m.name}</b><strong>${left.toFixed(1)}s</strong><span class="support-track"><i style="width:${pct}%"></i></span></div>`}).join(''):'<div class="support-empty">CHƯA CÓ HỖ TRỢ</div>';}
  if(UI.mobileSupportStrip){UI.mobileSupportStrip.innerHTML=active.slice(0,4).map(({m,left})=>`<span class="mobile-support-chip${left<2?' expiring':''}">${m.icon} ${left.toFixed(0)}s</span>`).join('');}
}


/* L1 consolidated: legacy updateHUD implementation removed */

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
/* L1 consolidated: legacy drawPowerups implementation removed */

// Minor enemies remain melee/movement threats only. Bosses alone use enemyShots.
/* L1 consolidated: legacy update implementation removed */

// Preserve the bar style, but progress now follows 0→50% minor enemies and 50→100% boss cleanse.
beginStageClear=function(){if(state.transition>0)return;state.transition=.001;state.mode='playing';state.environmentClean=Math.max(50,state.environmentClean);state.contamination=50;sfx.clear();toast('✨ ĐANG THANH TẨY TOÀN KHU...',2.4);};

// Final render order: environment -> enemies/reward NPC -> combat FX -> doctor.
/* L1 consolidated: legacy render implementation removed */


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


/* L1 consolidated: legacy newState implementation removed */

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

function a1ConfirmHome(){ goHome(); }
const quickHome=$('#homeQuickBtn');if(quickHome)quickHome.onclick=goHome;
if($('#homeBtn'))$('#homeBtn').onclick=goHome;
if($('#stageHomeBtn'))$('#stageHomeBtn').onclick=goHome;
if($('#pauseRetryBtn'))$('#pauseRetryBtn').onclick=()=>{if(!state)return;const idx=state.stageIndex;if(confirm('Chơi lại màn này từ đầu?'))startGame(idx);};

/* W1 consolidated: A1 stageComplete wrapper merged into canonical stageCompletePanel. */
$('#nextStageBtn').onclick=()=>{if(!state)return;const next=Math.min(A1_STAGE_COUNT-1,state.stageIndex+1);startGame(next);};

function a1FormatTime(sec){const n=Math.max(0,Math.floor(sec||0)),m=Math.floor(n/60),s=n%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}

/* L1 consolidated: legacy updateHUD implementation removed */

// The logo is the special all-in-one item: it carries every support effect.

/* L1 consolidated: legacy collectPowerups implementation removed */

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


/* L1 consolidated: legacy update implementation removed */

/* L1 consolidated: legacy render implementation removed */

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

/* L1 consolidated: legacy render implementation removed */

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
/* L1 consolidated: legacy d1SpeedTarget implementation removed */
/* L1 consolidated: legacy d1SpawnInterval implementation removed */
/* L1 consolidated: legacy d1ActiveCap implementation removed */
function d1Countdown(){return Math.max(0,D1_BOSS_TIME-(state?.stageElapsed||0));}
function d1FormatClock(sec){const n=Math.max(0,Math.ceil(sec)),m=Math.floor(n/60),s=n%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}

// D1 state: the stage is a 90-second survival ramp. Natural NPC spawning stops at Boss time.

/* L1 consolidated: legacy newState implementation removed */

// D1 spawn model: small/far NPCs, slower baseline and perspective-aware movement.
/* L1 consolidated: legacy spawnEnemy implementation removed */

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
    if(n){n.bossSummoned=true;n.countsForClean=false;n.depth=.96+Math.random()*.025;n.baseX=clamp(.16+Math.random()*.68,.08,.92);n.x=n.baseX;n.h17Ranged=true;n.h17ShotCooldown=Math.max(n.h17ShotCooldown||0,4.8+Math.random()*2.4);}
  }
}
function d1BossVisualPhase(e){const r=Math.max(0,e.hp/e.maxHp);return r>.75?1:r>.50?2:r>.25?3:4;}
function updateBoss(e,dt,d){
  const ratio=Math.max(0,e.hp/e.maxHp),attackPhase=ratio>.67?1:ratio>.34?2:3,visualPhase=d1BossVisualPhase(e);
  if(visualPhase!==e.d1VisualPhase){e.d1VisualPhase=visualPhase;if(visualPhase>1){sfx.boss();toast(visualPhase===4?'☣ BOSS BIẾN DẠNG TỐI ĐA!':`⚠ BOSS BIẾN DẠNG · CẤP ${visualPhase}`,1.0);}}
  e.phase+=dt*(1.12+visualPhase*.22);e.flash=Math.max(0,e.flash-dt*6);e.guard=Math.max(0,(e.guard||0)-dt);
  const amp=.11+state.stageIndex*.008;e.baseX=.5+Math.sin(e.phase*(.28+state.stageIndex*.008))*amp;e.x=e.baseX;e.depth=.79+Math.sin(e.phase*.31)*.012;
  if(state.bossIntro>0)return;
  const thresholds=[.75,.50,.25];for(let i=0;i<3;i++)if(!e.d1SummonDone[i]&&ratio<=thresholds[i])d1BossSummon(e,i);
  e.attackTimer-=dt;if(e.attackTimer<=0)bossAttack(e,attackPhase,d);
  if(e.h15SummonPauseUntil&&performance.now()<e.h15SummonPauseUntil)e.attackTimer=Math.max(e.attackTimer,.12);
}

// Q1 consolidated: D1 perspective projection merged into canonical enemyScreen.

// D1 main update loop.
/* L1 consolidated: legacy update implementation removed */

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
/* L1 consolidated: legacy drawPowerups implementation removed */

/* L1 consolidated: legacy collectPowerups implementation removed */

// Active support HUD: circular countdown around icon + one-time arrival animation.
updateSupportUI=function(){if(!state)return;const active=supportActive(),now=performance.now(),key=active.map(x=>`${x.k}:${Math.ceil(x.left*4)}`).join('|');if(key===state._supportHudKey)return;state._supportHudKey=key;
  if(UI.supportList){UI.supportList.innerHTML=active.length?active.map(({k,m,left})=>{const pct=clamp(left/m.duration*100,0,100),fresh=state._supportJustAdded===k&&now<state._supportJustUntil?' support-new':'',exp=left<2?' expiring':'';return`<div class="support-row${fresh}${exp}" style="--support-color:${m.color};--support-pct:${pct}%"><span class="support-icon"><i>${m.icon}</i></span><b>${m.name}</b><strong>${left.toFixed(1)}s</strong><span class="support-track"><i style="width:${pct}%"></i></span></div>`}).join(''):'<div class="support-empty">CHƯA CÓ HỖ TRỢ</div>';}
  if(UI.mobileSupportStrip)UI.mobileSupportStrip.innerHTML=active.slice(0,4).map(({m,left})=>`<span class="mobile-support-chip${left<2?' expiring':''}">${m.icon} ${left.toFixed(0)}s</span>`).join('');
  if(state._supportJustAdded&&now<state._supportJustUntil)state._supportJustAdded=null;
};

// D1 HUD: countdown to the exact Boss second and professional difficulty labels.

/* L1 consolidated: legacy updateHUD implementation removed */

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
/* L1 consolidated: legacy difficulty copy handler removed */
const d1GoHomeBase=goHome;goHome=function(){if(d1StagePanel)hide(d1StagePanel);d1GoHomeBase();a1RenderStageMenu();};

// Draw pickup confirmation over the completed scene without occupying the lower centre.

/* L1 consolidated: legacy render implementation removed */

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

/* L1 consolidated: legacy newState implementation removed */

function f1RewardWeaponPulse(kind,duration=900){if(!state)return;state.f1WeaponEffect=kind;state.f1WeaponEffectUntil=performance.now()+duration;}
/* L1 consolidated: legacy f1UseReward implementation removed */
for(const btn of document.querySelectorAll('[data-boss-reward]'))btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();f1UseReward(btn.dataset.bossReward)});
addEventListener('keydown',e=>{const kind=F1_REWARD_KEYS[e.code];if(!kind||e.ctrlKey||e.altKey||e.metaKey)return;if(state?.mode==='playing'){e.preventDefault();f1UseReward(kind)}},true);

// Make every dropped SUPPLY item usable by aiming/shooting at it, not only on the first pointerdown.

/* L1 consolidated: legacy shoot implementation removed */
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

/* L1 consolidated: legacy update implementation removed */

// Persistent upgrades affect player weapon damage/rate without changing enemy progression logic.

/* L1 consolidated: legacy hitEnemy implementation removed */

/* L1 consolidated: legacy shoot implementation removed */

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

/* W1 consolidated: F1 stageComplete wrapper merged into canonical stageCompletePanel. */


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
/* L1 consolidated: legacy d1SpeedTarget implementation removed */
d1Countdown=function(){return Math.max(0,G1_BOSS_TIME-(state?.stageElapsed||0));};
/* L1 consolidated: legacy d1SpawnInterval implementation removed */
/* L1 consolidated: legacy d1ActiveCap implementation removed */

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


/* L1 consolidated: legacy newState implementation removed */

// Fully D1-compatible mini spawn; fixes the old cluster NaN/stall bug in stages 2/4/8.
/* L1 consolidated: legacy spawnMini implementation removed */


/* L1 consolidated: legacy spawnEnemy implementation removed */

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
/* L1 consolidated: legacy update implementation removed */

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
/* L1 consolidated: legacy updateHUD implementation removed */
/* L1 consolidated: legacy difficulty copy handler removed */



// Production build: G1 final UI init.
f1UpdateRewardRail();g1RefreshInstallUI();g1RefreshUpdateUI();


/* === v3.3.0 G1 HARDENING · Boss endurance ×3 · tracer cleanup · left rewards · 20s elite Drone · branded item screens === */
const G2_VERSION='3.3.0';
const G2_BOSS_HP_MULT=3;
const G2_INSTALL_MARK='bstq-pwa-installed-v1';

// Boss is now a real endurance encounter. HP is tripled after all stage/difficulty scaling.

/* L1 consolidated: legacy spawnEnemy implementation removed */

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

/* L1 consolidated: legacy collectPowerups implementation removed */


/* L1 consolidated: legacy f1UseReward implementation removed */

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

/* L1 consolidated: legacy update implementation removed */

// Layer the visible elite Drone and brand overlays above the scene but below DOM HUD.
function g2DrawGppPickupBrand(t){if(!state||!logoIcon.complete)return;for(const f of state.pickupFx||[]){if(f.kind!=='gpp'||t-f.start>=f.dur)continue;const q=clamp((t-f.start)/f.dur,0,1),e=1-Math.pow(1-q,3),x=f.x+(f.tx-f.x)*e,y=f.y+(f.ty-f.y)*e-Math.sin(q*Math.PI)*70,sc=.75+.35*Math.sin(q*Math.PI);ctx.save();ctx.translate(x,y);ctx.scale(sc,sc);ctx.beginPath();ctx.arc(0,0,15,0,Math.PI*2);ctx.clip();ctx.fillStyle='#fff';ctx.fillRect(-15,-15,30,30);ctx.drawImage(logoIcon,-15,-15,30,30);ctx.restore();}
  const b=state.rewardBanner;if(b?.kind==='gpp'&&t<b.until){const v=gameplayViewport(),mobile=!v.desktop,w=Math.min(300,innerWidth*.40),x=mobile?(innerWidth-w)/2:v.left+14,y=mobile?70:innerHeight*.22;ctx.save();ctx.beginPath();ctx.roundRect(x+17,y+15,28,28,7);ctx.clip();ctx.fillStyle='#fff';ctx.fillRect(x+17,y+15,28,28);ctx.drawImage(logoIcon,x+17,y+15,28,28);ctx.restore();}}

/* L1 consolidated: legacy render implementation removed */

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
/* L1 consolidated: legacy g2IsNewer implementation removed */
g1RefreshUpdateUI=function(){g1SetVisible(G1_UPDATE_IDS,!!g1WaitingWorker||g2RemoteUpdate);};
async function g2CheckVersion(){try{const r=await fetch(`./version.json?t=${Date.now()}`,{cache:'no-store'});if(r.ok){const v=await r.json();g2RemoteUpdate=g2IsNewer(v.version);g1RefreshUpdateUI();}}catch{}}
g1ApplyUpdate=async function(){ensureAudio();if(g1WaitingWorker){g1Reloading=true;g1WaitingWorker.postMessage({type:'SKIP_WAITING'});return}if(g1SwReg){try{await g1SwReg.update()}catch{}if(g1SwReg.waiting){g1WaitingWorker=g1SwReg.waiting;g1Reloading=true;g1WaitingWorker.postMessage({type:'SKIP_WAITING'});return}}if(g2RemoteUpdate)location.reload();else g1RefreshUpdateUI();};
for(const id of G1_UPDATE_IDS){const b=document.getElementById(id);if(b)b.onclick=g1ApplyUpdate;}
setTimeout(g2CheckVersion,900);setInterval(g2CheckVersion,180000);

g1RefreshInstallUI();g1RefreshUpdateUI();f1UpdateRewardRail();




/* === v3.4.0 H1 FINAL · interactive campaign map · briefing gate · harder distant Boss · 2× NPC pressure · full cleanup · expanded item FX === */
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
function h1HideMapPreview(){const p=$('#h1MapPreview');if(p)p.classList.add('hidden');}
function h1RenderMapPreview(i=a1SelectedStage){
  i=clamp(Number(i)||0,0,7);const st=h1MapStageState(i),preview=$('#h1MapPreview'),img=$('#h1MapPreviewImg'),no=$('#h1MapPreviewNo'),name=$('#h1MapPreviewName'),story=$('#h1MapPreviewStory'),status=$('#h1MapPreviewState');
  if(img){img.src=`assets/stage${i+1}-clean.jpg`;img.alt=H1_MAP_NAMES[i];}if(no)no.textContent=`MÀN ${i+1}`;if(name)name.textContent=H1_MAP_NAMES[i];if(story)story.textContent=H1_STORIES[i];if(status){status.textContent=st.completed?'✓ ĐÃ KHỬ NHIỄM':st.open?'● ĐÃ MỞ':'🔒 CHƯA MỞ KHÓA';status.style.color=st.completed?'#8dffc1':st.open?'#8dffe8':'#c0c7cb';}preview?.classList.remove('hidden');requestAnimationFrame(()=>h15PlaceMapPreview(i));
}
function h1RefreshMap(){
  const unlocked=a1Unlocked();h1MapHotspots.forEach((b,i)=>{const open=i<unlocked,completed=i<Math.max(0,unlocked-1);b.classList.toggle('locked',!open);b.classList.toggle('completed',completed);b.classList.toggle('selected',open&&i===a1SelectedStage);b.setAttribute('aria-disabled',String(!open));});h1HideMapPreview();
}
for(const b of h1MapHotspots){const i=Number(b.dataset.mapStage)||0;b.addEventListener('mouseenter',()=>h1RenderMapPreview(i));b.addEventListener('focus',()=>h1RenderMapPreview(i));b.addEventListener('mouseleave',h1HideMapPreview);b.addEventListener('blur',h1HideMapPreview);b.addEventListener('click',e=>{e.preventDefault();const st=h1MapStageState(i);h1RenderMapPreview(i);if(!st.open){b.classList.remove('lock-pulse');void b.offsetWidth;b.classList.add('lock-pulse');setTimeout(()=>b.classList.remove('lock-pulse'),450);return;}a1SelectedStage=i;a1NewlyUnlocked=-1;a1RenderStageMenu();h1RenderMapPreview(i);});}
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

/* L1 consolidated: legacy spawnEnemy implementation removed */
/* Q1 consolidated: H1 boss enemyScreen wrapper merged into canonical enemyScreen. */
/* Q1 consolidated: obsolete H1 rapid Boss clamp removed. */

// --- H1 natural NPC pressure: at least 2× speed and 2× spawn frequency versus v3.3, while preserving archetype differences. ---
/* L1 consolidated: legacy d1SpeedTarget implementation removed */
/* L1 consolidated: legacy d1SpawnInterval implementation removed */
/* L1 consolidated: legacy d1ActiveCap implementation removed */

// --- Capture the last Boss position, then hard-clean every combat layer before the 5s cleanse begins. ---

/* L1 consolidated: legacy hitEnemy implementation removed */
/* L1 consolidated: legacy h1CombatCleanup implementation removed */
const h1BeginStageClearBase=beginStageClear;
beginStageClear=function(){if(!state||state.transition>0||state.bossRewardShown)return;h1CombatCleanup();h1BeginStageClearBase();};
function h1DrawBossDeathFx(t){const f=state?.h1BossDeathFx;if(!f)return;const q=clamp((t-f.start)/f.dur,0,1);if(q>=1){state.h1BossDeathFx=null;return;}ctx.save();ctx.globalCompositeOperation='screen';const a=1-q,r=f.r*(.8+q*2.2);for(let i=0;i<4;i++){ctx.globalAlpha=a*(.22-i*.035);ctx.strokeStyle=i%2?'#9c6cff':'#80ffce';ctx.lineWidth=Math.max(1,4-i);ctx.beginPath();ctx.arc(f.x,f.y,r*(.55+i*.19),0,Math.PI*2);ctx.stroke();}for(let i=0;i<18;i++){const ang=i*.349+t*.0006*(i%2?1:-1),rr=r*(.35+q*(.45+(i%4)*.08));ctx.globalAlpha=a*.28;ctx.fillStyle=i%3===0?'#ffe680':i%2?'#8effd5':'#a679ff';ctx.beginPath();ctx.arc(f.x+Math.cos(ang)*rr,f.y+Math.sin(ang)*rr*.65,1.5+(i%3),0,Math.PI*2);ctx.fill();}ctx.restore();}

// --- H1 item presentation: 3× standard / 4× special expansion from the weapon monitor. Shield becomes a full player field for 12s. ---
SUPPORT_ITEMS.shield.duration=12;D1_REWARD_META.shield.duration=12;

/* L1 consolidated: legacy collectPowerups implementation removed */
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
/* L1 consolidated: legacy render implementation removed */

// Version comparison must use this H1 build so UPDATE stays hidden until a genuinely newer deployment exists.
/* L1 consolidated: legacy g2IsNewer implementation removed */

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
const H15_VERSION=L1_VERSION;

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
// Q1 consolidated: H15 Boss summon-pause rule merged into canonical updateBoss.
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
/* W1 consolidated: H15 map-preview wrapper merged into h1RenderMapPreview. */
window.addEventListener('resize',()=>requestAnimationFrame(()=>h15PlaceMapPreview(a1SelectedStage)),{passive:true});

// --- More support without random droughts: higher cap plus a guaranteed SUPPLY window. ---
Object.assign(DIFF.easy,{rewardEvery:10.0,rewardMax:13});Object.assign(DIFF.normal,{rewardEvery:12.0,rewardMax:11});Object.assign(DIFF.hard,{rewardEvery:14.0,rewardMax:9});

/* L1 consolidated: legacy newState implementation removed */
const h15SpawnRewardBase=spawnRewardNpc;
spawnRewardNpc=function(){const before=state?.rewardNpcs?.length||0,r=h15SpawnRewardBase();if(state&&(state.rewardNpcs.length>before||state.rewardNpcs.some(n=>!n.dead)))state.h15LastSupplyAt=state.stageElapsed||0;return r;};

/* L1 consolidated: legacy update implementation removed */

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
$('#leaderboardBtn')?.addEventListener('click',()=>h15OpenLeaderboard(false));$('#leaderboardDifficulty')?.addEventListener('change',h15RefreshLeaderboard);$('#leaderboardStage')?.addEventListener('change',h15RefreshLeaderboard);$('#victoryLeaderboardRecordBtn')?.addEventListener('click',w1OpenEndLeaderboard);$('#gameOverLeaderboardRecordBtn')?.addEventListener('click',w1OpenEndLeaderboard);
/* W1: ordinary stage-complete record detector removed; join CTA is end-of-run only. */
/* W1 consolidated: H15 stageComplete wrapper removed; leaderboard CTA is end-of-run only. */

// Final render layer for the Boss telegraph.
/* L1 consolidated: legacy render implementation removed */

// Version UI must compare against this build.
/* L1 consolidated: legacy g2IsNewer implementation removed */



/* === v3.6.0 H1 CONTROL · mobile AUTO FIRE · PC AUTO/MANUAL · tap/click target lock === */
const H16_FIRE_MODE_KEY='bstq-h16-fire-mode-v1';
function h16IsMobileControl(){return matchMedia('(hover:none) and (pointer:coarse)').matches || (innerWidth<900 && navigator.maxTouchPoints>0);}
function h16ReadFireMode(){if(h16IsMobileControl())return'auto';try{return localStorage.getItem(H16_FIRE_MODE_KEY)==='manual'?'manual':'auto'}catch{return'auto'}}
let h16PreferredFireMode=h16ReadFireMode();
function h16CurrentFireMode(){return h16IsMobileControl()?'auto':(state?.h16FireMode||h16PreferredFireMode||'auto');}
/* L1 consolidated: legacy h16UpdateFireModeUI implementation removed */
/* L1 consolidated: legacy h16SetFireMode implementation removed */
for(const b of document.querySelectorAll('[data-fire-mode]'))b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();h16SetFireMode(b.dataset.fireMode);});


/* L1 consolidated: legacy newState implementation removed */

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
/* L1 consolidated: legacy h16ChooseAutoTarget implementation removed */
function h16LockTarget(target){
  if(!state)return;if(!target){state.h16ManualLock=null;state.h16AutoTarget=null;return;}
  state.h16ManualLock=h16TargetRef(target.kind,target.entity);state.h16AutoTarget=null;state.h16LockFxUntil=performance.now()+520;state.h16LockSerial=(state.h16LockSerial||0)+1;
  const label=target.kind==='reward'?'SUPPLY':target.entity.boss?'BOSS':target.entity.type==='elite'?'NPC ELITE':'NPC';tone(target.entity?.boss?330:690,.055,'triangle',.014,150,0,.05);toast(`🔒 ĐÃ KHÓA ${label}`,0.72);
}
/* L1 consolidated: legacy canvas pointerdown removed */

// Existing mouse/touch listeners remain installed for MANUAL mode. In AUTO mode their shot calls are suppressed.

/* L1 consolidated: legacy shoot implementation removed */
/* L1 consolidated: legacy h16AutoFireTick implementation removed */

/* L1 consolidated: legacy update implementation removed */

const h16CrosshairBase=drawCrosshair;
drawCrosshair=function(){if(state&&h16CurrentFireMode()==='auto'&&h16IsMobileControl())return;h16CrosshairBase();};
/* L1 consolidated: legacy h16DrawTargetLock implementation removed */
/* L1 consolidated: legacy render implementation removed */

// Re-apply the remembered mode when resuming and force AUTO whenever the device uses coarse touch controls.
// newState() already applies the correct mode when VÀO NGHÊNH CHIẾN creates a stage.
const h16ResumeBase=resumeGame;resumeGame=function(){const r=h16ResumeBase();if(state&&h16IsMobileControl())state.h16FireMode='auto';h16UpdateFireModeUI();return r;};
window.addEventListener('resize',()=>{if(h16IsMobileControl()&&state)state.h16FireMode='auto';h16UpdateFireModeUI();},{passive:true});

// Current build version for PWA update checks and leaderboard records.
/* L1 consolidated: legacy g2IsNewer implementation removed */
h16UpdateFireModeUI();

h1RefreshMap();h15PlaceMapPreview(a1SelectedStage);g1RefreshInstallUI();g1RefreshUpdateUI();

/* === v3.7.0 H1 · REAL MOBILE AUTO TARGET/FIRE + PC LIVE MODE + NPC COUNTERFIRE + ITEM/HIT REPAIR === */
function h17IsMobileGameplay(){
  const ua=navigator.userAgent||'', uaMobile=!!navigator.userAgentData?.mobile || /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini/i.test(ua);
  const touch=Number(navigator.maxTouchPoints||0)>0;
  let smallScreen=false;try{smallScreen=Math.min(screen.width||innerWidth,screen.height||innerHeight)<900}catch{smallScreen=Math.min(innerWidth,innerHeight)<900}
  return uaMobile || (touch&&smallScreen) || (touch&&Math.min(innerWidth,innerHeight)<700);
}
// Real phones/tablets are always AUTO even when a browser reports a mouse/fine pointer in landscape/PWA mode.
h16IsMobileControl=h17IsMobileGameplay;


/* L1 consolidated: legacy newState implementation removed */

// Faster NPC pressure, but only a moderate step above v3.6 so motion remains readable.

/* L1 consolidated: legacy d1SpeedTarget implementation removed */

/* W1: every ordinary NPC can participate in staggered counterfire; global cap prevents bullet spam. */

/* L1 consolidated: legacy spawnEnemy implementation removed */
function h17MaxNpcShots(){const diff=state?.difficulty||'normal';return diff==='easy'?1:diff==='hard'?3:2;}
function h17NpcShotDamage(){return .5;}
function h17NpcWarnSeconds(){const diff=state?.difficulty||'normal';return diff==='easy'?.72:diff==='hard'?.54:.62;}
function h17LaunchNpcShot(e){
  if(!state||!e||e.dead||e.boss||state.transition>0)return;const s=enemyScreen(e),aimX=Number.isFinite(e.h17AimPlayerX)?e.h17AimPlayerX:state.playerX,tx=playerScreenX(aimX),ty=innerHeight*.76,dx=tx-s.x,dy=ty-s.y,l=Math.hypot(dx,dy)||1;
  const speed=170+(state.difficulty==='hard'?18:state.difficulty==='easy'?-8:0),life=Math.max(.58,l/speed);
  state.h17NpcShots.push({x:s.x,y:s.y,px:s.x,py:s.y,vx:dx/l*speed,vy:dy/l*speed,t:0,life,r:3.2,damage:h17NpcShotDamage(),targetPlayerX:aimX,color:'#ff6f82',dead:false,sourceX:s.x,sourceY:s.y});
  e.h17AimPlayerX=null;e.h17ThreatPulse=.42;
}
function h17UpdateNpcCounterfire(dt){
  if(!state||state.mode!=='playing'||state.transition>0)return;state.h17DamageIFrame=Math.max(0,(state.h17DamageIFrame||0)-dt);
  const shots=state.h17NpcShots||(state.h17NpcShots=[]),cap=h17MaxNpcShots();
  if(!state.bossIntro){
    const candidates=state.enemies.filter(e=>!e.dead&&!e.boss&&e.h17Ranged&&e.depth<.76&&e.depth>.10).sort((a,b)=>a.depth-b.depth);
    let pending=candidates.filter(e=>e.h17ShotWarn>0||e.h17ShotQueued).length+shots.filter(s=>!s.dead).length;
    for(const e of candidates){
      e.h17ThreatPulse=Math.max(0,(e.h17ThreatPulse||0)-dt);const idleBoost=(state.w1PlayerIdle||0)>=1.15?1.45:1;e.h17ShotCooldown=(e.h17ShotCooldown||0)-dt*idleBoost;
      if(e.h17ShotWarn>0){e.h17ShotWarn-=dt;if(e.h17ShotWarn<=0&&e.h17ShotQueued){e.h17ShotQueued=false;h17LaunchNpcShot(e);e.h17ShotCooldown=3.6+Math.random()*2.2;pending++;}continue;}
      if(e.h17ShotCooldown<=0&&pending<cap){e.h17ShotWarn=h17NpcWarnSeconds();e.h17ShotQueued=true;e.h17AimPlayerX=state.playerX;e.h17ShotCooldown=99;pending++;}
    }
  }
  for(const sh of shots){
    if(sh.dead)continue;sh.t+=dt;sh.px=sh.x;sh.py=sh.y;sh.x+=sh.vx*dt;sh.y+=sh.vy*dt;
    if(sh.t>=sh.life){
      const hitRadius=Math.max(28,Math.min(52,innerWidth*.032));
      const missDx=Math.abs(playerScreenX()-playerScreenX(sh.targetPlayerX));
      if(missDx<hitRadius){state.h17IncomingHit=true;state.h17IncomingFromX=sh.sourceX;damagePlayer(sh.damage);state.h17IncomingHit=false;}
      else if(missDx<hitRadius*2.15){state.score+=10;if((state.q1NearMissToast||0)<=0){toast('✨ NÉ ĐẸP +10',.55);sfx.dodgeSuccess();state.q1NearMissToast=1.05;}}
      else state.score+=3;sh.dead=true;
    }
  }
  state.h17NpcShots=shots.filter(s=>!s.dead&&s.t<s.life+.2);
}

/* W1 consolidated: H17 damagePlayer wrapper merged into canonical damagePlayer. */

// Mobile AUTO target hierarchy: manual tap lock > current sticky target > ranged threat > closest dangerous NPC > Boss > SUPPLY.
function h17ThreatScore(e){
  const shooter=e.h17Ranged?120:0,warning=e.h17ShotWarn>0?220:0,fast=(e.g1Motion==='sprinter'||e.type==='charger'||e.type==='sprinter')?70:0,support=e.base?.support?65:0,close=(1-clamp(e.depth,0,1))*180;return warning+shooter+fast+support+close;
}

/* L1 consolidated: legacy h16ChooseAutoTarget implementation removed */
// No post-briefing dead time on mobile: once gameplay begins it immediately selects a target and fires.
/* L1 consolidated: legacy h16AutoFireTick implementation removed */

// Capture AUTO taps before the legacy manual pointer handler: power-up tap uses the item; NPC/Boss tap only locks target.
/* L1 consolidated: legacy canvas pointerdown removed */

// Ensure every ordinary support item has both a gameplay function and a fresh weapon-monitor effect.

/* L1 consolidated: legacy collectPowerups implementation removed */

function h17DrawNpcCounterfire(t){
  if(!state)return;ctx.save();ctx.beginPath();const v=gameplayViewport();ctx.rect(v.left,0,v.width,innerHeight);ctx.clip();
  for(const e of state.enemies){if(e.dead||e.boss||!e.h17Ranged)continue;const s=enemyScreen(e);if(e.h17ShotWarn>0){const q=1-clamp(e.h17ShotWarn/h17NpcWarnSeconds(),0,1),pulse=.55+.45*Math.sin(t*.025);ctx.globalCompositeOperation='screen';ctx.globalAlpha=.30+.42*q;ctx.strokeStyle='#ff7387';ctx.lineWidth=1.5+1.15*q;ctx.shadowColor='#ff536d';ctx.shadowBlur=11;ctx.beginPath();ctx.arc(s.x,s.y,s.r*(1.10+.18*q),0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle=`rgba(255,206,212,${.62+.3*pulse})`;ctx.font=`900 ${Math.max(7,Math.min(12,s.r*.17))}px system-ui`;ctx.textAlign='center';ctx.fillText('⚠ PHẢN KÍCH',s.x,s.y-s.r*1.24);}}
  for(const sh of state.h17NpcShots||[]){const a=clamp(1-sh.t/sh.life,0,1);ctx.globalCompositeOperation='screen';ctx.shadowColor='#ff536d';ctx.shadowBlur=10;ctx.globalAlpha=.28+.34*a;ctx.strokeStyle='#ff6077';ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(sh.sourceX??sh.px,sh.sourceY??sh.py);ctx.lineTo(sh.x,sh.y);ctx.stroke();ctx.globalAlpha=.82*a+.18;ctx.strokeStyle='#ffd7dc';ctx.lineWidth=1.35;ctx.beginPath();ctx.moveTo(sh.px,sh.py);ctx.lineTo(sh.x,sh.y);ctx.stroke();ctx.fillStyle='#fff6f7';ctx.shadowBlur=12;ctx.beginPath();ctx.arc(sh.x,sh.y,Math.max(2.4,sh.r),0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;}
  ctx.restore();
}
function h17DrawPlayerHitFx(t){
  const f=state?.h17PlayerHitFx;if(!f)return;const q=clamp((t-f.start)/f.dur,0,1);if(q>=1){state.h17PlayerHitFx=null;return;}const v=gameplayViewport(),cx=playerScreenX(),cy=innerHeight*.70,side=f.fromX<cx?-1:1,col=f.shielded?'#8cf5ff':'#ff8fa3';ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=(1-q)*.55;ctx.strokeStyle=col;ctx.lineWidth=2.5;ctx.shadowColor=col;ctx.shadowBlur=12;ctx.beginPath();ctx.arc(cx,cy,32+q*34,side<0?Math.PI*.55:-Math.PI*.45,side<0?Math.PI*1.45:Math.PI*.45);ctx.stroke();ctx.shadowBlur=0;for(let i=0;i<5;i++){const yy=innerHeight*(.30+i*.095),x=side<0?v.left+5:v.left+v.width-5;ctx.globalAlpha=(1-q)*(.17+i*.025);ctx.fillStyle=col;ctx.fillRect(side<0?x:x-4,yy,4,22);}ctx.restore();
}

/* L1 consolidated: legacy h16DrawTargetLock implementation removed */


/* L1 consolidated: legacy h1CombatCleanup implementation removed */


/* L1 consolidated: legacy update implementation removed */

/* L1 consolidated: legacy render implementation removed */

// Keep live PC mode buttons synced and force true mobile state after orientation/resume changes.

/* L1 consolidated: legacy h16UpdateFireModeUI implementation removed */
function h17ForceMobileAuto(){if(!h17IsMobileGameplay())return;if(state){state.h16FireMode='auto';state.h16AutoTarget=null;}h16PreferredFireMode='auto';h16UpdateFireModeUI();}
window.addEventListener('orientationchange',()=>setTimeout(h17ForceMobileAuto,80),{passive:true});window.addEventListener('pageshow',h17ForceMobileAuto,{passive:true});
const h17ResumeBase=resumeGame;resumeGame=function(){const r=h17ResumeBase();h17ForceMobileAuto();return r;};

// Update build comparison and UI now that v3.7 is active.
/* L1 consolidated: legacy g2IsNewer implementation removed */
h16UpdateFireModeUI();g1RefreshInstallUI();g1RefreshUpdateUI();

/* === v3.8.0 H1 · CONTROL SIDE + ITEM GUARANTEE + END-RESULT LEADERBOARD PREVIEW === */
const H18_VERSION=L1_VERSION,H18_CONTROL_SIDE_KEY='bstq-h18-mobile-control-side-v1';
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
/* L1 consolidated: legacy h18RefreshVersion implementation removed */
/* L1 consolidated: stale H18 version refresh removed */

// Final ordinary-item guarantee. Every pickup must change real gameplay state AND refresh its monitor/expanded FX.

/* L1 consolidated: legacy collectPowerups implementation removed */

function h18ScoreRecord(){if(!state)return null;const acc=state.shots?Math.round(state.hits/state.shots*100):100,rank=rankFor(acc,state.health,state.stageElapsed),bossSeconds=Math.max(0,state.stageElapsed-G1_BOSS_TIME);return{score:Math.round(state.score),stage:state.stageIndex,difficulty:state.difficulty,rank,accuracy:acc,bossSeconds:Math.round(bossSeconds*10)/10,version:H18_VERSION,__preview:true};}
function h18PreviewMatches(rec){const f=h15CurrentFilters();return !!rec&&rec.difficulty===f.difficulty&&(f.stage==='all'||String(rec.stage)===String(f.stage));}
function h18DiffLabel(d){return d==='easy'?'DỄ':d==='hard'?'KHÓ':'TRUNG BÌNH';}
function h18RenderCurrentResult(position,total){const box=$('#leaderboardCurrentResult');if(!box)return;if(!h18PendingShare){box.classList.add('hidden');box.replaceChildren();return;}box.classList.remove('hidden');const pos=Number.isFinite(position)?`#${position}`:'—';box.innerHTML=`<div><b>ĐIỂM VỪA ĐẠT</b><span>Màn ${h18PendingShare.stage+1} · ${h18DiffLabel(h18PendingShare.difficulty)} · ${h18PendingShare.rank}</span></div><div><strong>${Number(h18PendingShare.score).toLocaleString('vi-VN')}</strong><em>${pos} TẠM TÍNH</em></div>`;}

h15RenderLeaderRows=function(entries){
  const box=$('#leaderboardList');if(!box)return;let all=[...(Array.isArray(entries)?entries:[])],preview=h18PreviewMatches(h18PendingShare)?{...h18PendingShare,name:'BẠN · CHƯA CÔNG KHAI',__preview:true}:null;
  if(preview)all.push(preview);all.sort((a,b)=>Number(b.score)-Number(a.score)||Number(a.bossSeconds||999)-Number(b.bossSeconds||999));const pidx=preview?all.indexOf(preview):-1;h18RenderCurrentResult(pidx>=0?pidx+1:null,all.length);
  let list=all.slice(0,30);if(preview&&pidx>=30){list=all.slice(0,29);list.push(preview);}box.replaceChildren();if(!list.length){const e=document.createElement('div');e.className='h15-leader-row';e.textContent='Chưa có thành tích ở mục này.';box.appendChild(e);return;}
  for(const r of list){const actual=all.indexOf(r),row=document.createElement('div');row.className='h15-leader-row'+(actual<3?' top3':'')+(r.__preview?' h18-you-preview':'');const pos=document.createElement('span');pos.className='pos';pos.textContent=actual===0?'🥇':actual===1?'🥈':actual===2?'🥉':`#${actual+1}`;const who=document.createElement('span');who.className='who';const b=document.createElement('b');b.textContent=r.__preview?'BẠN · CHƯA CÔNG KHAI':h15SafeName(r.name);if(r.__preview){const tag=document.createElement('i');tag.className='h18-preview-tag';tag.textContent='XEM TRƯỚC';b.appendChild(tag);}const sm=document.createElement('small');sm.textContent=`Màn ${Number(r.stage)+1} · ${h18DiffLabel(r.difficulty||'normal')}`;who.append(b,sm);const sc=document.createElement('span');sc.className='score';sc.textContent=Number(r.score||0).toLocaleString('vi-VN');const rk=document.createElement('span');rk.className='rank';rk.textContent=r.rank||'A';row.append(pos,who,sc,rk);box.appendChild(row);}
};
function w1PrepareEndLeaderboard(reason='victory'){
  if(!state||state.w1EndLeaderboardPrepared)return;const rec=h18ScoreRecord();if(!rec)return;state.w1EndLeaderboardPrepared=true;h18PendingShare=rec;h18PreviewOnly=false;h15PendingRecord={...rec};const d=$('#leaderboardDifficulty'),s=$('#leaderboardStage');if(d)d.value=rec.difficulty;if(s)s.value=String(rec.stage);const btn=reason==='gameover'?$('#gameOverLeaderboardRecordBtn'):$('#victoryLeaderboardRecordBtn');if(btn){btn.textContent='🏆 THAM GIA BẢNG XẾP HẠNG';btn.classList.remove('hidden');}const hint=$('#leaderboardShareHint');if(hint)hint.textContent=H15_LB_ENDPOINT?'Xem vị trí tạm tính của bạn. Chỉ khi chọn THAM GIA BẢNG XẾP HẠNG, kết quả mới được gửi lên bảng online.':'Xem vị trí tạm tính của bạn. Chưa có máy chủ online: THAM GIA BẢNG XẾP HẠNG sẽ lưu kết quả trên thiết bị này.';$('#leaderboardRecordPrompt')?.classList.add('hidden');
}
function w1OpenEndLeaderboard(){if(!h18PendingShare)return;show($('#leaderboardRecordPrompt'));h15OpenLeaderboard(true);}

/* W1 consolidated: H18 stageComplete wrapper removed; final victory calls W1 leaderboard preparation directly. */

$('#leaderboardShareBtn')?.addEventListener('click',async()=>{
  if(!h18PendingShare)return;const rec={...h18PendingShare,name:h15SafeName($('#leaderboardName')?.value),createdAt:new Date().toISOString(),version:H18_VERSION};delete rec.__preview;let online=false;
  if(H15_LB_ENDPOINT){try{const r=await fetch(H15_LB_ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(rec)});online=r.ok;}catch{}}
  h15StoreLocalScore(rec);h18PendingShare=null;h15PendingRecord=null;h18PreviewOnly=false;$('#leaderboardRecordPrompt')?.classList.add('hidden');for(const rb of [$('#victoryLeaderboardRecordBtn'),$('#gameOverLeaderboardRecordBtn')])if(rb&&!rb.classList.contains('hidden')){rb.textContent='🏆 XEM BẢNG XẾP HẠNG';}toast(online?'🏆 ĐÃ THAM GIA BẢNG XẾP HẠNG ONLINE!':'🏆 ĐÃ LƯU KẾT QUẢ TRÊN THIẾT BỊ!',1.45);h15RefreshLeaderboard();
});
$('#leaderboardSkipShareBtn')?.addEventListener('click',()=>{if(!h18PendingShare)return;h18PreviewOnly=true;h15PendingRecord=null;$('#leaderboardRecordPrompt')?.classList.add('hidden');for(const rb of [$('#victoryLeaderboardRecordBtn'),$('#gameOverLeaderboardRecordBtn')])if(rb&&!rb.classList.contains('hidden'))rb.textContent='🏆 XEM BẢNG XẾP HẠNG';toast('👀 CHỈ XEM · KẾT QUẢ CHƯA ĐƯỢC CÔNG KHAI',1.1);h15RefreshLeaderboard();});

// A new round clears the previous unsaved preview; saved scores remain untouched.

/* L1 consolidated: legacy newState implementation removed */

// PC live mode selector remains visible in the right combat rail; mobile remains AUTO-only.

/* L1 consolidated: legacy h16UpdateFireModeUI implementation removed */

// Version/update comparison uses this build.
/* L1 consolidated: legacy g2IsNewer implementation removed */
h18ApplyControlSide(h18ControlSide,{persist:false});/* L1 consolidated: stale H18 version refresh removed */h16UpdateFireModeUI();g1RefreshInstallUI();g1RefreshUpdateUI();


/* === v3.9.0 J1 · NPC VISIBILITY · GAMEPLAY-ONLY FIRE MODES · 3s AUTO ITEMS · UI BALANCE === */

// Mobile detection must not misclassify Windows/touchscreen PCs; only true mobile/tablet UAs are forced to AUTO.
function j1IsRealMobile(){
  const ua=navigator.userAgent||'';
  const explicit=!!navigator.userAgentData?.mobile || /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile/i.test(ua);
  const ipadDesktopUA=(navigator.platform==='MacIntel' && Number(navigator.maxTouchPoints||0)>1);
  return explicit||ipadDesktopUA;
}
h17IsMobileGameplay=j1IsRealMobile;
h16IsMobileControl=j1IsRealMobile;

// Q1 consolidated: J1 minimum NPC radius merged into canonical enemyScreen.

// AUTO should never erase NPCs before they become visually readable. This was the main cause of "NPC not visible" on mobile:
// v3.7 could target a freshly spawned NPC at depth ~.99 and kill it while it was only a few pixels wide.
function j1NpcEngageable(e){
  if(!e||e.dead||e.boss)return false;
  const sc=enemyScreen(e),diff=state?.difficulty||'normal';
  const depthGate=j1IsRealMobile()?.965:(diff==='easy'?.93:diff==='hard'?.89:.91);
  return Number.isFinite(sc?.x)&&Number.isFinite(sc?.y)&&Number.isFinite(sc?.r)&&sc.r>=10&&e.depth<=depthGate;
}

/* L1 consolidated: legacy h16ChooseAutoTarget implementation removed */

// Spawn anti-stall: if a stage is active and there is no living NPC before Boss time, force the next natural spawn promptly.

/* L1 consolidated: legacy update implementation removed */

// Keep PC mode buttons live only in the right gameplay rail. Mobile is always AUTO.

/* L1 consolidated: legacy h16SetFireMode implementation removed */
function j1RefreshFireButtons(){
  const mobile=j1IsRealMobile(),block=$('#gameFireModeBlock'),mode=mobile?'auto':h16CurrentFireMode();
  if(block)block.classList.toggle('hidden',mobile||!state||state.mode!=='playing');
  for(const b of document.querySelectorAll('#gameFireModeBlock [data-fire-mode]')){b.classList.toggle('active',b.dataset.fireMode===mode);b.disabled=mobile;}
}

/* L1 consolidated: legacy h16UpdateFireModeUI implementation removed */
const j1ResumeBase=resumeGame;resumeGame=function(){const r=j1ResumeBase();j1RefreshFireButtons();return r;};
const j1PauseBase=pauseGame;pauseGame=function(){const r=j1PauseBase();j1RefreshFireButtons();return r;};
const j1GoHomeBase=goHome;goHome=function(){const r=j1GoHomeBase();j1RefreshFireButtons();return r;};

// 3-second power-up grace period. If the player ignores a field item, it activates automatically.
// If activating would be useless (e.g. full health), it waits safely until the effect can actually help.

/* L1 consolidated: legacy dropSpecificPowerup implementation removed */
/* L1 consolidated: legacy j1CanAutoUse implementation removed */
/* L1 consolidated: legacy j1AutoActivatePowerups implementation removed */

/* L1 consolidated: legacy drawPowerups implementation removed */

// Final item repair: all ordinary items must produce both real gameplay state and weapon-screen FX.

/* L1 consolidated: legacy collectPowerups implementation removed */

// J1 version is the authoritative build identity.
/* L1 consolidated: legacy j1RefreshVersion implementation removed */
/* L1 consolidated: legacy g2IsNewer implementation removed */

/* L1 consolidated: stale J1 version refresh removed */j1RefreshFireButtons();g1RefreshInstallUI();g1RefreshUpdateUI();


/* === v4.2.0 W1 · END-OF-RUN LEADERBOARD + ALWAYS-ON NPC PRESSURE + INTERACTIVE MAP PREVIEW === */
const L1_DIFF={
  easy:{speed:.90,density:.68,capLo:3,capHi:4},
  normal:{speed:1,density:1,capLo:4,capHi:5},
  hard:{speed:1.12,density:1.50,capLo:6,capHi:8}
};
const L1_WEAPON_LEVELS=[
  {shots:1,cooldown:.76,spread:0,range:1,pierce:0,label:'LV1'},
  {shots:1,cooldown:.68,spread:0,range:1.05,pierce:0,label:'LV2'},
  {shots:2,cooldown:.64,spread:22,range:1.08,pierce:0,label:'LV3 · 2 TIA'},
  {shots:2,cooldown:.60,spread:26,range:1.15,pierce:0,label:'LV4 · TẦM XA'},
  {shots:3,cooldown:.55,spread:24,range:1.20,pierce:0,label:'LV5 · 3 TIA'},
  {shots:3,cooldown:.51,spread:26,range:1.24,pierce:1,label:'LV6 · XUYÊN'},
  {shots:5,cooldown:.46,spread:20,range:1.30,pierce:1,label:'LV7 · 5 TIA'},
  {shots:5,cooldown:.42,spread:18,range:1.36,pierce:2,label:'LV8 · OVERDRIVE'}
];
const L1_POWER_EFFECTS={
  heal:{includeInLogo:true,max:10},shield:{includeInLogo:true,max:12},drone:{includeInLogo:true,max:12},adrenaline:{includeInLogo:true,max:8},vaccine:{includeInLogo:true,max:10},sterile:{includeInLogo:true,max:8},gppBoost:{includeInLogo:true,max:12},bossDrone:{includeInLogo:true,max:20},overdrive:{includeInLogo:true,max:12}
};
function l1Difficulty(){return L1_DIFF[state?.difficulty]||L1_DIFF.normal;}
function l1WeaponLevel(){return clamp((state?.stageIndex||0)+1,1,8);}
function l1WeaponProfile(){const base=L1_WEAPON_LEVELS[l1WeaponLevel()-1];if((state?.l1LogoUltimate||0)>0)return {...L1_WEAPON_LEVELS[7],cooldown:.36,range:1.45,pierce:3,label:'★ GPP ULTIMATE · MAX'};return base;}
function l1NpcClass(type){if(['sprinter','flyer','charger','spore','ambusher'].includes(type))return'fast';if(['crawler','support','shield','nucleus','elite','breather','cluster'].includes(type))return'heavy';return'normal';}
function l1TypeSpeed(type){const c=l1NpcClass(type);return c==='fast'?2.05:c==='heavy'?3.45:2.30;}
function l1NpcHp(type){if(type==='elite')return 10;if(l1NpcClass(type)==='heavy')return 7;if(l1NpcClass(type)==='fast')return 3.5;return 5;}
function d1SpeedTarget(diff=state?.difficulty||'normal',stage=state?.stageIndex||0){const base=(D1_SPEED_TARGETS.normal||[])[clamp(stage,0,7)]||.52;return base*H1_NPC_SPEED_MULT*1.18*(L1_DIFF[diff]?.speed||1);}
function d1ActiveCap(){const d=l1Difficulty(),s=state?.stageIndex||0,t=state?.stageElapsed||0,progress=clamp(s/7*.68+t/G1_BOSS_TIME*.32,0,1);return Math.round(d.capLo+(d.capHi-d.capLo)*progress);}
function d1SpawnInterval(){const d=l1Difficulty(),active=(state?.enemies||[]).filter(e=>!e.dead&&!e.boss).length,cap=d1ActiveCap(),fill=cap?active/cap:0;const normal=.78-(state?.stageIndex||0)*.025-clamp((state?.stageElapsed||0)/G1_BOSS_TIME,0,1)*.18;let sec=Math.max(.38,normal)/d.density;if(fill<.35)sec*=.42;else if(fill<.65)sec*=.68;return sec*(.86+Math.random()*.24);}
function l1CanAutoUse(kind){if(!state)return false;const max=state.maxHealth||10;if(kind==='heal')return state.health<max-.05;if(kind==='shield')return(state.shield||0)<10;if(kind==='drone')return(state.drone||0)<8;if(kind==='adrenaline')return(state.adrenaline||0)<4;if(kind==='vaccine')return(state.vaccine||0)<5;if(kind==='sterile')return(state.sterile||0)<4;return true;}
function activateLogoUltimate(source='gpp'){
  if(!state)return false;for(const [key,effect] of Object.entries(L1_POWER_EFFECTS)){if(!effect.includeInLogo)continue;if(key==='heal')state.health=state.maxHealth||effect.max;else if(key==='overdrive')state.l1LogoUltimate=Math.max(state.l1LogoUltimate||0,effect.max);else state[key]=Math.max(state[key]||0,effect.max);}state._bossDroneTimer=.03;
  for(const e of [...state.enemies])if(!e.dead&&!e.boss)hitEnemy(e,Math.max(3,e.hp*.72),false,true,false,{logo:true});
  state.f1AnnihilatorFx=1;g2SetWeaponScreenFx(source==='bossGpp'?'bossGpp':'gpp',2400);state.h1FxKind='gpp';state.h1FxStart=performance.now();state.h1FxBurstUntil=performance.now()+2600;sfx.gpp();toast('★ GPP ULTIMATE · TOÀN BỘ COMBO · MAX',1.55);updateHUD();return true;
}
function createGameState(stageIndex=0){
  stageIndex=clamp(stageIndex,0,A1_STAGE_COUNT-1);const cfg=STAGES[stageIndex],difficulty=window.__difficulty||'normal',d=DIFF[difficulty],baseTarget=(D1_EXPECTED_KILLS[difficulty]||D1_EXPECTED_KILLS.normal)[stageIndex]||36;
  h18PendingShare=null;h18PreviewOnly=false;h15PendingRecord=null;$('#leaderboardCurrentResult')?.classList.add('hidden');$('#gameOverLeaderboardRecordBtn')?.classList.add('hidden');$('#victoryLeaderboardRecordBtn')?.classList.add('hidden');
  return {mode:'playing',stageIndex,cfg,difficulty,health:10,maxHealth:10,score:stageIndex===0?0:(state?.score||0),enemies:[],particles:[],tracers:[],hitMarkers:[],enemyShots:[],powerups:[],rewardNpcs:[],spawnLeft:0,bossSpawned:false,bossDefeated:false,spawnTimer:.16,contamination:100,kills:0,shots:0,hits:0,combo:0,comboTimer:0,weapon:0,lastFire:0,bombs:3,beam:100,shield:0,drone:0,adrenaline:0,vaccine:0,sterile:0,gppBoost:0,bossDrone:0,stageElapsed:0,transition:0,zoom:0,shake:0,toastTimer:0,nextPanel:false,playerX:0,playerVX:0,moveLeft:false,moveRight:false,mobileMoveAxis:0,lastMoveDir:1,dashCooldown:0,dashTimer:0,dashDir:0,dodgeTilt:0,recoil:0,muzzleFlash:0,dodgeMessage:0,rewardNpcTimer:difficulty==='easy'?3:difficulty==='hard'?4.2:3.6,rewardNpcCount:0,rewardNpcMax:d.rewardMax||4,_rewardSerial:0,_supportHudKey:'',environmentClean:0,bossCleanse:0,cleanSparkle:0,stageIntro:1.9,d1BossAt:G1_BOSS_TIME,d1NaturalSpawns:0,d1MinorKills:0,d1BossStartedAt:0,_minorCleanTarget:baseTarget*3,pickupFx:[],rewardBanner:null,_supportJustAdded:null,_supportJustUntil:0,f1Upgrades:{damage:0,fireRate:0,survival:0,drone:0,supply:0},bossRewardFx:null,bossRewardPending:null,bossRewardShown:false,f1WeaponEffect:null,f1WeaponEffectUntil:0,f1AnnihilatorFx:0,f1CleanChimeMark:0,f1SparkleChime:false,f1BossKilledAt:0,f1BossKillDuration:0,g1LastValidSpawnAt:0,g1StallWatch:0,g1SpawnRepairs:0,h15LastSupplyAt:0,h15SupplyGuarantee:difficulty==='easy'?14:difficulty==='hard'?20:17,h16FireMode:j1IsRealMobile()?'auto':h16PreferredFireMode,h16ManualLock:null,h16AutoTarget:null,h16LockFxUntil:0,h16LockSerial:0,h16AutoBombAt:0,h17NpcShots:[],h17DamageIFrame:0,h17PlayerHitFx:null,h17LastAutoShotAt:0,l1LogoUltimate:0,l1GameTime:0,l1WeaponLevel:stageIndex+1,q1BossHitIFrame:0,q1NearMissToast:0,w1PlayerIdle:0,w1PrevPlayerX:0,w1EndLeaderboardPrepared:false};
}
function newState(stageIndex=0){return createGameState(stageIndex);}
function spawnEnemy(type,boss=false){
  if(!state)return null;const base=ENEMY[type]||ENEMY.basic,d=DIFF[state.difficulty],style=BOSS_STYLE[state.stageIndex]||BOSS_STYLE[BOSS_STYLE.length-1],x=boss?.5:sourceXFor(type),side=x<.5?-1:1;
  const hp=boss?state.cfg.bossHp*d.bossHp*G2_BOSS_HP_MULT*H1_BOSS_EXTRA_MULT:l1NpcHp(type);
  const e={id:Math.random(),type,boss,name:boss?state.cfg.boss:null,bossKind:boss?state.cfg.bossKind:null,x,baseX:x,depth:boss?.79:.955+Math.random()*.035,hp,maxHp:hp,speedBase:base.speed*(.90+Math.random()*.16),speed:base.speed,rad:boss?style.rad:base.rad,color:boss?style.color:base.color,accent:boss?style.accent:null,shotColor:boss?style.shot:null,phase:Math.random()*6.28,wobble:Math.random()*1.8+1,attackTimer:boss?1.15:999,summon:999,flash:0,dead:false,side,base,lastBossPhase:1,guard:0,orbit:Math.random()*6.28,bossSummoned:false,countsForClean:false,d1SummonDone:[false,false,false],g1Motion:base?.g1Motion||type,g1Lane:x,g1TargetX:x,g1Decision:.55+Math.random()*1.3,g1Pause:Math.random()*.5,g1Burst:0,g1GhostX:x,h17Ranged:!boss,h17ShotCooldown:2.8+Math.random()*2.0,h17ShotWarn:0,h17ShotQueued:false,h17ThreatPulse:0};
  if(!boss)e.h17Ranged=true;
  state.enemies.push(e);if(boss){e.g2BossScaled=true;e.h1BossScaled=true;e.g1DarkIntro=2.2;state.bossIntro=2.05;state.d1BossStartedAt=state.stageElapsed;state.enemyShots.length=0;show(UI.bossBar);UI.bossName.textContent=state.cfg.boss;sfx.boss();toast('⚠ GIÂY 180 · BOSS XUẤT HIỆN!',2);}return e;
}
function spawnMini(px,py){if(!state)return null;const base=ENEMY.spore,x=clamp(.32+Math.random()*.36,.08,.92),hp=2.5;const e={id:Math.random(),type:'spore',boss:false,name:null,x,baseX:x,depth:.46+Math.random()*.09,hp,maxHp:hp,speedBase:base.speed*(.82+Math.random()*.16),speed:base.speed,rad:14,color:base.color,phase:Math.random()*6.28,wobble:1.8,attackTimer:999,summon:999,flash:0,dead:false,side:x<.5?-1:1,base,lastBossPhase:1,guard:0,orbit:Math.random()*6.28,bossSummoned:false,countsForClean:false,d1SummonDone:[false,false,false],g1Motion:'mini',h17Ranged:true,h17ShotCooldown:4.6+Math.random()*2.4,h17ShotWarn:0,h17ShotQueued:false,h17ThreatPulse:0};state.enemies.push(e);return e;}
function dropSpecificPowerup(kind,x,y){if(!state)return;state.powerups.push({id:`p-${Date.now()}-${Math.random()}`,x,y,kind,t:0,life:20,dead:false,beam:1,l1AutoRemaining:3,l1Waiting:false});}
function activatePowerup(p,{auto=false}={}){if(!state||!p||p.dead)return false;const kind=p.kind,max=state.maxHealth||10;if(auto&&!l1CanAutoUse(kind)){p.l1Waiting=true;return false;}p.dead=true;p.l1Waiting=false;if(kind==='heal')state.health=Math.min(max,state.health+2);else if(kind==='shield')state.shield=Math.max(state.shield||0,12);else if(kind==='drone')state.drone=Math.max(state.drone||0,10);else if(kind==='adrenaline')state.adrenaline=Math.max(state.adrenaline||0,5);else if(kind==='vaccine')state.vaccine=Math.max(state.vaccine||0,7);else if(kind==='sterile')state.sterile=Math.max(state.sterile||0,6);else if(kind==='gpp')activateLogoUltimate('gpp');d1PickupFeedback(kind,p.x,p.y);g2SetWeaponScreenFx(kind,kind==='heal'?1800:2400);state.h1FxKind=kind;state.h1FxStart=performance.now();state.h1FxBurstUntil=performance.now()+2400;state._supportHudKey='';if(kind!=='gpp')sfx.power();updateHUD();return true;}
function collectPowerupAt(x,y){if(!state)return false;const p=state.powerups.filter(o=>!o.dead).map(o=>({o,d:Math.hypot(x-o.x,y-o.y)})).filter(a=>a.d<48).sort((a,b)=>a.d-b.d)[0]?.o;return p?activatePowerup(p):false;}
function collectPowerups(x,y){return collectPowerupAt(x,y);}
function drawPowerups(){if(!state)return;for(const p of state.powerups){if(p.dead)continue;const m=D1_REWARD_META[p.kind]||D1_REWARD_META.drone,isGpp=p.kind==='gpp',r=isGpp?31:26,pulse=1+Math.sin(p.t*4.2)*.055;ctx.save();ctx.translate(p.x,p.y);ctx.scale(pulse,pulse);ctx.shadowColor=m.color;ctx.shadowBlur=isGpp?18:10;ctx.fillStyle='rgba(4,42,48,.92)';ctx.strokeStyle=m.color;ctx.lineWidth=isGpp?3:2;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.shadowBlur=0;if(isGpp&&logoIcon.complete){ctx.save();ctx.beginPath();ctx.arc(0,0,r*.76,0,Math.PI*2);ctx.clip();ctx.drawImage(logoIcon,-r*.76,-r*.76,r*1.52,r*1.52);ctx.restore();}else{ctx.font='24px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='white';ctx.fillText(m.icon,0,1);}const left=Math.max(0,p.l1AutoRemaining??3),waiting=left<=0&&!l1CanAutoUse(p.kind);ctx.font='1000 8px system-ui';ctx.fillStyle=waiting?'#fff0a0':'#fff';ctx.textAlign='center';ctx.fillText(waiting?'ĐỢI':`${Math.max(1,Math.ceil(left))}`,0,-42);ctx.restore();}}
function l1TargetAt(x,y){if(!state)return null;const hits=[];for(const n of state.rewardNpcs||[]){if(n.dead)continue;const s=rewardNpcScreen(n),dist=Math.hypot(x-s.x,y-s.y),r=Math.max(j1IsRealMobile()?44:36,s.r*(j1IsRealMobile()?1.85:1.6));if(dist<=r)hits.push({kind:'reward',entity:n,screen:s,dist,norm:dist/r,z:2000});}for(const e of state.enemies||[]){if(e.dead)continue;const s=enemyScreen(e),dist=Math.hypot(x-s.x,y-s.y),r=Math.max(e.boss?(j1IsRealMobile()?66:58):(j1IsRealMobile()?44:36),s.r*(e.boss?1.42:(j1IsRealMobile()?1.78:1.55)));if(dist<=r)hits.push({kind:'enemy',entity:e,screen:s,dist,norm:dist/r,z:(1-e.depth)*1000});}hits.sort((a,b)=>b.z-a.z||a.norm-b.norm||a.dist-b.dist);return hits[0]||null;}
function q1NearestNpc(){if(!state)return null;const v=gameplayViewport(),cx=v.center;return(state.enemies||[]).filter(e=>!e.dead&&!e.boss&&j1NpcEngageable(e)).map(e=>({e,s:enemyScreen(e)})).sort((a,b)=>a.e.depth-b.e.depth||Math.abs(a.s.x-cx)-Math.abs(b.s.x-cx))[0]?.e||null;}
function h16ChooseAutoTarget(){
  if(!state)return null;
  const manual=h16ResolveTarget(state.h16ManualLock);if(manual)return manual;if(state.h16ManualLock)state.h16ManualLock=null;
  const npc=q1NearestNpc();if(npc){state.h16AutoTarget=h16TargetRef('enemy',npc);return h16ResolveTarget(state.h16AutoTarget);}
  const boss=(state.enemies||[]).find(e=>!e.dead&&e.boss);if(boss){state.h16AutoTarget=h16TargetRef('enemy',boss);return h16ResolveTarget(state.h16AutoTarget);}
  const supply=(state.rewardNpcs||[]).filter(n=>!n.dead).sort((a,b)=>a.life-b.life)[0];if(supply){state.h16AutoTarget=h16TargetRef('reward',supply);return h16ResolveTarget(state.h16AutoTarget);}
  state.h16AutoTarget=null;return null;
}
function l1PredictScreen(target){const s=target.kind==='reward'?rewardNpcScreen(target.entity):enemyScreen(target.entity);if(target.kind!=='enemy'||target.entity.boss)return s;const e=target.entity,lead=.10,prog=Math.max(.001,1-e.depth),dx=((e.x-(e._l1PrevX??e.x))/Math.max(.001,state?._l1LastDt||.016))*lead*gameplayViewport().width*(.22+.78*prog);return {...s,x:clamp(s.x+dx,gameplayViewport().left+4,gameplayViewport().left+gameplayViewport().width-4)};}
function h16AutoFireTick(){if(!state||state.mode!=='playing'||state.transition>0||h16CurrentFireMode()!=='auto'||state.bossIntro>0)return;const t=h16ChooseAutoTarget();if(!t)return;const s=l1PredictScreen(t);pointer.x=s.x;pointer.y=s.y;const w=WEAPONS[state.weapon],now=performance.now();if(w.kind==='bomb'&&now-(state.h16AutoBombAt||0)<1450)return;const before=state.lastFire;state.h16AutoShot=true;try{shoot(s.x,s.y)}finally{state.h16AutoShot=false;}if(state.lastFire!==before){state.h17LastAutoShotAt=now;weaponSingleFlashUntil=now+420;if(w.kind==='bomb')state.h16AutoBombAt=now;}}
function h16SetFireMode(mode,{persist=true,announce=true}={}){if(j1IsRealMobile())mode='auto';mode=mode==='manual'?'manual':'auto';h16PreferredFireMode=mode;if(persist&&!j1IsRealMobile())try{localStorage.setItem(H16_FIRE_MODE_KEY,mode)}catch{}if(state){state.h16FireMode=mode;state.h16ManualLock=null;state.h16AutoTarget=null;pointer.down=false;}h16UpdateFireModeUI();if(announce&&state?.mode==='playing')toast(mode==='auto'?'⚡ AUTO FIRE · CLICK/CHẠM ĐỂ KHÓA':'🎯 BẮN THỦ CÔNG · CHUỘT NGẮM/BẮN',1.0);}
function h16UpdateFireModeUI(){const mobile=j1IsRealMobile(),mode=mobile?'auto':h16CurrentFireMode();for(const b of document.querySelectorAll('[data-fire-mode]')){b.classList.toggle('active',b.dataset.fireMode===mode);b.disabled=mobile;}const block=$('#gameFireModeBlock');if(block)block.classList.toggle('hidden',mobile||!state||state.mode!=='playing');const hud=$('#fireModeHud');if(hud){hud.classList.toggle('manual',mode==='manual');hud.textContent=mode==='auto'?(mobile?'⚡ AUTO · TỰ CHỌN · CHẠM ĐỂ KHÓA':'⚡ AUTO · CLICK ĐỂ KHÓA'):'🎯 THỦ CÔNG · CHUỘT NGẮM/BẮN';}}
function h16DrawTargetLock(t){if(!state||state.mode!=='playing'||state.transition>0||h16CurrentFireMode()!=='auto')return;const manual=h16ResolveTarget(state.h16ManualLock),target=manual||h16ChooseAutoTarget();if(!target)return;const s=target.screen||l1PredictScreen(target),boss=target.kind==='enemy'&&target.entity.boss,r=Math.max(target.kind==='reward'?35:boss?66:32,s.r*(boss?1.32:1.42)),locked=!!manual,col=target.kind==='reward'?'#7dfff0':boss?'#ffcf6a':locked?'#ffe77d':'#7fffe8';ctx.save();ctx.translate(s.x,s.y);ctx.globalCompositeOperation='screen';ctx.strokeStyle=col;ctx.shadowColor=col;ctx.shadowBlur=locked?20:12;ctx.lineWidth=locked?2.8:1.8;ctx.globalAlpha=locked?.9:.6;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();for(const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]){ctx.beginPath();ctx.moveTo(sx*r,sy*(r-r*.25));ctx.lineTo(sx*r,sy*r);ctx.lineTo(sx*(r-r*.25),sy*r);ctx.stroke();}ctx.fillStyle=col;ctx.font='1000 9px system-ui';ctx.textAlign='center';ctx.fillText(locked?'🔒 ĐÃ KHÓA':boss?'🔒 BOSS':'⚡ AUTO',0,-r-10);if(target.kind==='enemy'&&target.entity.h17Ranged)ctx.fillText('↯ PHẢN KÍCH',0,r+15);ctx.restore();}
function aimHit(x,y,weapon){
  if(!state)return{hit:false,x,y,crit:false};const profile=l1WeaponProfile(),range=profile.range||1;
  const rewardCandidates=(state.rewardNpcs||[]).filter(n=>!n.dead).map(n=>{const s=rewardNpcScreen(n),dist=Math.hypot(x-s.x,y-s.y),r=s.r*(1.30+(range-1)*.24);return{n,s,dist,r}}).filter(c=>c.dist<c.r).sort((a,b)=>a.dist-b.dist);
  const candidates=[];for(const e of state.enemies){if(e.dead)continue;const s=enemyScreen(e),dist=Math.hypot(x-s.x,y-s.y),r=s.r*(1.12+(range-1)*.34);if(dist<r)candidates.push({e,s,dist,r});}candidates.sort((a,b)=>a.e.depth-b.e.depth||a.dist-b.dist);
  if(weapon.kind==='spray'){let hit=false,target=null;for(const c of rewardCandidates){if(c.dist<145*range){hitRewardNpc(c.n,weapon.damage*1.2);hit=true;target=target||c.s;}}for(const e of state.enemies){const s=enemyScreen(e),dist=Math.hypot(x-s.x,y-s.y);if(dist<145*range&&e.depth<Math.min(.78,.62+(range-1)*.3)){hitEnemy(e,weapon.damage*(1.15-e.depth*.35),true,false,false);hit=true;target=target||s;}}return{hit,x:target?.x||x,y:target?.y||y,crit:false};}
  if(weapon.kind==='bomb'){explode(x,y,weapon.damage);for(const c of(state.rewardNpcs||[]).filter(n=>!n.dead).map(n=>({n,s:rewardNpcScreen(n)}))){if(Math.hypot(x-c.s.x,y-c.s.y)<220*range)hitRewardNpc(c.n,weapon.damage*.7);}return{hit:true,x,y,crit:false};}
  const reward=rewardCandidates[0],enemy=candidates[0];if(reward&&(!enemy||reward.dist/reward.r<=enemy.dist/enemy.r)){hitRewardNpc(reward.n,weapon.damage*(weapon.kind==='pierce'?1.25:1));return{hit:true,x:reward.s.x,y:reward.s.y,crit:false};}
  if(!enemy)return{hit:false,x,y,crit:false};const maxTargets=Math.max(1,1+(profile.pierce||0)+(weapon.kind==='pierce'?1:0));let hit=false,crit=false;const chosen=weapon.kind==='beam'?[enemy]:candidates.slice(0,maxTargets);
  for(const c of chosen){const ratio=c.dist/Math.max(1,c.s.r),cc=ratio<(weapon.kind==='beam'?.30:weapon.kind==='pierce'?.32:.35)||!!(weapon.kind==='pierce'&&c.e.base?.core);const mult=weapon.kind==='beam'?(cc?1.35:1):weapon.kind==='pierce'?(cc?1.35:1):(cc?1.6:1);hitEnemy(c.e,weapon.damage*mult,true,false,cc);hit=true;crit=crit||cc;}
  if(crit&&weapon.kind==='shot')toast('🎯 CORE HIT!',.55);return{hit,x:enemy.s.x,y:enemy.s.y,crit};
}
function hitEnemy(e,damage,countHit=true,drone=false,crit=false,meta={}){if(!state||!e||e.dead)return;let dmg=damage;if(e.base?.shield&&e.hp>e.maxHp*.45)dmg*=.62;if(e.boss&&(meta.sideShot||state._l1SideShot))dmg*=.30;e.hp-=dmg;e.flash=1;const s=enemyScreen(e);burstAt(s.x,s.y,e.color,drone?3:(crit?9:5));state.hitMarkers.push({x:s.x,y:s.y,life:crit?.28:.18,max:crit?.28:.18,crit});sfx.hit(s.x);if(crit)sfx.crit(s.x);if(e.boss){state.h1LastBossScreen={x:s.x,y:s.y,r:s.r};UI.bossFill.style.width=Math.max(0,e.hp/e.maxHp*100)+'%';UI.bossHp.textContent=Math.max(0,Math.ceil(e.hp/e.maxHp*100))+'%';}if(e.hp<=0){e.dead=true;sfx.kill(s.x);state.kills++;state.score+=e.boss?2500:(e.base?.score||100);if(e.countsForClean&&!e.boss){state.cleanMinorKills=(state.cleanMinorKills||0)+1;state.d1MinorKills=(state.d1MinorKills||0)+1;}state.combo++;state.comboTimer=1.8;setCombo();burstAt(s.x,s.y,e.color,e.boss?32:12);if(e.base?.cluster&&!e.boss){spawnMini(s.x,s.y);spawnMini(s.x,s.y);}if(!e.boss&&Math.random()<.09)spawnPowerup(s.x,s.y);if(e.boss){state.f1BossKilledAt=state.stageElapsed;state.f1BossKillDuration=Math.max(0,state.stageElapsed-(state.d1BossStartedAt||G1_BOSS_TIME));for(const other of state.enemies)if(other!==e&&!other.boss)other.dead=true;hide(UI.bossBar);toast('💥 BOSS ĐÃ BỊ KHỬ NHIỄM!',1.8);}}}
function l1ShotOffsets(n,spread){if(n<=1)return[0];if(n===2)return[0,((state?.shots||0)%2?-1:1)*spread*.72];if(n===3)return[0,-spread,spread];if(n>=5)return[0,-spread,spread,-spread*2,spread*2].slice(0,n);return[0];}
function l1ApplyShotAt(x,y,w,profile){const offsets=(w.kind==='bomb'||w.kind==='spray')?[0]:l1ShotOffsets(profile.shots,profile.spread),results=[];for(let i=0;i<offsets.length;i++){const ox=offsets[i];state._l1SideShot=i>0;const res=aimHit(x+ox,y,w);results.push(res);addTracer(w.kind,res.x,res.y);}state._l1SideShot=false;return results;}
function shoot(x,y){if(!state||state.mode!=='playing'||state.transition>0)return;if(h16CurrentFireMode()==='auto'&&!state.h16AutoShot)return;if(h16CurrentFireMode()!=='auto'&&collectPowerupAt(x,y)){state.lastFire=performance.now();return;}const now=performance.now(),w=WEAPONS[state.weapon],p=l1WeaponProfile();let rate=p.cooldown;if(state.adrenaline>0)rate*=.82;if(state.gppBoost>0)rate*=.90;if(now-state.lastFire<w.cooldown*rate)return;if(w.kind==='bomb'&&state.bombs<=0){toast('Bom vitamin đã hết',.9);return;}if(w.kind==='beam'&&state.beam<5){toast('Tia miễn dịch đang hồi',.8);return;}state.lastFire=now;state.shots++;if(w.kind==='bomb')state.bombs--;if(w.kind==='beam')state.beam=Math.max(0,state.beam-4.5);state.recoil=Math.min(1,state.recoil+(w.kind==='bomb'?.85:w.kind==='pierce'?.62:.34));state.muzzleFlash=1;sfx.weapon(w.kind,x);const results=l1ApplyShotAt(x,y,w,p);if(results.some(r=>r.hit))state.hits++;const m=getMuzzlePoint();muzzleBurst(m.x,m.y,w.kind);}
function updateHUD(){if(!state)return;const hp=`${Math.max(0,state.health).toFixed(state.health%1?1:0)}/${state.maxHealth||10}`,hpPct=clamp(state.health/(state.maxHealth||10)*100,0,100),clean=Math.round(state.environmentClean||0),minor=state.enemies.filter(e=>!e.dead&&!e.boss).length,time=state.bossSpawned?'BOSS':d1FormatClock(d1Countdown());UI.healthText.textContent=hp;UI.healthFill.style.width=hpPct+'%';UI.cleanText.textContent=`KHỬ NHIỄM ${clean}%`;UI.cleanFill.style.width=clean+'%';UI.score.textContent=state.score.toLocaleString('vi-VN');UI.enemy.textContent=`Virus: ${minor}`;UI.stageName.textContent=`MÀN ${state.stageIndex+1} · ${state.cfg.name}`;if(UI.diffBadge)UI.diffBadge.textContent=`${DIFF[state.difficulty].label} · ${state.difficulty==='easy'?'MẬT ĐỘ THẤP':state.difficulty==='hard'?'MẬT ĐỘ CAO':'CÂN BẰNG'}`;if($('#leftHealthText'))$('#leftHealthText').textContent=hp;if($('#leftHealthFill'))$('#leftHealthFill').style.width=hpPct+'%';if($('#leftStageNo'))$('#leftStageNo').textContent=`MÀN ${state.stageIndex+1}`;if($('#leftStageName'))$('#leftStageName').textContent=state.cfg.name;if($('#rightScoreText'))$('#rightScoreText').textContent=state.score.toLocaleString('vi-VN');if($('#rightTimeText'))$('#rightTimeText').textContent=time;if($('#timeTextMobile'))$('#timeTextMobile').textContent=time;if($('#rightEnemyText'))$('#rightEnemyText').textContent=minor;if($('#rightComboText'))$('#rightComboText').textContent=`×${state.combo||0}`;const w=WEAPONS[state.weapon],wp=l1WeaponProfile();UI.weaponIcon.textContent=w.icon;UI.weaponName.textContent=`${w.name} · ${wp.label}`;UI.weaponStatus.textContent=(state.l1LogoUltimate>0?'★ ULTIMATE · ':`LV${l1WeaponLevel()} · `)+`${wp.shots} TIA · ${Math.round(1/wp.cooldown*10)/10}× TỐC`;updateSupportUI();}
function cleanupCombat(){if(!state)return;const p=state.h1LastBossScreen||{x:gameplayViewport().center,y:innerHeight*.50,r:90};state.h1BossDeathFx={start:performance.now(),dur:760,x:p.x,y:p.y,r:p.r};state.enemyShots.length=0;state.h17NpcShots.length=0;state.tracers.length=0;state.hitMarkers.length=0;state.particles.length=0;state.powerups.length=0;state.rewardNpcs.length=0;for(const e of state.enemies||[]){e.h15AttackSerial=(e.h15AttackSerial||0)+1;e.h17ShotWarn=0;e.h17ShotQueued=false;}state.enemies.length=0;state.h17PlayerHitFx=null;state.h17DamageIFrame=0;state.muzzleFlash=0;state.recoil=0;state.shake=0;pointer.down=false;}
function h1CombatCleanup(){return cleanupCombat();}
function updateGame(dt){if(!state||state.mode!=='playing')return;const d=DIFF[state.difficulty];state._l1LastDt=dt;state.l1GameTime+=dt;if(state.transition>0){state.transition+=dt;const cleanP=clamp(state.transition/F1_CLEAN_SECONDS,0,1);state.environmentClean=50+50*d1Smooth(cleanP);state.contamination=100-state.environmentClean;state.zoom=Math.min(1,state.transition/F1_CLEAN_SECONDS);state.cleanSparkle=state.transition>F1_CLEAN_SECONDS?clamp((state.transition-F1_CLEAN_SECONDS)/F1_SPARKLE_SECONDS,0,1):0;if(state.transition>=F1_CLEAN_SECONDS+F1_SPARKLE_SECONDS&&!state.nextPanel){state.nextPanel=true;state.environmentClean=100;state.contamination=0;state.cleanSparkle=1;f1ShowBossRewards();}updateHUD();return;}state.stageElapsed+=dt;if(state.stageIntro>0)state.stageIntro=Math.max(0,state.stageIntro-dt);state.zoom=Math.min(.10,state.stageElapsed*.00072);if(state.shake>0)state.shake=Math.max(0,state.shake-dt);if(state.bossIntro>0)state.bossIntro=Math.max(0,state.bossIntro-dt);state.dashCooldown=Math.max(0,state.dashCooldown-dt);state.dashTimer=Math.max(0,state.dashTimer-dt);state.dodgeTilt*=Math.pow(.001,dt);state.recoil=Math.max(0,state.recoil-dt*7.5);state.muzzleFlash=Math.max(0,state.muzzleFlash-dt*10);state.dodgeMessage=Math.max(0,state.dodgeMessage-dt);const axis=movementAxis();if(Math.abs(axis)>.03)state.lastMoveDir=axis<0?-1:1;const speedBoost=state.adrenaline>0?1.24:1;if(state.dashTimer>0)state.playerVX=state.dashDir*2.42*speedBoost;else{const accel=6.3*speedBoost,maxSpeed=1.05*speedBoost,friction=8;if(Math.abs(axis)>.03)state.playerVX+=axis*accel*dt;else state.playerVX*=Math.max(0,1-friction*dt);state.playerVX=clamp(state.playerVX,-maxSpeed,maxSpeed);}state.playerX=clamp(state.playerX+state.playerVX*dt,-1,1);if(Math.abs(state.playerX)>=1&&Math.sign(state.playerVX)===Math.sign(state.playerX))state.playerVX=0;const w1MoveDelta=Math.abs(state.playerX-(state.w1PrevPlayerX??state.playerX));state.w1PlayerIdle=w1MoveDelta>.0015?0:(state.w1PlayerIdle||0)+dt;state.w1PrevPlayerX=state.playerX;if(state.toastTimer>0){state.toastTimer-=dt;if(state.toastTimer<=0)hide(UI.toast);}if(state.comboTimer>0){state.comboTimer-=dt;if(state.comboTimer<=0){state.combo=0;setCombo();}}for(const f of ['shield','drone','adrenaline','vaccine','sterile','gppBoost','bossDrone','l1LogoUltimate'])if(state[f]>0)state[f]=Math.max(0,state[f]-dt);state.beam=Math.min(100,state.beam+18*dt);
  if(!state.bossSpawned&&state.rewardNpcCount<state.rewardNpcMax){state.rewardNpcTimer-=dt;if(state.rewardNpcTimer<=0&&!state.rewardNpcs.some(n=>!n.dead)){spawnRewardNpc();state.rewardNpcTimer=(d.rewardEvery||9)*(.88+Math.random()*.28);}}
  if(!state.bossSpawned&&state.stageElapsed<G1_BOSS_TIME){const active=state.enemies.filter(e=>!e.dead&&!e.boss).length,cap=d1ActiveCap();state.spawnTimer-=dt;if(active===0)state.spawnTimer=Math.min(state.spawnTimer,.05);else if(active<Math.ceil(cap*.45))state.spawnTimer=Math.min(state.spawnTimer,.14);if(state.spawnTimer<=0&&active<cap){const typ=state.cfg.mix[(Math.random()*state.cfg.mix.length)|0],e=spawnEnemy(typ,false);if(e)e.countsForClean=true;state.d1NaturalSpawns++;state.spawnTimer=d1SpawnInterval();}}
  if(!state.bossSpawned&&state.stageElapsed>=G1_BOSS_TIME-.001){state.environmentClean=50;state.contamination=50;state.bossSpawned=true;state.spawnLeft=0;spawnEnemy(state.cfg.mix[0],true);}
  const slow=state.sterile>0?.58:1;for(const e of state.enemies){if(e.dead)continue;if(e.boss){updateBoss(e,dt,d);continue;}e._l1PrevX=e.x;g1Behavior(e,dt,d1SpeedTarget()*d1Pressure()*l1TypeSpeed(e.type),slow);if(e.depth<=.055){const sc=enemyScreen(e),hitRadius=Math.max(36,Math.min(78,sc.r*.68+innerWidth*.016));if(Math.abs(playerScreenX()-sc.x)<hitRadius)damagePlayer(e.base.attack*d.damage);else{state.score+=35;sfx.dodgeSuccess();}e.dead=true;burstAt(sc.x,sc.y,e.color,7);}}
  state.enemies=state.enemies.filter(e=>!e.dead);state.q1BossHitIFrame=Math.max(0,(state.q1BossHitIFrame||0)-dt);state.q1NearMissToast=Math.max(0,(state.q1NearMissToast||0)-dt);for(const sh of state.enemyShots){if(sh.dead)continue;sh.t+=dt;sh.px=sh.x;sh.py=sh.y;sh.x+=sh.vx*dt;sh.y+=sh.vy*dt;sh.r=Math.min((sh.r||7)+6*dt,18);const py=innerHeight*.78,hitRadius=Math.max(34,Math.min(68,innerWidth*.043)),crossed=sh.py<py&&sh.y>=py;if(crossed||sh.t>=sh.life){const dx=Math.abs(playerScreenX()-sh.x);if(dx<=hitRadius+(sh.r||0)){if((state.q1BossHitIFrame||0)<=0){damagePlayer(sh.damage*d.damage);state.q1BossHitIFrame=.28;}}else if(dx<=hitRadius*2.15){state.score+=10;if((state.q1NearMissToast||0)<=0){toast('✨ NÉ ĐẸP +10',.55);sfx.dodgeSuccess();state.q1NearMissToast=1.05;}}else state.score+=3;sh.dead=true;}}state.enemyShots=state.enemyShots.filter(s=>!s.dead&&s.t<s.life+.25);for(const n of state.rewardNpcs){if(n.dead)continue;n.t+=dt;n.life-=dt;n.x+=n.vx*dt;if(n.life<=0||n.x<-.10||n.x>1.10)n.dead=true;}state.rewardNpcs=state.rewardNpcs.filter(n=>!n.dead);for(const p of state.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=12*dt;p.a=Math.max(0,p.life/p.max);}state.particles=state.particles.filter(p=>p.life>0);for(const tr of state.tracers){tr.t+=dt;tr.life-=dt;}state.tracers=state.tracers.filter(tr=>tr.life>0);for(const hm of state.hitMarkers)hm.life-=dt;state.hitMarkers=state.hitMarkers.filter(hm=>hm.life>0);
  let autoUsed=false;for(const p of state.powerups){if(p.dead)continue;p.t+=dt;p.y+=Math.sin(p.t*3)*.12;p.life-=dt;if(p.l1AutoRemaining==null)p.l1AutoRemaining=3;else p.l1AutoRemaining=Math.max(0,p.l1AutoRemaining-dt);if(!autoUsed&&p.l1AutoRemaining<=0&&l1CanAutoUse(p.kind)){autoUsed=activatePowerup(p,{auto:true});if(autoUsed)toast(`⚡ TỰ KÍCH HOẠT · ${(D1_REWARD_META[p.kind]?.name||p.kind).toUpperCase()}`,1);}else if(p.l1AutoRemaining<=0)p.l1Waiting=true;if(p.life<=0&&!p.l1Waiting)p.dead=true;}state.powerups=state.powerups.filter(p=>!p.dead);
  if(state.drone>0&&state.enemies.length){state._droneTimer=(state._droneTimer||0)-dt;if(state._droneTimer<=0){state._droneTimer=.40;const target=state.enemies.filter(e=>!e.dead&&!e.boss).sort((a,b)=>a.depth-b.depth)[0]||state.enemies.find(e=>!e.dead&&e.boss);if(target){q1DroneTracer(target,false);hitEnemy(target,.72,false,true);}}}if(state.bossDrone>0){state._bossDroneTimer=(state._bossDroneTimer||0)-dt;if(state._bossDroneTimer<=0){state._bossDroneTimer=.22;const target=state.enemies.filter(e=>!e.dead&&!e.boss).sort((a,b)=>a.depth-b.depth)[0]||state.enemies.find(e=>!e.dead&&e.boss);if(target){q1DroneTracer(target,true);hitEnemy(target,1.25,false,true,false);}}}if(state.f1AnnihilatorFx>0)state.f1AnnihilatorFx=Math.max(0,state.f1AnnihilatorFx-dt*1.8);if(!state.bossSpawned){const tt=clamp(state.stageElapsed/G1_BOSS_TIME,0,1),killRatio=clamp((state.cleanMinorKills||0)/Math.max(1,state._minorCleanTarget),0,1);state.environmentClean=clamp(36*tt+Math.min(13.5*tt,49.5*killRatio),0,49.5);state.contamination=100-state.environmentClean;}if(state.bossSpawned&&!state.bossDefeated&&!state.enemies.some(e=>e.boss)){state.bossDefeated=true;beginStageClear();}
  if(!state.bossSpawned&&!state.rewardNpcs.some(n=>!n.dead)&&state.rewardNpcCount<state.rewardNpcMax&&(state.stageElapsed-(state.h15LastSupplyAt||0))>=(state.h15SupplyGuarantee||18)){spawnRewardNpc();state.rewardNpcTimer=Math.max(state.rewardNpcTimer||0,4.5);}h17UpdateNpcCounterfire(dt);if(h16CurrentFireMode()==='auto')h16AutoFireTick();else if(pointer.down&&performance.now()-weaponPressStarted>120)shoot(pointer.x,pointer.y);h16UpdateFireModeUI();updateHUD();}
function update(dt){return updateGame(dt);}
function q1DrawDangerIndicator(){if(!state||state.mode!=='playing')return;const incoming=[...(state.enemyShots||[]).map(s=>({...s,q1Boss:true})),...(state.h17NpcShots||[]).map(s=>({...s,q1Boss:false}))].filter(s=>!s.dead&&s.life>0&&s.life-s.t<.85);if(!incoming.length)return;const v=gameplayViewport(),cx=playerScreenX(),left=incoming.some(s=>s.x<cx),right=incoming.some(s=>s.x>=cx),boss=incoming.some(s=>s.q1Boss);ctx.save();ctx.globalCompositeOperation='screen';ctx.fillStyle=boss?'#ff4f68':'#ff7387';ctx.shadowColor=ctx.fillStyle;ctx.shadowBlur=10;ctx.globalAlpha=.55+.30*Math.sin(performance.now()*.02);const y=innerHeight*.56;if(left){ctx.beginPath();ctx.moveTo(v.left+8,y);ctx.lineTo(v.left+24,y-13);ctx.lineTo(v.left+24,y+13);ctx.closePath();ctx.fill();}if(right){const x=v.left+v.width-8;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-16,y-13);ctx.lineTo(x-16,y+13);ctx.closePath();ctx.fill();}ctx.restore();}
function renderGame(t){v270PrepareWeaponPose(t);drawBackground(t);if(!state)return;const sorted=[...state.enemies].sort((a,b)=>b.depth-a.depth);for(const e of sorted)drawEnemy(e,t);for(const n of state.rewardNpcs||[])drawRewardNpc(n,t);drawEnemyShots();drawTracers();drawPowerups();drawParticles();drawHitMarkers();drawDrone(t);drawPlayerShadow(t);drawWeapon(t);drawCrosshair();drawBossIntro();drawB1StageIntro();drawD1PickupFeedback(t);g2DrawEliteDrone(t);g2DrawGppPickupBrand(t);h1DrawBossDeathFx(t);h1DrawExpandedItemFx(t);h1DrawShieldField(t);h15DrawBossTelegraph(t);h16DrawTargetLock(t);h17DrawNpcCounterfire(t);q1DrawDangerIndicator();h17DrawPlayerHitFx(t);}
function render(t){return renderGame(t);}
function g2IsNewer(v,cur='4.2.0'){const a=g2VerParts(v),b=g2VerParts(cur);for(let i=0;i<Math.max(a.length,b.length);i++){if((a[i]||0)!==(b[i]||0))return(a[i]||0)>(b[i]||0);}return false;}
function f1UseReward(kind,fromCombo=false){if(!state||state.mode!=='playing'||state.transition>0)return false;const inv=f1Inventory();if((inv[kind]||0)<=0){toast('Vật phẩm Boss chưa sẵn sàng',.7);return false;}if(kind==='survival'){if(state.health>=state.maxHealth-.01){toast('❤️ SINH TỒN ĐÃ ĐẦY',.8);return false;}state.health=Math.min(state.maxHealth,state.health+5);g2SetWeaponScreenFx('survival',1800);}else if(kind==='eliteDrone'){state.bossDrone=Math.max(state.bossDrone||0,20);state._bossDroneTimer=.03;g2SetWeaponScreenFx('eliteDrone',20000);}else if(kind==='annihilator'){const targets=state.enemies.filter(e=>!e.dead&&!e.boss);if(!targets.length)return false;for(const e of targets){if(Math.random()<.5)hitEnemy(e,e.hp+1,false,true);}state.f1AnnihilatorFx=1;g2SetWeaponScreenFx('annihilator',1600);}else if(kind==='bossGpp')activateLogoUltimate('bossGpp');inv[kind]--;f1SaveInventory(inv);updateHUD();return true;}
function l1RefreshVersion(){const v=$('#menuVersion'),b=$('#menuVersionBadge');if(v)v.textContent='PHIÊN BẢN · v4.2.0 W1';if(b)b.textContent='v4.2.0 W1';document.title='Bác Sĩ Truy Quét · TRƯỜNG GPP · v4.2.0 W1';}
async function l1EnterLandscape(){if(!j1IsRealMobile())return true;try{if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();}catch{}try{await screen.orientation?.lock?.('landscape');}catch{}document.documentElement.classList.add('l1-gameplay-landscape');return innerWidth>=innerHeight;}
function l1LeaveLandscape(){document.documentElement.classList.remove('l1-gameplay-landscape');try{screen.orientation?.unlock?.();}catch{}}
let l1PausedForOrientation=false;function l1UpdateOrientationGate(){const gate=$('#l1OrientationGate');if(!gate)return;const need=!!state&&state.mode!=='menu'&&j1IsRealMobile()&&innerHeight>innerWidth;gate.classList.toggle('hidden',!need);if(need&&state?.mode==='playing'){l1PausedForOrientation=true;pauseGame();}else if(!need&&l1PausedForOrientation&&state?.mode==='paused'){l1PausedForOrientation=false;resumeGame();}if(!state||state.mode==='menu')l1PausedForOrientation=false;}
window.addEventListener('resize',l1UpdateOrientationGate,{passive:true});window.addEventListener('orientationchange',()=>setTimeout(l1UpdateOrientationGate,100),{passive:true});
canvas.addEventListener('pointerdown',e=>{if(!state||state.mode!=='playing')return;e.preventDefault();const p=pointerPos(e);pointer.x=p.x;pointer.y=p.y;ensureAudio();if(collectPowerupAt(p.x,p.y)){state.lastFire=performance.now();return;}if(h16CurrentFireMode()==='auto'){pointer.down=false;const target=l1TargetAt(p.x,p.y);h16LockTarget(target);return;}pointer.down=true;weaponPressStarted=performance.now();weaponSingleFlashUntil=weaponPressStarted+190;shoot(p.x,p.y);},{capture:true});
const l1EngageBtn=$('#engageBtn');if(l1EngageBtn){const old=l1EngageBtn.onclick;l1EngageBtn.onclick=async e=>{await l1EnterLandscape();old?.call(l1EngageBtn,e);setTimeout(l1UpdateOrientationGate,80);};}
const l1HomeHooks=['homeBtn','homeQuickBtn','gameOverHomeBtn','victoryHomeBtn','stageHomeBtn'];for(const id of l1HomeHooks){const b=$('#'+id);if(!b)continue;b.onclick=e=>{e?.preventDefault?.();l1LeaveLandscape();goHome();};}
const L1_DIFFICULTY_COPY={easy:['🛡 DỄ · MẬT ĐỘ THẤP','NPC ít hơn rõ rệt · tốc độ giảm nhẹ 10% · hỏa lực vũ khí giữ nguyên'],normal:['⚠ TRUNG BÌNH · CÂN BẰNG','Mật độ chuẩn L1 · tốc độ chuẩn · hỏa lực giống mọi cấp'],hard:['☣ KHÓ · MẬT ĐỘ CAO','NPC nhiều hơn rõ rệt · tốc độ tăng khoảng 12% · hỏa lực vũ khí giữ nguyên']};for(const b of $$('.difficulty'))b.addEventListener('click',()=>{const box=$('#difficultyDetail'),m=L1_DIFFICULTY_COPY[b.dataset.difficulty];if(box&&m)box.innerHTML=`<b>${m[0]}</b><span>${m[1]}</span>`;});
l1RefreshVersion();h16UpdateFireModeUI();

})();
