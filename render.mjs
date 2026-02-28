#!/usr/bin/env node
/**
 * Music Agent Renderer
 * 
 * Executes a composition .js file and renders to WAV.
 * 
 * Usage:
 *   node render.mjs composition.mjs              → output/composition.wav
 *   node render.mjs composition.mjs -o beat.wav   → output/beat.wav
 *   node render.mjs composition.mjs -d 16         → 16 seconds
 */

import { OfflineAudioContext } from 'node-web-audio-api';
import { writeFileSync, readFileSync, existsSync, readdirSync } from 'fs';
import { resolve, basename, extname } from 'path';
import { parseArgs } from 'util';
import { pathToFileURL } from 'url';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    output: { type: 'string', short: 'o' },
    duration: { type: 'string', short: 'd', default: '8' },
    samplerate: { type: 'string', short: 'r', default: '44100' },
    channels: { type: 'string', short: 'c', default: '2' },
    help: { type: 'boolean', short: 'h', default: false },
  }
});

if (values.help || positionals.length === 0) {
  console.log(`
🎵 Music Agent Renderer

Usage:
  node render.mjs <composition.mjs> [options]

Options:
  -o, --output <file>       Output filename (default: <composition-name>.wav)
  -d, --duration <secs>     Duration in seconds (default: 8)
  -r, --samplerate <hz>     Sample rate (default: 44100)
  -c, --channels <n>        Channels: 1=mono, 2=stereo (default: 2)
  -h, --help                Show this help

The composition file must export a default async function:

  export default async function(ctx, helpers) {
    // ctx = OfflineAudioContext
    // helpers = { loadSample, noteToFreq, midiToFreq, bpm, duration }
    // Connect your audio nodes to ctx.destination
  }
`);
  process.exit(0);
}

const inputFile = resolve(positionals[0]);
if (!existsSync(inputFile)) {
  console.error(`Error: file not found: ${inputFile}`);
  process.exit(1);
}

const duration = parseFloat(values.duration);
const sampleRate = parseInt(values.samplerate);
const numChannels = parseInt(values.channels);
const defaultName = basename(inputFile, extname(inputFile)) + '.wav';
// Output goes in an output/ folder next to the composition file
const inputDir = resolve(inputFile, '..');
const outputDir = resolve(inputDir, 'output');
import { mkdirSync } from 'fs';
mkdirSync(outputDir, { recursive: true });
const outputFile = resolve(outputDir, values.output || defaultName);

console.log(`🎵 Music Agent Renderer`);
console.log(`  Composition: ${basename(inputFile)}`);
console.log(`  Duration: ${duration}s | Rate: ${sampleRate}Hz | Channels: ${numChannels}`);
console.log(`  Output: ${outputFile}`);
console.log();

// ─── Create Offline Context ────────────────────────────────────────────────────

const totalSamples = Math.ceil(sampleRate * duration);
const ctx = new OfflineAudioContext(numChannels, totalSamples, sampleRate);

// ─── Helper Functions (passed to composition) ──────────────────────────────────

function noteToFreq(note) {
  if (typeof note === 'number') {
    return note > 20 ? note : 440 * Math.pow(2, (note - 69) / 12);
  }
  const str = String(note).toLowerCase().trim();
  const match = str.match(/^([a-g])(s|#|b|f)?(\d)?$/);
  if (!match) return 261.63;
  const base = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  let semi = base[match[1]];
  if (match[2] === 's' || match[2] === '#') semi++;
  if (match[2] === 'b' || match[2] === 'f') semi--;
  const oct = match[3] !== undefined ? parseInt(match[3]) : 4;
  return 440 * Math.pow(2, (semi + (oct + 1) * 12 - 69) / 12);
}

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Load a sample from the project's samples/ directory
const sampleCache = new Map();
async function loadSample(name) {
  if (sampleCache.has(name)) return sampleCache.get(name);
  
  const samplesDir = resolve(inputDir, 'samples');
  // Try exact path first
  let filePath = resolve(samplesDir, name);
  if (!existsSync(filePath)) {
    // Try with common extensions
    for (const ext of ['.wav', '.mp3', '.ogg', '.flac']) {
      const p = resolve(samplesDir, name + ext);
      if (existsSync(p)) { filePath = p; break; }
    }
  }
  
  if (!existsSync(filePath)) {
    console.warn(`  Warning: sample not found: ${name}`);
    return null;
  }

  try {
    const fileData = readFileSync(filePath);
    const arrayBuf = fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength);
    const audioBuf = await ctx.decodeAudioData(arrayBuf);
    sampleCache.set(name, audioBuf);
    return audioBuf;
  } catch (err) {
    console.warn(`  Warning: failed to decode ${name}: ${err.message}`);
    return null;
  }
}

// List available samples
function listSamples() {
  const samplesDir = resolve(inputDir, 'samples');
  if (!existsSync(samplesDir)) return [];
  const walk = (dir, prefix = '') => {
    let results = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        results = results.concat(walk(resolve(dir, entry.name), rel));
      } else if (/\.(wav|mp3|ogg|flac)$/i.test(entry.name)) {
        results.push(rel);
      }
    }
    return results;
  };
  return walk(samplesDir);
}

