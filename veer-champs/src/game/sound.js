// Tiny synthesized sound effects: no audio files to load.
let ctx = null;
let enabled = true;
try { enabled = localStorage.getItem('vc:sound') !== 'off'; } catch { /* storage blocked */ }

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, { at = 0, dur = 0.12, type = 'sine', gain = 0.18, slide = 0 } = {}) {
  const a = audio();
  if (!a || !enabled) return;
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise(at, dur, gain) {
  const a = audio();
  if (!a || !enabled) return;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const filter = a.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 2400;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(a.destination);
  src.start(a.currentTime + at);
}

export const sound = {
  get enabled() { return enabled; },
  toggle() {
    enabled = !enabled;
    try { localStorage.setItem('vc:sound', enabled ? 'on' : 'off'); } catch { /* ignore */ }
    return enabled;
  },
  unlock: () => audio(),
  dice() { for (let i = 0; i < 7; i++) noise(i * 0.11 + Math.random() * 0.04, 0.05, 0.5 - i * 0.05); },
  land: () => tone(180, { dur: 0.1, type: 'triangle', gain: 0.25 }),
  step: () => tone(620 + Math.random() * 60, { dur: 0.06, type: 'triangle', gain: 0.08 }),
  capture() { tone(700, { dur: 0.35, type: 'sawtooth', gain: 0.1, slide: 0.25 }); noise(0, 0.2, 0.3); },
  home() { [523, 659, 784].forEach((f, i) => tone(f, { at: i * 0.09, dur: 0.18, gain: 0.14 })); },
  turn() { tone(880, { dur: 0.12, gain: 0.12 }); tone(1320, { at: 0.1, dur: 0.16, gain: 0.1 }); },
  error: () => tone(160, { dur: 0.18, type: 'square', gain: 0.06 }),
  win() {
    [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, { at: i * 0.12, dur: 0.22, type: 'triangle', gain: 0.16 }));
  },
};
