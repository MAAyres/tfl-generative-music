import * as Tone from 'tone';

// A mapping of tube lines to musical scales (C minor pentatonic, F minor, etc.)
// We use a universal C minor ambient scale for cohesive harmony.
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

  // Set up Master Effects Chain
  masterReverb = new Tone.Reverb({
    decay: 6,
    wet: 0.4,
  });
  
  // A lowpass filter that can be modulated by wind speed
  globalFilter = new Tone.Filter({
    type: "lowpass",
    frequency: 2000,
    Q: 2,
  });

  masterCompressor = new Tone.Compressor({
    threshold: -24,
    ratio: 3,
    attack: 0.1,
    release: 0.5
  });

  // Chain effects to destination
  Tone.Destination.chain(globalFilter, masterReverb, masterCompressor);
  Tone.Transport.bpm.value = 60; // Base BPM
  Tone.Transport.start();

  // Create ambient drone pad
  ambientDrone = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: {
      attack: 2,
      decay: 2,
      sustain: 1,
      release: 5,
    },
    volume: -15
  }).connect(masterReverb);

  // Trigger base drone chords
  ambientDrone.triggerAttackRelease(["C3", "G3", "Eb4"], "1m");

  Tone.Transport.scheduleRepeat((time) => {
    ambientDrone.triggerAttackRelease(["C3", "G3", "Eb4"], "2m", time);
  }, "4m");

  setupLineInstruments();
  isInitialized = true;
}

function setupLineInstruments() {
  // Configured with distinct synth definitions per line for sonic variety
  const lineConfigs = {
    "victoria": { osc: "triangle", attack: 0.05, release: 2, volume: -10 },
    "jubilee": { osc: "sine", attack: 0.1, release: 3, volume: -8 },
    "northern": { osc: "square8", attack: 0.01, release: 1, volume: -15 },
    "piccadilly": { osc: "fmsine", attack: 0.2, release: 4, volume: -12 },
    "central": { osc: "sawtooth", attack: 0.05, release: 1.5, volume: -14 },
    "bakerloo": { osc: "triangle8", attack: 0.1, release: 2, volume: -10 },
  };

  Object.keys(lineConfigs).forEach((line) => {
    const config = lineConfigs[line];
    instruments[line] = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: config.osc },
      envelope: {
        attack: config.attack,
        decay: 1,
        sustain: 0.5,
        release: config.release,
      },
      volume: config.volume,
    }).connect(globalFilter);
  });
}

// Function to trigger notes on specific line events
export function triggerArrivalPoint(lineId, stationId) {
  if (!isInitialized || !instruments[lineId]) return;

  // Use a simple hash of the stationId to pick a note from the scale consistently
  const hash = stationId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const note = AMBIENT_SCALE[hash % AMBIENT_SCALE.length];

  const synth = instruments[lineId];
  if (synth) {
    // Randomize velocity for dynamics
    const velocity = 0.5 + Math.random() * 0.5;
    // Add slight random delay so simultaneous arrivals feel organic, not robotic
    const delay = Tone.now() + Math.random() * 0.2;
    synth.triggerAttackRelease(note, "8n", delay, velocity);
  }
}

// Function to smoothly alter the audio based on live weather data
export function applyWeatherModulation(weatherData) {
  if (!isInitialized) return;

  const { temperature, windSpeed, humidity } = weatherData;

  // Temperature (approx 0-35 deg C) modulates Tempo
  // Let's say 15C = 60BPM. Cold = slower, Hot = faster
  const targetBpm = Math.max(30, Math.min(120, 40 + temperature * 1.5));
  Tone.Transport.bpm.rampTo(targetBpm, 5); // 5 sec ramp

  // Humidity (0-100%) controls Reverb Wetness
  // E.g., 50% humidity = 0.3 wet, 100% = 0.8 wet
  if (masterReverb) {
    const reverbWet = Math.max(0.1, Math.min(0.9, humidity / 100));
    masterReverb.wet.rampTo(reverbWet, 2);
  }

  // Wind speed (0 - 50mph) controls the global Filter Cutoff
  // E.g., 5mph = 1500Hz, 30mph = 4000Hz (allows more high frequencies)
  if (globalFilter) {
    const targetFreq = Math.max(500, Math.min(8000, 500 + windSpeed * 150));
    globalFilter.frequency.rampTo(targetFreq, 3);
  }
}
