// ============================================================
// Shared script for every page in this mini-app (index.html,
// kids.html, animals.html, painting.html, colorbook.html).
//
// Structure:
//   1. Generic helpers used by more than one page (rand/choice/
//      shuffle, the synthesized sound engine, background music,
//      the #soundToggle / #homeBtn wiring every page shares).
//   2. One init function per page (initHome/initKids/initAnimals/
//      initPainting/initColorbook), each holding that page's own
//      state in local variables so nothing collides between pages.
//   3. A single dispatch at the bottom that runs only the init
//      function matching the current page, based on
//      <body data-page="..."> set in that page's HTML.
// ============================================================

const PAGE = document.body.dataset.page;

// ---------- Generic helpers ----------
function rand(min, max) { return Math.random() * (max - min) + min; }
function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function article(word) { return /^[aeiou]/i.test(word) ? 'an' : 'a'; }

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Sound engine (synthesized on the fly, no audio files) ----------
let soundOn = true;
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone(freq, startTime, duration, type, peakGain) {
  const ctx = getAudioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.03);
}

function createNoiseBuffer(duration) {
  const ctx = getAudioCtx();
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function playPop() {
  if (!soundOn) return;
  const ctx = getAudioCtx();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(rand(500, 700), now);
  osc.frequency.exponentialRampToValueAtTime(160, now + 0.12);
  gain.gain.setValueAtTime(0.22, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.15);
}

function playChime() {
  if (!soundOn) return;
  const now = getAudioCtx().currentTime;
  const root = 523.25;
  [root, root * 1.25, root * 1.5].forEach((freq, i) => {
    playTone(freq, now + i * 0.06, 0.22, 'triangle', 0.2);
  });
}

function playWhoosh() {
  if (!soundOn) return;
  const ctx = getAudioCtx();
  const now = ctx.currentTime;
  const dur = 0.4;
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(dur);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(2200, now);
  filter.frequency.exponentialRampToValueAtTime(180, now + dur);
  filter.Q.value = 1;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.3, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  noise.connect(filter).connect(gain).connect(ctx.destination);
  noise.start(now);
  noise.stop(now + dur + 0.05);
}

// ---------- Soft background music (synthesized loop, no audio files) ----------
const MUSIC_NOTES = [
  523.25, 587.33, 659.25, 587.33, 523.25, 440.00, 523.25, 587.33,
  659.25, 784.99, 659.25, 587.33, 523.25, 440.00, 392.00, 440.00
];
// Kept a little quieter on the animals page since it plays underneath spoken prompts.
const MUSIC_GAIN = PAGE === 'animals' ? 0.2 : 0.35;
let musicTimer = null;
let musicStep = 0;

function scheduleMusicNote() {
  if (!soundOn) return;
  const now = getAudioCtx().currentTime;
  const freq = MUSIC_NOTES[musicStep % MUSIC_NOTES.length];
  musicStep++;
  playTone(freq, now, 0.48, 'sine', MUSIC_GAIN);
}

function startMusic() {
  if (musicTimer) return;
  scheduleMusicNote();
  musicTimer = setInterval(scheduleMusicNote, 550);
}

function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}

// Music can only start inside a real user gesture (browser autoplay rules).
// Every page except animals.html starts it on the very first tap/click
// anywhere; animals.html instead starts it explicitly when its Start
// button is pressed (see initAnimals), since that's already gated behind
// a "Start!" screen.
if (PAGE !== 'animals') {
  document.addEventListener('pointerdown', function firstGesture() {
    document.removeEventListener('pointerdown', firstGesture);
    if (soundOn) startMusic();
  }, { once: true });
}

// ---------- Generic #soundToggle wiring (every page has one) ----------
function wireSoundToggle() {
  const soundToggle = document.getElementById('soundToggle');
  if (!soundToggle) return;
  soundToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    soundOn = !soundOn;
    soundToggle.textContent = soundOn ? '🔊' : '🔇';
    if (soundOn) {
      getAudioCtx();
      startMusic();
    } else {
      stopMusic();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    }
  });
}

// ---------- Generic #homeBtn wiring (animals/painting/colorbook have one) ----------
function wireHomeButton() {
  const homeBtn = document.getElementById('homeBtn');
  if (homeBtn) homeBtn.addEventListener('click', () => { window.location.href = 'index.html'; });
}

wireSoundToggle();
wireHomeButton();

// ============================================================
// index.html — Kids Fun Zone home screen
// ============================================================
function initHome() {
  const sky = document.getElementById('sky');

  function spawnTwinkle() {
    const t = document.createElement('div');
    t.className = 'twinkle';
    t.textContent = choice(['✨', '⭐', '💫']);
    t.style.left = rand(0, 100) + 'vw';
    t.style.top = rand(0, 90) + 'vh';
    t.style.fontSize = rand(0.7, 1.6) + 'em';
    t.style.animationDuration = rand(1.6, 3.2) + 's';
    sky.appendChild(t);
    setTimeout(() => t.remove(), 6000);
  }
  setInterval(spawnTwinkle, 600);
  for (let i = 0; i < 8; i++) setTimeout(spawnTwinkle, i * 150);

  // ---------- Navigate on tile tap ----------
  document.querySelectorAll('.tile').forEach(tile => {
    tile.addEventListener('click', () => {
      playPop();
      const href = tile.dataset.href;
      setTimeout(() => { window.location.href = href; }, 160);
    });
  });
}

