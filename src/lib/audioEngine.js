import * as Tone from 'tone';

// ── Musical Scales ──
const SCALES = {
  "C Minor Pentatonic": ["C3","Eb3","F3","G3","Bb3","C4","Eb4","F4","G4","Bb4","C5","Eb5"],
  "C Major":            ["C3","D3","E3","F3","G3","A3","B3","C4","D4","E4","F4","G4","A4","B4","C5"],
  "D Dorian":           ["D3","E3","F3","G3","A3","B3","C4","D4","E4","F4","G4","A4","B4","C5","D5"],
  "A Minor":            ["A2","B2","C3","D3","E3","F3","G3","A3","B3","C4","D4","E4","F4","G4","A4"],
  "E Minor Pentatonic": ["E3","G3","A3","B3","D4","E4","G4","A4","B4","D5","E5"],
  "F Lydian":           ["F3","G3","A3","B3","C4","D4","E4","F4","G4","A4","B4","C5","D5","E5","F5"],
  "Bb Major":           ["Bb2","C3","D3","Eb3","F3","G3","A3","Bb3","C4","D4","Eb4","F4","G4","A4","Bb4"],
  "Whole Tone":         ["C3","D3","E3","F#3","G#3","A#3","C4","D4","E4","F#4","G#4","A#4","C5"],
};

let activeScale = SCALES["C Minor Pentatonic"];
let isInitialized = false;

// ── Global Effects Chain ──
let masterReverb, globalFilter, masterCompressor;
let masterDelay;     // Delay line — modulated by FTSE volatility
let masterCrusher;   // Bitcrusher — modulated by air quality
let ambientDrone;

// ── Melodic Instruments ──
const instruments = {};
const mutedLines = new Set();

// ── Drum Machine ──
let kick, snare, hihat, rimshot;
let drumLoop = null;
let drumsEnabled = false;
let drumVolume = -6;
let drumPattern = { density: 0.5, swing: 0 };

export function getScaleNames() { return Object.keys(SCALES); }
export function setScale(scaleName) { if (SCALES[scaleName]) activeScale = SCALES[scaleName]; }

export async function initAudio() {
  if (isInitialized) return;
  await Tone.start();

  // Effects chain: instruments → filter → crusher → delay → reverb → compressor → output
  masterReverb = new Tone.Reverb({ decay: 6, wet: 0.4 });
  globalFilter = new Tone.Filter({ type: "lowpass", frequency: 2000, Q: 2 });
  masterCompressor = new Tone.Compressor({ threshold: -24, ratio: 3, attack: 0.1, release: 0.5 });

  masterDelay = new Tone.FeedbackDelay({
    delayTime: "8n",
    feedback: 0.15,
    wet: 0.1,
  });

  masterCrusher = new Tone.BitCrusher({
    bits: 16, // Clean to start (16-bit = no crush)
  });
  masterCrusher.wet.value = 0;

  Tone.Destination.chain(globalFilter, masterCrusher, masterDelay, masterReverb, masterCompressor);
  Tone.Transport.bpm.value = 60;
  Tone.Transport.swing = 0;
  Tone.Transport.start();

  // Quiet ambient bed
  ambientDrone = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 3, decay: 2, sustain: 0.8, release: 5 },
    volume: -25
  }).connect(masterReverb);

  ambientDrone.triggerAttackRelease(["C3", "G3", "Eb4"], "2m");
  Tone.Transport.scheduleRepeat((time) => {
    ambientDrone.triggerAttackRelease(["C3", "G3", "Eb4"], "2m", time, 0.03);
  }, "8m");

  setupLineInstruments();
  setupDrumKit();
  isInitialized = true;
}

