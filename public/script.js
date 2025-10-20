
/* Final game script: modes, combo, lives, dynamic difficulty, audio via WebAudio, (III) effect above head */

const holes = Array.from(document.querySelectorAll('.hole'));
const scoreDisplay = document.getElementById('score');
const timeDisplay = document.getElementById('time');
const livesDisplay = document.getElementById('lives');
const comboDisplay = document.getElementById('combo');
const overlay = document.getElementById('overlay');
const finalScore = document.getElementById('finalScore');
const hsFinal = document.getElementById('hsFinal');
const replayBtn = document.getElementById('replay');
const menuBtn = document.getElementById('menu');
const hsDisplay = document.getElementById('hsDisplay');
const startBtn = document.getElementById('startBtn');
const startMenu = document.getElementById('startMenu');
const gameArea = document.getElementById('gameArea');
const pauseBtn = document.getElementById('pauseBtn');
const modeSelect = document.getElementById('mode');
const difficultyRange = document.getElementById('difficulty');

let lastHole;
let timeUp = false;
let score = 0;
let gameDuration = 15;
let timerInterval = null;
let popTimeouts = [];
let minPop = 400, maxPop = 1200;
let combo = 1;
let comboTimer = null;
let comboWindow = 1200;
let lives = 3;
let mode = 'normal';
let difficultyScale = 1;
let running = false;
let paused = false;
let audioCtx = null;
let bgOsc = null;
let bgGain = null;

const HS_KEY = 'whack_head_hs_final';
let highScore = Number(localStorage.getItem(HS_KEY) || 0);
hsDisplay.textContent = highScore;

function initAudio(){
  if(audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  bgOsc = audioCtx.createOscillator();
  const lfo = audioCtx.createOscillator();
  bgGain = audioCtx.createGain();
  const lfoGain = audioCtx.createGain();
  bgOsc.type = 'sawtooth';
  bgOsc.frequency.value = 55;
  bgGain.gain.value = 0.02;
  lfo.frequency.value = 0.2;
  lfoGain.gain.value = 20;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  bgOsc.connect(filter);
  filter.connect(bgGain);
  bgGain.connect(audioCtx.destination);
  lfo.connect(lfoGain);
  lfoGain.connect(bgOsc.frequency);
  bgOsc.start();
  lfo.start();
}

function stopAudio(){
  if(!audioCtx) return;
  try{ bgOsc.stop(); }catch(e){};
  try{ audioCtx.close(); }catch(e){};
  audioCtx = null; bgOsc = null; bgGain = null;
}

function playPop(){
  if(!audioCtx) initAudio();
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type='triangle'; o.frequency.value=700;
  g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.06, audioCtx.currentTime + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + 0.2);
}

function playHit(){
  if(!audioCtx) initAudio();
  const o = audioCtx.createOscillator();
  const o2 = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type='square'; o.frequency.value=220;
  o2.type='sawtooth'; o2.frequency.value=330;
  g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.25);
  o.connect(g); o2.connect(g); g.connect(audioCtx.destination);
  o.start(); o2.start();
  o.stop(audioCtx.currentTime + 0.25); o2.stop(audioCtx.currentTime + 0.25);
}

function playEnd(){
  if(!audioCtx) initAudio();
  const c = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  c.type='sine'; c.frequency.value=110;
  g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.2);
  c.connect(g); g.connect(audioCtx.destination);
  c.start(); c.stop(audioCtx.currentTime + 1.2);
}

function randomTime(min, max){ return Math.round(Math.random() * (max - min) + min); }
function randomHole(holes){ const idx = Math.floor(Math.random() * holes.length); const hole = holes[idx]; if(hole === lastHole) return randomHole(holes); lastHole = hole; return hole; }

function adjustDifficulty(elapsed, total){
  const progress = Math.min(1, Math.max(0, elapsed/total));
  const baseMin = 300 - difficultyScale*80;
  const baseMax = 1000 - difficultyScale*200;
  const adj = 1 - progress*0.7;
  minPop = Math.max(120, Math.round(baseMin * adj));
  maxPop = Math.max(220, Math.round(baseMax * adj));
}

function pop(){
  if(timeUp || paused) return;
  const time = randomTime(minPop, maxPop);
  const hole = randomHole(holes);
  hole.classList.add('up');
  playPop();
  const t = setTimeout(()=>{ hole.classList.remove('up'); if(!timeUp) pop(); }, time);
  popTimeouts.push(t);
}

function registerHit(hole){
  if(!hole.classList.contains('up') || timeUp || paused) return;
  if(comboTimer) clearTimeout(comboTimer);
  comboTimer = setTimeout(()=>{ combo = 1; comboDisplay.textContent = combo; }, comboWindow);
  combo++;
  comboDisplay.textContent = combo;
  const base = 1;
  const points = Math.round(base * combo * (1 + difficultyScale*0.5));
  score += points;
  scoreDisplay.textContent = score;
  hole.classList.remove('up');
  hole.classList.add('pop');
  setTimeout(()=> hole.classList.remove('pop'), 160);
  spawnStars(hole);
  showHitText(hole, '(III)');
  playHit();
  if(mode === 'endless' && Math.random() < 0.07){ lives = Math.min(5, lives+1); livesDisplay.textContent = lives; }
}

function registerMiss(){
  if(mode === 'kids') return;
  lives--;
  livesDisplay.textContent = lives;
  combo = 1; comboDisplay.textContent = combo;
  if(lives <= 0) endGame('outoflives');
}

