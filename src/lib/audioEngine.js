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

// High-register twinkle notes (flights)
const TWINKLE_NOTES = ["C5","D5","Eb5","F5","G5","Bb5","C6","D6","Eb6","G6"];

let activeScale = SCALES["C Minor Pentatonic"];
let isInitialized = false;

// ── Global Effects (melodic bus) ──
let masterReverb, globalFilter, masterCompressor, masterDelay, masterCrusher;

// ── Dry drum bus ── drums get their own light reverb, no delay/crusher
let drumBus;

// ── Ambient layers ──
let ambientDrone;     // gentle pad
let riverDrone;       // deep sub bass tied to river level
let twinkleSynth;     // high crystalline synth for flight data

// ── Melodic Instruments ──
const instruments = {};
const mutedLines = new Set();

// ── Drum Machine ──
let kick, snare, hihat, rimshot;
let drumLoop = null;
let drumsEnabled = false;
let drumVolume = -6;
let drumPattern = { density: 0.5 };

export function getScaleNames() { return Object.keys(SCALES); }
export function setScale(scaleName) { if (SCALES[scaleName]) activeScale = SCALES[scaleName]; }

export async function initAudio() {
  if (isInitialized) return;
  await Tone.start();
  console.log("Audio context started");

  // ── Create effects nodes ──
  masterReverb = new Tone.Reverb({ decay: 6, wet: 0.4 });
  globalFilter = new Tone.Filter({ type: "lowpass", frequency: 2000, Q: 2 });
  masterCompressor = new Tone.Compressor({ threshold: -24, ratio: 3, attack: 0.1, release: 0.5 });
  masterDelay = new Tone.FeedbackDelay({ delayTime: "8n", feedback: 0.15, wet: 0.1 });
  masterCrusher = new Tone.BitCrusher({ bits: 16 });
  masterCrusher.wet.value = 0;

  // ── CORRECT melodic chain: filter → crusher → delay → reverb → compressor → speakers ──
  // Previously this was backwards (Tone.Destination.chain which routes FROM speakers)
  globalFilter.chain(masterCrusher, masterDelay, masterReverb, masterCompressor, Tone.Destination);

  // ── Dry drum bus: drums → light room reverb → speakers (NO delay/crusher) ──
  const drumReverb = new Tone.Reverb({ decay: 1.0, wet: 0.06 });
  drumBus = new Tone.Channel({ volume: 0 });
  drumBus.chain(drumReverb, Tone.Destination);

  // ── Ambient reverb send for drone/twinkle (connects to reverb which is already chained to output) ──
  // masterReverb is already in the chain above so anything .connect(masterReverb) will flow to destination

  Tone.Transport.bpm.value = 60;
  Tone.Transport.swing = 0;
  Tone.Transport.start();

  // ── Ambient pad — connects into reverb ──
  ambientDrone = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 3, decay: 2, sustain: 0.8, release: 5 },
    volume: -25
  }).connect(masterReverb);
  ambientDrone.triggerAttackRelease(["C3", "G3", "Eb4"], "2m");
  Tone.Transport.scheduleRepeat((time) => {
    ambientDrone.triggerAttackRelease(["C3", "G3", "Eb4"], "2m", time, 0.03);
  }, "8m");

  // ── River Drone: bass drone — sends to reverb ──
  riverDrone = new Tone.MonoSynth({
    oscillator: { type: "sine" },
    filter: { type: "lowpass", frequency: 150, Q: 1 },
    envelope: { attack: 4, decay: 2, sustain: 1, release: 6 },
    filterEnvelope: { attack: 4, decay: 1, sustain: 0.8, release: 6, baseFrequency: 80, octaves: 1 },
    volume: -8, // Boosted even more
  }).connect(masterReverb);
  // Start the drone at C2 (approx 65Hz) instead of C1 for better audibility
  riverDrone.triggerAttack("C2", Tone.now());
  console.log("River drone started at C2");

  // ── Twinkle Synth: high crystalline for flights ──
  twinkleSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 0.1, decay: 1.5, sustain: 0, release: 3.0 }, // Slower attack, longer tail
    volume: -6, // Boosted significantly
  });
  const twinkleDelay = new Tone.PingPongDelay({ delayTime: "8n", feedback: 0.5, wet: 0.6 });
  twinkleSynth.chain(twinkleDelay, masterReverb);
  console.log("Twinkle synth ready");

  setupLineInstruments();
  setupDrumKit();
  isInitialized = true;
  console.log("All audio initialized");
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

