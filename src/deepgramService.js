// ============================================================
//  src/deepgramService.js
//  Real-time streaming ASR via Deepgram WebSocket API
// ============================================================

const WebSocket = require('ws');

class DeepgramService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.ws = null;
    this.onTranscript = null;   // callback(text, isFinal)
    this.onError = null;        // callback(err)
    this.onClose = null;        // callback()
    this.isConnected = false;
  }

  /**
   * Open a WebSocket connection to Deepgram and begin streaming.
   * @param {object} opts - model, language, etc.
   */
  connect(opts = {}) {
    const {
      model    = 'nova-2',
      language = 'en',
      sampleRate = 16000,
      encoding   = 'linear16',
      channels   = 1,
      punctuate  = true,
      smartFormat = true,
      interimResults = true,
    } = opts;

    const params = new URLSearchParams({
      model,
      language,
      sample_rate: sampleRate,
      encoding,
      channels,
      punctuate,
      smart_format: smartFormat,
      interim_results: interimResults,
    });

    const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`;

    this.ws = new WebSocket(url, {
      headers: { Authorization: `Token ${this.apiKey}` },
    });

    this.ws.on('open', () => {
      this.isConnected = true;
      console.log('[Deepgram] WebSocket connected');
    });

    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'Results') {
          const alt = msg.channel?.alternatives?.[0];
          if (alt && alt.transcript) {
            const isFinal = msg.is_final ?? false;
            this.onTranscript?.(alt.transcript, isFinal);
          }
        }
      } catch (e) {
        console.error('[Deepgram] Parse error:', e.message);
      }
    });

    this.ws.on('error', (err) => {
      console.error('[Deepgram] WebSocket error:', err.message);
      this.isConnected = false;
      this.onError?.(err);
    });

    this.ws.on('close', (code, reason) => {
      console.log(`[Deepgram] Connection closed (${code}): ${reason}`);
      this.isConnected = false;
      this.onClose?.();
    });
  }

  /**
   * Send raw PCM audio bytes to Deepgram.
   * @param {Buffer|ArrayBuffer} audioChunk
   */
  sendAudio(audioChunk) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(audioChunk);
    }
  }

  /**
   * Signal end-of-stream and close the WebSocket.
   */
  finish() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Send empty bytes as EOS signal per Deepgram docs
      this.ws.send(Buffer.alloc(0));
      this.ws.close();
    }
    this.isConnected = false;
  }

  /**
   * Fetch available Deepgram models for a given language.
   * @returns {Promise<string[]>}
   */
  async fetchModels() {
    const fetch = require('node-fetch');
    const res = await fetch('https://api.deepgram.com/v1/models?type=transcription', {
      headers: { Authorization: `Token ${this.apiKey}` },
    });
    if (!res.ok) throw new Error(`Deepgram models fetch failed: ${res.status}`);
    const data = await res.json();
    // Extract unique model names
    const models = [];
    for (const category of Object.values(data)) {
      if (Array.isArray(category)) {
        for (const m of category) {
          if (m.name && !models.includes(m.name)) models.push(m.name);
        }
      }
    }
    return models.length ? models : ['nova-2', 'nova', 'whisper-large', 'base'];
  }
}

module.exports = DeepgramService;
