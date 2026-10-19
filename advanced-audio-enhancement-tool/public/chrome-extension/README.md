# Volume Corrector Pro — Chrome Extension

## Install in Chrome

### Method 1: Load Unpacked (Developer Mode)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `chrome-extension` folder from this project
5. Click the extension icon in your toolbar to use it

### Method 2: Load from dist/

After running `npm run build`:
```
chrome-extension/  →  dist/chrome-extension/
```
Load the `dist/chrome-extension/` folder instead.

## Features

- 🌐 Capture audio from any browser tab (YouTube, Spotify, etc.)
- 🪟 Capture audio from any app window
- 🔊 Volume boost up to 500% with anti-clip limiter
- ✨ Voice clarity enhancement
- 🔇 Noise gate (fixes grinding/buzzing)
- 🎯 De-esser (fixes harsh sounds)
- 🎛️ 5-band parametric EQ
- 🗜️ Dynamic compressor with live GR meter
- 🧱 Brick-wall limiter (prevents ALL distortion)
- 💾 6 one-click presets
- 🛡️ Anti-doubling (original tab audio suppressed)
- 📊 Live RMS, compressor GR, and limiter GR meters
- ⚙️ Settings persist between sessions

## How to Use

1. **Pin the extension** to your toolbar (click puzzle icon → pin)
2. Navigate to a tab playing audio (YouTube, Spotify, etc.)
3. Click the extension icon
4. Select "Tab" or "Window" as source
5. Click **"▶️ Start Enhancement"**
6. Adjust volume, EQ, and enhancement sliders
7. Click a preset for one-click optimization

## Permissions

- `tabCapture` — Required to capture tab audio for processing
- `activeTab` — Required to identify current tab
- `tabs` — Required for tab information
- `offscreen` — Required for Web Audio API processing in background
- `storage` — Required to save your settings

## Architecture

```
popup.html/js/css   → Extension popup UI (controls & meters)
background.js       → Service worker (message routing, tab capture)
offscreen.js/html   → Audio processing engine (Web Audio API)
```

All processing happens in real-time with zero latency. The original tab audio
is automatically suppressed to prevent doubling — only the enhanced,
processed audio plays through your speakers.
