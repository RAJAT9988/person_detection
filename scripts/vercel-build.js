#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = path.join(root, 'singapor', 'public');
const dest = path.join(root, 'public', 'singapor');

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
      fs.copyFileSync(path.join(src, file), path.join(dest, file));
      copied++;
    }
  }
}

console.log(`Vercel build OK — ${copied} asset(s) in public/singapor/`);
