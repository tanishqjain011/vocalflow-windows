// ============================================================
//  main.js
//  VocalFlow for Windows — Electron main process
// ============================================================

const {
  app, BrowserWindow, Tray, Menu, ipcMain,
  nativeImage, Notification, shell,
} = require('electron');
const path    = require('path');
const Store   = require('electron-store');

const config          = require('./config');
const DeepgramService = require('./src/deepgramService');
const GroqService     = require('./src/groqService');
const HotkeyManager   = require('./src/hotkeyManager');
const { injectText }  = require('./src/textInjector');
const {
  fetchDeepgramBalance,
  fetchGroqBalance,
} = require('./src/balanceService');

// ── Persistent settings ───────────────────────────────────────
const store = new Store({
  defaults: {
    deepgramApiKey:   config.DEEPGRAM_API_KEY,
    groqApiKey:       config.GROQ_API_KEY,
    hotkey:           config.defaultHotkey,
    deepgramModel:    config.deepgram.defaultModel,
    deepgramLanguage: config.deepgram.defaultLanguage,
    groqModel:        config.groq.defaultModel,
    postProcessing:   false,
    postProcessType:  'none',
    transLang:        'Hinglish',
    targetLang:       'English',
  },
});

// ── State ─────────────────────────────────────────────────────
let tray           = null;
let settingsWindow = null;
let deepgram       = null;
let groq           = null;
let hotkeyMgr      = null;
let isRecording    = false;
let liveTranscript = '';   // accumulated final transcripts this session
let interimText    = '';   // current interim transcript

// ── App ready ─────────────────────────────────────────────────
app.whenReady().then(() => {
  // Prevent app from closing when all windows close
  app.on('window-all-closed', (e) => e.preventDefault());

  createTray();
  initServices();
  initHotkey();
});

app.on('before-quit', () => {
  hotkeyMgr?.stop();
});

// ── Tray ──────────────────────────────────────────────────────
function createTray() {
  // Try to load icon; fall back to empty image
  let icon;
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) icon = nativeImage.createEmpty();
  } catch (_) {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('VocalFlow — Hold-to-dictate');
  updateTrayMenu();
  tray.on('click', openSettings);
}

function updateTrayMenu(recordingState = false) {
  const hotkey = store.get('hotkey');
  const menu = Menu.buildFromTemplate([
    {
      label: recordingState ? '🔴 Recording…' : '🎙  VocalFlow',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: `Hotkey: ${hotkey}`,
      enabled: false,
    },
    {
      label: 'Settings…',
      click: openSettings,
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => { hotkeyMgr?.stop(); app.exit(0); },
    },
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(recordingState ? '🔴 Recording…' : 'VocalFlow — Hold to dictate');
}

// ── Settings Window ───────────────────────────────────────────
function openSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 680,
    height: 780,
    title: 'VocalFlow Settings',
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration:  false,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    autoHideMenuBar: true,
  });

  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// ── Services init ─────────────────────────────────────────────
function initServices() {
  deepgram = new DeepgramService(store.get('deepgramApiKey'));
  groq     = new GroqService(store.get('groqApiKey'));
}

// ── Global Hotkey ─────────────────────────────────────────────
function initHotkey() {
  hotkeyMgr = new HotkeyManager();
  hotkeyMgr.setHotkey(store.get('hotkey'));

  hotkeyMgr.onKeyDown = startRecording;
  hotkeyMgr.onKeyUp   = stopRecording;

  hotkeyMgr.start();
}

// ── Recording ─────────────────────────────────────────────────
function startRecording() {
  if (isRecording) return;
  isRecording    = true;
  liveTranscript = '';
  interimText    = '';

  // Tell renderer to start microphone capture
  settingsWindow?.webContents?.send('recording-start');
  updateTrayMenu(true);

  // Connect Deepgram WebSocket
  deepgram = new DeepgramService(store.get('deepgramApiKey'));

  deepgram.onTranscript = (text, isFinal) => {
    if (isFinal) {
      liveTranscript += (liveTranscript ? ' ' : '') + text;
      interimText = '';
    } else {
      interimText = text;
    }
    // Update live transcript in settings window if open
    settingsWindow?.webContents?.send('live-transcript', {
      final: liveTranscript,
      interim: interimText,
    });
  };

  deepgram.onError = (err) => {
    console.error('[Main] Deepgram error:', err.message);
    settingsWindow?.webContents?.send('deepgram-error', err.message);
  };

  deepgram.connect({
    model:    store.get('deepgramModel'),
    language: store.get('deepgramLanguage'),
    ...config.deepgram,
  });

  console.log('[Main] Recording started');
}

async function stopRecording() {
  if (!isRecording) return;
  isRecording = false;

  // Tell renderer to stop capturing audio
  settingsWindow?.webContents?.send('recording-stop');
  updateTrayMenu(false);

  // Finalize Deepgram stream
  deepgram?.finish();

  // Small delay to allow final transcript to arrive
  await new Promise(r => setTimeout(r, 600));

  const rawText = liveTranscript.trim();
  if (!rawText) {
    console.log('[Main] No transcript captured');
    return;
  }

  // Optional Groq post-processing
  let finalText = rawText;
  if (store.get('postProcessing')) {
    const type  = store.get('postProcessType');
    const model = store.get('groqModel');
    const opts  = {
      language:       store.get('transLang'),
      targetLanguage: store.get('targetLang'),
    };
    try {
      groq = new GroqService(store.get('groqApiKey'));
      finalText = await groq.process(rawText, type, model, opts);
      console.log('[Main] Groq processed:', finalText);
    } catch (err) {
      console.error('[Main] Groq error:', err.message);
      finalText = rawText; // fall back to raw
    }
  }

  console.log('[Main] Injecting:', finalText);
  settingsWindow?.webContents?.send('final-transcript', finalText);

  // Inject text at cursor
  await injectText(finalText);
}

// ── IPC Handlers ──────────────────────────────────────────────

// Renderer sends audio chunks captured from microphone
ipcMain.on('audio-chunk', (_event, buffer) => {
  if (isRecording && deepgram?.isConnected) {
    deepgram.sendAudio(Buffer.from(buffer));
  }
});

// Renderer saves updated settings
ipcMain.handle('save-settings', (_event, settings) => {
  for (const [k, v] of Object.entries(settings)) {
    store.set(k, v);
  }
  // Re-init services with new keys
  deepgram = new DeepgramService(store.get('deepgramApiKey'));
  groq     = new GroqService(store.get('groqApiKey'));
  // Update hotkey
  hotkeyMgr.setHotkey(store.get('hotkey'));
  return { ok: true };
});

// Renderer requests current settings
ipcMain.handle('get-settings', () => store.store);

// Fetch Deepgram models
ipcMain.handle('fetch-deepgram-models', async () => {
  const svc = new DeepgramService(store.get('deepgramApiKey'));
  return svc.fetchModels();
});

// Fetch Groq models
ipcMain.handle('fetch-groq-models', async () => {
  const svc = new GroqService(store.get('groqApiKey'));
  return svc.fetchModels();
});

// Fetch balances (extra feature)
ipcMain.handle('fetch-balances', async () => {
  const [dg, gq] = await Promise.all([
    fetchDeepgramBalance(store.get('deepgramApiKey')),
    fetchGroqBalance(store.get('groqApiKey')),
  ]);
  return { deepgram: dg, groq: gq };
});

// Open external links
ipcMain.on('open-external', (_event, url) => shell.openExternal(url));
