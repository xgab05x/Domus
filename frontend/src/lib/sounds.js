// Suonerie e sirene Domus: generate dal browser (nessun file da scaricare) + supporto MP3 personalizzati.
export const RINGTONES = [
  { id: "chime", name: "Chime classico", pattern: [[880, 180], [660, 260], [0, 320]], wave: "sine" },
  { id: "ding_dong", name: "Ding dong", pattern: [[784, 300], [587, 520], [0, 380]], wave: "triangle" },
  { id: "westminster", name: "Westminster", pattern: [[659, 260], [587, 260], [523, 260], [392, 520], [0, 420]], wave: "sine" },
  { id: "digital", name: "Digitale", pattern: [[1046, 90], [0, 60], [1046, 90], [0, 420]], wave: "square" },
  { id: "marimba", name: "Marimba", pattern: [[523, 120], [659, 120], [784, 120], [1046, 220], [0, 300]], wave: "triangle" },
  { id: "soft_bell", name: "Campanella soft", pattern: [[1318, 140], [1046, 320], [0, 460]], wave: "sine" },
  { id: "double_knock", name: "Doppio tocco", pattern: [[392, 130], [0, 90], [392, 130], [0, 520]], wave: "triangle" },
  { id: "arpeggio", name: "Arpeggio", pattern: [[440, 100], [554, 100], [659, 100], [880, 160], [659, 100], [0, 340]], wave: "sine" },
  { id: "retro", name: "Retro 8-bit", pattern: [[698, 100], [0, 50], [880, 100], [0, 50], [1174, 160], [0, 380]], wave: "square" },
  { id: "gong", name: "Gong", pattern: [[196, 700], [0, 500]], wave: "sine" },
  { id: "whistle", name: "Fischio", pattern: [[1200, 120], [1600, 180], [1200, 160], [0, 400]], wave: "sine" },
  { id: "buzzer_soft", name: "Ronzio gentile", pattern: [[320, 260], [0, 120], [320, 260], [0, 520]], wave: "sawtooth" },
];

export const SIRENS = [
  { id: "siren_classic", name: "Sirena classica", sweep: [600, 1200], step: 14, wave: "sawtooth" },
  { id: "siren_fast", name: "Sirena rapida", sweep: [800, 1600], step: 7, wave: "square" },
  { id: "siren_police", name: "Polizia", pattern: [[1100, 300], [780, 300]], wave: "square" },
  { id: "siren_yelp", name: "Yelp", sweep: [700, 1500], step: 4, wave: "sawtooth" },
  { id: "siren_air", name: "Allarme aereo", sweep: [400, 900], step: 28, wave: "sine" },
  { id: "siren_beep", name: "Bip d'emergenza", pattern: [[2000, 140], [0, 120]], wave: "square" },
  { id: "siren_horn", name: "Tromba", pattern: [[220, 420], [180, 420]], wave: "sawtooth" },
  { id: "siren_pulse", name: "Impulso continuo", pattern: [[1400, 90], [0, 60], [1400, 90], [0, 200]], wave: "square" },
];

export const ALL_SOUNDS = [...RINGTONES, ...SIRENS];
export const soundName = (id, custom = []) => ALL_SOUNDS.find((s) => s.id === id)?.name || custom.find((c) => c.id === id)?.name || id;

let ctx = null;
let active = null;

function audioCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export function stopSound() {
  if (!active) return;
  try { active.stop(); } catch { /* già fermo */ }
  active = null;
}

// Riproduce una suoneria/sirena (o un MP3 personalizzato) per `duration` secondi al volume indicato.
export function playSound(id, { volume = 70, duration = 6, custom = [] } = {}) {
  stopSound();
  const mp3 = custom.find((c) => c.id === id);
  if (mp3?.url) {
    const el = new Audio(mp3.url);
    el.volume = Math.min(1, Math.max(0, volume / 100));
    el.loop = true;
    el.play().catch((err) => console.warn("MP3 non riproducibile:", err?.message || err));
    const timer = setTimeout(() => { el.pause(); active = null; }, duration * 1000);
    active = { stop: () => { clearTimeout(timer); el.pause(); } };
    return active;
  }

  const def = ALL_SOUNDS.find((s) => s.id === id) || RINGTONES[0];
  const ac = audioCtx();
  const gain = ac.createGain();
  gain.gain.value = Math.min(1, Math.max(0, volume / 100)) * 0.35;
  gain.connect(ac.destination);
  const osc = ac.createOscillator();
  osc.type = def.wave || "sine";
  osc.connect(gain);
  const t0 = ac.currentTime;
  const end = t0 + duration;

  if (def.sweep) {
    const [lo, hi] = def.sweep;
    const half = def.step / 10;
    let t = t0;
    osc.frequency.setValueAtTime(lo, t);
    while (t < end) {
      osc.frequency.linearRampToValueAtTime(hi, Math.min(t + half, end));
      osc.frequency.linearRampToValueAtTime(lo, Math.min(t + half * 2, end));
      t += half * 2;
    }
  } else {
    let t = t0;
    while (t < end) {
      for (const [freq, ms] of def.pattern) {
        if (t >= end) break;
        const dur = ms / 1000;
        if (freq > 0) {
          osc.frequency.setValueAtTime(freq, t);
          gain.gain.setValueAtTime(gain.gain.value, t);
        } else {
          gain.gain.setValueAtTime(0.0001, t);
          gain.gain.setValueAtTime(gain.gain.value, t + dur);
        }
        t += dur;
      }
    }
  }

  osc.start(t0);
  osc.stop(end);
  active = { stop: () => { try { osc.stop(); } catch { /* noop */ } gain.disconnect(); } };
  osc.onended = () => { active = null; };
  return active;
}
