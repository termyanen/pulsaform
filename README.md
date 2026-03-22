# Pulsaform

Real-time audio visualization app powered by Web Audio API. Use your microphone or upload a track to see the sound come alive.

## Features

- **8 visualization templates** — Flow Field, Circular Spectrum, Starfield, Waveform, Spectrogram, Terrain, Equalizer, Color Waves
- **Audio sources** — microphone input (with device selection) or MP3 file upload
- **MP3 player** — play/pause, seek, replay controls
- **Real-time parameter controls** — tweak every aspect of each visualization on the fly
- **Settings persistence** — all parameters saved to localStorage
- **Responsive** — works on desktop and mobile

## Visualizations

| Template | Description |
|----------|-------------|
| Flow Field | Particles flowing through noise fields, reacting to beats with color, direction, and speed changes |
| Circular Spectrum | Radial frequency bars with logarithmic mapping, rotation, and center glow |
| Starfield | 3D starfield with speed driven by bass and color by treble |
| Waveform | Oscilloscope display with waveform history and grid overlay |
| Spectrogram | Scrolling waterfall frequency display with multiple color modes |
| Terrain | 3D landscape generated from frequency data with perspective rendering |
| Equalizer | Classic equalizer bars with peak indicators and mirror mode |
| Color Waves | Smooth flowing sine waves of different colors driven by frequency bands |

## Tech Stack

- React 19 + Vite
- Web Audio API (AudioContext, AnalyserNode)
- Canvas 2D rendering
- React Router for navigation

## Getting Started

```bash
npm install
npm run dev
```

## Build & Deploy

```bash
npm run build
```
