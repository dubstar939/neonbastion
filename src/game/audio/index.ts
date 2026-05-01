// =============================================================
// PROCEDURAL AUDIO ENGINE — Web Audio API synthesis
// All music + SFX generated at runtime. No audio files.
// =============================================================

let ctx: AudioContext | null = null;
let masterGain!: GainNode;
let musicGain!: GainNode;
let sfxGain!: GainNode;
let ambienceGain!: GainNode;
let musicPlaying = false;
let currentTrack: "menu" | "combat" | "boss" | "none" = "none";
let activeMusic: { stop: () => void } | null = null;
let ambienceNodes: { stop: () => void } | null = null;

function getCtx(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(ctx.destination);

    musicGain = ctx.createGain();
    musicGain.gain.value = 0.35;
    musicGain.connect(masterGain);

    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.6;
    sfxGain.connect(masterGain);

    ambienceGain = ctx.createGain();
    ambienceGain.gain.value = 0.15;
    ambienceGain.connect(masterGain);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

// ── Utility ────────────────────────────────────────────────────

function whiteNoise(ac: AudioContext, duration: number): AudioBufferSourceNode {
  const size = ac.sampleRate * duration;
  const buf = ac.createBuffer(1, size, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  return src;
}

// noiseBuffer available if needed

// ── MASTER CONTROLS ────────────────────────────────────────────

export function initAudio() { getCtx(); }

export function setMasterVolume(v: number) {
  getCtx();
  masterGain.gain.value = clamp(v);
}
export function setMusicVolume(v: number) {
  getCtx();
  musicGain.gain.value = clamp(v);
}
export function setSfxVolume(v: number) {
  getCtx();
  sfxGain.gain.value = clamp(v);
}

function clamp(v: number) { return Math.max(0, Math.min(1, v)); }

// ── ENVELOPE HELPER ────────────────────────────────────────────

function env(gain: GainNode, ac: AudioContext, steps: [number, number][]) {
  const t = ac.currentTime;
  for (const [time, val] of steps) {
    gain.gain.linearRampToValueAtTime(val, t + time);
  }
}

// ================================================================
//  BACKGROUND MUSIC — 3 procedural looping tracks
// ================================================================

export function playMusic(track: "menu" | "combat" | "boss") {
  if (track === currentTrack && musicPlaying) return;
  stopMusic();
  getCtx();
  currentTrack = track;
  musicPlaying = true;

  switch (track) {
    case "menu":   activeMusic = buildMenuTrack(); break;
    case "combat": activeMusic = buildCombatTrack(); break;
    case "boss":   activeMusic = buildBossTrack(); break;
  }
}

export function stopMusic() {
  if (activeMusic) { activeMusic.stop(); activeMusic = null; }
  musicPlaying = false;
  currentTrack = "none";
}

// ── MENU AMBIENT — Soft pads, light arpeggios, mechanical hum ──
function buildMenuTrack(): { stop: () => void } {
  const ac = getCtx();
  if (!ac || !musicGain) return { stop: () => {} };
  const nodes: AudioNode[] = [];
  let stopped = false;

  // Sub bass drone (C1, 32.7 Hz)
  const sub = ac.createOscillator();
  sub.type = "sine";
  sub.frequency.value = 32.7;
  const subG = ac.createGain();
  subG.gain.value = 0.12;
  sub.connect(subG).connect(musicGain);
  sub.start();
  nodes.push(sub);

  // Pad chord: Cm7 — C3, Eb3, G3, Bb3
  const padFreqs = [130.81, 155.56, 196.0, 233.08];
  for (const f of padFreqs) {
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = f;
    // gentle detuning for width
    const detune = (hash2(f) % 20) - 10;
    osc.detune.value = detune;
    const filt = ac.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 400;
    filt.Q.value = 0.5;
    const g = ac.createGain();
    g.gain.value = 0.03;
    osc.connect(filt).connect(g).connect(musicGain);
    osc.start();
    nodes.push(osc);
    nodes.push(filt);
    nodes.push(g);
    // LFO on filter for movement
    const lfo = ac.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.15 + Math.random() * 0.1;
    const lfoG = ac.createGain();
    lfoG.gain.value = 200;
    lfo.connect(lfoG).connect(filt.frequency);
    lfo.start();
    nodes.push(lfo);
  }

  // Arpeggio — slow pentatonic, every 0.5s
  const arpNotes = [130.81, 155.56, 196.0, 233.08, 261.63, 311.13, 349.23];
  let arpIdx = 0;
  const arpInterval = setInterval(() => {
    if (stopped || !musicGain) return;
    const osc = ac.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = arpNotes[arpIdx % arpNotes.length];
    const g = ac.createGain();
    g.gain.value = 0.06;
    env(g, ac, [[0, 0.06], [0.15, 0.04], [0.4, 0.0]]);
    osc.connect(g).connect(musicGain);
    osc.start();
    osc.stop(ac.currentTime + 0.45);
    arpIdx++;
  }, 500);

  // Mechanical hum (filtered noise)
  const hum = whiteNoise(ac, 2);
  hum.loop = true;
  const humFilt = ac.createBiquadFilter();
  humFilt.type = "bandpass";
  humFilt.frequency.value = 120;
  humFilt.Q.value = 8;
  const humG = ac.createGain();
  humG.gain.value = 0.04;
  hum.connect(humFilt).connect(humG).connect(musicGain);
  hum.start();
  nodes.push(hum);

  return {
    stop: () => {
      stopped = true;
      clearInterval(arpInterval);
      for (const n of nodes) {
        try { (n as OscillatorNode).stop(); } catch {}
        try { (n as AudioBufferSourceNode).stop(); } catch {}
      }
    }
  };
}

// ── COMBAT TECHNO — Pulsing bass, mechanical percussion, neon synths ──
function buildCombatTrack(): { stop: () => void } {
  const ac = getCtx();
  if (!ac || !musicGain) return { stop: () => {} };
  const nodes: AudioNode[] = [];
  let stopped = false;
  const bpm = 130;
  const beat = 60 / bpm;

  // Pulsing bassline (8th notes)
  const bassNotes = [65.41, 65.41, 77.78, 65.41, 87.31, 87.31, 77.78, 65.41]; // C2, C2, Eb2, C2, F2...
  let bassIdx = 0;
  const bassInterval = setInterval(() => {
    if (stopped || !musicGain) return;
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = bassNotes[bassIdx % bassNotes.length];
    const filt = ac.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 180;
    filt.Q.value = 4;
    const g = ac.createGain();
    env(g, ac, [[0, 0.15], [0.02, 0.12], [beat * 0.45, 0.0]]);
    osc.connect(filt).connect(g).connect(musicGain);
    osc.start();
    osc.stop(ac.currentTime + beat * 0.5);
    bassIdx++;
  }, beat * 0.5 * 1000);

  // Kick drum (every beat)
  const kickInterval = setInterval(() => {
    if (stopped || !musicGain) return;
    playKickInternal(ac, musicGain, 0.25);
  }, beat * 1000);

  // Hi-hat (16th notes)
  let hhCounter = 0;
  const hhInterval = setInterval(() => {
    if (stopped || !musicGain) return;
    const vol = (hhCounter % 2 === 0) ? 0.06 : 0.03;
    playHiHatInternal(ac, musicGain, vol);
    hhCounter++;
  }, beat * 0.25 * 1000);

  // Neon synth stab (every 2 bars)
  const stabNotes = [523.25, 622.25, 698.46, 523.25]; // C5, Eb5, F5, C5
  let stabIdx = 0;
  const stabInterval = setInterval(() => {
    if (stopped || !musicGain) return;
    const osc = ac.createOscillator();
    osc.type = "square";
    osc.frequency.value = stabNotes[stabIdx % stabNotes.length];
    const filt = ac.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 2000;
    const g = ac.createGain();
    env(g, ac, [[0, 0.06], [0.05, 0.04], [0.2, 0.0]]);
    osc.connect(filt).connect(g).connect(musicGain);
    osc.start();
    osc.stop(ac.currentTime + 0.25);
    stabIdx++;
  }, beat * 8 * 1000);

  // Sub bass sustained
  const sub = ac.createOscillator();
  sub.type = "sine";
  sub.frequency.value = 32.7;
  const subG = ac.createGain();
  subG.gain.value = 0.08;
  sub.connect(subG).connect(musicGain);
  sub.start();
  nodes.push(sub);

  return {
    stop: () => {
      stopped = true;
      clearInterval(bassInterval);
      clearInterval(kickInterval);
      clearInterval(hhInterval);
      clearInterval(stabInterval);
      for (const n of nodes) {
        try { (n as OscillatorNode).stop(); } catch {}
      }
    }
  };
}

// ── BOSS TRACK — Heavy drops, wobble bass, glitch FX ──
function buildBossTrack(): { stop: () => void } {
  const ac = getCtx();
  if (!ac || !musicGain) return { stop: () => {} };
  const nodes: AudioNode[] = [];
  let stopped = false;
  const bpm = 145;
  const beat = 60 / bpm;

  // Aggressive wobble bass
  const bassNotes = [55, 55, 65.41, 55, 73.42, 65.41, 55, 49.0];
  let bassIdx = 0;
  const bassInterval = setInterval(() => {
    if (stopped || !musicGain) return;
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = bassNotes[bassIdx % bassNotes.length];
    // wobble via LFO on filter
    const filt = ac.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 300;
    filt.Q.value = 12;
    const lfo = ac.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 6; // wobble rate
    const lfoG = ac.createGain();
    lfoG.gain.value = 250;
    lfo.connect(lfoG).connect(filt.frequency);
    lfo.start();
    const g = ac.createGain();
    env(g, ac, [[0, 0.18], [0.02, 0.14], [beat * 0.45, 0.0]]);
    osc.connect(filt).connect(g).connect(musicGain);
    osc.start();
    osc.stop(ac.currentTime + beat * 0.5);
    lfo.stop(ac.currentTime + beat * 0.5);
    bassIdx++;
  }, beat * 0.5 * 1000);

  // Double-time kick
  const kickInterval = setInterval(() => {
    if (stopped || !musicGain) return;
    playKickInternal(ac, musicGain, 0.3);
  }, beat * 0.5 * 1000);

  // Glitch FX burst (random every 2-4 beats)
  const glitchInterval = setInterval(() => {
    if (stopped || !musicGain) return;
    // bit-crushed noise burst
    const src = whiteNoise(ac, 0.08);
    const filt = ac.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.value = 2000;
    const g = ac.createGain();
    env(g, ac, [[0, 0.1], [0.04, 0.05], [0.07, 0.0]]);
    src.connect(filt).connect(g).connect(musicGain);
    src.start();
  }, beat * 2 * 1000);

  // Menacing drone
  const drone = ac.createOscillator();
  drone.type = "sawtooth";
  drone.frequency.value = 55;
  const droneFilt = ac.createBiquadFilter();
  droneFilt.type = "lowpass";
  droneFilt.frequency.value = 150;
  const droneG = ac.createGain();
  droneG.gain.value = 0.1;
  drone.connect(droneFilt).connect(droneG).connect(musicGain);
  drone.start();
  nodes.push(drone);

  // Siren sweep (every 4 bars)
  const sirenInterval = setInterval(() => {
    if (stopped || !musicGain) return;
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 400;
    // sweep up
    osc.frequency.linearRampToValueAtTime(1200, ac.currentTime + 1.5);
    osc.frequency.linearRampToValueAtTime(400, ac.currentTime + 3.0);
    const g = ac.createGain();
    g.gain.value = 0.04;
    env(g, ac, [[0, 0.04], [1.5, 0.03], [2.8, 0.0]]);
    osc.connect(g).connect(musicGain);
    osc.start();
    osc.stop(ac.currentTime + 3.0);
  }, beat * 16 * 1000);

  return {
    stop: () => {
      stopped = true;
      clearInterval(bassInterval);
      clearInterval(kickInterval);
      clearInterval(glitchInterval);
      clearInterval(sirenInterval);
      for (const n of nodes) {
        try { (n as OscillatorNode).stop(); } catch {}
      }
    }
  };
}

// ── Internal drum helpers ──────────────────────────────────────

function playKickInternal(ac: AudioContext, dest: AudioNode, vol: number) {
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.value = 150;
  osc.frequency.exponentialRampToValueAtTime(30, ac.currentTime + 0.12);
  const g = ac.createGain();
  env(g, ac, [[0, vol], [0.02, vol * 0.8], [0.15, 0.0]]);
  osc.connect(g).connect(dest);
  osc.start();
  osc.stop(ac.currentTime + 0.2);
}

function playHiHatInternal(ac: AudioContext, dest: AudioNode, vol: number) {
  const src = whiteNoise(ac, 0.05);
  const filt = ac.createBiquadFilter();
  filt.type = "highpass";
  filt.frequency.value = 8000;
  const g = ac.createGain();
  env(g, ac, [[0, vol], [0.02, vol * 0.5], [0.04, 0.0]]);
  src.connect(filt).connect(g).connect(dest);
  src.start();
}

function hash2(n: number): number {
  let h = (n * 374761393) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return Math.abs(h);
}

// ================================================================
//  SOUND EFFECTS — All procedural
// ================================================================

export const sfx = {
  // ── WEAPON FIRE ──────────────────────────────────────────────

  /** Laser shot — short sharp high-freq */
  laserShot() {
    const ac = getCtx(); if (!sfxGain) return;
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 1800;
    osc.frequency.exponentialRampToValueAtTime(400, ac.currentTime + 0.08);
    const filt = ac.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 1200;
    filt.Q.value = 3;
    const g = ac.createGain();
    env(g, ac, [[0, 0.2], [0.02, 0.15], [0.08, 0.0]]);
    osc.connect(filt).connect(g).connect(sfxGain);
    osc.start(); osc.stop(ac.currentTime + 0.1);
  },

  /** Pulse shot — snappy kinetic */
  pulseShot() {
    const ac = getCtx(); if (!sfxGain) return;
    const osc = ac.createOscillator();
    osc.type = "square";
    osc.frequency.value = 600;
    osc.frequency.exponentialRampToValueAtTime(200, ac.currentTime + 0.06);
    const g = ac.createGain();
    env(g, ac, [[0, 0.18], [0.015, 0.1], [0.06, 0.0]]);
    osc.connect(g).connect(sfxGain);
    osc.start(); osc.stop(ac.currentTime + 0.08);
    // noise click layer
    const n = whiteNoise(ac, 0.03);
    const ng = ac.createGain();
    env(ng, ac, [[0, 0.12], [0.01, 0.06], [0.025, 0.0]]);
    n.connect(ng).connect(sfxGain);
    n.start();
  },

  /** Plasma burst — warm mid-range */
  plasmaShot() {
    const ac = getCtx(); if (!sfxGain) return;
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 300;
    osc.frequency.exponentialRampToValueAtTime(120, ac.currentTime + 0.15);
    const filt = ac.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 800;
    filt.Q.value = 2;
    const g = ac.createGain();
    env(g, ac, [[0, 0.2], [0.04, 0.12], [0.12, 0.0]]);
    osc.connect(filt).connect(g).connect(sfxGain);
    osc.start(); osc.stop(ac.currentTime + 0.15);
  },

  /** Railgun — deep metallic impact */
  railgunShot() {
    const ac = getCtx(); if (!sfxGain) return;
    // metallic sweep
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 100;
    osc.frequency.exponentialRampToValueAtTime(2000, ac.currentTime + 0.04);
    osc.frequency.exponentialRampToValueAtTime(50, ac.currentTime + 0.2);
    const filt = ac.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 3000;
    const g = ac.createGain();
    env(g, ac, [[0, 0.3], [0.03, 0.2], [0.15, 0.05], [0.25, 0.0]]);
    osc.connect(filt).connect(g).connect(sfxGain);
    osc.start(); osc.stop(ac.currentTime + 0.3);
    // impact thump
    const imp = ac.createOscillator();
    imp.type = "sine";
    imp.frequency.value = 80;
    imp.frequency.exponentialRampToValueAtTime(20, ac.currentTime + 0.15);
    const ig = ac.createGain();
    env(ig, ac, [[0, 0.25], [0.05, 0.15], [0.12, 0.0]]);
    imp.connect(ig).connect(sfxGain);
    imp.start(); imp.stop(ac.currentTime + 0.15);
  },

  /** EMP pulse — LF thump + electric crackle */
  empPulse() {
    const ac = getCtx(); if (!sfxGain) return;
    // thump
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 60;
    osc.frequency.exponentialRampToValueAtTime(20, ac.currentTime + 0.3);
    const g = ac.createGain();
    env(g, ac, [[0, 0.3], [0.05, 0.15], [0.2, 0.0]]);
    osc.connect(g).connect(sfxGain);
    osc.start(); osc.stop(ac.currentTime + 0.3);
    // crackle
    const noise = whiteNoise(ac, 0.25);
    const filt = ac.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 3000;
    filt.Q.value = 2;
    const ng = ac.createGain();
    env(ng, ac, [[0, 0.15], [0.08, 0.1], [0.2, 0.0]]);
    noise.connect(filt).connect(ng).connect(sfxGain);
    noise.start();
  },

  /** Nano swarm — buzzing */
  nanoShot() {
    const ac = getCtx(); if (!sfxGain) return;
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 800;
    // vibrato
    const lfo = ac.createOscillator();
    lfo.frequency.value = 30;
    const lfoG = ac.createGain();
    lfoG.gain.value = 150;
    lfo.connect(lfoG).connect(osc.frequency);
    lfo.start();
    const g = ac.createGain();
    env(g, ac, [[0, 0.08], [0.05, 0.06], [0.12, 0.0]]);
    osc.connect(g).connect(sfxGain);
    osc.start(); osc.stop(ac.currentTime + 0.15);
    lfo.stop(ac.currentTime + 0.15);
  },

  /** Quantum rift — eerie tone */
  quantumPulse() {
    const ac = getCtx(); if (!sfxGain) return;
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 200;
    osc.frequency.linearRampToValueAtTime(600, ac.currentTime + 0.15);
    osc.frequency.linearRampToValueAtTime(150, ac.currentTime + 0.3);
    const g = ac.createGain();
    env(g, ac, [[0, 0.15], [0.1, 0.1], [0.25, 0.0]]);
    osc.connect(g).connect(sfxGain);
    osc.start(); osc.stop(ac.currentTime + 0.3);
    // shimmer
    const osc2 = ac.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.value = 1200;
    osc2.frequency.exponentialRampToValueAtTime(400, ac.currentTime + 0.2);
    const g2 = ac.createGain();
    env(g2, ac, [[0, 0.06], [0.1, 0.03], [0.18, 0.0]]);
    osc2.connect(g2).connect(sfxGain);
    osc2.start(); osc2.stop(ac.currentTime + 0.2);
  },

  // ── EXPLOSIONS ───────────────────────────────────────────────

  /** Small explosion */
  smallExplosion() {
    const ac = getCtx(); if (!sfxGain) return;
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 150;
    osc.frequency.exponentialRampToValueAtTime(30, ac.currentTime + 0.15);
    const g = ac.createGain();
    env(g, ac, [[0, 0.25], [0.04, 0.15], [0.12, 0.0]]);
    const filt = ac.createBiquadFilter();
    filt.type = "lowpass"; filt.frequency.value = 600;
    osc.connect(filt).connect(g).connect(sfxGain);
    osc.start(); osc.stop(ac.currentTime + 0.2);
    // noise burst
    const n = whiteNoise(ac, 0.12);
    const nf = ac.createBiquadFilter();
    nf.type = "lowpass"; nf.frequency.value = 1500;
    const ng = ac.createGain();
    env(ng, ac, [[0, 0.2], [0.05, 0.12], [0.1, 0.0]]);
    n.connect(nf).connect(ng).connect(sfxGain);
    n.start();
  },

  /** Medium explosion */
  mediumExplosion() {
    const ac = getCtx(); if (!sfxGain) return;
    // bass impact
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 80;
    osc.frequency.exponentialRampToValueAtTime(15, ac.currentTime + 0.3);
    const g = ac.createGain();
    env(g, ac, [[0, 0.35], [0.05, 0.2], [0.2, 0.05], [0.3, 0.0]]);
    osc.connect(g).connect(sfxGain);
    osc.start(); osc.stop(ac.currentTime + 0.35);
    // debris noise
    const n = whiteNoise(ac, 0.3);
    const f = ac.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = 1000; f.Q.value = 0.5;
    const ng = ac.createGain();
    env(ng, ac, [[0, 0.25], [0.08, 0.15], [0.2, 0.05], [0.28, 0.0]]);
    n.connect(f).connect(ng).connect(sfxGain);
    n.start();
  },

  /** Large explosion / energy detonation */
  largeExplosion() {
    const ac = getCtx(); if (!sfxGain) return;
    // deep sub impact
    const sub = ac.createOscillator();
    sub.type = "sine";
    sub.frequency.value = 50;
    sub.frequency.exponentialRampToValueAtTime(10, ac.currentTime + 0.5);
    const sg = ac.createGain();
    env(sg, ac, [[0, 0.4], [0.08, 0.25], [0.3, 0.05], [0.5, 0.0]]);
    sub.connect(sg).connect(sfxGain);
    sub.start(); sub.stop(ac.currentTime + 0.55);
    // distortion crackle
    const n = whiteNoise(ac, 0.45);
    const f = ac.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 2500;
    f.frequency.linearRampToValueAtTime(400, ac.currentTime + 0.4);
    const ng = ac.createGain();
    env(ng, ac, [[0, 0.3], [0.1, 0.2], [0.3, 0.08], [0.42, 0.0]]);
    n.connect(f).connect(ng).connect(sfxGain);
    n.start();
    // digital distortion whine
    const wh = ac.createOscillator();
    wh.type = "square";
    wh.frequency.value = 800;
    wh.frequency.exponentialRampToValueAtTime(100, ac.currentTime + 0.3);
    const wg = ac.createGain();
    env(wg, ac, [[0, 0.08], [0.1, 0.04], [0.25, 0.0]]);
    wh.connect(wg).connect(sfxGain);
    wh.start(); wh.stop(ac.currentTime + 0.3);
  },

  // ── UI SOUNDS ────────────────────────────────────────────────

  /** Button click — soft synthetic */
  buttonClick() {
    const ac = getCtx(); if (!sfxGain) return;
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 1000;
    osc.frequency.exponentialRampToValueAtTime(600, ac.currentTime + 0.04);
    const g = ac.createGain();
    env(g, ac, [[0, 0.12], [0.02, 0.06], [0.04, 0.0]]);
    osc.connect(g).connect(sfxGain);
    osc.start(); osc.stop(ac.currentTime + 0.05);
  },

  /** Hover beep — light high-tech */
  hoverBeep() {
    const ac = getCtx(); if (!sfxGain) return;
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 2400;
    const g = ac.createGain();
    env(g, ac, [[0, 0.05], [0.02, 0.03], [0.04, 0.0]]);
    osc.connect(g).connect(sfxGain);
    osc.start(); osc.stop(ac.currentTime + 0.05);
  },

  /** Error tone — descending chirp */
  errorTone() {
    const ac = getCtx(); if (!sfxGain) return;
    const osc = ac.createOscillator();
    osc.type = "square";
    osc.frequency.value = 800;
    osc.frequency.exponentialRampToValueAtTime(200, ac.currentTime + 0.15);
    const g = ac.createGain();
    env(g, ac, [[0, 0.1], [0.05, 0.06], [0.12, 0.0]]);
    osc.connect(g).connect(sfxGain);
    osc.start(); osc.stop(ac.currentTime + 0.15);
  },

  /** Upgrade confirmation — bright ascending ping */
  upgradeConfirm() {
    const ac = getCtx(); if (!sfxGain) return;
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 600;
    osc.frequency.exponentialRampToValueAtTime(1400, ac.currentTime + 0.12);
    const g = ac.createGain();
    env(g, ac, [[0, 0.15], [0.06, 0.1], [0.15, 0.02], [0.25, 0.0]]);
    osc.connect(g).connect(sfxGain);
    osc.start(); osc.stop(ac.currentTime + 0.3);
    // sparkle layer
    const osc2 = ac.createOscillator();
    osc2.type = "triangle";
    osc2.frequency.value = 1200;
    osc2.frequency.exponentialRampToValueAtTime(2400, ac.currentTime + 0.1);
    const g2 = ac.createGain();
    env(g2, ac, [[0, 0.06], [0.05, 0.04], [0.12, 0.0]]);
    osc2.connect(g2).connect(sfxGain);
    osc2.start(); osc2.stop(ac.currentTime + 0.15);
  },

  /** Sell / demolish */
  sellTone() {
    const ac = getCtx(); if (!sfxGain) return;
    const osc = ac.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 800;
    osc.frequency.exponentialRampToValueAtTime(300, ac.currentTime + 0.12);
    const g = ac.createGain();
    env(g, ac, [[0, 0.1], [0.06, 0.05], [0.1, 0.0]]);
    osc.connect(g).connect(sfxGain);
    osc.start(); osc.stop(ac.currentTime + 0.12);
  },

  /** Wave start */
  waveStart() {
    const ac = getCtx(); if (!sfxGain) return;
    // ascending arpeggio
    const notes = [400, 500, 600, 800];
    notes.forEach((f, i) => {
      const osc = ac.createOscillator();
      osc.type = "square";
      osc.frequency.value = f;
      const g = ac.createGain();
      const t = ac.currentTime + i * 0.08;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.08, t + 0.01);
      g.gain.linearRampToValueAtTime(0, t + 0.1);
      osc.connect(g).connect(sfxGain);
      osc.start(t);
      osc.stop(t + 0.12);
    });
  },

  /** Wave complete */
  waveComplete() {
    const ac = getCtx(); if (!sfxGain) return;
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((f, i) => {
      const osc = ac.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f;
      const g = ac.createGain();
      const t = ac.currentTime + i * 0.1;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.02);
      g.gain.linearRampToValueAtTime(0, t + 0.2);
      osc.connect(g).connect(sfxGain);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  },

  // ── ENEMY SOUNDS ─────────────────────────────────────────────

  /** Robotic footstep — metallic clank */
  footstep() {
    const ac = getCtx(); if (!sfxGain) return;
    const osc = ac.createOscillator();
    osc.type = "square";
    osc.frequency.value = 200 + Math.random() * 80;
    osc.frequency.exponentialRampToValueAtTime(80, ac.currentTime + 0.05);
    const g = ac.createGain();
    env(g, ac, [[0, 0.06], [0.015, 0.03], [0.04, 0.0]]);
    osc.connect(g).connect(sfxGain);
    osc.start(); osc.stop(ac.currentTime + 0.05);
  },

  /** Enemy death — electronic burst */
  enemyDeath() {
    const ac = getCtx(); if (!sfxGain) return;
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 600;
    osc.frequency.exponentialRampToValueAtTime(60, ac.currentTime + 0.2);
    const g = ac.createGain();
    env(g, ac, [[0, 0.15], [0.06, 0.08], [0.15, 0.0]]);
    osc.connect(g).connect(sfxGain);
    osc.start(); osc.stop(ac.currentTime + 0.22);
    // noise
    const n = whiteNoise(ac, 0.1);
    const ng = ac.createGain();
    env(ng, ac, [[0, 0.1], [0.04, 0.05], [0.08, 0.0]]);
    n.connect(ng).connect(sfxGain);
    n.start();
  },

  /** Boss roar — synthesized mechanical */
  bossRoar() {
    const ac = getCtx(); if (!sfxGain) return;
    // layered saws detuned
    for (let i = 0; i < 3; i++) {
      const osc = ac.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 80 + i * 15;
      osc.detune.value = (i - 1) * 30;
      const filt = ac.createBiquadFilter();
      filt.type = "lowpass"; filt.frequency.value = 500;
      const g = ac.createGain();
      env(g, ac, [[0, 0.1], [0.15, 0.08], [0.5, 0.04], [0.8, 0.0]]);
      osc.connect(filt).connect(g).connect(sfxGain);
      osc.start(); osc.stop(ac.currentTime + 0.85);
    }
    // rumble
    const sub = ac.createOscillator();
    sub.type = "sine";
    sub.frequency.value = 35;
    const sg = ac.createGain();
    env(sg, ac, [[0, 0.2], [0.2, 0.12], [0.6, 0.04], [0.8, 0.0]]);
    sub.connect(sg).connect(sfxGain);
    sub.start(); sub.stop(ac.currentTime + 0.85);
  },

  /** Shield hit — electric crackle */
  shieldHit() {
    const ac = getCtx(); if (!sfxGain) return;
    const osc = ac.createOscillator();
    osc.type = "square";
    osc.frequency.value = 1500;
    osc.frequency.exponentialRampToValueAtTime(500, ac.currentTime + 0.08);
    const g = ac.createGain();
    env(g, ac, [[0, 0.1], [0.03, 0.05], [0.07, 0.0]]);
    osc.connect(g).connect(sfxGain);
    osc.start(); osc.stop(ac.currentTime + 0.08);
  },

  // ── ENVIRONMENTAL AMBIENCE (one-shot / looping) ─────────────

  /** Neon buzz — short buzzing loop */
  neonBuzz() {
    const ac = getCtx(); if (!sfxGain) return;
    const osc = ac.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 120;
    const filt = ac.createBiquadFilter();
    filt.type = "bandpass"; filt.frequency.value = 120; filt.Q.value = 20;
    const g = ac.createGain();
    g.gain.value = 0.02;
    osc.connect(filt).connect(g).connect(sfxGain);
    osc.start();
    return { stop: () => { try { osc.stop(); } catch {} } };
  },

  /** Hologram flicker */
  holoFlicker() {
    const ac = getCtx(); if (!sfxGain) return;
    const n = whiteNoise(ac, 0.06);
    const f = ac.createBiquadFilter();
    f.type = "highpass"; f.frequency.value = 5000;
    const g = ac.createGain();
    env(g, ac, [[0, 0.06], [0.02, 0.03], [0.05, 0.0]]);
    n.connect(f).connect(g).connect(sfxGain);
    n.start();
  },
};

// ================================================================
//  AMBIENCE SYSTEM — looping environmental layer
// ================================================================

export function startAmbience() {
  const ac = getCtx();
  if (!ambienceGain || ambienceNodes) return;
  const dest = ambienceGain; // capture non-null
  const nodes: (OscillatorNode | AudioBufferSourceNode)[] = [];

  // Distant traffic hum
  const traffic = whiteNoise(ac, 3);
  traffic.loop = true;
  const tf = ac.createBiquadFilter();
  tf.type = "lowpass"; tf.frequency.value = 300;
  const tg = ac.createGain(); tg.gain.value = 0.3;
  traffic.connect(tf).connect(tg).connect(dest);
  traffic.start();
  nodes.push(traffic);

  // Industrial machinery hum
  const hum = ac.createOscillator();
  hum.type = "sawtooth";
  hum.frequency.value = 60;
  const hf = ac.createBiquadFilter();
  hf.type = "bandpass"; hf.frequency.value = 60; hf.Q.value = 15;
  const hg = ac.createGain(); hg.gain.value = 0.15;
  hum.connect(hf).connect(hg).connect(dest);
  hum.start();
  nodes.push(hum);

  // Wind across skyscrapers (filtered noise, slowly modulating)
  const wind = whiteNoise(ac, 4);
  wind.loop = true;
  const wf = ac.createBiquadFilter();
  wf.type = "bandpass"; wf.frequency.value = 600; wf.Q.value = 0.3;
  // LFO on wind filter
  const lfo = ac.createOscillator();
  lfo.type = "sine"; lfo.frequency.value = 0.1;
  const lfoG = ac.createGain(); lfoG.gain.value = 300;
  lfo.connect(lfoG).connect(wf.frequency);
  lfo.start();
  const wg = ac.createGain(); wg.gain.value = 0.08;
  wind.connect(wf).connect(wg).connect(dest);
  wind.start();
  nodes.push(wind);

  ambienceNodes = {
    stop: () => {
      for (const n of nodes) {
        try { (n as any).stop(); } catch {}
      }
    }
  };
}

export function stopAmbience() {
  if (ambienceNodes) { ambienceNodes.stop(); ambienceNodes = null; }
}

// ================================================================
//  HOOK — Easy integration with engine events
// ================================================================

export function playTowerSfx(kind: string) {
  switch (kind) {
    case "pulse": sfx.pulseShot(); break;
    case "laser": sfx.laserShot(); break;
    case "emp": sfx.empPulse(); break;
    case "plasma": sfx.plasmaShot(); break;
    case "railgun": sfx.railgunShot(); break;
    case "nano": sfx.nanoShot(); break;
    case "quantum": sfx.quantumPulse(); break;
  }
}