// ============================================================
// kids.html — Magic Tap Playground
// ============================================================
function initKids() {
  const sky = document.getElementById('sky');

  const EMOJIS = ['🎈', '🦄', '🌈', '🍭', '🎉', '🐶', '🐱', '🦋', '🍦', '⭐', '🐬', '🍩', '🚀', '🌸', '🐢'];
  const CONFETTI_COLORS = ['#ff5da2', '#ffd93d', '#4fd1ff', '#7f5bff', '#ff9a3c', '#6bff8c'];

  // ---------- Ambient background life (plays on its own, no tap needed) ----------
  function spawnTwinkle() {
    const t = document.createElement('div');
    t.className = 'twinkle';
    t.textContent = choice(['✨', '⭐', '💫']);
    t.style.left = rand(0, 100) + 'vw';
    t.style.top = rand(0, 90) + 'vh';
    t.style.fontSize = rand(0.7, 1.6) + 'em';
    t.style.animationDuration = rand(1.6, 3.2) + 's';
    sky.appendChild(t);
    setTimeout(() => t.remove(), 6000);
  }

  function spawnAmbient() {
    const a = document.createElement('div');
    a.className = 'ambient';
    a.textContent = choice(['🎈', '☁️', '⭐', '🍬', '🦋']);
    a.style.left = rand(0, 96) + 'vw';
    a.style.fontSize = rand(1.2, 2.6) + 'em';
    a.style.animationDuration = rand(9, 16) + 's';
    sky.appendChild(a);
    setTimeout(() => a.remove(), 18000);
  }

  setInterval(spawnTwinkle, 500);
  setInterval(spawnAmbient, 700);
  for (let i = 0; i < 10; i++) setTimeout(spawnTwinkle, i * 120);

  // A cheerful little ascending chime, randomized in pitch each tap so it
  // never feels repetitive.
  function playMagicSound() {
    if (!soundOn) return;
    const now = getAudioCtx().currentTime;
    const roots = [392.0, 440.0, 523.25, 587.33]; // G4, A4, C5, D5
    const root = choice(roots);
    const notes = [root, root * 1.25, root * 1.5]; // happy major-ish rise
    notes.forEach((freq, i) => {
      playTone(freq, now + i * 0.055, 0.24, 'triangle', 0.18);
    });
  }

  // ---------- Tap-triggered magic ----------
  function ripple(x, y) {
    const r = document.createElement('div');
    r.className = 'tap-ripple';
    r.style.left = x + 'px';
    r.style.top = y + 'px';
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 700);
  }

  function confettiBurst(x, y) {
    const count = 26;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'particle confetti';
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.background = choice(CONFETTI_COLORS);

      const angle = rand(0, Math.PI * 2);
      const dist = rand(80, 220);
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - rand(40, 100); // biased upward
      const rot = rand(180, 720) * (Math.random() < 0.5 ? -1 : 1);
      const dur = rand(0.8, 1.4);

      document.body.appendChild(p);
      p.animate([
        { transform: 'translate(-50%,-50%) translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(-50%,-50%) translate(${dx * 1.15}px, ${dy + 160}px) rotate(${rot * 1.3}deg)`, opacity: 0 }
      ], { duration: dur * 1000, easing: 'cubic-bezier(.2,.7,.3,1)' });

      setTimeout(() => p.remove(), dur * 1000 + 50);
    }
  }

  function starBurst(x, y) {
    const count = 10;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'particle star-bit';
      p.textContent = choice(['⭐', '✨', '💫']);
      p.style.left = x + 'px';
      p.style.top = y + 'px';

      const angle = (Math.PI * 2 * i) / count + rand(-0.2, 0.2);
      const dist = rand(60, 140);
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const dur = rand(0.6, 0.9);

      document.body.appendChild(p);
      p.animate([
        { transform: 'translate(-50%,-50%) translate(0,0) scale(0.4)', opacity: 1 },
        { transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px) scale(1.1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px) scale(0.3)`, opacity: 0 }
      ], { duration: dur * 1000, easing: 'ease-out' });

      setTimeout(() => p.remove(), dur * 1000 + 50);
    }
  }

  function emojiPop(x, y) {
    const p = document.createElement('div');
    p.className = 'particle emoji-pop';
    p.textContent = choice(EMOJIS);
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    const dur = 1.1;
    const drift = rand(-40, 40);

    document.body.appendChild(p);
    p.animate([
      { transform: 'translate(-50%,-50%) translate(0,0) scale(0.3) rotate(0deg)', opacity: 0 },
      { transform: 'translate(-50%,-50%) translate(0,-10px) scale(1.3) rotate(-8deg)', opacity: 1, offset: 0.25 },
      { transform: `translate(-50%,-50%) translate(${drift}px,-120px) scale(1) rotate(8deg)`, opacity: 1, offset: 0.75 },
      { transform: `translate(-50%,-50%) translate(${drift * 1.4}px,-180px) scale(0.8) rotate(-4deg)`, opacity: 0 }
    ], { duration: dur * 1000, easing: 'ease-out' });

    setTimeout(() => p.remove(), dur * 1000 + 50);
  }

  const EFFECTS = [confettiBurst, starBurst, emojiPop];

  function magicAt(x, y) {
    ripple(x, y);
    playMagicSound();
    // fire two different effects together for extra wow-factor
    const picks = new Set();
    while (picks.size < 2) picks.add(choice(EFFECTS));
    picks.forEach(fn => fn(x, y));
  }

  document.addEventListener('pointerdown', (e) => {
    magicAt(e.clientX, e.clientY);
  });
}

// ============================================================
// animals.html — Animal Friends name-and-click game
// ============================================================
function initAnimals() {
  const sky = document.getElementById('sky');
  const stage = document.getElementById('stage');
  const promptLabel = document.getElementById('promptLabel');
  const startOverlay = document.getElementById('startOverlay');
  const startBtn = document.getElementById('startBtn');
  const counterEl = document.getElementById('counter');
  const congratsOverlay = document.getElementById('congratsOverlay');
  const playAgainBtn = document.getElementById('playAgainBtn');

  const ANIMAL_POOL = [
    { name: 'Dog',      emoji: '🐶', sound: 'Woof woof!' },
    { name: 'Cat',      emoji: '🐱', sound: 'Meow!' },
    { name: 'Cow',      emoji: '🐮', sound: 'Moo!' },
    { name: 'Pig',      emoji: '🐷', sound: 'Oink oink!' },
    { name: 'Lion',     emoji: '🦁', sound: 'Roar!' },
    { name: 'Elephant', emoji: '🐘', sound: 'Toot!' },
    { name: 'Frog',     emoji: '🐸', sound: 'Ribbit!' },
    { name: 'Chicken',  emoji: '🐔', sound: 'Cluck cluck!' },
    { name: 'Horse',    emoji: '🐴', sound: 'Neigh!' },
    { name: 'Duck',     emoji: '🦆', sound: 'Quack quack!' },
    { name: 'Sheep',    emoji: '🐑', sound: 'Baa!' },
    { name: 'Owl',      emoji: '🦉', sound: 'Hoo hoo!' },
    { name: 'Bear',     emoji: '🐻', sound: 'Grr!' },
    { name: 'Monkey',   emoji: '🐵', sound: 'Ooh ooh ah ah!' },
    { name: 'Bee',      emoji: '🐝', sound: 'Buzz buzz!' },
    { name: 'Rabbit',   emoji: '🐰', sound: 'Hop hop!' },
    { name: 'Penguin',  emoji: '🐧', sound: 'Waddle waddle!' },
    { name: 'Fish',     emoji: '🐟', sound: 'Blub blub!' }
  ];

  const PRAISES = ['Yay!', 'Great job!', 'You got it!', 'Awesome!', 'Well done!', 'Woohoo!'];
  const TRY_AGAIN = ['Oops, try again!', 'Not quite, try again!', 'Almost! Try again!', 'Nope, keep looking!'];
  const CONFETTI_COLORS = ['#ff5da2', '#ffd93d', '#4fd1ff', '#7f5bff', '#ff9a3c', '#6bff8c'];

  let bubbles = [];        // { data, el, x, y, vx, vy, size }
  let target = null;
  let awaitingAnswer = false;
  let repeatTimer = null;
  let rafId = null;

  // ---------- Background twinkles ----------
  function spawnTwinkle() {
    const t = document.createElement('div');
    t.className = 'twinkle';
    t.textContent = choice(['✨', '⭐', '💫']);
    t.style.left = rand(0, 100) + 'vw';
    t.style.top = rand(0, 90) + 'vh';
    t.style.fontSize = rand(0.7, 1.6) + 'em';
    t.style.animationDuration = rand(1.6, 3.2) + 's';
    sky.appendChild(t);
    setTimeout(() => t.remove(), 6000);
  }
  setInterval(spawnTwinkle, 600);
  for (let i = 0; i < 8; i++) setTimeout(spawnTwinkle, i * 150);

  // One "clap" = a short burst of filtered noise shaped like a real hand
  // clap: a very fast transient click (high, narrow) layered with a slightly
  // longer, lower thump underneath for body.
  function playClapBurst(ctx, startTime, peak) {
    const dur = rand(0.05, 0.09);

    const noise = ctx.createBufferSource();
    noise.buffer = createNoiseBuffer(dur);

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = rand(1000, 3200);
    bandpass.Q.value = rand(0.6, 1.4);

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 500;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(peak, startTime + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

    noise.connect(bandpass).connect(highpass).connect(gain).connect(ctx.destination);
    noise.start(startTime);
    noise.stop(startTime + dur + 0.02);
  }

  // A proper round of applause: a soft broadband "wash" bed (like the sound
  // of a full crowd clapping together) with dozens of individual clap
  // transients sprinkled on top, dense at first and thinning out as it fades
  // — much closer to real applause than a handful of identical clicks.
  function playClapSound() {
    if (!soundOn) return;
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const totalDur = 1.1;

    const wash = ctx.createBufferSource();
    wash.buffer = createNoiseBuffer(totalDur);
    const washFilter = ctx.createBiquadFilter();
    washFilter.type = 'bandpass';
    washFilter.frequency.value = 2200;
    washFilter.Q.value = 0.4;
    const washGain = ctx.createGain();
    washGain.gain.setValueAtTime(0.0001, now);
    washGain.gain.exponentialRampToValueAtTime(0.22, now + 0.1);
    washGain.gain.exponentialRampToValueAtTime(0.12, now + 0.5);
    washGain.gain.exponentialRampToValueAtTime(0.0001, now + totalDur);
    wash.connect(washFilter).connect(washGain).connect(ctx.destination);
    wash.start(now);
    wash.stop(now + totalDur + 0.05);

    let t = 0;
    while (t < totalDur - 0.1) {
      const fadeProgress = t / totalDur; // 0 (start) -> 1 (end)
      playClapBurst(ctx, now + t, rand(0.35, 0.6) * (1 - fadeProgress * 0.6));
      t += rand(0.02, 0.05 + fadeProgress * 0.08); // claps thin out over time
    }
  }

  // A harsh game-show-style "wrong answer" buzzer: two slightly detuned
  // sawtooth oscillators beating against each other through a low-pass
  // filter for a buzzy, unmistakably "nope" sound.
  function playBuzzer() {
    if (!soundOn) return;
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const duration = 0.45;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
    gain.gain.setValueAtTime(0.25, now + duration - 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    filter.connect(gain).connect(ctx.destination);

    [140, 144].forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(filter);
      osc.start(now);
      osc.stop(now + duration + 0.03);
    });
  }

  // Pick a pleasant female voice once voices are available (loading is
  // async and browser-dependent, so we retry on the voiceschanged event).
  let ladyVoice = null;
  function pickLadyVoice() {
    if (!('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return;

    const preferredNames = [
      'Google UK English Female', 'Google US English', 'Microsoft Zira',
      'Samantha', 'Victoria', 'Karen', 'Moira', 'Tessa', 'Fiona', 'Susan', 'Serena'
    ];

    ladyVoice =
      voices.find(v => preferredNames.some(name => v.name.includes(name))) ||
      voices.find(v => /female|woman|girl/i.test(v.name)) ||
      voices.find(v => v.lang && v.lang.startsWith('en')) ||
      voices[0];
  }
  pickLadyVoice();
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = pickLadyVoice;
  }

  function speak(text) {
    if (!soundOn || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    if (ladyVoice) utter.voice = ladyVoice;
    utter.rate = 0.92;
    utter.pitch = 1.35; // warm, sweet tone
    window.speechSynthesis.speak(utter);
  }

  // ---------- Reward particles ----------
  function confettiBurst(x, y) {
    for (let i = 0; i < 22; i++) {
      const p = document.createElement('div');
      p.className = 'particle confetti';
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      p.style.background = choice(CONFETTI_COLORS);

      const angle = rand(0, Math.PI * 2);
      const dist = rand(70, 200);
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - rand(30, 90);
      const rot = rand(180, 720) * (Math.random() < 0.5 ? -1 : 1);
      const dur = rand(0.8, 1.3);

      document.body.appendChild(p);
      p.animate([
        { transform: 'translate(-50%,-50%) translate(0,0) rotate(0deg)', opacity: 1 },
        { transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px) rotate(${rot}deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(-50%,-50%) translate(${dx * 1.15}px, ${dy + 150}px) rotate(${rot * 1.3}deg)`, opacity: 0 }
      ], { duration: dur * 1000, easing: 'cubic-bezier(.2,.7,.3,1)' });

      setTimeout(() => p.remove(), dur * 1000 + 50);
    }
  }

  function starBurst(x, y) {
    for (let i = 0; i < 8; i++) {
      const p = document.createElement('div');
      p.className = 'particle star-bit';
      p.textContent = choice(['⭐', '✨', '💫']);
      p.style.left = x + 'px';
      p.style.top = y + 'px';

      const angle = (Math.PI * 2 * i) / 8 + rand(-0.2, 0.2);
      const dist = rand(50, 120);
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const dur = rand(0.6, 0.9);

      document.body.appendChild(p);
      p.animate([
        { transform: 'translate(-50%,-50%) translate(0,0) scale(0.4)', opacity: 1 },
        { transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px) scale(1.1)`, opacity: 1, offset: 0.6 },
        { transform: `translate(-50%,-50%) translate(${dx}px, ${dy}px) scale(0.3)`, opacity: 0 }
      ], { duration: dur * 1000, easing: 'ease-out' });

      setTimeout(() => p.remove(), dur * 1000 + 50);
    }
  }

  // ---------- Bubble field setup ----------
  const TOTAL_ANIMALS = 10; // the round always starts with 10 and counts down to 0
  function bubbleCount() {
    return TOTAL_ANIMALS;
  }

  // Pushes any overlapping bubbles apart so they never sit on top of each
  // other, whether at initial placement or while drifting.
  function resolveCollisions() {
    for (let i = 0; i < bubbles.length; i++) {
      for (let j = i + 1; j < bubbles.length; j++) {
        const a = bubbles[i], b = bubbles[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const minDist = (a.size + b.size) / 2 + 8; // small gap between bubbles
        if (dist < minDist) {
          const overlap = (minDist - dist) / 2;
          const nx = dx / dist, ny = dy / dist;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
          a.vx -= nx * 0.015;
          a.vy -= ny * 0.015;
          b.vx += nx * 0.015;
          b.vy += ny * 0.015;
        }
      }
    }
  }

  function boundsForSize(size) {
    return {
      minX: size / 2 + 10,
      maxX: window.innerWidth - size / 2 - 10,
      minY: 90,                                  // clear of the title
      maxY: window.innerHeight - 130             // clear of the prompt label
    };
  }

  function buildBubbles() {
    const chosen = shuffle(ANIMAL_POOL).slice(0, bubbleCount());
    const n = chosen.length;
    const cols = Math.ceil(Math.sqrt(n * (window.innerWidth / window.innerHeight)));
    const rows = Math.ceil(n / cols);
    const cellW = window.innerWidth / cols;
    const usableH = window.innerHeight - 90 - 130;
    const cellH = usableH / rows;
    const cells = shuffle(Array.from({ length: cols * rows }, (_, i) => i)).slice(0, n);

    bubbles = chosen.map((data, i) => {
      const el = document.createElement('button');
      el.className = 'animal-btn';
      el.textContent = data.emoji;
      el.setAttribute('aria-label', data.name);
      stage.appendChild(el);

      const cell = cells[i];
      const col = cell % cols;
      const row = Math.floor(cell / cols);
      const cx = col * cellW + cellW / 2 + rand(-cellW * 0.25, cellW * 0.25);
      const cy = 90 + row * cellH + cellH / 2 + rand(-cellH * 0.2, cellH * 0.2);

      const speed = rand(0.12, 0.35);
      const angle = rand(0, Math.PI * 2);

      const b = {
        data, el,
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: el.offsetWidth || 90
      };
      el.style.left = b.x + 'px';
      el.style.top = b.y + 'px';

      el.addEventListener('pointerdown', () => onBubbleClick(b));
      return b;
    });

    // Settle any overlaps left over from the jittered grid placement before
    // the first frame ever paints.
    for (let pass = 0; pass < 8; pass++) {
      resolveCollisions();
      bubbles.forEach(b => {
        const { minX, maxX, minY, maxY } = boundsForSize(b.size);
        b.x = Math.min(Math.max(b.x, minX), maxX);
        b.y = Math.min(Math.max(b.y, minY), maxY);
      });
    }
    bubbles.forEach(b => {
      b.el.style.left = b.x + 'px';
      b.el.style.top = b.y + 'px';
    });
  }

  function clearBubbles() {
    bubbles.forEach(b => b.el.remove());
    bubbles = [];
  }

  // ---------- Slow drifting "bubble" motion ----------
  function tick() {
    bubbles.forEach(b => {
      // occasionally nudge direction so the drift feels alive, not robotic
      if (Math.random() < 0.01) {
        b.vx += rand(-0.08, 0.08);
        b.vy += rand(-0.08, 0.08);
        const speed = Math.hypot(b.vx, b.vy);
        const maxSpeed = 0.4;
        if (speed > maxSpeed) {
          b.vx = (b.vx / speed) * maxSpeed;
          b.vy = (b.vy / speed) * maxSpeed;
        }
      }

      b.x += b.vx;
      b.y += b.vy;

      const { minX, maxX, minY, maxY } = boundsForSize(b.size);
      if (b.x < minX) { b.x = minX; b.vx = Math.abs(b.vx); }
      if (b.x > maxX) { b.x = maxX; b.vx = -Math.abs(b.vx); }
      if (b.y < minY) { b.y = minY; b.vy = Math.abs(b.vy); }
      if (b.y > maxY) { b.y = maxY; b.vy = -Math.abs(b.vy); }
    });

    resolveCollisions();

    bubbles.forEach(b => {
      const { minX, maxX, minY, maxY } = boundsForSize(b.size);
      b.x = Math.min(Math.max(b.x, minX), maxX);
      b.y = Math.min(Math.max(b.y, minY), maxY);
      b.el.style.left = b.x + 'px';
      b.el.style.top = b.y + 'px';
    });

    rafId = requestAnimationFrame(tick);
  }

  // ---------- Round logic ----------
  function askForTarget() {
    let next;
    do { next = choice(bubbles); } while (next === target && bubbles.length > 1);
    target = next;
    awaitingAnswer = true;

    promptLabel.textContent = `Find the ${target.data.name}! 🔍`;
    promptLabel.classList.remove('pop');
    void promptLabel.offsetWidth;
    promptLabel.classList.add('pop');

    speak(`Where is the ${target.data.name}?`);

    clearInterval(repeatTimer);
    repeatTimer = setInterval(() => {
      if (awaitingAnswer) speak(`Find the ${target.data.name}.`);
    }, 6000);
  }

  function updateCounter() {
    counterEl.textContent = bubbles.length === 1 ? '1 left' : `${bubbles.length} left`;
  }

  function onBubbleClick(b) {
    if (!awaitingAnswer) return;

    const rect = b.el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    if (b === target) {
      awaitingAnswer = false;
      clearInterval(repeatTimer);
      b.el.classList.add('right');
      playClapSound();
      confettiBurst(cx, cy);
      starBurst(cx, cy);
      speak(`${choice(PRAISES)} That's ${article(b.data.name)} ${b.data.name}! ${b.data.sound}`);

      setTimeout(() => {
        // the found animal is gone for good — the field counts down, it's
        // never replenished
        b.el.remove();
        bubbles = bubbles.filter(x => x !== b);
        updateCounter();

        if (bubbles.length === 0) {
          finishGame();
        } else {
          askForTarget();
        }
      }, 1200);
    } else {
      playBuzzer();
      b.el.classList.remove('wrong');
      void b.el.offsetWidth;
      b.el.classList.add('wrong');
      speak(choice(TRY_AGAIN));
    }
  }

  // ---------- Finale: all 10 found ----------
  function launchFireworks() {
    let bursts = 0;
    const interval = setInterval(() => {
      const x = rand(60, window.innerWidth - 60);
      const y = rand(80, window.innerHeight * 0.6);
      confettiBurst(x, y);
      starBurst(x, y);
      bursts++;
      if (bursts >= 10) clearInterval(interval);
    }, 300);

    // a few rockets streaking up for good measure
    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        const r = document.createElement('div');
        r.className = 'rocket';
        r.textContent = '🎆';
        r.style.left = rand(10, 90) + 'vw';
        r.style.animationDuration = rand(1.4, 2.2) + 's';
        document.body.appendChild(r);
        setTimeout(() => r.remove(), 2500);
      }, i * 350);
    }
  }

  function finishGame() {
    clearInterval(repeatTimer);
    cancelAnimationFrame(rafId);
    promptLabel.textContent = '';
    playClapSound();
    setTimeout(playClapSound, 550); // a bigger final round of applause
    speak('Congratulations! You found all ten animals! Amazing job!');
    congratsOverlay.style.display = 'flex';
    launchFireworks();
  }

  function startGame() {
    congratsOverlay.style.display = 'none';
    clearBubbles();
    counterEl.textContent = `${TOTAL_ANIMALS} left`;
    target = null;
    buildBubbles();
    updateCounter();
    cancelAnimationFrame(rafId);
    tick();
    askForTarget();
  }

  playAgainBtn.addEventListener('click', startGame);

  window.addEventListener('resize', () => {
    bubbles.forEach(b => {
      const { minX, maxX, minY, maxY } = boundsForSize(b.size);
      b.x = Math.min(Math.max(b.x, minX), maxX);
      b.y = Math.min(Math.max(b.y, minY), maxY);
    });
  });

  startBtn.addEventListener('click', () => {
    getAudioCtx();
    speak(' '); // tiny unlock utterance so mobile browsers allow speech later
    startOverlay.style.display = 'none';
    startGame();
    if (soundOn) startMusic();
  });
}

