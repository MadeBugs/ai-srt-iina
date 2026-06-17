# IINA AI Subtitle Plugin

Generate subtitles locally using AI speech recognition (whisper.cpp).

## Prerequisites

- [Homebrew](https://brew.sh/)
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) — `brew install whisper-cpp`
- [ffmpeg](https://ffmpeg.org/) — `brew install ffmpeg`
- Whisper model: `ggml-small.en-q8_0.bin` (~500MB)

### Download Model

```bash
curl -L -o ~/.cache/whisper-cpp/models/ggml-small.en-q8_0.bin \
  https://huggingface.co/Pomni/whisper-small.en-ggml-allquants/resolve/main/ggml-small.en-q8_0.bin
```

## Installation

### Dev Mode (IINA >= 1.3.0)

```bash
iina-plugin link .
```

### Manual

Copy `IINA-AI-Subtitle.iinaplugin` to `~/Library/Application Support/com.colliderli.iina/plugins/`.

## Usage

1. Open a video file in IINA
2. Click `Plugins → AI Subtitle → Generate Subtitle`
3. Wait for processing (progress shown on OSD)
4. Subtitle loads automatically

## Development

```bash
npm install
npx jest          # run tests
npx jest --coverage  # with coverage
```

## Build

```bash
mkdir -p build && cp -r IINA-AI-Subtitle.iinaplugin build/
```
