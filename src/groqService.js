// ============================================================
//  src/groqService.js
//  LLM post-processing via Groq API (spelling, grammar,
//  transliteration, translation)
// ============================================================

const fetch = require('node-fetch');

const GROQ_BASE = 'https://api.groq.com/openai/v1';

class GroqService {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  // ── Build system prompt per processing type ───────────────

  _systemPrompt(type, opts = {}) {
    switch (type) {
      case 'spelling':
        return (
          'You are a spelling corrector. The user will provide a raw voice transcript. '
          + 'Fix only spelling mistakes. Preserve the original words and sentence structure. '
          + 'Return ONLY the corrected text with no explanation or preamble.'
        );

      case 'grammar':
        return (
          'You are a grammar corrector. The user will provide a raw voice transcript. '
          + 'Fix grammar, punctuation and sentence structure while keeping the meaning intact. '
          + 'Return ONLY the corrected text with no explanation or preamble.'
        );

      case 'transliteration': {
        const lang = opts.language || 'Hinglish';
        return (
          `You are a ${lang} transliteration assistant. The user will provide a code-mixed voice `
          + `transcript in ${lang}. Convert it to clean, readable English while preserving intent. `
          + 'Return ONLY the transliterated text with no explanation or preamble.'
        );
      }

      case 'translation': {
        const target = opts.targetLanguage || 'English';
        return (
          `You are a translator. Translate the following voice transcript to ${target}. `
          + 'Preserve the meaning and tone. '
          + 'Return ONLY the translated text with no explanation or preamble.'
        );
      }

      default:
        return null; // No processing
    }
  }

  /**
   * Run post-processing on a transcript.
   * @param {string} transcript  Raw transcript from Deepgram
   * @param {string} type        'spelling' | 'grammar' | 'transliteration' | 'translation' | 'none'
   * @param {string} model       Groq model name
   * @param {object} opts        Extra options (language, targetLanguage)
   * @returns {Promise<string>}  Processed text
   */
  async process(transcript, type, model = 'llama3-8b-8192', opts = {}) {
    if (!type || type === 'none') return transcript;
    if (!this.apiKey) return transcript;

    const systemPrompt = this._systemPrompt(type, opts);
    if (!systemPrompt) return transcript;

    const res = await fetch(`${GROQ_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: transcript },
        ],
        max_tokens: 1024,
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq API error ${res.status}: ${err}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? transcript;
  }

  /**
   * Fetch available Groq chat models.
   * @returns {Promise<string[]>}
   */
  async fetchModels() {
    const res = await fetch(`${GROQ_BASE}/models`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });
    if (!res.ok) throw new Error(`Groq models fetch failed: ${res.status}`);
    const data = await res.json();
    return (data.data || [])
      .filter(m => !m.id.includes('whisper'))   // exclude audio models
      .map(m => m.id)
      .sort();
  }
}

module.exports = GroqService;
