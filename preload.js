// ============================================================
//  preload.js
//  Exposes a safe, typed API to the renderer via contextBridge.
// ============================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Settings ────────────────────────────────────────────
  getSettings:    ()       => ipcRenderer.invoke('get-settings'),
  saveSettings:   (s)      => ipcRenderer.invoke('save-settings', s),

  // ── Models ──────────────────────────────────────────────
  fetchDeepgramModels: () => ipcRenderer.invoke('fetch-deepgram-models'),
  fetchGroqModels:     () => ipcRenderer.invoke('fetch-groq-models'),

  // ── Balances (extra feature) ─────────────────────────────
  fetchBalances: () => ipcRenderer.invoke('fetch-balances'),

  // ── Audio streaming ──────────────────────────────────────
  sendAudioChunk: (buffer) => ipcRenderer.send('audio-chunk', buffer),

  // ── Events from main → renderer ──────────────────────────
  onRecordingStart:  (cb) => ipcRenderer.on('recording-start',  () => cb()),
  onRecordingStop:   (cb) => ipcRenderer.on('recording-stop',   () => cb()),
  onLiveTranscript:  (cb) => ipcRenderer.on('live-transcript',  (_e, d) => cb(d)),
  onFinalTranscript: (cb) => ipcRenderer.on('final-transcript', (_e, t) => cb(t)),
  onDeepgramError:   (cb) => ipcRenderer.on('deepgram-error',   (_e, m) => cb(m)),

  // ── Utilities ────────────────────────────────────────────
  openExternal: (url) => ipcRenderer.send('open-external', url),
});
