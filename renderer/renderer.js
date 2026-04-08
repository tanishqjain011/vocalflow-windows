// ============================================================
//  renderer/renderer.js
//  Settings UI logic + microphone audio capture pipeline
// ============================================================

'use strict';

const api = window.electronAPI;

// ── DOM refs ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const dgKey      = $('deepgramApiKey');
const dgModel    = $('deepgramModel');
const dgLang     = $('deepgramLanguage');
const gqKey      = $('groqApiKey');
const gqModel    = $('groqModel');
const hotkey     = $('hotkey');
const postToggle = $('postProcessing');
const postType   = $('postProcessType');
const transLang  = $('transLang');
const targetLang = $('targetLang');
const transcriptBox = $('transcriptBox');
const recordingBar  = $('recordingBar');
const recInline     = $('recTranscriptInline');
const toast         = $('toast');

// ── Audio state ───────────────────────────────────────────────
let audioCtx    = null;
let mediaStream = null;
let processor   = null;
let sourceNode  = null;

// ── Load settings on open ─────────────────────────────────────
(async () => {
  const s = await api.getSettings();
  dgKey.value      = s.deepgramApiKey     ?? '';
  dgModel.value    = s.deepgramModel      ?? 'nova-2';
  dgLang.value     = s.deepgramLanguage   ?? 'en';
  gqKey.value      = s.groqApiKey         ?? '';
  gqModel.value    = s.groqModel          ?? 'llama3-8b-8192';
  hotkey.value     = s.hotkey             ?? 'AltRight';
  postToggle.checked = !!s.postProcessing;
  postType.value   = s.postProcessType    ?? 'none';
  transLang.value  = s.transLang          ?? 'Hinglish';
  targetLang.value = s.targetLang         ?? 'English';

  updatePostProcessVisibility();

  // Auto-load balances on open
  loadBalances();
})();

// ── Save settings ─────────────────────────────────────────────
$('saveBtn').addEventListener('click', async () => {
  const settings = {
    deepgramApiKey:   dgKey.value.trim(),
    groqApiKey:       gqKey.value.trim(),
    deepgramModel:    dgModel.value,
    deepgramLanguage: dgLang.value.trim() || 'en',
    groqModel:        gqModel.value,
    hotkey:           hotkey.value,
    postProcessing:   postToggle.checked,
    postProcessType:  postType.value,
    transLang:        transLang.value,
    targetLang:       targetLang.value.trim() || 'English',
  };
  const res = await api.saveSettings(settings);
  if (res.ok) showToast('Settings saved ✓', 'success');
  else        showToast('Save failed', 'error');
});

// ── Fetch Deepgram models ─────────────────────────────────────
$('fetchDGModels').addEventListener('click', async () => {
  $('fetchDGModels').disabled = true;
  $('fetchDGModels').textContent = '…';
  try {
    const models = await api.fetchDeepgramModels();
    dgModel.innerHTML = '';
    models.forEach(m => {
      const o = document.createElement('option');
      o.value = m; o.textContent = m;
      dgModel.appendChild(o);
    });
    showToast(`${models.length} Deepgram models loaded`, 'success');
  } catch (e) {
    showToast('Failed to fetch models', 'error');
  } finally {
    $('fetchDGModels').disabled = false;
    $('fetchDGModels').textContent = 'Fetch Models';
  }
});

// ── Fetch Groq models ─────────────────────────────────────────
$('fetchGQModels').addEventListener('click', async () => {
  $('fetchGQModels').disabled = true;
  $('fetchGQModels').textContent = '…';
  try {
    const models = await api.fetchGroqModels();
    gqModel.innerHTML = '';
    models.forEach(m => {
      const o = document.createElement('option');
      o.value = m; o.textContent = m;
      gqModel.appendChild(o);
    });
    showToast(`${models.length} Groq models loaded`, 'success');
  } catch (e) {
    showToast('Failed to fetch models', 'error');
  } finally {
    $('fetchGQModels').disabled = false;
    $('fetchGQModels').textContent = 'Fetch Models';
  }
});

// ── Balance (extra feature) ───────────────────────────────────
$('refreshBalBtn').addEventListener('click', loadBalances);

