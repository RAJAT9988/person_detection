/* Vercel demo — video playlist + simulated analytics (no detection pipeline) */
'use strict';

const DEMO_AGE = ['0–17', '18–25', '26–35', '36–50', '51–65', '65+'];
const DEMO_ORIGIN = ['South Asian', 'East Asian', 'Middle Eastern', 'African', 'European', 'American', 'Other'];
/** Male/female stay close; female trails male by a few points */
const MALE_RATIO = 0.51;

let playlist = [];
let assetsBase = '';
let currentIndex = 0;
let advancing = false;
let globalTime = 0;
let videoDuration = 12;
let lastTick = 0;
let loopCount = 0;

const session = {
  totalToday: 0,
  activePeople: 0,
  hourlyData: Array(24).fill(0),
  dailyData: Array(7).fill(0),
  sexBreakdown: { Male: 0, Female: 0 },
  ageBreakdown: Object.fromEntries(DEMO_AGE.map(a => [a, 0])),
  originBreakdown: Object.fromEntries(DEMO_ORIGIN.map(o => [o, 0])),
  detections: [],
  entryTimes: [],
};

function isVercelHost() {
  return /\.vercel\.app$/i.test(location.hostname)
    || location.hostname.endsWith('.vercel.app')
    || new URLSearchParams(location.search).get('demo') === '1';
}

function videoUrl(item) {
  const base = assetsBase.replace(/\/$/, '');
  return `${base}/${item.file}`;
}

function buildMountainHourly(nowHour) {
  const data = Array(24).fill(0);
  const timeline = Math.max(globalTime + videoDuration, 60);
  const cursor = Math.min(23, Math.floor((globalTime / timeline) * 24));
  session.entryTimes.forEach(t => {
    const h = Math.min(23, Math.floor((t / timeline) * 24));
    if (h <= cursor) data[h]++;
  });
  for (let h = cursor + 1; h < 24; h++) data[h] = null;
  return data;
}

function randomDetection() {
  const sex = Math.random() < MALE_RATIO ? 'Male' : 'Female';
  const age = DEMO_AGE[Math.floor(Math.random() * DEMO_AGE.length)];
  const origin = DEMO_ORIGIN[Math.floor(Math.random() * DEMO_ORIGIN.length)];
  return {
    sex, age, origin,
    confidence: 0.72 + Math.random() * 0.25,
    ts: Date.now(),
  };
}

function tickAnalytics(videoTime) {
  const t = globalTime + videoTime;

  // Active count pulses with video time (feels tied to the feed)
  const wave = 4 + Math.sin(t * 0.35 + currentIndex) * 2 + Math.sin(t * 0.9) * 1.5;
  session.activePeople = Math.max(1, Math.min(18, Math.round(wave + Math.random() * 3)));

  // New "detections" every few seconds
  if (Date.now() - lastTick > 1800 + Math.random() * 1200) {
    lastTick = Date.now();
    const batch = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < batch; i++) {
      const d = randomDetection();
      session.totalToday++;
      session.sexBreakdown[d.sex]++;
      session.ageBreakdown[d.age]++;
      session.originBreakdown[d.origin]++;
      session.entryTimes.push(t);
      session.detections.unshift(d);
      if (session.detections.length > 50) session.detections.pop();
    }
    const hour = new Date().getHours();
    session.hourlyData[hour] = (session.hourlyData[hour] || 0) + batch;
    session.dailyData[new Date().getDay()] = (session.dailyData[new Date().getDay()] || 0) + batch;
  }

  const hourlyData = buildMountainHourly(new Date().getHours());

  window.applyDetectionState?.({
    activePeople: session.activePeople,
    totalToday: session.totalToday,
    hourlyData,
    dailyData: session.dailyData,
    sexBreakdown: { ...session.sexBreakdown },
    ageBreakdown: { ...session.ageBreakdown },
    originBreakdown: { ...session.originBreakdown },
    detections: [...session.detections],
    source: 'demo',
    videoTime: t,
    playlistIndex: currentIndex,
    playlistLabel: playlist[currentIndex]?.label || '',
  });
}

async function loadVideoAtIndex(video, index) {
  const item = playlist[index];
  if (!item) return false;
  currentIndex = index;

  const trySrc = async (file) => {
    const src = `${assetsBase.replace(/\/$/, '')}/${file}`;
    video.pause();
    video.removeAttribute('loop');
    video.loop = false;
    video.src = src;
    video.load();
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('timeout')), 15000);
      const ok = () => { clearTimeout(t); resolve(); };
      const err = () => { clearTimeout(t); reject(new Error('load error')); };
      video.addEventListener('loadeddata', ok, { once: true });
      video.addEventListener('error', err, { once: true });
    });
  };

  try {
    await trySrc(item.file);
  } catch {
    if (item.fallback) await trySrc(item.fallback);
    else throw new Error('video load failed');
  }

  if (video.duration && Number.isFinite(video.duration)) videoDuration = video.duration;
  video.currentTime = 0;

  const cam = document.querySelector('.vhd-loc');
  if (cam) cam.textContent = `${item.label.toUpperCase()} — LIVE`;
  return true;
}

async function advance(video) {
  if (advancing || !playlist.length) return;
  advancing = true;
  try {
    globalTime += videoDuration || 0;
    const next = (currentIndex + 1) % playlist.length;
    if (next === 0) loopCount++;
    await loadVideoAtIndex(video, next);
    video.muted = true;
    video.playsInline = true;
    await video.play().catch(() => {});
    tickAnalytics(0);
  } catch (e) {
    console.warn('[Vercel demo] advance failed', e);
  }
  advancing = false;
}

function bindVideo(video) {
  video.addEventListener('timeupdate', () => {
    tickAnalytics(video.currentTime);
    if (!advancing && video.duration && video.currentTime >= video.duration - 0.25) {
      advance(video);
    }
  });
  video.addEventListener('ended', () => advance(video));
  video.addEventListener('error', () => advance(video));
}

async function initVercelVideoEngine() {
  if (!isVercelHost()) return false;

  const video = document.getElementById('feed-video');
  const placeholder = document.getElementById('video-placeholder');
  if (!video) return false;

  try {
    const res = await fetch('/config/vercel-playlist.json', { cache: 'no-store' });
    const cfg = await res.json();
    assetsBase = cfg.assetsBase || '';
    playlist = cfg.videos || [];
    if (!playlist.length) throw new Error('empty playlist');
  } catch (e) {
    console.warn('[Vercel demo] config failed', e);
    return false;
  }

  bindVideo(video);
  if (!(await loadVideoAtIndex(video, 0))) return false;

  if (placeholder) placeholder.style.display = 'none';
  video.muted = true;
  video.playsInline = true;
  await video.play().catch(() => {});

  window.VERCEL_DEMO_MODE = true;
  // Seed sex split so bars start close (female slightly lower)
  session.totalToday = 100;
  session.sexBreakdown = { Male: 51, Female: 49 };
  tickAnalytics(0);

  console.log(`[Vercel demo] ${playlist.length} videos, simulated analytics`);
  return true;
}

window.isVercelHost = isVercelHost;
window.initVercelVideoEngine = initVercelVideoEngine;
