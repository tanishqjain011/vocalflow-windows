// ============================================================
//  src/textInjector.js
//  Injects text at the current cursor position on Windows
//  by writing to the clipboard then simulating Ctrl+V.
// ============================================================

const { clipboard } = require('electron');
const { exec }      = require('child_process');
const path          = require('path');
const fs            = require('fs');
const os            = require('os');

/**
 * Inject `text` at the user's current cursor position.
 * Strategy:
 *   1. Back up current clipboard contents
 *   2. Write `text` to clipboard
 *   3. Send Ctrl+V via keybd_event (WinAPI via PowerShell)
 *   4. Restore original clipboard after a short delay
 */
async function injectText(text) {
  if (!text || !text.trim()) return;

  // 1. Preserve existing clipboard
  const previousText = clipboard.readText();

  // 2. Write new text to clipboard
  clipboard.writeText(text);

  // 3. Simulate Ctrl+V using PowerShell + Windows API
  await sendCtrlV();

  // 4. Restore clipboard after paste has happened
  setTimeout(() => {
    clipboard.writeText(previousText);
  }, 500);
}

/**
 * Writes a temporary PowerShell script that uses keybd_event
 * to simulate Ctrl+V, then executes it.
 */
function sendCtrlV() {
  return new Promise((resolve, reject) => {
    const psScript = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WinKeys {
    [DllImport("user32.dll", SetLastError=true)]
    public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    
    public const int KEYEVENTF_KEYUP = 0x0002;
    public const byte VK_CONTROL = 0x11;
    public const byte VK_V = 0x56;
    
    public static void PasteCtrlV() {
        keybd_event(VK_CONTROL, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(30);
        keybd_event(VK_V, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(30);
        keybd_event(VK_V, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        System.Threading.Thread.Sleep(30);
        keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }
}
"@
[WinKeys]::PasteCtrlV()
`;

    const tmpFile = path.join(os.tmpdir(), `vocalflow_paste_${Date.now()}.ps1`);
    fs.writeFileSync(tmpFile, psScript, 'utf8');

    exec(
      `powershell -ExecutionPolicy Bypass -NonInteractive -File "${tmpFile}"`,
      (err) => {
        // Clean up temp file
        try { fs.unlinkSync(tmpFile); } catch (_) {}
        if (err) {
          console.error('[TextInjector] Ctrl+V error:', err.message);
          reject(err);
        } else {
          resolve();
        }
      }
    );
  });
}

module.exports = { injectText };
