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

// ── Global Effects ──
let masterReverb;
let globalFilter;
let masterCompressor;
let ambientDrone;

// ── Melodic Instruments ──
const instruments = {};

// ── Drum Machine ──
let kick, snare, hihat, rimshot;
let drumLoop = null;
let drumsEnabled = false;
let drumVolume = -6;
let drumPattern = { density: 0.5, swing: 0 }; // driven by live data

export function getScaleNames() { return Object.keys(SCALES); }

export function setScale(scaleName) {
  if (SCALES[scaleName]) {
    activeScale = SCALES[scaleName];
  }
}

export async function initAudio() {
  if (isInitialized) return;
  await Tone.start();
  console.log("Tone.js audio context started.");

  masterReverb = new Tone.Reverb({ decay: 6, wet: 0.4 });
  globalFilter = new Tone.Filter({ type: "lowpass", frequency: 2000, Q: 2 });
  masterCompressor = new Tone.Compressor({ threshold: -24, ratio: 3, attack: 0.1, release: 0.5 });

  Tone.Destination.chain(globalFilter, masterReverb, masterCompressor);
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

// ── Melodic Instruments Setup ──
function setupLineInstruments() {
  instruments["victoria"] = new Tone.PolySynth(Tone.FMSynth, {
    volume: -10, harmonicity: 8, modulationIndex: 2,
    envelope: { attack: 0.1, decay: 2, release: 3 }
  }).connect(globalFilter);

  instruments["jubilee"] = new Tone.PolySynth(Tone.AMSynth, {
    volume: -8,
    envelope: { attack: 0.5, decay: 3, sustain: 0.5, release: 4 }
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
    volume: -12,
    envelope: { attack: 0.4, decay: 2, sustain: 0.6, release: 3 }
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

// ── Drum Kit Setup ──
function setupDrumKit() {
  // Deep sub kick
  kick = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 6,
    oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 0.4 },
    volume: drumVolume,
  }).toDestination();

  // Tight snare from filtered noise
  snare = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
    volume: drumVolume - 4,
  }).toDestination();

  // Metallic hi-hat
  hihat = new Tone.MetalSynth({
    frequency: 400,
    envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 4000,
    octaves: 1.5,
    volume: drumVolume - 10,
  }).toDestination();

  // Rimshot (short noise burst, higher pitched)
  rimshot = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
    volume: drumVolume - 8,
  }).toDestination();
}

// ── Drum Pattern Engine ──
// Data mappings:
//   - Total active predictions → pattern density (more trains = busier beat)
//   - Wind speed → swing amount  
//   - Humidity → probability of ghost notes (rimshots)
function buildDrumSequence() {
  if (drumLoop) {
    drumLoop.dispose();
    drumLoop = null;
  }

  const density = drumPattern.density; // 0.0 to 1.0

  // Generate a 16-step pattern
  // Kick: always on 1 and 9, probabilistic on others based on density
  // Snare: always on 5 and 13, probabilistic on others
  // Hi-hat: frequency increases with density
  // Rimshot: ghost notes based on density
  const steps = 16;
  const pattern = [];

  for (let i = 0; i < steps; i++) {
    const beat = {
      kick: false,
      snare: false,
      hihat: false,
      rimshot: false,
    };

    // Kick: beats 0, 4, 8, 12 are strong positions
    if (i === 0 || i === 8) beat.kick = true;
    else if ((i === 4 || i === 12) && density > 0.4) beat.kick = true;
    else if (density > 0.7 && Math.random() < density * 0.3) beat.kick = true;

    // Snare: beats 4 and 12 (backbeat)
    if (i === 4 || i === 12) beat.snare = true;
    else if (density > 0.6 && (i === 10 || i === 14) && Math.random() < 0.5) beat.snare = true;

    // Hi-hat: more frequent with higher density
    if (density < 0.3) {
      // Sparse: only on quarter notes
      if (i % 4 === 0) beat.hihat = true;
    } else if (density < 0.6) {
      // Medium: eighth notes
      if (i % 2 === 0) beat.hihat = true;
    } else {
      // Dense: every 16th step, with some probability
      beat.hihat = Math.random() < 0.85;
    }

    // Rimshot ghost notes
    if (density > 0.5 && Math.random() < density * 0.15) {
      beat.rimshot = true;
    }

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

// ── Drum Control Exports ──
export function toggleDrums(enabled) {
  drumsEnabled = enabled;
  if (enabled && isInitialized) {
    buildDrumSequence();
  } else if (drumLoop) {
    drumLoop.dispose();
    drumLoop = null;
  }
}

export function setDrumVolume(volumeDb) {
  drumVolume = volumeDb;
  if (kick) kick.volume.rampTo(volumeDb, 0.1);
  if (snare) snare.volume.rampTo(volumeDb - 4, 0.1);
  if (hihat) hihat.volume.rampTo(volumeDb - 10, 0.1);
  if (rimshot) rimshot.volume.rampTo(volumeDb - 8, 0.1);
}

// Called from page.js with live data stats to reshape the drum pattern
export function updateDrumPattern(totalPredictions, windSpeed, humidity) {
  if (!isInitialized) return;

  // Total predictions (typically 500-4000 during service hours) → density
  // Normalize: 0 predictions = 0.1 density, 3000+ = 1.0
  const density = Math.max(0.1, Math.min(1.0, totalPredictions / 3000));

  // Wind speed → swing (0-50 km/h maps to 0-0.5 swing)
  const swing = Math.max(0, Math.min(0.5, (windSpeed || 0) / 100));
  Tone.Transport.swing = swing;

  drumPattern.density = density;

  // Rebuild the pattern if drums are active
  if (drumsEnabled) {
    buildDrumSequence();
  }
}

// ── Melodic Exports ──
export function setLineVolume(lineId, volumeDb) {
  if (instruments[lineId]) {
    instruments[lineId].volume.rampTo(volumeDb, 0.1);
  }
}

export function triggerArrivalPoint(lineId, stationId) {
  if (!isInitialized) return;
  const synth = instruments[lineId] || instruments["victoria"];
  if (!synth) return;

  const note = activeScale[Math.floor(Math.random() * activeScale.length)];
  const velocity = 0.3 + Math.random() * 0.7;
  synth.triggerAttackRelease(note, "8n", Tone.now(), velocity);
}

export function applyWeatherModulation(weatherData) {
  if (!isInitialized) return;
  const { temperature, windSpeed, humidity } = weatherData;

  const targetBpm = Math.max(30, Math.min(120, 40 + temperature * 1.5));
  Tone.Transport.bpm.rampTo(targetBpm, 5);

  if (masterReverb) {
    const reverbWet = Math.max(0.1, Math.min(0.9, humidity / 100));
    masterReverb.wet.rampTo(reverbWet, 2);
  }

  if (globalFilter) {
    const targetFreq = Math.max(500, Math.min(8000, 500 + windSpeed * 150));
    globalFilter.frequency.rampTo(targetFreq, 3);
  }
}
