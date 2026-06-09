const express = require('express');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');
const { discoverPlaylist, getStatus } = require('./lib/singapore-playlist');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const SINGAPOR_DIR = path.join(__dirname, 'singapor', 'public');

app.use(express.static(path.join(__dirname, 'public')));
if (fs.existsSync(SINGAPOR_DIR)) {
  app.use('/singapor', express.static(SINGAPOR_DIR));
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/singapore/playlist', (req, res) => {
  const videos = discoverPlaylist(__dirname);
  if (!videos.length) {
    return res.status(404).json({ error: 'No processed videos. Run: cd singapor && python3 process_video.py --force' });
  }
  res.json({ version: 1, loop: true, videos });
});

app.get('/api/singapore/status', (req, res) => {
  res.json(getStatus(__dirname));
});

const USE_SINGAPOR = discoverPlaylist(__dirname).length > 0;

const SEX_OPTIONS = ['Male', 'Female'];
const AGE_GROUPS = ['0–17', '18–25', '26–35', '36–50', '51–65', '65+'];
const ORIGIN_OPTIONS = ['South Asian', 'East Asian', 'Middle Eastern', 'African', 'European', 'American', 'Other'];

let detectionState = {
  totalToday: 0,
  activePeople: 0,
  hourlyData: Array(24).fill(0),
  dailyData: Array(7).fill(0),
  sexBreakdown: { Male: 0, Female: 0 },
  ageBreakdown: Object.fromEntries(AGE_GROUPS.map(a => [a, 0])),
  originBreakdown: Object.fromEntries(ORIGIN_OPTIONS.map(o => [o, 0])),
  detections: [],
};

function simulateDetection() {
  const count = Math.floor(Math.random() * 3) + 1;
  for (let i = 0; i < count; i++) {
    const sex = SEX_OPTIONS[Math.random() < 0.54 ? 0 : 1];
    const age = AGE_GROUPS[Math.floor(Math.random() * AGE_GROUPS.length)];
    const origin = ORIGIN_OPTIONS[Math.floor(Math.random() * ORIGIN_OPTIONS.length)];
    detectionState.totalToday++;
    detectionState.hourlyData[new Date().getHours()]++;
    detectionState.sexBreakdown[sex]++;
    detectionState.ageBreakdown[age]++;
    detectionState.originBreakdown[origin]++;
    detectionState.detections.unshift({ sex, age, origin, confidence: 0.9, ts: Date.now() });
    if (detectionState.detections.length > 50) detectionState.detections.pop();
  }
  detectionState.activePeople = Math.min(30, Math.max(0, detectionState.activePeople + count - 1));
  io.emit('detection_update', detectionState);
  setTimeout(simulateDetection, 2000 + Math.random() * 3000);
}

if (!USE_SINGAPOR) {
  simulateDetection();
} else {
  const pl = discoverPlaylist(__dirname);
  console.log(`  Singapore playlist: ${pl.length} videos`);
  pl.forEach((v, i) => console.log(`    ${i + 1}. ${v.label} — ${v.video}`));
}

io.on('connection', (socket) => {
  if (!USE_SINGAPOR) socket.emit('detection_update', detectionState);
  socket.on('disconnect', () => {});
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n  Surveillance Dashboard → http://localhost:${PORT}`);
  console.log(USE_SINGAPOR ? '  Mode: Singapore live video + detection\n' : '  Mode: Simulated detections\n');
});
