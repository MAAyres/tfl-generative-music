import * as Tone from 'tone';

// A universal C minor ambient scale for cohesive harmony.
const AMBIENT_SCALE = ["C3", "Eb3", "F3", "G3", "Bb3", "C4", "Eb4", "F4", "G4", "Bb4", "C5", "D5", "Eb5"];

let isInitialized = false;

// Global Effects
let masterReverb;
let globalFilter;
let masterCompressor;
let ambientDrone;

// Instrument Map
const instruments = {};

export async function initAudio() {
  if (isInitialized) return;
  await Tone.start();
  console.log("Tone.js audio context started.");

  masterReverb = new Tone.Reverb({ decay: 6, wet: 0.4 });
  
  globalFilter = new Tone.Filter({ type: "lowpass", frequency: 2000, Q: 2 });

  masterCompressor = new Tone.Compressor({ threshold: -24, ratio: 3, attack: 0.1, release: 0.5 });

  Tone.Destination.chain(globalFilter, masterReverb, masterCompressor);
  Tone.Transport.bpm.value = 60; // Base BPM
  Tone.Transport.start();

  ambientDrone = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 2, decay: 2, sustain: 1, release: 5 },
    volume: -15
  }).connect(masterReverb);

  ambientDrone.triggerAttackRelease(["C3", "G3", "Eb4"], "1m");
  Tone.Transport.scheduleRepeat((time) => {
    ambientDrone.triggerAttackRelease(["C3", "G3", "Eb4"], "2m", time);
  }, "4m");

  setupLineInstruments();
  isInitialized = true;
}

function setupLineInstruments() {
  // Give each line a highly distinctive sound generator instead of just generic synths.
  instruments["victoria"] = new Tone.PolySynth(Tone.FMSynth, {
    volume: -10,
    harmonicity: 8,
    modulationIndex: 2,
    envelope: { attack: 0.1, decay: 2, release: 3 }
  }).connect(globalFilter);

  instruments["jubilee"] = new Tone.PolySynth(Tone.AMSynth, {
    volume: -8,
    envelope: { attack: 0.5, decay: 3, sustain: 0.5, release: 4 }
  }).connect(globalFilter);
  
  instruments["northern"] = new Tone.PolySynth(Tone.DuoSynth, {
    volume: -18,
    vibratoAmount: 0.5,
    vibratoRate: 5,
    harmonicity: 1.5,
    voice0: { envelope: { attack: 0.1, release: 1 } },
    voice1: { envelope: { attack: 0.1, release: 2 } }
  }).connect(globalFilter);

  instruments["piccadilly"] = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sawtooth" },
    volume: -14,
    envelope: { attack: 0.05, decay: 0.5, sustain: 0.1, release: 1 } // Shorter string-like pluck
  }).connect(globalFilter);

  instruments["central"] = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 1.5,
    modulationIndex: 5,
    volume: -12,
    envelope: { attack: 0.01, decay: 1, sustain: 0.2, release: 2 }
  }).connect(globalFilter);

  instruments["bakerloo"] = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "square4" },
    volume: -14,
    envelope: { attack: 0.2, release: 2 }
  }).connect(globalFilter);
}

// Control function for manual UI volume adjustments
export function setLineVolume(lineId, volumeDb) {
  if (instruments[lineId]) {
    // We optionally use a rampTo to prevent clicking, but simple assignment is okay.
    instruments[lineId].volume.rampTo(volumeDb, 0.1);
  }
}

export function triggerArrivalPoint(lineId, stationId) {
  if (!isInitialized || !instruments[lineId]) return;

  // Pick a randomly distributed note within the scale for maximum variation rather than 
  // repeating the same single station note forever.
  const randomFactor = Math.floor(Math.random() * AMBIENT_SCALE.length);
  const note = AMBIENT_SCALE[randomFactor];

  const synth = instruments[lineId];
  if (synth) {
    const velocity = 0.4 + Math.random() * 0.6;
    const delay = Tone.now() + Math.random() * 0.3;
    synth.triggerAttackRelease(note, "8n", delay, velocity); // Different synths will respect their own release times
  }
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
