# Prelude: MIDI Mentor

Prelude is an open-source browser-based piano sight-reading trainer designed to improve note recognition through interactive MIDI-powered practice sessions.

Using either a physical MIDI keyboard or an on-screen piano, users identify randomly generated notes displayed on a musical staff while tracking accuracy, response time, and streaks over time.

🌐 **Live Demo:** https://nickbuzzerio.com/prelude/

---

## Features

- 🎹 Real-time MIDI keyboard support
- 🎼 Dynamic music notation rendered with VexFlow
- 📱 Responsive desktop, tablet, and mobile interface
- 🎯 Bass, treble, and mixed practice modes
- 📊 Accuracy, streak, and response-time statistics
- 🎹 Interactive four-octave on-screen piano
- 📦 Installable Progressive Web App (PWA)
- ⚡ Offline application support
- 🚀 Automated deployment with GitHub Actions

---

## Tech Stack

### Frontend

- React
- TypeScript
- Vite
- Tailwind CSS

### Music

- VexFlow
- Web MIDI API

### Tooling

- vite-plugin-pwa
- GitHub Actions

### Hosting

- Nginx
- DigitalOcean

---

## Why I Built This

As an adult piano student, I wanted a lightweight sight-reading trainer that worked directly with a MIDI keyboard without requiring desktop software or subscriptions.

Prelude explores how modern web technologies can provide an engaging music education experience entirely within the browser while remaining installable as a Progressive Web App.

---

## Technical Highlights

- Real-time MIDI event handling using the Web MIDI API
- Dynamic music notation rendering with VexFlow
- Responsive interface supporting desktop, tablet, and mobile devices
- Progressive Web App with offline functionality
- Automated deployment pipeline using GitHub Actions

---

## Running Locally

Install dependencies:

```bash
pnpm install
```

Start the development server:

```bash
pnpm dev
```

Run linting:

```bash
pnpm lint
```

Create a production build:

```bash
pnpm build
```

Preview the production build:

```bash
pnpm preview
```

---

## MIDI Setup

Prelude uses the browser's Web MIDI API.

Supported browsers:

- Google Chrome
- Microsoft Edge

Connect a class-compliant USB MIDI interface before selecting **Connect MIDI**.

Typical wiring:

```text
Keyboard MIDI OUT ───► Interface MIDI IN
Keyboard MIDI IN  ◄─── Interface MIDI OUT
```

---

## Progressive Web App

Prelude can be installed on desktop and mobile devices.

Features include:

- Standalone application mode
- Offline asset caching
- Web App Manifest
- Service worker powered by Workbox

---

## Deployment

Production deployment pipeline:

```text
GitHub Repository
        │
        ▼
GitHub Actions CI/CD
        │
        ▼
Self-hosted Runner
        │
        ▼
Vite Production Build
        │
        ▼
Nginx
        │
        ▼
DigitalOcean
```

Production site:

https://nickbuzzerio.com/prelude/

---

## Roadmap

### Phase 1 (MVP)

- Difficulty settings
- Configurable note ranges
- Local progress persistence

### Phase 2

- Chords
- Intervals
- Scales
- Weak-note review
- Timed practice mode

### Phase 3

- Rhythm training
- Ear training

---

## License

MIT
