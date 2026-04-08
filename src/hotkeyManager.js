// ============================================================
//  src/hotkeyManager.js
//  Global hold-to-record hotkey using uiohook-napi.
//  Fires onKeyDown when the hotkey is pressed,
//  onKeyUp when released.
// ============================================================

let uiohook;
try {
  const mod = require('uiohook-napi');
  uiohook = mod.uIOhook;
} catch (e) {
  console.warn('[HotkeyManager] uiohook-napi not available:', e.message);
  uiohook = null;
}

// Map friendly names → uiohook key codes
// See: https://github.com/SnosMe/uiohook-napi/blob/master/src/uiohook.ts
const KEY_CODES = {
  AltRight:     0xe038,
  AltLeft:      0x0038,
  ControlRight: 0xe01d,
  ControlLeft:  0x001d,
};

class HotkeyManager {
  constructor() {
    this.currentKey   = 'AltRight';
    this.keyCode      = KEY_CODES['AltRight'];
    this.isHeld       = false;
    this.onKeyDown    = null;   // callback()
    this.onKeyUp      = null;   // callback()
    this._started     = false;
  }

  /**
   * Set the active hotkey by name.
   * @param {string} name - e.g. 'AltRight'
   */
  setHotkey(name) {
    this.currentKey = name;
    this.keyCode = KEY_CODES[name] ?? KEY_CODES['AltRight'];
  }

  /** Start the global keyboard hook. */
  start() {
    if (!uiohook) {
      console.warn('[HotkeyManager] Falling back to no-op (uiohook unavailable)');
      return;
    }
    if (this._started) return;

    uiohook.on('keydown', (e) => {
      if (e.keycode === this.keyCode && !this.isHeld) {
        this.isHeld = true;
        this.onKeyDown?.();
      }
    });

    uiohook.on('keyup', (e) => {
      if (e.keycode === this.keyCode && this.isHeld) {
        this.isHeld = false;
        this.onKeyUp?.();
      }
    });

    uiohook.start();
    this._started = true;
    console.log(`[HotkeyManager] Listening for ${this.currentKey} (code: 0x${this.keyCode.toString(16)})`);
  }

  /** Stop the global keyboard hook. */
  stop() {
    if (uiohook && this._started) {
      uiohook.stop();
      this._started = false;
    }
  }
}

module.exports = HotkeyManager;
