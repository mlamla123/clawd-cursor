# Changelog

All notable changes to Clawd Cursor will be documented in this file.

## [0.2.0] - 2025-02-21

### 🚀 Major: Anthropic Computer Use API

Clawd Cursor now supports Anthropic's native Computer Use API (`computer_20250124`) as the **primary execution path**. This is a fundamentally different approach — the full task goes directly to Claude with native computer use tools. No decomposition, no routing. Claude sees screenshots, plans, and executes natively.

### Dual Execution Paths

The agent now has two separate code paths selected by provider:

- **Path A — Computer Use API** (`--provider anthropic`): Full task sent to Claude with `computer_20250124` tool. Claude sees the screen, plans multi-step sequences, and executes them natively. Handles complex, multi-app workflows reliably.
- **Path B — Decompose + Action Router** (`--provider openai` / offline): Original approach from v0.1.0. Parse task → subtasks → Action Router (UI Automation, zero LLM) → Vision fallback. Faster and cheaper for simple tasks, works without an API key.

### Added

- **Anthropic Computer Use integration** — native `computer_20250124` tool type with `anthropic-beta: computer-use-2025-01-24` header
- **Adaptive delays** — per-action timing: 1000ms for app launch, 800ms for navigation, 100ms for typing, 300ms default
- **Verification hints** — post-action verification prompts after each Computer Use step
- **VNC mouse drag** — `mouseDrag`, `mouseDown`, `mouseUp` with smooth interpolation between points
- **Bulletproof system prompt** — planning rules, ctrl+l for URL navigation, recovery strategies for failed actions
- **Display scaling** — automatic resolution scaling to 1280×720 for Computer Use API compatibility
- **Vision model** — `claude-sonnet-4-20250514` for Computer Use path

### Test Results

| Task | Time | API Calls | Result |
|------|------|-----------|--------|
| Google Docs: open Chrome, go to Docs, write a paragraph | 187s | 14 | ✅ All succeeded |
| GitHub: open Chrome, navigate to profile, screenshot | 102s | — | ✅ All succeeded |
| Notepad: open, write haiku, save to desktop | ~180s | — | ✅ File saved correctly |
| Paint: draw a stick figure | ~90s | 16 | ✅ Drawing completed |

### Breaking Changes

- **Provider selection now determines execution path.** `--provider anthropic` uses Computer Use API (Path A). `--provider openai` or no provider uses the original Decompose + Action Router pipeline (Path B). This is a fundamental change in behavior — the same task will execute via completely different code paths depending on the provider.

### Performance Characteristics

| | Path A (Computer Use) | Path B (Action Router) |
|---|---|---|
| Best for | Complex multi-step tasks | Simple single-action tasks |
| Reliability | Very high | Good for supported patterns |
| Speed | ~90–190s for complex tasks | ~2s for simple tasks |
| Cost | Higher (multiple API calls with screenshots) | Lower (1 text call or zero) |
| Offline | No | Yes (for common patterns) |

## [0.1.0] - 2025-01-15

### Initial Release

- Action Router with Windows UI Automation — 80% of common tasks with zero LLM calls
- Vision fallback for complex/unfamiliar UI
- Smart task decomposition (single text-only LLM call)
- VNC protocol integration via rfb2
- Three-tier safety system (Auto / Preview / Confirm)
- REST API and CLI interface
- Windows setup script with TightVNC auto-install