async function loadBalances() {
  $('dgBalValue').textContent = '…';
  $('gqBalValue').textContent = '…';
  $('refreshBalBtn').disabled = true;

  try {
    const { deepgram: dg, groq: gq } = await api.fetchBalances();

    // Deepgram
    if (dg.error) {
      $('dgBalValue').textContent = 'N/A';
      $('dgBalSub').textContent   = dg.error;
    } else {
      $('dgBalValue').textContent = `$${Number(dg.amount).toFixed(4)}`;
      $('dgBalSub').textContent   = dg.projectName;
    }

    // Groq
    if (gq.error) {
      $('gqBalValue').textContent = 'Error';
      $('gqBalSub').textContent   = gq.error;
    } else {
      $('gqBalValue').textContent = gq.status;
      $('gqBalSub').textContent   = `${gq.models} models available`;
    }
  } catch (e) {
    $('dgBalValue').textContent = 'Error';
    $('gqBalValue').textContent = 'Error';
  } finally {
    $('refreshBalBtn').disabled = false;
  }
}

// ── Post-process visibility ───────────────────────────────────
postToggle.addEventListener('change', updatePostProcessVisibility);
postType.addEventListener('change', updatePostProcessVisibility);

function updatePostProcessVisibility() {
  const enabled = postToggle.checked;
  $('postProcessOptions').style.opacity = enabled ? '1' : '0.4';
  $('postProcessOptions').style.pointerEvents = enabled ? '' : 'none';

  const type = postType.value;
  $('transLangRow').style.display = (enabled && type === 'transliteration') ? '' : 'none';
  $('targetLangRow').style.display = (enabled && type === 'translation')    ? '' : 'none';
}

// ── Recording events from main ────────────────────────────────
api.onRecordingStart(startMicCapture);
api.onRecordingStop(stopMicCapture);

api.onLiveTranscript(({ final, interim }) => {
  transcriptBox.innerHTML = '';
  if (final) {
    transcriptBox.appendChild(document.createTextNode(final + ' '));
  }
  if (interim) {
    const span = document.createElement('span');
    span.className = 'interim';
    span.textContent = interim;
    transcriptBox.appendChild(span);
  }
  recInline.textContent = interim || final || '';
});

api.onFinalTranscript((text) => {
  transcriptBox.innerHTML = '';
  transcriptBox.textContent = text;
});

api.onDeepgramError((msg) => {
  showToast('Deepgram error: ' + msg, 'error');
});

// ── Microphone capture ────────────────────────────────────────

async function startMicCapture() {
  recordingBar.classList.add('active');
  transcriptBox.innerHTML = '<span style="color:var(--muted);font-style:italic;">Listening…</span>';

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    // Use 16 kHz sample rate to match Deepgram config
    audioCtx = new AudioContext({ sampleRate: 16000 });
    sourceNode = audioCtx.createMediaStreamSource(mediaStream);

    // ScriptProcessor for broad compatibility (4096 frame buffer, mono)
    processor = audioCtx.createScriptProcessor(4096, 1, 1);

    processor.onaudioprocess = (event) => {
      const float32 = event.inputBuffer.getChannelData(0);
      // Convert Float32 [-1, 1] → Int16 PCM
      const int16 = float32ToInt16(float32);
      api.sendAudioChunk(int16.buffer);
    };

    sourceNode.connect(processor);
    processor.connect(audioCtx.destination);

  } catch (err) {
    console.error('[Renderer] Mic error:', err);
    showToast('Microphone access denied: ' + err.message, 'error');
    recordingBar.classList.remove('active');
  }
}

function stopMicCapture() {
  recordingBar.classList.remove('active');
  recInline.textContent = '';

  if (processor) {
    processor.disconnect();
    processor = null;
  }
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  if (audioCtx) {
    audioCtx.close().catch(() => {});
    audioCtx = null;
  }
}

// ── Helper: Float32 → Int16 ───────────────────────────────────
function float32ToInt16(float32Array) {
  const int16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16;
}

// ── External links ────────────────────────────────────────────
$('dgLink').addEventListener('click', () =>
  api.openExternal('https://console.deepgram.com'));
$('gqLink').addEventListener('click', () =>
  api.openExternal('https://console.groq.com'));

// ── Toast ─────────────────────────────────────────────────────
let toastTimer = null;

function showToast(msg, type = 'success') {
  toast.textContent = msg;
  toast.className   = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, 2800);
}
