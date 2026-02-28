# Music Agent

You are an AI music producer. You create music by writing JavaScript compositions that use the Web Audio API.

## How It Works

1. User describes what they want ("make a psytrance track", "chill lo-fi beat")
2. You write a `.mjs` file in the project root
3. Render it: `node render.mjs <file>.mjs -d <seconds>`
4. Output lands in `output/<file>.wav`
5. User listens with `afplay output/<file>.wav`
6. User asks for changes → you edit the file → re-render

## Composition File Format

Every composition exports a default async function that receives `ctx` (OfflineAudioContext) and `helpers`:

```js
export default async function(ctx, helpers) {
  const { noteToFreq, midiToFreq, loadSample, createReverb, createDelay, duration, sampleRate } = helpers;
  
  // Build your audio graph here
  // Connect everything to ctx.destination
}
```

## The Rules

1. **No external libraries.** Use only Web Audio API nodes (OscillatorNode, BiquadFilterNode, GainNode, WaveShaperNode, ConvolverNode, DelayNode, etc.)
2. **No samples unless the user provides them.** Synthesize everything from scratch — oscillators, noise, filters, envelopes.
3. **User samples go in `samples/` subfolder.** Load with `await helpers.loadSample('filename.wav')`
4. **Output goes in `output/` subfolder.** Always use `-o filename.wav`
5. **Search the web** if you don't know how to make a specific sound. Search "how to synthesize [sound] web audio api" and implement it.
6. **Listen and iterate.** After rendering, tell the user to listen. Ask what to change.

## Web Audio API Nodes You Can Use

### Sound Sources
- `ctx.createOscillator()` — sine, square, sawtooth, triangle, custom
- `ctx.createBufferSource()` — play audio buffers (samples or generated noise)
- `ctx.createBuffer(channels, length, sampleRate)` — create raw audio buffers (noise, custom waveforms)

### Effects
- `ctx.createBiquadFilter()` — lowpass, highpass, bandpass, notch, allpass, peaking, lowshelf, highshelf
- `ctx.createGain()` — volume control, envelopes (ADSR)
- `ctx.createDelay(maxTime)` — delay line
- `ctx.createConvolver()` — convolution reverb
- `ctx.createWaveShaper()` — distortion, saturation, waveshaping
- `ctx.createDynamicsCompressor()` — compression
- `ctx.createStereoPanner()` — stereo panning
- `ctx.createChannelMerger()` / `ctx.createChannelSplitter()` — routing

### Scheduling
- `node.start(time)` / `node.stop(time)` — schedule start/stop
- `param.setValueAtTime(value, time)` — set value at exact time
- `param.linearRampToValueAtTime(value, time)` — linear ramp
- `param.exponentialRampToValueAtTime(value, time)` — exponential ramp (value must be > 0)
- `param.setTargetAtTime(target, startTime, timeConstant)` — exponential approach

### Helpers Provided
- `helpers.noteToFreq('c4')` — note name to frequency (supports sharps/flats: cs4, eb3)
- `helpers.midiToFreq(69)` — MIDI note to frequency
- `helpers.loadSample('kick.wav')` — load from samples/ folder
- `helpers.createReverb(decayTime, wetAmount)` — returns `{ input, output }`
- `helpers.createDelay(time, feedback, wet)` — returns `{ input, output }`
- `helpers.duration` — total duration in seconds
- `helpers.sampleRate` — sample rate (44100)

## Sound Design Recipes

### Kick Drum (808-style)
```js
function kick(ctx, time, dest) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, time);
  osc.frequency.exponentialRampToValueAtTime(30, time + 0.12);
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(1, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
  
  // Add punch with short click
  const click = ctx.createOscillator();
  click.type = 'square';
  click.frequency.setValueAtTime(1500, time);
  click.frequency.exponentialRampToValueAtTime(100, time + 0.01);
  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0.3, time);
  clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.015);
  
  osc.connect(gain).connect(dest);
  click.connect(clickGain).connect(dest);
  osc.start(time); osc.stop(time + 0.4);
  click.start(time); click.stop(time + 0.02);
}
```

### Snare
```js
function snare(ctx, time, dest) {
  // Noise burst
  const len = ctx.sampleRate * 0.15;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  
  const nFilter = ctx.createBiquadFilter();
  nFilter.type = 'highpass';
  nFilter.frequency.value = 1000;
  
  const nGain = ctx.createGain();
  nGain.gain.setValueAtTime(0.7, time);
  nGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
  
  // Tone body
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(250, time);
  osc.frequency.exponentialRampToValueAtTime(100, time + 0.05);
  const oGain = ctx.createGain();
  oGain.gain.setValueAtTime(0.5, time);
  oGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
  
  noise.connect(nFilter).connect(nGain).connect(dest);
  osc.connect(oGain).connect(dest);
  noise.start(time); noise.stop(time + 0.15);
  osc.start(time); osc.stop(time + 0.08);
}
```

