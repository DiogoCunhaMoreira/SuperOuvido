# SuperOuvido

A web app that records audio from the microphone, detects the piano notes being played, and generates an automatic musical analysis (chord identification, intervals, tonal context, sonic character, and musical applications) through the Gemini API.

Built with React, it uses [Spotify's Basic Pitch](https://basicpitch.spotify.com/) model (running locally in the browser via TensorFlow.js) for note detection and Google's `gemini-2.5-flash` model for harmonic analysis.

## Features

- **Microphone recording** using the Web Audio API, with manual stop or automatic cutoff.
- **Polyphonic note detection** with the Basic Pitch model, including harmonic and sub-harmonic filtering to reduce false positives and a confidence boost for low notes.
- **Keyboard visualization** with the detected pitch classes highlighted.
- **Gemini-powered musical analysis** covering chord identification, intervals, tonal context, sonic character, and musical applications.
- **Analysis history** with note-based search and date grouping.
- **Local audio cache** that lets you play back recordings tied to past analyses.
- European Portuguese interface.


## Prerequisites

- Node.js 18+ and npm.
- A browser supporting `getUserMedia`, `AudioContext`, and IndexedDB (recent Chrome, Firefox, Edge, Safari).
- A microphone.
- A Gemini API key ([Google AI Studio](https://aistudio.google.com/)).

## Installation

```bash
git clone <repo-url>
cd SuperOuvido
npm install
```

## Configuration

Create a `.env` file at the project root with your Gemini API key. You can copy `.env.example` as a starting point:

```bash
cp .env.example .env
```

## Usage

```bash
npm start      # dev server at http://localhost:3000
npm run build  # production build into ./build
npm test       # tests in watch mode
```

Inside the app:

1. **Start Recording** — play the notes or chord on the piano (10 s limit).
2. **Stop Recording** (or wait for the timeout).
3. **Play Current Recording** to confirm what was captured.
4. **Analyze Recording** — runs Basic Pitch, updates the keyboard, and calls Gemini.
5. **History** — revisit previous analyses and play back the cached audio.

## Technical notes

- **Basic Pitch model**: loaded via CDN from `https://unpkg.com/@spotify/basic-pitch@1.0.1/model/model.json`. The first initialization takes a few seconds.
- **Detection limits**: notes below C2 (MIDI 36) trigger a warning; the base threshold is `max(0.25, top_score * 0.4)`.
- **Harmonic thresholds**: octave (12) and octave+fifth (19) at 0.65, two octaves (24) at 0.7, etc. See `NoteDetector.js` for details.
- **Privacy**: audio and history stay in the browser (localStorage + IndexedDB). Only the text with the detected notes is sent to Gemini.

## Scripts (Create React App)

| Command | Description |
| --- | --- |
| `npm start` | Dev server with hot reload. |
| `npm run build` | Minified production build under `build/`. |
| `npm test` | Runs the tests with Jest / React Testing Library. |
| `npm run eject` | Exposes the CRA configuration (irreversible). |

## Stack

React 19 · Create React App 5 · `@spotify/basic-pitch` · `@tensorflow/tfjs` · `@google/generative-ai` · `react-markdown` · `@mdi/react`
