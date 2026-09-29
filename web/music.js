// Background music: an original chiptune loop synthesised with Web Audio (no audio files needed).
// If `assets/music.mp3` exists it is looped instead, so a track you have the rights to can be dropped in.
// Browsers only allow audio after a click, so `play()` is called from the drop / demo handlers.

const KEY = "checkpoint:music";
const VOLUME = 0.11;
const BPM = 112;
const STEP = 60 / BPM / 4; // one 16th note

let muted = false;
try { muted = localStorage.getItem(KEY) === "off"; } catch { /* storage blocked */ }

let ac = null, master = null, timer = 0, step = 0, nextTime = 0, noise = null;
let file = null; // HTMLAudioElement when a custom track exists
let fileChecked = null;
const listeners = new Set();

export const isMuted = () => muted;
export function onChange(fn) { listeners.add(fn); }

export function setMuted(m) {
  muted = m;
  try { localStorage.setItem(KEY, m ? "off" : "on"); } catch { /* storage blocked */ }
  if (file) file.muted = m;
  if (master) master.gain.setTargetAtTime(m ? 0 : VOLUME, ac.currentTime, 0.08);
  listeners.forEach((fn) => fn(m));
}

/** Starts the loop (idempotent). Must be called from a user gesture the first time. */
export async function play() {
  // Create the context synchronously, inside the gesture, before any await.
  if (!ac) {
    try {
      ac = new AudioContext();
      master = ac.createGain();
      master.gain.value = 0;
      master.connect(ac.destination);
    } catch { return; }
  }
  ac.resume?.();
  fileChecked ??= fetch("assets/music.mp3", { method: "HEAD" }).then((r) => r.ok).catch(() => false);
  if (await fileChecked) {
    if (!file) {
      file = new Audio("assets/music.mp3");
      file.loop = true;
      file.volume = 0.5;
    }
    file.muted = muted;
    file.play().catch(() => {});
    return;
  }
  if (timer) return;
  master.gain.setTargetAtTime(muted ? 0 : VOLUME, ac.currentTime, 0.4);
  step = 0;
  nextTime = ac.currentTime + 0.1;
  timer = setInterval(schedule, 25);
}

/** Fades out and stops. */
export function stop() {
  if (file) file.pause();
  if (!ac || !timer) return;
  master.gain.setTargetAtTime(0, ac.currentTime, 0.25);
  clearInterval(timer);
  timer = 0;
}

// ---------- the tune ----------

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

// i - VI - III - VII in A minor. Bass root, arpeggio tones.
const CHORDS = [
  { bass: 45, arp: [57, 60, 64, 69] }, // Am
  { bass: 41, arp: [53, 57, 60, 65] }, // F
  { bass: 48, arp: [55, 60, 64, 67] }, // C
  { bass: 43, arp: [55, 59, 62, 67] }, // G
];
const ARP = [0, 1, 2, 3, 2, 1, 2, 3, 0, 1, 2, 3, 2, 3, 1, 2];
// Lead melody, 8th notes (null = rest), played on the second pass of the progression.
const LEAD = [
  [76, null, 76, 79, 81, null, 79, 76],
  [77, null, 76, 74, 72, null, 74, 76],
  [79, null, 79, 76, 72, null, 76, 79],
  [74, null, 71, 74, 79, null, 76, 74],
];
const BARS = 8;

function schedule() {
  while (nextTime < ac.currentTime + 0.12) {
    note(step, nextTime);
    nextTime += STEP;
    step = (step + 1) % (BARS * 16);
  }
}

function note(i, t) {
  const bar = Math.floor(i / 16), s = i % 16;
  const chord = CHORDS[bar % 4];
  const second = bar >= 4;

  // Arpeggio: soft square 16ths.
  tone("square", hz(chord.arp[ARP[s]] + 12), t, STEP * 0.8, second ? 0.05 : 0.07);
  // Bass: triangle 8ths with an octave hop.
  if (s % 2 === 0) tone("triangle", hz(chord.bass - (s % 8 === 4 ? 0 : 12)), t, STEP * 1.7, 0.35);
  // Lead on the second pass.
  if (second && s % 2 === 0) {
    const n = LEAD[bar % 4][s / 2];
    if (n) tone("square", hz(n), t, STEP * 1.8, 0.09, true);
  }
  // Drums.
  if (s % 8 === 0) kick(t);
  if (s % 8 === 4) hit(t, 0.12, 1800, 0.22); // snare
  if (s % 2 === 1) hit(t, 0.03, 8000, 0.06); // hat
}

function tone(type, freq, t, dur, gain, vibrato = false) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.value = freq;
  if (vibrato) {
    const lfo = ac.createOscillator(), depth = ac.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.value = freq * 0.006;
    lfo.connect(depth).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + dur);
  }
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function kick(t) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
  g.gain.setValueAtTime(0.6, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.2);
}

function hit(t, dur, freq, gain) {
  if (!noise) {
    noise = ac.createBuffer(1, ac.sampleRate * 0.25, ac.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = noise;
  f.type = freq > 4000 ? "highpass" : "bandpass";
  f.frequency.value = freq;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
}
