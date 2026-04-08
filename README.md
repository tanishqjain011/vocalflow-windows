# VocalFlow for Windows 🎙

A Windows port of [VocalFlow](https://github.com/Vocallabsai/vocalflow) — a lightweight system-tray app that lets you **hold a hotkey, speak, and have the transcript injected at your cursor** in any app.

Built with **Electron**, **Deepgram** (real-time WebSocket STT), and **Groq** (LLM post-processing).

---
<img width="672" height="743" alt="image" src="https://github.com/user-attachments/assets/50e9f505-4183-4d33-b63a-8c3caa589412" />

## ✨ Features

| Feature | Details |
|---------|---------|
| 🎙 Hold-to-record hotkey | Right Alt, Left Alt, Right Ctrl, Left Ctrl (configurable) |
| 📡 Real-time streaming ASR | Deepgram WebSocket API (`nova-2`, `nova`, `whisper-large`, …) |
| ✍️ Text injection | Paste at cursor in **any Windows app** (Notepad, Word, browser, VS Code, …) |
| 🤖 LLM post-processing (Groq) | Spelling correction, grammar, code-mix transliteration, translation |
| 💰 Balance display | Shows Deepgram credit balance + Groq API status live |
| 🗂 System tray | Runs silently in the background; no taskbar icon |
| 💾 Persistent settings | All settings survive app restarts |

---

## 🚀 Quick Start

### Prerequisites

- **Windows 10 / 11** (64-bit)
- **Node.js 18+** → https://nodejs.org
- **Deepgram API key** → https://console.deepgram.com (free tier available)
- **Groq API key** *(optional, for post-processing)* → https://console.groq.com

---

### 1. Clone / unzip the project

```
cd vocalflow-windows
```

### 2. Add your API keys

Open **`config.js`** and paste your keys:

```js
DEEPGRAM_API_KEY: 'dg_xxxxxxxxxxxxxxxxxxxx',
GROQ_API_KEY:     'gsk_xxxxxxxxxxxxxxxxxxxx',
```

### 3. Install dependencies

```
npm install
```

> This also automatically rebuilds native modules (`uiohook-napi`) for your Node/Electron version.

### 4. Run the app

```
npm start
```

A 🎙 VocalFlow icon will appear in your **system tray** (bottom-right).  
Click the tray icon to open **Settings**.

---

## 🖥 Settings Window

| Section | What to configure |
|---------|-------------------|
| **Deepgram** | API key, STT model, language |
| **Groq** | API key, LLM model, post-processing type |
| **Hotkey** | Which key triggers recording |
| **Balance** | Live credit balance & API status (auto-refreshed) |
| **Live transcript** | See what's being transcribed in real time |

Click **"Fetch Models"** to load available models from your account.

---

## ⌨️ How to Dictate

1. Click anywhere (any text field, editor, browser, etc.)  
2. **Hold** the configured hotkey (default: **Right Alt**)  
3. Speak clearly  
4. **Release** the key → text is pasted at your cursor  

No mouse clicks needed. Works in every app.

---

## 📁 Project Structure

```
vocalflow-windows/
├── config.js                  ← ★ API keys & default settings (edit me!)
├── main.js                    ← Electron main process (tray, hotkey, IPC)
├── preload.js                 ← Secure IPC bridge (contextBridge)
├── package.json
│
├── src/
│   ├── deepgramService.js     ← WebSocket streaming STT
│   ├── groqService.js         ← LLM post-processing
│   ├── hotkeyManager.js       ← Global hold-to-record hotkey (uiohook-napi)
│   ├── textInjector.js        ← Clipboard + Ctrl+V injection
│   └── balanceService.js      ← Deepgram & Groq balance/status fetch
│
├── renderer/
│   ├── index.html             ← Settings window HTML
│   ├── renderer.js            ← Settings UI + microphone capture
│   └── styles.css             ← Dark theme styles
│
└── assets/
    └── icon.png               ← System tray icon (replace with your own)
```

---

## 🔧 Post-Processing Options (Groq)

Enable in Settings → toggle **"Enable Post-Processing"** → choose type:

| Type | What it does |
|------|-------------|
| **None** | Raw Deepgram transcript (fastest) |
| **Spelling Correction** | Fixes mis-heard words |
| **Grammar Correction** | Fixes grammar & punctuation |
| **Code-mix Transliteration** | Converts Hinglish / Tanglish / Spanglish etc. to English |
| **Translation** | Translates transcript to any target language |

---

## 💰 Balance Display (Extra Feature)

The Settings window shows a **live balance bar** at the top:

- **Deepgram Balance** — queries `/v1/projects/{id}/balances` and shows your dollar credit
- **Groq Status** — verifies your key and shows how many models are available

Click **↻ Refresh** to reload at any time.

---

## 🏗 Build Installer (optional)

To create a Windows `.exe` installer:

```
npm run build
```

The output `.exe` will be in the `dist/` folder.

---

## 🛠 Troubleshooting

| Problem | Fix |
|---------|-----|
| Hotkey not working | Run the app **as Administrator** (required for global keyboard hook) |
| Mic not captured | Allow microphone access when Windows prompts |
| Text not pasted | Allow **clipboard access**; make sure target window is focused |
| `uiohook-napi` build error | Run `npm run rebuild` after install |
| Deepgram balance shows "N/A" | Check your API key in `config.js` |

---

## 📜 License

MIT — same as the original VocalFlow.

---

## 🙏 Credits

- Original macOS app: [Vocallabs AI / vocalflow](https://github.com/Vocallabsai/vocalflow)
- Speech-to-Text: [Deepgram](https://deepgram.com)
- LLM post-processing: [Groq](https://groq.com)