// ── Melodic Instruments ──
function setupLineInstruments() {
  instruments["victoria"] = new Tone.PolySynth(Tone.FMSynth, {
    volume: -10, harmonicity: 8, modulationIndex: 2,
    envelope: { attack: 0.1, decay: 2, release: 3 }
  }).connect(globalFilter);

  instruments["jubilee"] = new Tone.PolySynth(Tone.AMSynth, {
    volume: -8, envelope: { attack: 0.5, decay: 3, sustain: 0.5, release: 4 }
  }).connect(globalFilter);

  instruments["northern"] = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" }, volume: -12,
    envelope: { attack: 0.05, decay: 1.5, sustain: 0.3, release: 2 }
  }).connect(globalFilter);

  instruments["piccadilly"] = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sawtooth" }, volume: -14,
    envelope: { attack: 0.05, decay: 0.5, sustain: 0.1, release: 1 }
  }).connect(globalFilter);

  instruments["central"] = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 1.5, modulationIndex: 5, volume: -12,
    envelope: { attack: 0.01, decay: 1, sustain: 0.2, release: 2 }
  }).connect(globalFilter);

  instruments["bakerloo"] = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "square4" }, volume: -14,
    envelope: { attack: 0.2, release: 2 }
  }).connect(globalFilter);

  instruments["district"] = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" }, volume: -12,
    envelope: { attack: 0.3, decay: 1.5, sustain: 0.4, release: 3 }
  }).connect(globalFilter);

  instruments["circle"] = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 3, modulationIndex: 1, volume: -14,
    envelope: { attack: 0.15, decay: 1, sustain: 0.3, release: 2 }
  }).connect(globalFilter);

  instruments["metropolitan"] = new Tone.PolySynth(Tone.AMSynth, {
    volume: -12, envelope: { attack: 0.4, decay: 2, sustain: 0.6, release: 3 }
  }).connect(globalFilter);

  instruments["hammersmith-city"] = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" }, volume: -15,
    envelope: { attack: 0.5, decay: 2, sustain: 0.5, release: 4 }
  }).connect(globalFilter);

  instruments["waterloo-city"] = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle4" }, volume: -16,
    envelope: { attack: 0.1, decay: 0.5, sustain: 0.2, release: 1 }
  }).connect(globalFilter);

  instruments["elizabeth"] = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 2, modulationIndex: 3, volume: -11,
    envelope: { attack: 0.08, decay: 1.5, sustain: 0.3, release: 2.5 }
  }).connect(globalFilter);
}

// ── Drum Kit ──
function setupDrumKit() {
  kick = new Tone.MembraneSynth({
    pitchDecay: 0.05, octaves: 6, oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 0.4 },
    volume: drumVolume,
  }).toDestination();

  snare = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
    volume: drumVolume - 4,
  }).toDestination();

  hihat = new Tone.MetalSynth({
    frequency: 400,
    envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
    harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
    volume: drumVolume - 10,
  }).toDestination();

  rimshot = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
    volume: drumVolume - 8,
  }).toDestination();
}

function buildDrumSequence() {
  if (drumLoop) { drumLoop.dispose(); drumLoop = null; }
  const density = drumPattern.density;
  const steps = 16;
  const pattern = [];

  for (let i = 0; i < steps; i++) {
    const beat = { kick: false, snare: false, hihat: false, rimshot: false };
    if (i === 0 || i === 8) beat.kick = true;
    else if ((i === 4 || i === 12) && density > 0.4) beat.kick = true;
    else if (density > 0.7 && Math.random() < density * 0.3) beat.kick = true;
    if (i === 4 || i === 12) beat.snare = true;
    else if (density > 0.6 && (i === 10 || i === 14) && Math.random() < 0.5) beat.snare = true;
    if (density < 0.3) { if (i % 4 === 0) beat.hihat = true; }
    else if (density < 0.6) { if (i % 2 === 0) beat.hihat = true; }
    else { beat.hihat = Math.random() < 0.85; }
    if (density > 0.5 && Math.random() < density * 0.15) beat.rimshot = true;
    pattern.push(beat);
  }

  let step = 0;
  drumLoop = new Tone.Loop((time) => {
    if (!drumsEnabled) return;
    const beat = pattern[step % steps];
    if (beat.kick) kick.triggerAttackRelease("C1", "16n", time);
    if (beat.snare) snare.triggerAttackRelease("16n", time);
    if (beat.hihat) hihat.triggerAttackRelease("32n", time);
    if (beat.rimshot) rimshot.triggerAttackRelease("32n", time + 0.02);
    step++;
  }, "16n").start(0);
}

// ── Drum Controls ──
export function toggleDrums(enabled) {
  drumsEnabled = enabled;
  if (enabled && isInitialized) buildDrumSequence();
  else if (drumLoop) { drumLoop.dispose(); drumLoop = null; }
}

export function setDrumVolume(volumeDb) {
  drumVolume = volumeDb;
  if (kick) kick.volume.rampTo(volumeDb, 0.1);
  if (snare) snare.volume.rampTo(volumeDb - 4, 0.1);
  if (hihat) hihat.volume.rampTo(volumeDb - 10, 0.1);
  if (rimshot) rimshot.volume.rampTo(volumeDb - 8, 0.1);
}

export function updateDrumPattern(totalPredictions, windSpeed, humidity) {
  if (!isInitialized) return;
  const density = Math.max(0.1, Math.min(1.0, totalPredictions / 3000));
  const swing = Math.max(0, Math.min(0.5, (windSpeed || 0) / 100));
  Tone.Transport.swing = swing;
  drumPattern.density = density;
  if (drumsEnabled) buildDrumSequence();
}