// ============================================================
// painting.html — free-draw canvas
// ============================================================
function initPainting() {
  const canvas = document.getElementById('paintCanvas');
  const ctx = canvas.getContext('2d');
  const canvasWrap = document.querySelector('.canvas-wrap');
  const paintPictureBtn = document.getElementById('paintPictureBtn');
  const clearBtn = document.getElementById('clearBtn');
  const saveBtn = document.getElementById('saveBtn');
  const modalOverlay = document.getElementById('modalOverlay');
  const confirmClearYes = document.getElementById('confirmClearYes');
  const confirmClearNo = document.getElementById('confirmClearNo');
  const toast = document.getElementById('toast');
  const colorRow = document.getElementById('colorRow');
  const sizeRow = document.getElementById('sizeRow');
  const stampRow = document.getElementById('stampRow');
  const toolRow = document.getElementById('toolRow');

  const COLORS = [
    '#2b2b2b', '#ffffff', '#ff4d6d', '#ff9a3c', '#ffd93d',
    '#6bff8c', '#2ec4f1', '#4f6bff', '#a55bff', '#ff5da2'
  ];
  const SIZES = [6, 14, 24, 40];
  const STAMPS = ['⭐', '💖', '🌈', '🦋', '🌸', '🎈', '☀️', '🍭', '🐶', '🐱'];

  function showToast(text) {
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('show'), 1600);
  }

  // ---------- Canvas setup ----------
  let currentColor = COLORS[2];
  let currentSize = SIZES[1];
  let currentStamp = STAMPS[0];
  let tool = 'draw'; // 'draw' | 'erase' | 'stamp'

  function fillWhite(w, h) {
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function resizeCanvas() {
    const displayWidth = canvasWrap.clientWidth;
    const displayHeight = canvasWrap.clientHeight;
    if (displayWidth === 0 || displayHeight === 0) return;

    let prev = null;
    if (canvas.width > 0 && canvas.height > 0) {
      prev = document.createElement('canvas');
      prev.width = canvas.width;
      prev.height = canvas.height;
      prev.getContext('2d').drawImage(canvas, 0, 0);
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(displayWidth * dpr);
    canvas.height = Math.round(displayHeight * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    fillWhite(displayWidth, displayHeight);
    if (prev) {
      ctx.drawImage(prev, 0, 0, prev.width, prev.height, 0, 0, displayWidth, displayHeight);
    }

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  window.addEventListener('load', resizeCanvas);
  window.addEventListener('resize', resizeCanvas);

  // ---------- Drawing ----------
  let drawing = false;
  let lastPoint = null;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function dotAt(pos) {
    ctx.beginPath();
    ctx.fillStyle = tool === 'erase' ? '#ffffff' : currentColor;
    ctx.arc(pos.x, pos.y, currentSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function placeStamp(pos) {
    ctx.save();
    ctx.font = '54px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(pos.x, pos.y);
    ctx.rotate(rand(-0.3, 0.3));
    ctx.fillText(currentStamp, 0, 0);
    ctx.restore();
    playPop();
  }

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    const pos = getPos(e);

    if (tool === 'stamp') {
      placeStamp(pos);
      return;
    }

    drawing = true;
    lastPoint = pos;
    dotAt(pos);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const pos = getPos(e);
    ctx.strokeStyle = tool === 'erase' ? '#ffffff' : currentColor;
    ctx.lineWidth = currentSize;
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPoint = pos;
  });

  function endStroke() {
    drawing = false;
    lastPoint = null;
  }
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);

  // ---------- Toolbar: colors ----------
  COLORS.forEach((color, i) => {
    const btn = document.createElement('button');
    btn.className = 'swatch' + (i === 2 ? ' active' : '');
    btn.style.background = color;
    btn.addEventListener('click', () => {
      currentColor = color;
      tool = 'draw';
      updateToolButtons();
      [...colorRow.querySelectorAll('.swatch')].forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
    });
    colorRow.appendChild(btn);
  });

  // ---------- Toolbar: sizes ----------
  SIZES.forEach((size, i) => {
    const btn = document.createElement('button');
    btn.className = 'size-btn' + (i === 1 ? ' active' : '');
    const dot = document.createElement('div');
    dot.className = 'size-dot';
    const dotSize = 8 + i * 7;
    dot.style.width = dotSize + 'px';
    dot.style.height = dotSize + 'px';
    btn.appendChild(dot);
    btn.addEventListener('click', () => {
      currentSize = size;
      [...sizeRow.querySelectorAll('.size-btn')].forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
    });
    sizeRow.appendChild(btn);
  });

  // ---------- Toolbar: stamps ----------
  STAMPS.forEach((emoji, i) => {
    const btn = document.createElement('button');
    btn.className = 'stamp-btn';
    btn.textContent = emoji;
    btn.addEventListener('click', () => {
      currentStamp = emoji;
      tool = 'stamp';
      updateToolButtons();
      [...stampRow.querySelectorAll('.stamp-btn')].forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
    });
    stampRow.appendChild(btn);
  });

  // ---------- Toolbar: tools (draw / erase) ----------
  function updateToolButtons() {
    [...toolRow.querySelectorAll('.tool-btn')].forEach(b => {
      b.classList.toggle('active', b.dataset.tool === tool);
    });
    if (tool !== 'stamp') {
      [...stampRow.querySelectorAll('.stamp-btn')].forEach(s => s.classList.remove('active'));
    }
  }

  toolRow.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      tool = btn.dataset.tool;
      updateToolButtons();
    });
  });

  // ---------- Clear ----------
  clearBtn.addEventListener('click', () => {
    modalOverlay.style.display = 'flex';
  });

  confirmClearNo.addEventListener('click', () => {
    modalOverlay.style.display = 'none';
  });

  confirmClearYes.addEventListener('click', () => {
    modalOverlay.style.display = 'none';
    playWhoosh();
    fillWhite(canvasWrap.clientWidth, canvasWrap.clientHeight);
    showToast('All clean! 🧹');
  });

  // ---------- Save ----------
  saveBtn.addEventListener('click', () => {
    getAudioCtx();
    playChime();
    const link = document.createElement('a');
    link.download = 'my-painting.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Picture saved! 🎉');
  });

  paintPictureBtn.addEventListener('click', () => {
    window.location.href = 'colorbook.html';
  });
}

