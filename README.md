# 🐾 Clawd Cursor

**AI Desktop Agent over VNC** — your AI connects to your desktop like a remote user.

## How It Works

1. You run a VNC server on your machine (TightVNC, UltraVNC, etc.)
2. Clawd Cursor connects as a VNC client
3. AI sees your screen (on-demand frames, not continuous streaming)
4. AI sends mouse clicks and keystrokes through the VNC protocol
5. You can watch everything happening in real time via your own VNC viewer

## Architecture

```
┌──────────────────────────┐
│     Your Desktop         │
│   (VNC Server running)   │
└──────────┬───────────────┘
           │ VNC Protocol (RFB)
┌──────────┴───────────────┐
│   Clawd Cursor Agent     │
│                          │
│  ┌────────────────────┐  │
│  │  VNC Client        │  │  ← connects as remote user
│  │  (rfb2 / node-vnc) │  │
│  └────────┬───────────┘  │
│           │              │
│  ┌────────┴───────────┐  │
│  │  Action Engine     │  │  ← translates AI intent → VNC input
│  │  mouse/keyboard    │  │
│  └────────┬───────────┘  │
│           │              │
│  ┌────────┴───────────┐  │
│  │  AI Brain          │  │  ← LLM decides what to do
│  │  (OpenClaw / API)  │  │
│  └────────┬───────────┘  │
│           │              │
│  ┌────────┴───────────┐  │
│  │  Safety Layer      │  │  ← tiered confirmations
│  └────────────────────┘  │
│                          │
│  ┌────────────────────┐  │
│  │  REST API / CLI    │  │  ← you tell it what to do
│  └────────────────────┘  │
└──────────────────────────┘
```

## Quick Start

```bash
# 1. Install a VNC server (e.g. TightVNC) on your machine
# 2. Start VNC server with a password

# 3. Run Clawd Cursor
pnpm install
pnpm build
pnpm start --host localhost --port 5900 --password yourpass

# 4. Give it a task
curl http://localhost:3847/task -d '{"task": "Open Chrome and go to github.com"}'
```

## Safety Tiers

- 🟢 **Auto**: Navigation, reading, opening apps
- 🟡 **Preview**: Typing, form filling — logs before executing
- 🔴 **Confirm**: Sending messages, deleting, purchases — pauses for approval

## Tech Stack

- TypeScript + Node.js
- `rfb2` — VNC client library (RFB protocol)
- `sharp` — screenshot processing
- LLM vision (Claude, GPT-4o) — understands what's on screen
- Express + WebSocket — REST API and real-time control

## License

MIT
