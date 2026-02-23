---
name: clawd-cursor
version: 0.5.1
description: >
  AI desktop agent with smart 3-layer pipeline. Controls Windows/Mac natively via @nut-tree-fork/nut-js.
  Works with any AI provider (Anthropic, OpenAI, Ollama, Kimi) or completely free with local models.
  Auto-configures via 'clawd-cursor doctor'. Layer 1 (Action Router) handles 80% of tasks with zero LLM calls.
  Layer 2 (Accessibility Reasoner) uses cheap text-only LLM. Layer 3 (Screenshot) uses vision for complex tasks.
  Installs: Node.js dependencies via npm. No external server required.
privacy: >
  All screenshots and data stay local on the user's machine. AI calls go only to the user's own configured
  API provider and key — no data is sent to third-party servers or skill authors. With Ollama, everything
  runs 100% locally with zero external network calls.
metadata:
  openclaw:
    requires:
      bins:
        - node
        - npm
    install:
      - git clone https://github.com/AmrDab/clawd-cursor.git
      - cd clawd-cursor && npm install && npm run build
      - cd clawd-cursor && npx clawd-cursor doctor
    privacy:
      - Screenshots processed by user's own configured AI provider only
      - With Ollama, fully offline — no external API calls
---

# Clawd Cursor

**One skill, every app.** Instead of integrating dozens of APIs, give your agent a screen. Gmail, Slack, Jira, Figma — if you can click it, your agent can too.

## Quick Start

```bash
git clone https://github.com/AmrDab/clawd-cursor.git
cd clawd-cursor
npm install && npm run build
npx clawd-cursor doctor    # auto-detects and configures everything
npm start
```

That's it. The doctor handles provider detection, model testing, and pipeline configuration.

## How It Works — 3-Layer Pipeline

Every task flows through layers. Most tasks are handled by Layer 1 (free, instant). Only complex tasks reach Layer 3.

| Layer | What | Speed | Cost |
|-------|------|-------|------|
| **1: Action Router** | Regex + UI Automation. Opens apps, types, clicks by name | Instant | Free |
| **2: Accessibility Reasoner** | Reads UI tree → cheap text LLM decides action | ~1s | Free (Qwen) or $0.25/M (Haiku) |
| **3: Screenshot + Vision** | Full screenshot → vision LLM or Computer Use | ~5-8s | ~$3/M (Sonnet) |

The user configures **one API key** (or none for Ollama). Clawd Cursor routes internally — the end user never sees or interacts with multiple models.

## Provider Support

| Provider | Setup | Layer 2 | Layer 3 | Computer Use |
|----------|-------|---------|---------|-------------|
| **Ollama** | `ollama pull qwen2.5:7b` | Qwen (free) | Limited | ❌ |
| **Anthropic** | `AI_API_KEY=sk-ant-...` | Haiku or Qwen | Sonnet | ✅ |
| **OpenAI** | `AI_API_KEY=sk-...` | GPT-4o-mini | GPT-4o | ❌ |
| **Kimi** | `AI_API_KEY=sk-...` | Moonshot-8k | Moonshot-8k | ❌ |

## OpenClaw Agent Instructions

When an OpenClaw agent dispatches Clawd Cursor tasks:

### Simple Tasks (single agent)
For simple, sequential tasks — just send them one at a time via the REST API:
```
POST http://localhost:3847/task
{"task": "Open Notepad and type hello world"}
```

### Complex Tasks (optional: two-agent dispatch)
For heavy workloads, spawn two sub-agents to reduce token usage:
1. **Setup agent** — runs `doctor`, starts the server, validates connectivity
2. **Task agent** — sends tasks via REST API, monitors status, reports results

This keeps the setup context separate from the task context, saving tokens on long sessions.

## Doctor (Self-Healing)

```bash
npx clawd-cursor doctor
```

The doctor:
1. Tests screen capture and accessibility bridge
2. Detects available AI providers
3. Tests each model for responsiveness
4. Builds the optimal pipeline config
5. Falls back gracefully if models are unavailable
6. Saves config to `.clawd-config.json`

## API Endpoints

`http://localhost:3847`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/task` | POST | `{"task": "Open Chrome"}` |
| `/status` | GET | Agent state |
| `/confirm` | POST | `{"approved": true}` |
| `/abort` | POST | Stop current task |

## Safety

| Tier | Actions | Behavior |
|------|---------|----------|
| 🟢 Auto | Navigation, reading, opening apps | Runs immediately |
| 🟡 Preview | Typing, form filling | Logs before executing |
| 🔴 Confirm | Sending messages, deleting | Pauses for approval |

## Security

- Screenshots are NOT saved to disk by default (memory only, sent to user's own AI provider)
- API binds to 127.0.0.1 only — not network accessible
- Use `--debug` to opt-in to disk screenshot saves
- Run in a sandbox/VM when testing with sensitive screen content
- With Ollama, everything runs 100% locally — no external API calls