// ============================================================
// colorbook.html — "Paint a Picture" coloring book
// ============================================================
function initColorbook() {
  // Picture data — each is hand-drawn as plain SVG shapes.
  // ".fillable" shapes are colorable regions (data-group ties
  // multi-part regions, like a cloud made of 3 circles, together).
  // ".detail" shapes are decorative outline/accent marks drawn on
  // top and are never clickable/fillable.
  const F = 'class="fillable" fill="#ffffff" stroke="#2b2b2b" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"';
  const D = 'class="detail" pointer-events="none"';

  const PICTURES = [
    {
      id: 'puppy',
      name: 'Puppy & House',
      svg: `
        <rect data-group="sky" ${F} x="0" y="0" width="400" height="210"/>
        <rect data-group="ground" ${F} x="0" y="210" width="400" height="90"/>

        <circle data-group="cloud1" ${F} cx="55" cy="58" r="16"/>
        <circle data-group="cloud1" ${F} cx="75" cy="48" r="20"/>
        <circle data-group="cloud1" ${F} cx="95" cy="58" r="16"/>

        <circle data-group="cloud2" ${F} cx="240" cy="42" r="12"/>
        <circle data-group="cloud2" ${F} cx="255" cy="35" r="15"/>
        <circle data-group="cloud2" ${F} cx="270" cy="42" r="12"/>

        <circle data-group="sun" ${F} cx="345" cy="55" r="28"/>
        <g ${D} stroke="#2b2b2b" stroke-width="4" stroke-linecap="round">
          <line x1="375" y1="55" x2="387" y2="55"/>
          <line x1="366" y1="76" x2="375" y2="85"/>
          <line x1="345" y1="85" x2="345" y2="97"/>
          <line x1="324" y1="76" x2="315" y2="85"/>
          <line x1="315" y1="55" x2="303" y2="55"/>
          <line x1="324" y1="34" x2="315" y2="25"/>
          <line x1="345" y1="25" x2="345" y2="13"/>
          <line x1="366" y1="34" x2="375" y2="25"/>
        </g>
        <circle ${D} cx="337" cy="52" r="2.5" fill="#2b2b2b"/>
        <circle ${D} cx="353" cy="52" r="2.5" fill="#2b2b2b"/>
        <path ${D} d="M330,62 Q345,72 360,62" fill="none" stroke="#2b2b2b" stroke-width="3" stroke-linecap="round"/>

        <circle data-group="tree-leaves" ${F} cx="55" cy="185" r="40"/>
        <rect data-group="tree-trunk" ${F} x="46" y="200" width="18" height="45" rx="4"/>

        <polygon data-group="house-roof" ${F} points="140,145 215,90 290,145"/>
        <rect data-group="house-body" ${F} x="150" y="145" width="130" height="95"/>
        <rect data-group="house-chimney" ${F} x="255" y="100" width="18" height="40"/>
        <rect data-group="house-door" ${F} x="195" y="185" width="32" height="55" rx="6"/>
        <rect data-group="house-window" ${F} x="160" y="160" width="30" height="30" rx="4"/>
        <g ${D} stroke="#2b2b2b" stroke-width="3">
          <line x1="175" y1="160" x2="175" y2="190"/>
          <line x1="160" y1="175" x2="190" y2="175"/>
        </g>

        <circle data-group="bush1" ${F} cx="140" cy="232" r="18"/>
        <circle data-group="bush1" ${F} cx="158" cy="238" r="22"/>
        <circle data-group="bush2" ${F} cx="290" cy="232" r="18"/>
        <circle data-group="bush2" ${F} cx="305" cy="238" r="20"/>

        <polygon data-group="walkway" ${F} points="203,240 227,240 235,300 195,300"/>

        <circle data-group="flower1" ${F} cx="100" cy="269" r="6"/>
        <circle data-group="flower1" ${F} cx="100" cy="281" r="6"/>
        <circle data-group="flower1" ${F} cx="94" cy="275" r="6"/>
        <circle data-group="flower1" ${F} cx="106" cy="275" r="6"/>
        <circle ${D} cx="100" cy="275" r="3" fill="#ffd93d"/>

        <circle data-group="flower2" ${F} cx="230" cy="274" r="6"/>
        <circle data-group="flower2" ${F} cx="230" cy="286" r="6"/>
        <circle data-group="flower2" ${F} cx="224" cy="280" r="6"/>
        <circle data-group="flower2" ${F} cx="236" cy="280" r="6"/>
        <circle ${D} cx="230" cy="280" r="3" fill="#ffd93d"/>

        <circle data-group="flower3" ${F} cx="335" cy="264" r="6"/>
        <circle data-group="flower3" ${F} cx="335" cy="276" r="6"/>
        <circle data-group="flower3" ${F} cx="329" cy="270" r="6"/>
        <circle data-group="flower3" ${F} cx="341" cy="270" r="6"/>
        <circle ${D} cx="335" cy="270" r="3" fill="#ffd93d"/>

        <path data-group="dog-tail" ${F} d="M290,240 Q322,222 302,198 Q290,214 280,236 Z"/>
        <ellipse data-group="dog-body" ${F} cx="245" cy="250" rx="48" ry="36"/>
        <rect data-group="dog-legs" ${F} x="225" y="278" width="14" height="26" rx="6"/>
        <rect data-group="dog-legs" ${F} x="255" y="278" width="14" height="26" rx="6"/>
        <ellipse data-group="dog-ear-l" ${F} cx="178" cy="182" rx="12" ry="20" transform="rotate(-20 178 182)"/>
        <ellipse data-group="dog-ear-r" ${F} cx="222" cy="182" rx="12" ry="20" transform="rotate(20 222 182)"/>
        <circle data-group="dog-head" ${F} cx="200" cy="205" r="32"/>
        <ellipse data-group="dog-snout" ${F} cx="185" cy="215" rx="16" ry="12"/>
        <rect data-group="dog-collar" ${F} x="190" y="232" width="30" height="8" rx="4"/>
        <circle ${D} cx="190" cy="200" r="3" fill="#2b2b2b"/>
        <circle ${D} cx="210" cy="200" r="3" fill="#2b2b2b"/>
        <ellipse ${D} cx="183" cy="213" rx="4" ry="3" fill="#2b2b2b"/>
        <path ${D} d="M183,218 Q190,224 197,218" fill="none" stroke="#2b2b2b" stroke-width="2.5" stroke-linecap="round"/>
      `
    },
    {
      id: 'cat',
      name: 'Kitty & Yarn',
      svg: `
        <rect data-group="sky" ${F} x="0" y="0" width="400" height="210"/>
        <rect data-group="ground" ${F} x="0" y="210" width="400" height="90"/>

        <circle data-group="sun" ${F} cx="60" cy="50" r="24"/>
        <g ${D} stroke="#2b2b2b" stroke-width="4" stroke-linecap="round">
          <line x1="60" y1="18" x2="60" y2="8"/>
          <line x1="60" y1="82" x2="60" y2="92"/>
          <line x1="28" y1="50" x2="18" y2="50"/>
          <line x1="92" y1="50" x2="102" y2="50"/>
        </g>

        <circle data-group="cloud1" ${F} cx="310" cy="52" r="14"/>
        <circle data-group="cloud1" ${F} cx="330" cy="44" r="18"/>
        <circle data-group="cloud1" ${F} cx="350" cy="52" r="14"/>

        <path data-group="cat-tail" ${F} d="M292,258 Q332,248 322,206 Q306,222 296,244 Z"/>
        <ellipse data-group="cat-body" ${F} cx="200" cy="228" rx="65" ry="48"/>
        <ellipse data-group="cat-paws" ${F} cx="175" cy="270" rx="14" ry="10"/>
        <ellipse data-group="cat-paws" ${F} cx="225" cy="270" rx="14" ry="10"/>

        <polygon data-group="cat-ear-l" ${F} points="165,115 150,68 186,104"/>
        <polygon data-group="cat-ear-r" ${F} points="235,115 250,68 214,104"/>
        <circle data-group="cat-head" ${F} cx="200" cy="150" r="48"/>
        <polygon data-group="cat-inner-ear" ${F} points="168,106 161,84 182,101" stroke-width="4"/>
        <polygon data-group="cat-inner-ear" ${F} points="232,106 239,84 218,101" stroke-width="4"/>

        <ellipse data-group="cat-eyes" ${F} cx="178" cy="150" rx="9" ry="11" stroke-width="4"/>
        <ellipse data-group="cat-eyes" ${F} cx="222" cy="150" rx="9" ry="11" stroke-width="4"/>
        <circle ${D} cx="178" cy="152" r="4" fill="#2b2b2b"/>
        <circle ${D} cx="222" cy="152" r="4" fill="#2b2b2b"/>

        <polygon data-group="cat-nose" ${F} points="200,160 193,169 207,169" stroke-width="3"/>
        <path ${D} d="M193,171 Q200,177 193,181 M207,171 Q200,177 207,181" fill="none" stroke="#2b2b2b" stroke-width="2.5" stroke-linecap="round"/>

        <g ${D} stroke="#2b2b2b" stroke-width="2.5" stroke-linecap="round">
          <line x1="163" y1="155" x2="115" y2="148"/>
          <line x1="163" y1="163" x2="115" y2="163"/>
          <line x1="163" y1="171" x2="115" y2="178"/>
          <line x1="237" y1="155" x2="285" y2="148"/>
          <line x1="237" y1="163" x2="285" y2="163"/>
          <line x1="237" y1="171" x2="285" y2="178"/>
        </g>

        <circle data-group="yarn" ${F} cx="310" cy="268" r="26"/>
        <g ${D} stroke="#2b2b2b" stroke-width="2.5" fill="none">
          <path d="M290,255 Q310,268 330,255"/>
          <path d="M286,268 Q310,278 334,268"/>
          <path d="M290,281 Q310,268 330,281"/>
        </g>

        <circle data-group="flower1" ${F} cx="90" cy="265" r="6"/>
        <circle data-group="flower1" ${F} cx="90" cy="277" r="6"/>
        <circle data-group="flower1" ${F} cx="84" cy="271" r="6"/>
        <circle data-group="flower1" ${F} cx="96" cy="271" r="6"/>
        <circle ${D} cx="90" cy="271" r="3" fill="#ffd93d"/>
      `
    },
    {
      id: 'fish',
      name: 'Under the Sea',
      svg: `
        <rect data-group="water" ${F} x="0" y="0" width="400" height="300"/>
        <rect data-group="sand" ${F} x="0" y="262" width="400" height="38"/>

        <path data-group="seaweed1" ${F} d="M60,262 C40,224 78,206 55,168 C40,138 68,118 60,92 L76,92 C86,120 58,142 76,170 C90,198 62,226 80,262 Z"/>
        <path data-group="seaweed2" ${F} d="M340,262 C360,230 328,210 348,178 C360,152 336,132 344,108 L328,108 C320,134 344,154 328,180 C316,206 342,230 326,262 Z"/>

        <circle data-group="bubble1" ${F} cx="150" cy="55" r="9"/>
        <circle data-group="bubble2" ${F} cx="172" cy="86" r="6"/>
        <circle data-group="bubble3" ${F} cx="300" cy="45" r="10"/>
        <circle data-group="bubble4" ${F} cx="322" cy="78" r="7"/>

        <polygon data-group="starfish" ${F} points="330,243 337,261 357,261 341,273 347,294 330,282 313,294 319,273 303,261 323,261"/>

        <polygon data-group="fish-tail" ${F} points="255,150 302,118 302,182"/>
        <polygon data-group="fish-fin-top" ${F} points="170,102 190,68 212,102"/>
        <polygon data-group="fish-fin-bottom" ${F} points="170,198 190,228 212,198"/>
        <ellipse data-group="fish-body" ${F} cx="180" cy="150" rx="75" ry="48"/>
        <circle data-group="fish-eye" ${F} cx="140" cy="140" r="12" stroke-width="4"/>
        <circle ${D} cx="136" cy="140" r="5" fill="#2b2b2b"/>
        <path ${D} d="M105,152 Q95,158 105,164" fill="none" stroke="#2b2b2b" stroke-width="3" stroke-linecap="round"/>

        <polygon data-group="small-fish-tail" ${F} points="65,220 40,205 40,235"/>
        <ellipse data-group="small-fish-body" ${F} cx="95" cy="220" rx="28" ry="18"/>
        <circle ${D} cx="108" cy="216" r="3" fill="#2b2b2b"/>
      `
    },
    {
      id: 'rocket',
      name: 'Rocket & Stars',
      svg: `
        <rect data-group="space" ${F} x="0" y="0" width="400" height="260"/>
        <rect data-group="ground" ${F} x="0" y="260" width="400" height="40"/>

        <circle data-group="moon" ${F} cx="340" cy="60" r="36"/>
        <g ${D} stroke="#2b2b2b" stroke-width="3" fill="none">
          <circle cx="330" cy="50" r="6"/>
          <circle cx="352" cy="66" r="5"/>
          <circle cx="326" cy="72" r="4"/>
        </g>

        <circle data-group="planet" ${F} cx="65" cy="225" r="30"/>
        <ellipse ${D} cx="65" cy="225" rx="55" ry="14" fill="none" stroke="#2b2b2b" stroke-width="4" transform="rotate(-15 65 225)"/>

        <polygon data-group="star1" ${F} points="130,46 134,58 146,58 136,66 140,78 130,70 120,78 124,66 114,58 126,58" stroke-width="3"/>
        <polygon data-group="star2" ${F} points="220,30 223,39 232,39 225,45 228,54 220,48 212,54 215,45 208,39 217,39" stroke-width="3"/>
        <polygon data-group="star3" ${F} points="150,122 153,130 161,130 155,135 157,143 150,138 143,143 145,135 139,130 147,130" stroke-width="3"/>
        <polygon data-group="star4" ${F} points="300,140 303,149 312,149 305,155 308,164 300,158 292,164 295,155 288,149 297,149" stroke-width="3"/>
        <polygon data-group="star5" ${F} points="60,130 63,139 72,139 65,145 68,154 60,148 52,154 55,145 48,139 57,139" stroke-width="3"/>

        <path data-group="rocket-flame" ${F} d="M180,240 Q200,282 220,240 Q200,262 180,240 Z"/>
        <polygon data-group="rocket-fin-l" ${F} points="170,210 138,242 170,242"/>
        <polygon data-group="rocket-fin-r" ${F} points="230,210 262,242 230,242"/>
        <path data-group="rocket-body" ${F} d="M200,118 C178,118 168,160 168,202 L168,242 L232,242 L232,202 C232,160 222,118 200,118 Z"/>
        <circle data-group="rocket-window" ${F} cx="200" cy="172" r="18"/>
        <circle ${D} cx="186" cy="204" r="3" fill="#2b2b2b"/>
        <circle ${D} cx="214" cy="204" r="3" fill="#2b2b2b"/>
      `
    }
  ];

  const svgRoot = document.getElementById('pictureSvg');
  const stage = document.getElementById('pictureStage');
  const canvas = document.getElementById('brushCanvas');
  const ctx = canvas.getContext('2d');
  const colorGrid = document.getElementById('colorGrid');
  const sizeRow = document.getElementById('sizeRow');
  const toolRow = document.getElementById('toolRow');
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  const randomBtn = document.getElementById('randomBtn');
  const clearBtn = document.getElementById('clearBtn');
  const saveBtn = document.getElementById('saveBtn');
  const galleryRow = document.getElementById('galleryRow');
  const toast = document.getElementById('toast');

  const COLORS = [
    '#ff4d4d', '#ff9a3c', '#ffd93d', '#a8e05f', '#4caf50',
    '#4fd1ff', '#2e6da4', '#4f6bff', '#a55bff', '#ff5da2',
    '#ffb3c6', '#a0623c', '#e0e0e0', '#8d6748', '#2b2b2b', '#ffffff'
  ];
  const LIGHT_COLORS = new Set(['#ffd93d', '#e0e0e0', '#ffffff', '#a8e05f', '#ffb3c6']);
  const SIZES = [4, 10, 18, 28];

  function showToast(text) {
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('show'), 1600);
  }

  // ---------- State ----------
  let currentColor = COLORS[0];
  let currentSize = SIZES[1];
  let tool = 'brush'; // 'brush' | 'erase' | 'fill'
  let currentPic = null;
  let undoStack = [];
  let redoStack = [];

  // ---------- Canvas sizing ----------
  function resizeCanvas() {
    const displayWidth = stage.clientWidth;
    const displayHeight = stage.clientHeight;
    if (!displayWidth || !displayHeight) return;

    let prev = null;
    if (canvas.width > 0 && canvas.height > 0) {
      prev = document.createElement('canvas');
      prev.width = canvas.width;
      prev.height = canvas.height;
      prev.getContext('2d').drawImage(canvas, 0, 0);
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(displayWidth * dpr);
    canvas.height = Math.round(displayHeight * dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (prev) ctx.drawImage(prev, 0, 0, prev.width, prev.height, 0, 0, displayWidth, displayHeight);
  }
  window.addEventListener('resize', resizeCanvas);

  // ---------- Undo / redo ----------
  function snapshotState() {
    const fills = {};
    svgRoot.querySelectorAll('[data-group]').forEach(el => {
      const g = el.dataset.group;
      if (!(g in fills)) fills[g] = el.getAttribute('fill');
    });
    return { fills, imgData: ctx.getImageData(0, 0, canvas.width, canvas.height) };
  }

  function restoreState(state) {
    Object.entries(state.fills).forEach(([group, color]) => {
      svgRoot.querySelectorAll(`[data-group="${group}"]`).forEach(el => el.setAttribute('fill', color));
    });
    ctx.putImageData(state.imgData, 0, 0);
  }

  function pushUndo() {
    undoStack.push(snapshotState());
    if (undoStack.length > 25) undoStack.shift();
    redoStack = [];
    updateUndoRedoButtons();
  }

  function updateUndoRedoButtons() {
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
  }

  undoBtn.addEventListener('click', () => {
    if (!undoStack.length) return;
    redoStack.push(snapshotState());
    restoreState(undoStack.pop());
    updateUndoRedoButtons();
  });

  redoBtn.addEventListener('click', () => {
    if (!redoStack.length) return;
    undoStack.push(snapshotState());
    restoreState(redoStack.pop());
    updateUndoRedoButtons();
  });

  // ---------- Load a picture ----------
  function loadPicture(pic) {
    currentPic = pic;
    svgRoot.innerHTML = pic.svg;
    resizeCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    undoStack = [];
    redoStack = [];
    updateUndoRedoButtons();
    [...galleryRow.children].forEach(card => {
      card.classList.toggle('active', card.dataset.id === pic.id);
    });
  }

  function pickRandomPicture(excludeId) {
    const options = excludeId ? PICTURES.filter(p => p.id !== excludeId) : PICTURES;
    return options[Math.floor(Math.random() * options.length)];
  }

  // ---------- Fill tool ----------
  svgRoot.addEventListener('pointerdown', (e) => {
    if (tool !== 'fill') return;
    const el = e.target.closest('.fillable');
    if (!el) return;
    pushUndo();
    const group = el.dataset.group;
    svgRoot.querySelectorAll(`[data-group="${group}"]`).forEach(node => node.setAttribute('fill', currentColor));
    playPop();
  });

  // ---------- Brush / eraser ----------
  let drawing = false;
  let lastPoint = null;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function dotAt(pos) {
    ctx.beginPath();
    ctx.fillStyle = currentColor;
    ctx.globalCompositeOperation = tool === 'erase' ? 'destination-out' : 'source-over';
    ctx.arc(pos.x, pos.y, currentSize / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (tool !== 'brush' && tool !== 'erase') return;
    canvas.setPointerCapture(e.pointerId);
    pushUndo();
    drawing = true;
    const pos = getPos(e);
    lastPoint = pos;
    dotAt(pos);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const pos = getPos(e);
    ctx.globalCompositeOperation = tool === 'erase' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;
    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPoint = pos;
  });

  function endStroke() { drawing = false; lastPoint = null; }
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);

  // ---------- Toolbar: colors ----------
  COLORS.forEach((color, i) => {
    const btn = document.createElement('button');
    btn.className = 'swatch' + (i === 0 ? ' active' : '') + (LIGHT_COLORS.has(color) ? ' light-color' : '');
    btn.style.background = color;
    btn.addEventListener('click', () => {
      currentColor = color;
      [...colorGrid.querySelectorAll('.swatch')].forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      if (tool === 'erase') setTool('brush');
    });
    colorGrid.appendChild(btn);
  });

  // ---------- Toolbar: sizes ----------
  SIZES.forEach((size, i) => {
    const btn = document.createElement('button');
    btn.className = 'size-btn' + (i === 1 ? ' active' : '');
    const dot = document.createElement('div');
    dot.className = 'size-dot';
    const d = 6 + i * 6;
    dot.style.width = d + 'px';
    dot.style.height = d + 'px';
    btn.appendChild(dot);
    btn.addEventListener('click', () => {
      currentSize = size;
      [...sizeRow.querySelectorAll('.size-btn')].forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
    });
    sizeRow.appendChild(btn);
  });

  // ---------- Toolbar: tools ----------
  function setTool(t) {
    tool = t;
    canvas.style.pointerEvents = (t === 'brush' || t === 'erase') ? 'auto' : 'none';
    svgRoot.style.cursor = t === 'fill' ? 'pointer' : 'default';
    [...toolRow.querySelectorAll('.tool-btn[data-tool]')].forEach(b => {
      b.classList.toggle('active', b.dataset.tool === t);
    });
  }
  setTool('brush');

  toolRow.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => setTool(btn.dataset.tool));
  });

  // ---------- Random / Clear / Save ----------
  randomBtn.addEventListener('click', () => {
    playPop();
    loadPicture(pickRandomPicture(currentPic ? currentPic.id : null));
    showToast('New picture! 🎲');
  });

  clearBtn.addEventListener('click', () => {
    if (!currentPic) return;
    pushUndo();
    playWhoosh();
    svgRoot.querySelectorAll('.fillable').forEach(el => el.setAttribute('fill', '#ffffff'));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    showToast('All clean! 🧹');
  });

  saveBtn.addEventListener('click', () => {
    getAudioCtx();
    const svgString = new XMLSerializer().serializeToString(svgRoot);
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const outW = 800, outH = 600;
      const off = document.createElement('canvas');
      off.width = outW;
      off.height = outH;
      const octx = off.getContext('2d');
      octx.fillStyle = '#ffffff';
      octx.fillRect(0, 0, outW, outH);
      octx.drawImage(img, 0, 0, outW, outH);
      octx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, outW, outH);
      URL.revokeObjectURL(url);
      const link = document.createElement('a');
      link.download = `my-${currentPic.id}-painting.png`;
      link.href = off.toDataURL('image/png');
      link.click();
      playChime();
      showToast('Picture saved! 🎉');
    };
    img.src = url;
  });

  // ---------- Gallery ----------
  PICTURES.forEach(pic => {
    const card = document.createElement('div');
    card.className = 'gallery-card';
    card.dataset.id = pic.id;

    const thumb = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    thumb.setAttribute('viewBox', '0 0 400 300');
    thumb.innerHTML = pic.svg;
    card.appendChild(thumb);

    const label = document.createElement('div');
    label.className = 'name';
    label.textContent = pic.name;
    card.appendChild(label);

    card.addEventListener('click', () => {
      playPop();
      loadPicture(pic);
    });
    galleryRow.appendChild(card);
  });

  // ---------- Init ----------
  window.addEventListener('load', () => {
    loadPicture(pickRandomPicture());
  });
}

// ============================================================
// Dispatch — run only the current page's init function
// ============================================================
if (PAGE === 'home') initHome();
else if (PAGE === 'kids') initKids();
else if (PAGE === 'animals') initAnimals();
else if (PAGE === 'painting') initPainting();
else if (PAGE === 'colorbook') initColorbook();
