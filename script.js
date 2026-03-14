// ── Config ────────────────────────────────────────────────────────────────────
const MODES = {
  work:  { label: 'Focus',       minutes: 25 },
  short: { label: 'Short Break', minutes: 5  },
  long:  { label: 'Long Break',  minutes: 12 },
};

const QUOTE = '"We. Did. Not. Care."';

// ── State ─────────────────────────────────────────────────────────────────────
let currentMode    = 'work';
let totalSeconds   = MODES.work.minutes * 60;
let remainingSeconds = totalSeconds;
let isRunning      = false;
let intervalId     = null;
let pomodoroCount  = 0;   // within current set (0–3)
let completedTotal = 0;   // all-time for this session

// ── DOM refs ──────────────────────────────────────────────────────────────────
const timerDisplay  = document.getElementById('timerDisplay');
const progressRing  = document.getElementById('progressRing');
const startBtn      = document.getElementById('startBtn');
const resetBtn      = document.getElementById('resetBtn');
const skipBtn       = document.getElementById('skipBtn');
const tabs          = document.querySelectorAll('.tab');
const dots          = document.querySelectorAll('.dot');
const completedCount    = document.getElementById('completedCount');
const quoteBox          = document.getElementById('quoteBox');
const clearCounterBtn   = document.getElementById('clearCounterBtn');

const CIRCUMFERENCE = 2 * Math.PI * 88; // r=88 from SVG

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function setProgress(fraction) {
  // fraction 1 = full ring, 0 = empty
  const offset = CIRCUMFERENCE * (1 - fraction);
  progressRing.style.strokeDasharray  = CIRCUMFERENCE;
  progressRing.style.strokeDashoffset = offset;
}

function updateDots() {
  dots.forEach((dot, i) => {
    dot.classList.toggle('filled', i < pomodoroCount);
  });
}

function showQuote() {
  quoteBox.textContent = QUOTE;
}

function updateRingMode() {
  if (currentMode === 'work') {
    progressRing.classList.remove('break-mode');
  } else {
    progressRing.classList.add('break-mode');
  }
}

function updateDisplay() {
  timerDisplay.textContent = formatTime(remainingSeconds);
  setProgress(remainingSeconds / totalSeconds);
  document.title = `${formatTime(remainingSeconds)} — 12s Pomodoro`;
}

// ── Editable timer ────────────────────────────────────────────────────────────
function enterEditMode() {
  if (isRunning) return;
  timerDisplay.contentEditable = 'true';
  timerDisplay.classList.add('editing');
  timerDisplay.focus();
  // Select all so the user can just start typing
  const range = document.createRange();
  range.selectNodeContents(timerDisplay);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

function commitEdit() {
  timerDisplay.contentEditable = 'false';
  timerDisplay.classList.remove('editing');

  const raw = timerDisplay.textContent.trim();
  let parsed = 0;

  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    // MM:SS format
    const [m, s] = raw.split(':').map(Number);
    parsed = m * 60 + Math.min(s, 59);
  } else if (/^\d+$/.test(raw)) {
    // Plain number → treat as minutes
    parsed = parseInt(raw, 10) * 60;
  }

  if (parsed > 0) {
    totalSeconds = parsed;
    remainingSeconds = parsed;
    MODES[currentMode].minutes = parsed / 60;
  }

  updateDisplay();
}

timerDisplay.addEventListener('click', enterEditMode);

timerDisplay.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    timerDisplay.blur();
  }
  if (e.key === 'Escape') {
    timerDisplay.textContent = formatTime(remainingSeconds);
    timerDisplay.blur();
  }
});

timerDisplay.addEventListener('blur', commitEdit);

// ── Beep via Web Audio API ────────────────────────────────────────────────────
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523, 659, 784]; // C5, E5, G5 — a cheerful major chord arpeggio
    notes.forEach((freq, i) => {
      const osc   = ctx.createOscillator();
      const gain  = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type      = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.4);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.5);
    });
  } catch (e) {
    // Audio not available — silently skip
  }
}

// ── Timer logic ───────────────────────────────────────────────────────────────
function tick() {
  if (remainingSeconds <= 0) {
    clearInterval(intervalId);
    isRunning = false;
    onTimerComplete();
    return;
  }
  remainingSeconds--;
  updateDisplay();
}

function onTimerComplete() {
  beep();
  timerDisplay.classList.add('flash');
  setTimeout(() => timerDisplay.classList.remove('flash'), 2000);

  startBtn.textContent = 'Start';
  startBtn.classList.remove('running');

  if (currentMode === 'work') {
    completedTotal++;
    pomodoroCount = (pomodoroCount % 4) + 1;
    completedCount.textContent = completedTotal;
    updateDots();
    showQuote();

    // After 4 pomodoros, suggest a long break
    if (pomodoroCount === 4) {
      pomodoroCount = 0;
      updateDots();
      setTimeout(() => switchMode('long'), 800);
    } else {
      setTimeout(() => switchMode('short'), 800);
    }
  } else {
    setTimeout(() => switchMode('work'), 800);
  }
}

function startPause() {
  if (isRunning) {
    clearInterval(intervalId);
    isRunning = false;
    startBtn.textContent = 'Resume';
    startBtn.classList.remove('running');
  } else {
    if (remainingSeconds === 0) return;
    isRunning = true;
    startBtn.textContent = 'Pause';
    startBtn.classList.add('running');
    intervalId = setInterval(tick, 1000);
    if (!quoteBox.textContent) showQuote();
  }
}

function reset() {
  clearInterval(intervalId);
  isRunning = false;
  remainingSeconds = totalSeconds;
  startBtn.textContent = 'Start';
  startBtn.classList.remove('running');
  updateDisplay();
}

function switchMode(mode) {
  clearInterval(intervalId);
  isRunning = false;
  currentMode = mode;
  totalSeconds = MODES[mode].minutes * 60;
  remainingSeconds = totalSeconds;
  startBtn.textContent = 'Start';
  startBtn.classList.remove('running');

  tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  updateRingMode();
  updateDisplay();
}

// ── Event listeners ───────────────────────────────────────────────────────────
startBtn.addEventListener('click', startPause);
resetBtn.addEventListener('click', reset);
skipBtn.addEventListener('click', () => {
  clearInterval(intervalId);
  isRunning = false;
  onTimerComplete();
});

tabs.forEach(tab => {
  tab.addEventListener('click', () => switchMode(tab.dataset.mode));
});

clearCounterBtn.addEventListener('click', () => {
  pomodoroCount  = 0;
  completedTotal = 0;
  completedCount.textContent = 0;
  updateDots();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target === document.body) {
    e.preventDefault();
    startPause();
  }
  if (e.code === 'KeyR' && e.target === document.body) reset();
});

// ── Init ──────────────────────────────────────────────────────────────────────
updateDisplay();
updateDots();
showQuote();
