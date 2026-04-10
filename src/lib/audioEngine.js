import * as Tone from 'tone';

// Available scales the user can select
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

// Global Effects
let masterReverb;
let globalFilter;
let masterCompressor;
let ambientDrone;

// Instrument Map
const instruments = {};

export function getScaleNames() {
  return Object.keys(SCALES);
}

export function setScale(scaleName) {
  if (SCALES[scaleName]) {
    activeScale = SCALES[scaleName];
    console.log("Scale changed to:", scaleName);
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
  Tone.Transport.start();

  // Very quiet ambient drone for bed texture
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
  isInitialized = true;
}

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
    oscillator: { type: "triangle" },
    volume: -12,
    envelope: { attack: 0.05, decay: 1.5, sustain: 0.3, release: 2 }
  }).connect(globalFilter);

  instruments["piccadilly"] = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sawtooth" },
    volume: -14,
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

export function setLineVolume(lineId, volumeDb) {
  if (instruments[lineId]) {
    instruments[lineId].volume.rampTo(volumeDb, 0.1);
  }
}

// This is called with a staggered delay from page.js so notes spread out over time
export function triggerArrivalPoint(lineId, stationId) {
  if (!isInitialized) return;

  // If we don't have an instrument for this line, fall back to victoria
  const synth = instruments[lineId] || instruments["victoria"];
  if (!synth) return;

  // Pick a random note from the ACTIVE scale
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