// ─── Create reverb impulse response ────────────────────────────────────────────

function createReverb(decayTime = 2, wet = 0.3) {
  const length = Math.ceil(sampleRate * decayTime);
  const impulse = ctx.createBuffer(2, length, sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
    }
  }
  const convolver = ctx.createConvolver();
  convolver.buffer = impulse;
  
  const dry = ctx.createGain();
  dry.gain.value = 1 - wet;
  const wetGain = ctx.createGain();
  wetGain.gain.value = wet;
  const merger = ctx.createGain();
  
  // Return a node-like object with connect method
  return { convolver, dry, wetGain, merger,
    input: (() => {
      const input = ctx.createGain();
      input.connect(dry);
      input.connect(convolver);
      convolver.connect(wetGain);
      dry.connect(merger);
      wetGain.connect(merger);
      return input;
    })(),
    output: merger
  };
}

// ─── Delay effect ──────────────────────────────────────────────────────────────

function createDelay(time = 0.25, feedback = 0.4, wet = 0.3) {
  const delay = ctx.createDelay(5);
  delay.delayTime.value = time;
  const fb = ctx.createGain();
  fb.gain.value = feedback;
  const wetGain = ctx.createGain();
  wetGain.gain.value = wet;
  const dryGain = ctx.createGain();
  dryGain.gain.value = 1 - wet;
  const input = ctx.createGain();
  const output = ctx.createGain();
  
  input.connect(dryGain);
  input.connect(delay);
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(wetGain);
  dryGain.connect(output);
  wetGain.connect(output);
  
  return { input, output, delay, feedback: fb };
}

const helpers = {
  loadSample,
  listSamples,
  noteToFreq,
  midiToFreq,
  createReverb,
  createDelay,
  duration,
  sampleRate,
  numChannels,
};

// ─── Load & Run Composition ────────────────────────────────────────────────────

console.log('Loading composition...');
const mod = await import(pathToFileURL(inputFile).href);
const compose = mod.default;

if (typeof compose !== 'function') {
  console.error('Error: composition must export a default async function');
  process.exit(1);
}

console.log('Building audio graph...');
await compose(ctx, helpers);

console.log('Rendering audio...');
const audioBuffer = await ctx.startRendering();
console.log(`  Rendered ${audioBuffer.length} samples (${audioBuffer.duration.toFixed(2)}s)`);

// ─── Encode WAV ────────────────────────────────────────────────────────────────

console.log('Writing WAV...');

function encodeWAV(buf) {
  const nc = buf.numberOfChannels;
  const sr = buf.sampleRate;
  const bps = 16;
  const channels = [];
  for (let i = 0; i < nc; i++) channels.push(buf.getChannelData(i));
  
  const dataLen = channels[0].length * nc * (bps / 8);
  const buffer = Buffer.alloc(44 + dataLen);
  
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataLen, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(nc, 22);
  buffer.writeUInt32LE(sr, 24);
  buffer.writeUInt32LE(sr * nc * (bps / 8), 28);
  buffer.writeUInt16LE(nc * (bps / 8), 32);
  buffer.writeUInt16LE(bps, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataLen, 40);
  
  let off = 44;
  for (let i = 0; i < channels[0].length; i++) {
    for (let ch = 0; ch < nc; ch++) {
      const s = Math.max(-1, Math.min(1, channels[ch][i]));
      buffer.writeInt16LE(Math.round(s < 0 ? s * 0x8000 : s * 0x7FFF), off);
      off += 2;
    }
  }
  return buffer;
}

const wavBuffer = encodeWAV(audioBuffer);
writeFileSync(outputFile, wavBuffer);

const kb = (wavBuffer.length / 1024).toFixed(1);
console.log(`\n✅ Done! ${outputFile} (${kb} KB)`);
console.log(`   Play: afplay ${outputFile}`);
