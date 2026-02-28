# 🎵 Music Agent

**Make music with AI agents. No DAW needed.**

Tell your AI agent what you want in plain English — it writes the code, synthesizes every sound from scratch, and renders a WAV file. No samples, no libraries, no limits.

```
You: "make me a chill lo-fi beat at 85 bpm"
Agent: *writes composition* → *renders* → lofi/output/main.wav
You: "punchier kick, add some vinyl crackle"
Agent: *tweaks* → *re-renders* → lofi/output/main.wav
```

Works with **Claude Code**, **Codex**, **Gemini CLI**, or any coding agent that can read files and run commands.

## Quick Start

```bash
git clone https://github.com/fernsugi/music-agent.git
cd music-agent
npm install
```

Then open your favorite AI coding agent:

```bash
claude          # Claude Code
# or
codex           # OpenAI Codex
# or
gemini          # Google Gemini CLI
```

And just say what you want:

> "make me a chill lo-fi beat at 85 bpm"

The agent reads `AGENTS.md`, knows how to synthesize any sound using Web Audio API, creates a project, and renders your track.

## How It Works

1. **You describe** what you want in plain English
2. **Agent writes** a `.mjs` composition file using Web Audio API
3. **Renderer** executes it offline and outputs a `.wav` file
4. **You listen** and tell the agent what to change
5. **Repeat** until you're happy

Every sound is synthesized from scratch — oscillators, noise, filters, envelopes. No sample packs required (but you can add your own).

## Project Structure

```
music-agent/
├── render.mjs              ← The renderer engine
├── AGENTS.md               ← Teaches agents how to make music
├── samples/                ← Shared samples (optional, add your own)
└── projects/
    └── my-track/           ← One folder per project
        ├── main.mjs        ← The composition code
        ├── samples/        ← Project-specific samples
        └── output/
            └── main.wav    ← Rendered WAV
```

## Manual Usage (without AI)

You can also write compositions yourself:

```bash
# Create a project
mkdir -p projects/my-beat

# Write your composition (see AGENTS.md for API reference)
cat > projects/my-beat/main.mjs << 'EOF'
export default async function(ctx, helpers) {
  const { noteToFreq, duration } = helpers;
  const bpm = 120;
  const beat = 60 / bpm;
  const master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);

  for (let i = 0; i < Math.floor(duration / beat); i++) {
    const t = i * beat;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.8, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc.connect(g).connect(master);
    osc.start(t); osc.stop(t + 0.4);
  }
}
EOF

# Render
node render.mjs projects/my-beat/main.mjs -d 8

# Listen
afplay projects/my-beat/output/main.wav  # macOS
# or: aplay, ffplay, vlc, etc.
```

## Renderer Options

```
node render.mjs <composition.mjs> [options]

Options:
  -o, --output <file>       Output filename (default: <composition-name>.wav)
  -d, --duration <secs>     Duration in seconds (default: 8)
  -r, --samplerate <hz>     Sample rate (default: 44100)
  -c, --channels <n>        1=mono, 2=stereo (default: 2)
  -h, --help                Show help
```

## Using Your Own Samples

Drop `.wav`, `.mp3`, `.ogg`, or `.flac` files into your project's `samples/` folder:

```
projects/my-beat/
├── main.mjs
├── samples/
│   ├── kick.wav
│   ├── snare.wav
│   └── vocal-chop.wav
└── output/
```

Then in your composition:
```js
const kick = await helpers.loadSample('kick.wav');
const src = ctx.createBufferSource();
src.buffer = kick;
src.connect(ctx.destination);
src.start(0);
```

## Requirements

- **Node.js 18+**
- **npm**
- An AI coding agent (Claude Code, Codex, Gemini CLI, etc.)

That's it. No DAW, no plugins, no audio drivers. Everything runs offline in Node.js.

---

## ⚠️ Current Limitations (Help Wanted!)

This project is early stage. It works, but there's a lot of room to improve. Here's what needs love:

### 1. 🎵 Sound Quality
Generated audio quality is basic. Sounds are synthesized from raw oscillators and noise — they work but don't sound professional. We need better sound design recipes, layering techniques, and mixing knowledge baked into `AGENTS.md`.

### 2. 🎲 Too Random
Agents write the entire composition from scratch every time. There's no persistence of good patterns, no reusable components, no template system. Each generation is a dice roll.

### 3. 👀 No Visual Arrangement
There's no visual representation of the arrangement — no timeline, no waveform, no piano roll. Users can't easily see which part plays when, or which instrument to tweak. A simple terminal or HTML visualizer would help a lot.

### 4. 🧠 No Premade Sound Design Skills
Agents have basic recipes in AGENTS.md, but there's no curated library of high-quality sound design techniques. A collection of proven synth patches (808 kick, supersaw lead, Reese bass, etc.) would dramatically improve output quality.

### 5. 🔄 No Incremental Editing
Changing one instrument means the agent rewrites and re-renders everything. An architecture that separates tracks/instruments into individual files would allow targeted edits.

### 6. 🐌 Slow Rendering
Rendering takes a long time, especially for longer compositions. The offline audio context processes everything sequentially. Optimizations like caching, parallel rendering, or smarter scheduling could speed things up significantly.

---

## 🤝 Contributing

**This project needs contributors!** Whether you're a music producer, sound designer, or developer — there's something you can help with.

### Ways to contribute:

- **🎹 Sound Design** — Add better synthesis recipes to `AGENTS.md` (how to make a proper 808, supersaw, Reese bass, etc.)
- **📐 Architecture** — Help design a track/instrument separation system for incremental editing
- **📊 Visualization** — Build a terminal or HTML-based arrangement viewer
- **🎛️ Effects** — Improve the reverb, add chorus, flanger, phaser, EQ, compression
- **🤖 Agent Skills** — Create specialized skill files for different genres (techno, DnB, lo-fi, ambient)
- **🧪 Testing** — Try different agents (Claude, Codex, Gemini) and report what works/breaks
- **📝 Documentation** — Better examples, tutorials, genre guides
- **🐛 Bug Fixes** — Found something broken? Fix it!

### How to contribute:

1. Fork this repo
2. Create a branch: `git checkout -b my-feature`
3. Make your changes
4. Test: `node render.mjs your-test.mjs -d 4`
5. Commit: `git commit -m "feat: better 808 kick recipe"`
6. Push: `git push origin my-feature`
7. Open a Pull Request

No contribution is too small. Even fixing a typo in AGENTS.md helps.

---

## Philosophy

- **No dependencies** (except `node-web-audio-api` for offline rendering)
- **No sample packs required** — everything synthesizable from code
- **Agent-agnostic** — works with any AI that can read files and run shell commands
- **Simple** — one renderer, one instruction file, project folders

The dream: anyone can make music by just talking to their AI agent.

---

## License

MIT — do whatever you want with it.

## Author

Built by [Sugi](https://github.com/fernsugi) and [Sentient](https://github.com/fernsugi) 🌌

---

*If you make something cool with this, let us know! Open an issue or PR with your creation.*