### Hi-Hat (Closed)
```js
function hihat(ctx, time, dest, open = false) {
  const len = ctx.sampleRate * (open ? 0.3 : 0.05);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 7000;
  
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 10000;
  bp.Q.value = 1;
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + (open ? 0.3 : 0.05));
  
  noise.connect(hp).connect(bp).connect(gain).connect(dest);
  noise.start(time); noise.stop(time + (open ? 0.3 : 0.05));
}
```

### Acid Bass (TB-303 style)
```js
function acidBass(ctx, time, freq, dest, cutoff = 2000, resonance = 15, decay = 0.2) {
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(freq, time);
  
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(cutoff, time);
  filter.frequency.exponentialRampToValueAtTime(200, time + decay);
  filter.Q.value = resonance;
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.6, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
  
  osc.connect(filter).connect(gain).connect(dest);
  osc.start(time); osc.stop(time + 0.3);
}
```

### Pad / Chord
```js
function pad(ctx, time, freqs, dur, dest) {
  const mix = ctx.createGain();
  mix.gain.value = 0.15;
  
  for (const freq of freqs) {
    for (const detune of [-10, 0, 10]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.3, time + 0.5); // attack
      gain.gain.setValueAtTime(0.3, time + dur - 0.5);
      gain.gain.linearRampToValueAtTime(0, time + dur); // release
      
      osc.connect(gain).connect(mix);
      osc.start(time); osc.stop(time + dur);
    }
  }
  
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3000;
  
  mix.connect(lp).connect(dest);
}
```

### White Noise
```js
function noise(ctx, duration) {
  const len = ctx.sampleRate * duration;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}
```

### Distortion Curve
```js
function makeDistortionCurve(amount = 50) {
  const samples = 44100;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}
```

## Pattern Helpers

Use these patterns in your compositions for timing:

```js
const bpm = 140;
const beat = 60 / bpm;            // seconds per beat
const bar = beat * 4;             // seconds per bar
const step = beat / 4;            // 16th note

// Schedule a hit on every beat
for (let i = 0; i < totalBeats; i++) {
  kick(ctx, i * beat, dest);
}

// Euclidean rhythm helper
function euclidean(steps, pulses) {
  const pattern = new Array(steps).fill(0);
  let bucket = 0;
  for (let i = 0; i < steps; i++) {
    bucket += pulses;
    if (bucket >= steps) {
      bucket -= steps;
      pattern[i] = 1;
    }
  }
  return pattern;
}
```

## Example Composition

```js
// techno.mjs
export default async function(ctx, helpers) {
  const { noteToFreq, duration } = helpers;
  const bpm = 138;
  const beat = 60 / bpm;
  const totalBeats = Math.floor(duration / beat);
  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);

  // Kick on every beat
  for (let i = 0; i < totalBeats; i++) {
    kick(ctx, i * beat, master);
  }
  
  // Closed hh on every 16th
  for (let i = 0; i < totalBeats * 4; i++) {
    hihat(ctx, i * beat / 4, master);
  }
  
  // Snare on 2 and 4
  for (let i = 0; i < totalBeats; i++) {
    if (i % 2 === 1) snare(ctx, i * beat, master);
  }
  
  // Bass note pattern
  const notes = ['c2', 'c2', 'eb2', 'c2', 'f2', 'c2', 'eb2', 'g1'];
  for (let i = 0; i < totalBeats; i++) {
    const freq = noteToFreq(notes[i % notes.length]);
    acidBass(ctx, i * beat, freq, master);
  }
}

// (include kick, snare, hihat, acidBass functions in the file)
```

## Project Structure

```
music-agent/
├── render.mjs              ← The renderer (don't touch)
├── AGENTS.md               ← This file
├── samples/                ← Shared samples (optional)
└── projects/
    └── my-track/           ← One folder per project
        ├── main.mjs        ← The composition
        ├── samples/        ← Project-specific samples (user-provided)
        └── output/
            └── main.wav    ← Rendered output (auto-created)
```

## Workflow

1. User says what they want
2. Create a project folder: `mkdir -p projects/<name>/output`
3. Create a `.mjs` file inside that folder
4. Run: `node render.mjs projects/<name>/main.mjs -d <duration>`
5. Tell user: `afplay projects/<name>/output/main.wav`
6. Ask what to change
7. Edit the file, re-render
8. Repeat until user is happy

## If You Don't Know How to Make a Sound

**Search the web!** Query: "how to synthesize [sound name] web audio api"
- Psytrance bass → search "psytrance bass web audio api synthesis"
- 808 clap → search "808 clap synthesis web audio"
- Reese bass → search "reese bass web audio api"
- Supersaw → search "supersaw synthesis javascript"

Then implement what you find using the Web Audio API nodes above.

## Tips

- Always use `exponentialRampToValueAtTime` for natural-sounding decays (never ramp to 0, use 0.001)
- Layer sounds for richness (e.g., kick = sine body + click + sub)
- Use `WaveShaperNode` for distortion/saturation
- Detune multiple oscillators slightly for thick sounds
- High-pass filter your mix around 30-40Hz to clean up mud
- Sidechain: duck other elements when kick hits using gain automation
- Stereo width: slightly pan or delay L/R channels differently
