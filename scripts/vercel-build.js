#!/usr/bin/env node
/**
 * Vercel build: copy telemetry JSON + playlist into public/singapor for API/fs fallback.
 * Videos are proxied from GitHub LFS via vercel.json rewrite (too large to bundle).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'singapor', 'public');
const dest = path.join(root, 'public', 'singapor');

const COPY_GLOBS = ['*_data.json', 'playlist.json', 'favicon.svg', 'icons.svg'];

function copyIfExists(name) {
  const from = path.join(src, name);
  const to = path.join(dest, name);
  if (!fs.existsSync(from)) return false;
  fs.copyFileSync(from, to);
  console.log(`  copied ${name}`);
  return true;
}

fs.mkdirSync(dest, { recursive: true });

let copied = 0;
if (fs.existsSync(src)) {
  for (const file of fs.readdirSync(src)) {
    if (
      file.endsWith('_data.json') ||
      file === 'playlist.json' ||
      file === 'favicon.svg' ||
      file === 'icons.svg'
    ) {
      if (copyIfExists(file)) copied++;
    }
  }
}

console.log(`Vercel build: ${copied} singapor asset(s) copied to public/singapor/`);