// ── Drum Kit — now routed to the DRY drumBus, NOT through delay/crusher ──
function setupDrumKit() {
  kick = new Tone.MembraneSynth({
    pitchDecay: 0.05, octaves: 6, oscillator: { type: "sine" },
    envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 0.4 },
    volume: drumVolume,
  }).connect(drumBus);

  snare = new Tone.NoiseSynth({
    noise: { type: "white" },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.1 },
    volume: drumVolume - 4,
  }).connect(drumBus);

  hihat = new Tone.MetalSynth({
    frequency: 400,
    envelope: { attack: 0.001, decay: 0.05, release: 0.01 },
    harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5,
    volume: drumVolume - 10,
  }).connect(drumBus);

  rimshot = new Tone.NoiseSynth({
    noise: { type: "pink" },
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
    volume: drumVolume - 8,
  }).connect(drumBus);
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
export function updateDrumPattern(totalPredictions, windSpeed) {
  if (!isInitialized) return;
  drumPattern.density = Math.max(0.1, Math.min(1.0, totalPredictions / 3000));
  Tone.Transport.swing = Math.max(0, Math.min(0.5, (windSpeed || 0) / 100));
  if (drumsEnabled) buildDrumSequence();
}

// ── Line Mute ──
export function toggleMuteLine(lineId) {
  if (mutedLines.has(lineId)) {
    mutedLines.delete(lineId);
    if (instruments[lineId]) instruments[lineId].volume.rampTo(-10, 0.1);
    return false;
  } else {
    mutedLines.add(lineId);
    if (instruments[lineId]) instruments[lineId].volume.rampTo(-Infinity, 0.1);
    return true;
  }
}

// ══════════════════════════════════════════════
//  DATA → AUDIO MODULATION
// ══════════════════════════════════════════════

// ── Weather → Tempo, Filter cutoff, Reverb ──
export function applyWeatherModulation(weatherData) {
  if (!isInitialized) return;
  const { temperature, windSpeed, humidity } = weatherData;
  Tone.Transport.bpm.rampTo(Math.max(30, Math.min(120, 40 + temperature * 1.5)), 5);
  if (masterReverb) masterReverb.wet.rampTo(Math.max(0.1, Math.min(0.9, humidity / 100)), 2);
  if (globalFilter) globalFilter.frequency.rampTo(Math.max(500, Math.min(8000, 500 + windSpeed * 150)), 3);
}

// ── Traffic → Attack / Release envelopes ──
export function applyTrafficModulation(trafficData) {
  if (!isInitialized) return;
  const { totalDisruptions, severity } = trafficData;
  const attackMod = Math.max(0.01, 0.5 - (totalDisruptions / 100));
  const severityScore = (severity.Moderate || 0) + (severity.Severe || 0) * 2 + (severity.Serious || 0) * 3;
  const releaseMod = Math.min(6, 1 + severityScore * 0.3);
  Object.values(instruments).forEach(synth => {
    try { synth.set({ envelope: { attack: attackMod, release: releaseMod } }); } catch (e) {}
  });
}

// ── Air Quality → Bitcrusher, Filter Q ──
export function applyAirQualityModulation(airData) {
  if (!isInitialized) return;
  const { pm25, aqi } = airData;
  if (masterCrusher && pm25 != null) {
    masterCrusher.bits.value = Math.max(6, Math.round(16 - (pm25 / 10)));
    masterCrusher.wet.rampTo(Math.min(0.6, pm25 / 80), 2);
  }
  if (globalFilter && aqi != null) {
    globalFilter.Q.rampTo(Math.min(10, aqi / 10), 2);
  }
}

