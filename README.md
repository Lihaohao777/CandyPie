# CandyPie

A lightweight AI chat tool that lives in your system tray. Press `Ctrl+Space` to instantly open a chat window and talk to any OpenAI-compatible AI.

## Features

- Global hotkey `Ctrl+Space` to toggle the chat window
- Supports any OpenAI-compatible API (OpenAI, DeepSeek, local models, etc.)
- Streaming responses with Markdown rendering
- Code blocks with one-click copy
- `<think>` reasoning blocks (DeepSeek R1 style) collapsed by default
- Chat history sent with each message for multi-turn conversations
- Frameless, always-on-top window — stays out of your taskbar
- Single instance — double-clicking the exe brings the existing window to front
- Config persisted locally (`%APPDATA%/candypie/config.json`)

## Quick Start

### Use the installer (Windows)

1. Download `CandyPie Setup x.x.x.exe` from Releases
2. Install and run — the app starts in the system tray
3. Press `Ctrl+Space` or click the tray icon to open
4. Click the ⚙ button to enter your API URL, key, and model name

### Run from source

**Requirements:** Node.js 18+

```bash
git clone <repo>
cd winchat
npm install
npm run dev
```

### Build installer

```bash
npm run dist
```

Output: `dist/CandyPie Setup x.x.x.exe`

> **macOS/Linux:** The app is designed for Windows (tray + global shortcut). Running `npm run dev` works on other platforms for development, but packaging targets Windows only.

## Configuration

| Field | Description |
|-------|-------------|
| API URL | Base URL, e.g. `https://api.openai.com/v1` |
| API Key | Your API key |
| Model | e.g. `gpt-4o`, `deepseek-reasoner` |
| System Prompt | Optional instructions for the AI |

## Tech Stack

Electron · Vue 3 · Vite · electron-builder · marked
