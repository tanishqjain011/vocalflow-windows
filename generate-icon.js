#!/usr/bin/env node
// ============================================================
//  generate-icon.js
//  Run this once to create a simple tray icon if you don't
//  have one. Requires the 'canvas' package.
//  npm install canvas --save-dev && node generate-icon.js
//
//  Alternatively just drop your own icon.png (16x16 or 32x32)
//  into the assets/ folder.
// ============================================================

const fs   = require('fs');
const path = require('path');

// Create a minimal 1x1 transparent PNG as absolute fallback
// (Electron requires a valid image file for the tray)
const PNG_1x1_TRANSPARENT = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4' +
  '890000000a49444154789c6260000000020001e221bc330000000049454e44ae426082',
  'hex'
);

const outPath = path.join(__dirname, 'assets', 'icon.png');
if (!fs.existsSync(outPath)) {
  fs.writeFileSync(outPath, PNG_1x1_TRANSPARENT);
  console.log('Created placeholder icon at assets/icon.png');
  console.log('Replace it with a proper 32x32 PNG for a better tray icon.');
} else {
  console.log('assets/icon.png already exists — skipping.');
}