// ── FTSE100 → Delay, FM modulation ──
export function applyStockModulation(stockData) {
  if (!isInitialized || !stockData.available) return;
  const absChange = Math.abs(parseFloat(stockData.changePercent) || 0);
  const vol = parseFloat(stockData.volatility) || 0;
  if (masterDelay) {
    masterDelay.feedback.rampTo(Math.min(0.5, 0.05 + vol * 20), 3);
    masterDelay.wet.rampTo(Math.min(0.35, 0.05 + vol * 15), 3);
  }
  const modIdx = Math.min(12, 2 + absChange * 3);
  ['victoria', 'central', 'circle', 'elizabeth'].forEach(id => {
    if (instruments[id]) try { instruments[id].set({ modulationIndex: modIdx }); } catch (e) {}
  });
}

// ── River Level → Bass Drone pitch and filter ──
// Higher water = deeper pitch, more sub, opens the filter slightly
export function applyRiverModulation(riverData) {
  if (!isInitialized || !riverDrone) return;
  const { level, typicalRange } = riverData;
  if (level == null) return;

  // Normalize level within typical range (usually ~0.5m to ~5m)
  const low = typicalRange?.low || 0.5;
  const high = typicalRange?.high || 5.0;
  const normalized = Math.max(0, Math.min(1, (level - low) / (high - low)));

  // Map to pitch: low water = C2 (65.4Hz), high water = F1 (43.6Hz) — deeper when high
  // This is an octave higher than before to ensure it's heard on most speakers
  const pitchFreq = 65.4 - (normalized * 22);
  riverDrone.frequency.rampTo(pitchFreq, 8);

  // Adjust drone filter — higher water = slightly more open sub
  const filterFreq = 120 + normalized * 180;
  riverDrone.filter.frequency.rampTo(filterFreq, 5);

  // Adjust volume: louder when higher
  const vol = -16 + normalized * 6;
  riverDrone.volume.rampTo(vol, 5);
}

// ── Flight Data → High twinkling notes ──
export function triggerFlightTwinkles(flightData) {
  if (!isInitialized || !twinkleSynth) return;
  const { flights, available } = flightData;
  if (!available || !flights || flights.length === 0) {
    console.log("Flights: no data to trigger");
    return;
  }

  // Pick up to 8 flights per cycle, stagger them
  const selected = flights.slice(0, 8);
  selected.forEach((flight, i) => {
    // Stagger across the 5 second interval
    const delay = i * 400 + Math.random() * 600;
    setTimeout(() => {
      // Map altitude (500-12000m) to note index in the twinkle scale
      const alt = flight.altitude || 3000;
      const noteIdx = Math.floor((alt / 12000) * (TWINKLE_NOTES.length - 1));
      const note = TWINKLE_NOTES[Math.max(0, Math.min(noteIdx, TWINKLE_NOTES.length - 1))];

      // Map velocity (50-250 m/s) to duration
      const vel = flight.velocity || 100;
      const duration = vel > 220 ? "16n" : vel > 120 ? "8n" : "4n";

      const velocity = 0.4 + Math.random() * 0.5; // Boosted twinkle velocity
      twinkleSynth.triggerAttackRelease(note, duration, Tone.now(), velocity);
    }, delay);
  });
}

// ── Core melodic trigger (TFL arrivals) ──
export function triggerArrivalPoint(lineId, stationId) {
  if (!isInitialized || mutedLines.has(lineId)) return;
  const synth = instruments[lineId] || instruments["victoria"];
  if (!synth) return;
  const note = activeScale[Math.floor(Math.random() * activeScale.length)];
  synth.triggerAttackRelease(note, "8n", Tone.now(), 0.3 + Math.random() * 0.7);
}

export function setLineVolume(lineId, volumeDb) {
  if (instruments[lineId]) instruments[lineId].volume.rampTo(volumeDb, 0.1);
}