function spawnStars(hole){
  const eff = document.createElement('div');
  eff.className = 'effect-stars';
  eff.innerHTML = '<svg viewBox="0 0 24 24" width="60" height="60" aria-hidden="true"><path d="M12 2l1.9 5.9L20 9l-4.5 3.3L16 20l-4-2.3L8 20l1.5-7.7L5 9l6.1-1.1L12 2z" fill="gold"/></svg>';
  hole.appendChild(eff);
  setTimeout(()=> eff.remove(), 700);
}

function showHitText(hole, text){
  const el = hole.querySelector('.hitText');
  el.textContent = text;
  el.classList.add('show');
  setTimeout(()=> el.classList.remove('show'), 700);
}

holes.forEach(h => {
  h.addEventListener('click', (e)=>{
    if(paused || timeUp) return;
    if(h.classList.contains('up')) registerHit(h);
    else registerMiss();
  });
  h.addEventListener('touchstart', (e)=>{ e.preventDefault(); if(paused||timeUp) return; if(h.classList.contains('up')) registerHit(h); else registerMiss(); }, {passive:false});
});

function startGame(selectedMode='normal', duration=15){
  initAudio();
  mode = selectedMode;
  difficultyScale = Number(difficultyRange.value);
  if(mode === 'normal'){ gameDuration = duration; timeDisplay.textContent = gameDuration; lives = 3; }
  if(mode === 'hard'){ gameDuration = 10; timeDisplay.textContent = gameDuration; lives = 2; difficultyScale = Math.min(2, difficultyScale+1); }
  if(mode === 'kids'){ gameDuration = 30; timeDisplay.textContent = gameDuration; lives = 5; difficultyRange.value = 0; difficultyScale = 0; }
  if(mode === 'endless'){ gameDuration = 0; lives = 3; timeDisplay.textContent = '—'; }
  score = 0; scoreDisplay.textContent = score;
  combo = 1; comboDisplay.textContent = combo;
  livesDisplay.textContent = lives;
  timeUp = false; running = true; paused = false;
  startMenu.classList.add('hidden');
  gameArea.classList.remove('hidden');
  pauseBtn.disabled = false;
  pop();
  if(mode !== 'endless'){
    const startTs = Date.now();
    timerInterval = setInterval(()=>{
      if(paused) return;
      const elapsed = (Date.now() - startTs)/1000;
      const remaining = Math.max(0, Math.ceil(gameDuration - elapsed));
      timeDisplay.textContent = remaining;
      adjustDifficulty(elapsed, gameDuration);
      if(remaining <= 0){ clearInterval(timerInterval); endGame('timeup'); }
    }, 250);
    setTimeout(()=>{ timeUp = true; }, (gameDuration+2)*1000);
  } else {
    const startTs = Date.now();
    timerInterval = setInterval(()=>{
      if(paused) return;
      const elapsed = (Date.now() - startTs)/1000;
      adjustDifficulty(elapsed, Math.max(10, elapsed+10));
    }, 500);
  }
  if(audioCtx && bgGain) try{ bgGain.gain.linearRampToValueAtTime(0.02, audioCtx.currentTime + 0.6);}catch(e){}
}

function togglePause(){
  if(!running) return;
  paused = !paused;
  pauseBtn.textContent = paused ? 'Resume' : 'Pause';
  if(paused){ popTimeouts.forEach(t=>clearTimeout(t)); popTimeouts = []; } else { pop(); }
}

function endGame(reason='timeup'){
  timeUp = true; running = false; paused = false;
  popTimeouts.forEach(t=>clearTimeout(t)); popTimeouts = [];
  if(timerInterval) clearInterval(timerInterval);
  holes.forEach(h=>h.classList.remove('up'));
  finalScore.textContent = score;
  if(score > highScore){ highScore = score; localStorage.setItem(HS_KEY, String(highScore)); }
  hsFinal.textContent = highScore;
  hsDisplay.textContent = highScore;
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden','false');
  playEnd();
  if(audioCtx && bgGain) try{ bgGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.2);}catch(e){}
  pauseBtn.disabled = true;
  const title = document.getElementById('overlayTitle');
  if(reason === 'outoflives') title.textContent = 'Out of lives!'; else title.textContent = "Time's up!";
}

startBtn.addEventListener('click', ()=>{
  const sel = modeSelect.value;
  let dur = 15;
  if(sel === 'normal') dur = 15;
  if(sel === 'hard') dur = 10;
  if(sel === 'kids') dur = 30;
  if(sel === 'endless') dur = 0;
  startGame(sel, dur);
});

replayBtn.addEventListener('click', ()=>{ overlay.classList.add('hidden'); startGame(mode, gameDuration || 15); });
menuBtn.addEventListener('click', ()=>{ overlay.classList.add('hidden'); startMenu.classList.remove('hidden'); gameArea.classList.add('hidden'); stopAudio(); });
pauseBtn.addEventListener('click', ()=>{ togglePause(); });

document.body.addEventListener('click', (e)=>{
  if(e.target.closest('.hole') || e.target.closest('.btn') || e.target.closest('#startMenu') || e.target.closest('.menu')) return;
  if(!running || paused || timeUp) return;
  registerMiss();
});

window.addEventListener('load', ()=>{
  hsDisplay.textContent = highScore;
  document.addEventListener('click', function unlock(){ initAudio(); document.removeEventListener('click', unlock); }, {once:true});
});
