# ai-srt-iina 🎬

[**中文版**](README.zh.md)

**AI-powered subtitle generator plugin for the [IINA](https://iina.io) media player.**

Generate SRT subtitles on-the-fly for any video playing in IINA using local AI speech recognition ([whisper.cpp](https://github.com/ggerganov/whisper.cpp)). All processing happens **entirely on your machine** — no data leaves your computer, no internet connection required after initial setup.

## How It Works

```
Video playing in IINA
  │
  ├─ 1. Plugins → AI Subtitle → Generate Subtitle
  │
  ├─ 2. ffmpeg extracts audio (16 kHz, mono, WAV)
  │
  ├─ 3. whisper.cpp transcribes audio → SRT
  │       └─ Real-time progress shown on OSD
  │
  ├─ 4. Subtitle saved as {video}.ai.srt (cached)
  │
  └─ 5. Subtitle track loaded automatically in IINA
```

## Features

- **Fully local & private** — uses whisper.cpp, no cloud API calls
- **One-click** — generate subtitles from IINA's Plugins menu
- **Progress feedback** — real-time OSD updates during transcription
- **Smart caching** — generated subtitles are saved alongside the video as `{filename}.ai.srt` and reloaded automatically on subsequent plays
- **Cancellation support** — abort long transcriptions if needed
- **Dependency checks** — friendly error messages when tools are missing

## Prerequisites

- [IINA](https://iina.io) >= 1.3.0 (for the plugin system)
- [Homebrew](https://brew.sh/)
- [ffmpeg](https://ffmpeg.org/) — `brew install ffmpeg`
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) — `brew install whisper-cpp`
- A whisper model file (see below)

### Download a Whisper Model

The plugin uses `ggml-small.en-q8_0.bin` (~500 MB), a good balance of speed and accuracy for English content:

```bash
mkdir -p ~/.cache/whisper-cpp/models
curl -L -o ~/.cache/whisper-cpp/models/ggml-small.en-q8_0.bin \
  https://huggingface.co/Pomni/whisper-small.en-ggml-allquants/resolve/main/ggml-small.en-q8_0.bin
```

> You can use any whisper.cpp-compatible model. The plugin searches these locations in order:
> 1. `~/.cache/whisper-cpp/models/`
> 2. `./models/` (relative to plugin directory)
> 3. IINA's `@data` directory

## Installation

Install from **GitHub repository** (supports automatic updates):

1. Open IINA → **Preferences → Plugins**
2. Click **Install from GitHub...**
3. Enter the repository URL: `https://github.com/MadeBugs/ai-srt-iina`
4. Click **Install**

> New releases are automatically detected — IINA will prompt you to update when a newer version is published.

### Verify Installation

Open IINA, go to `Plugins` in the menu bar. You should see **AI Subtitle** with options to generate and load subtitles.

## Usage

1. Open a video file in IINA
2. Click `Plugins → AI Subtitle → Generate Subtitle` (shortcut: `Ctrl+Shift+G`)
3. Watch progress on the OSD:
   - `AI Subtitle: Extracting audio...` — ffmpeg is extracting the audio track
   - `AI Subtitle: Transcribing: 42%` — whisper.cpp is processing
   - `AI Subtitle: Ready` — subtitle loaded and ready
4. The generated `{video}.ai.srt` file appears next to your video

> **Tip:** Already have a generated subtitle? Press `Ctrl+Shift+L` (or `Plugins → AI Subtitle → Load Cached Subtitle`) to load it immediately.

## Project Structure

```
ai-srt-iina/
├── IINA-AI-Subtitle.iinaplugin/   # IINA plugin bundle
│   ├── Info.json                   # Plugin metadata & permissions
│   ├── main.js                     # Entry point, menu, orchestration
│   ├── lib/
│   │   ├── cache-manager.js        # Path parsing & cache logic
│   │   ├── dependency-checker.js   # Checks for ffmpeg, whisper, model
│   │   ├── progress-parser.js      # Real-time stderr progress parsing
│   │   └── subtitle-generator.js   # Audio extraction + transcription
│   ├── __tests__/                  # Jest test suite
│   └── README.md                   # Plugin-specific documentation
├── package.json                    # Test dependencies
├── jest.config.js                  # Jest configuration
└── README.md                       # This file
```

### Architecture

The plugin runs in IINA's **JavaScriptCore** environment — no Node.js, no browser APIs, no `fs` module. It uses IINA's native APIs:

| API | Usage |
|---|---|
| `iina.utils.exec()` | Run ffmpeg, whisper-cpp, and shell commands |
| `iina.utils.fileInPath()` | Check if a binary exists in PATH |
| `iina.file.access()` | Check file existence |
| `iina.core.subtitle.loadTrack()` | Load generated SRT into the player |
| `iina.core.osd()` | Show progress messages on-screen |
| `iina.menu` | Register plugin menu items |

**Pipeline:**
1. `main.js` receives the menu action
2. `dependency-checker.js` validates all prerequisites
3. `cache-manager.js` computes the output cache path and checks for existing subtitles
4. `subtitle-generator.js` orchestrates the two-phase process:
   - *Phase 1:* ffmpeg extracts audio to a temp directory (16 kHz, mono, PCM s16le WAV)
   - *Phase 2:* whisper.cpp transcribes with `--print-progress` for real-time feedback
5. The resulting SRT is copied to the video's directory as `{basename}.ai.srt`
6. `progress-parser.js` feeds OSD updates throughout

## Development

```bash
# Install test dependencies
npm install

# Run tests
npx jest

# With coverage
npx jest --coverage
```

### Test Coverage

The test suite covers:
- **cache-manager**: Path parsing, extension validation, cache path resolution
- **dependency-checker**: Binary search, model file search, environment injection
- **progress-parser**: ffmpeg and whisper.cpp stderr parsing, state tracking
- **subtitle-generator**: ffmpeg/whisper argument building, success/error flows, cancellation, callbacks, temp cleanup

All modules use dependency injection — `env` objects mock IINA's native APIs, making tests fast and deterministic without a running IINA instance.

### Adding Features

1. Add or modify a module in `lib/`
2. Write/extend tests in `__tests__/`
3. Wire up the new feature in `main.js` (menu items + handlers)
4. Run `npx jest` to verify nothing is broken

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+G` | Generate subtitle for current video |
| `Ctrl+Shift+L` | Load cached subtitle (if exists) |

*(Customizable in IINA's plugin preferences.)*

## Troubleshooting

| Symptom | Likely Cause | Solution |
|---|---|---|
| "Whisper engine not found" | whisper.cpp not installed | `brew install whisper-cpp` |
| "ffmpeg not found" | ffmpeg not installed | `brew install ffmpeg` |
| "Model file not found" | No model downloaded | See [Download a Model](#download-a-whisper-model) |
| "Audio extraction failed" | Corrupted or DRM-protected video | Try a different video file |
| "Transcription failed" | whisper.cpp configuration issue | Run `whisper-cpp --help` to verify installation |
| No "AI Subtitle" in menu | Plugin not installed or too old IINA | Ensure IINA >= 1.3.0 and re-link the plugin |

## Why Local AI?

- **Privacy** — your videos are never uploaded anywhere
- **Offline** — works without internet (after initial model download)
- **No API costs** — unlimited subtitle generation
- **Speed** — small models run well on modern hardware

## License

[MIT](LICENSE)