// ── Mute / Unmute ──
export function toggleMuteLine(lineId) {
  if (mutedLines.has(lineId)) {
    mutedLines.delete(lineId);
    if (instruments[lineId]) instruments[lineId].volume.rampTo(-10, 0.1);
    return false; // not muted
  } else {
    mutedLines.add(lineId);
    if (instruments[lineId]) instruments[lineId].volume.rampTo(-Infinity, 0.1);
    return true; // muted
  }
}

// ── Timbral Modulation from Extended Data ──
// Traffic disruptions → Attack time (more disruptions = harsher, shorter attacks)
//                     → Release time (severe disruptions = longer, lingering decay)
export function applyTrafficModulation(trafficData) {
  if (!isInitialized) return;
  const { totalDisruptions, severity } = trafficData;

  // Map disruptions (0-50) to attack time (0.5 down to 0.01)
  const attackMod = Math.max(0.01, 0.5 - (totalDisruptions / 100));
  // Severe disruptions increase release time
  const severityScore = (severity.Moderate || 0) + (severity.Severe || 0) * 2 + (severity.Serious || 0) * 3;
  const releaseMod = Math.min(6, 1 + severityScore * 0.3);

  Object.values(instruments).forEach(synth => {
    try {
      synth.set({ envelope: { attack: attackMod, release: releaseMod } });
    } catch (e) { /* some synths may not accept all params */ }
  });
}

// Air quality → Bitcrusher intensity (dirty air = dirtier sound)
//             → Filter resonance (high pollution = more resonant, buzzy)
export function applyAirQualityModulation(airData) {
  if (!isInitialized) return;
  const { pm25, aqi } = airData;

  // PM2.5 (0-100+) → Bitcrusher bits (16 = clean, down to 6 = very crunchy)
  if (masterCrusher && pm25 != null) {
    const bits = Math.max(6, Math.round(16 - (pm25 / 10)));
    masterCrusher.bits.value = bits;
    // Set wet amount so it's subtle at low pollution, stronger at high
    const wetAmount = Math.min(0.6, pm25 / 80);
    masterCrusher.wet.rampTo(wetAmount, 2);
  }

  // AQI (0-100+) → Filter Q resonance (0-10)
  if (globalFilter && aqi != null) {
    const resonance = Math.min(10, aqi / 10);
    globalFilter.Q.rampTo(resonance, 2);
  }
}

// FTSE100 → Delay feedback & wet (volatility = more echoes/spaciness)
//         → FM modulation index on FM synths (market movement = harmonic complexity)
export function applyStockModulation(stockData) {
  if (!isInitialized) return;
  const { changePercent, volatility, available } = stockData;
  if (!available) return;

  const absChange = Math.abs(parseFloat(changePercent) || 0);
  const vol = parseFloat(volatility) || 0;

  // Volatility (0-5+) → Delay feedback (0.05 to 0.5) and wet (0.05 to 0.35)
  if (masterDelay) {
    const feedback = Math.min(0.5, 0.05 + vol * 20);
    const wet = Math.min(0.35, 0.05 + vol * 15);
    masterDelay.feedback.rampTo(feedback, 3);
    masterDelay.wet.rampTo(wet, 3);
  }

  // Market change % (0-3+) → FM modulation index on FM synths
  const modIdx = Math.min(12, 2 + absChange * 3);
  ['victoria', 'central', 'circle', 'elizabeth'].forEach(lineId => {
    if (instruments[lineId]) {
      try { instruments[lineId].set({ modulationIndex: modIdx }); } catch (e) {}
    }
  });
}

// ── Core Melodic Trigger ──
export function triggerArrivalPoint(lineId, stationId) {
  if (!isInitialized) return;
  if (mutedLines.has(lineId)) return;

  const synth = instruments[lineId] || instruments["victoria"];
  if (!synth) return;

  const note = activeScale[Math.floor(Math.random() * activeScale.length)];
  const velocity = 0.3 + Math.random() * 0.7;
  synth.triggerAttackRelease(note, "8n", Tone.now(), velocity);
}

// ── Weather Modulation (existing) ──
export function applyWeatherModulation(weatherData) {
  if (!isInitialized) return;
  const { temperature, windSpeed, humidity } = weatherData;

  Tone.Transport.bpm.rampTo(Math.max(30, Math.min(120, 40 + temperature * 1.5)), 5);
  if (masterReverb) masterReverb.wet.rampTo(Math.max(0.1, Math.min(0.9, humidity / 100)), 2);
  if (globalFilter) globalFilter.frequency.rampTo(Math.max(500, Math.min(8000, 500 + windSpeed * 150)), 3);
}

export function setLineVolume(lineId, volumeDb) {
  if (instruments[lineId]) instruments[lineId].volume.rampTo(volumeDb, 0.1);
}
