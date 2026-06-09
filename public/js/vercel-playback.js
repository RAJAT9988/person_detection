/* Vercel playback — videos loop + simulated analytics (no detection JSON) */
'use strict';

const AGE_GROUPS = ['0–17', '18–25', '26–35', '36–50', '51–65', '65+'];
const ORIGIN_OPTIONS = ['South Asian', 'East Asian', 'Middle Eastern', 'African', 'European', 'American', 'Other'];
const SEX_OPTS = ['Male', 'Female'];

let playlist = [];
let currentVideoIndex = 0;
let videoDuration = 12;
let globalTimeOffset = 0;
let playlistTotalDuration = 36;
let playlistLoopCount = 0;
let advancing = false;
let lastTick = 0;

let totalToday = 0;
let activePeople = 3;
let sessionHourly = Array(24).fill(0);
let sexBreakdown = { Male: 0, Female: 0 };
let ageBreakdown = Object.fromEntries(AGE_GROUPS.map(a => [a, 0]));
let originBreakdown = Object.fromEntries(ORIGIN_OPTIONS.map(o => [o, 0]));
let detectionLog = [];
let personSeq = 100;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sessionTime(video) {
  return globalTimeOffset + (video?.currentTime || 0);
}

function timelineDuration() {
  return Math.max(playlistTotalDuration * Math.max(1, playlistLoopCount + 1), sessionTime(), 1);
}

function buildHourlyMountain(globalT) {
  const hourly = [...sessionHourly];
  const currentHour = Math.min(23, Math.floor((globalT / timelineDuration()) * 24));
  for (let h = 0; h <= currentHour; h++) {
    if (hourly[h] === 0 && h < currentHour) hourly[h] = Math.floor(rand(1, 4));
  }
  hourly[currentHour] = Math.max(hourly[currentHour], activePeople);
  for (let h = currentHour + 1; h < 24; h++) hourly[h] = null;
  return hourly;
}

function maybeAddPerson() {
  if (Math.random() > 0.35) return;
  const sex = pick(SEX_OPTS);
  const age = pick(AGE_GROUPS);
  const origin = pick(ORIGIN_OPTIONS);
  personSeq++;
  totalToday++;
  sexBreakdown[sex]++;
  ageBreakdown[age]++;
  originBreakdown[origin]++;
  const entry = {
    id: personSeq,
    sex,
    age,
    origin,
    confidence: 0.72 + Math.random() * 0.25,
    ts: Date.now(),
  };
  detectionLog.unshift(entry);
  if (detectionLog.length > 50) detectionLog.pop();
}

function buildState(video) {
  const globalT = sessionTime(video);
  const total = sexBreakdown.Male + sexBreakdown.Female || 1;
  return {
    activePeople,
    totalToday,
    hourlyData: buildHourlyMountain(globalT),
    dailyData: [
      Math.round(totalToday * 0.35),
      Math.round(totalToday * 0.48),
      Math.round(totalToday * 0.62),
      Math.round(totalToday * 0.78),
      totalToday,
      null,
      null,
    ],
    sexBreakdown: { ...sexBreakdown },
    ageBreakdown: { ...ageBreakdown },
    originBreakdown: { ...originBreakdown },
    detections: [...detectionLog],
    source: 'singapore',
    videoTime: globalT,
    playlistIndex: currentVideoIndex,
    playlistLabel: playlist[currentVideoIndex]?.label || '',
    playlistLoop: playlistLoopCount,
  };
}

function tickAnalytics(video) {
  const now = Date.now();
  if (now - lastTick < 400) return;
  lastTick = now;

  activePeople = Math.max(1, Math.min(18, Math.round(4 + 6 * Math.sin(now / 2200 + currentVideoIndex) + rand(-2, 3))));
  const h = Math.min(23, Math.floor((sessionTime(video) / timelineDuration()) * 24));
  sessionHourly[h] = Math.max(sessionHourly[h] || 0, activePeople);
  maybeAddPerson();
  window.applyDetectionState?.(buildState(video));
}

function updateHud() {
  const item = playlist[currentVideoIndex];
  const cam = document.querySelector('.vhd-loc');
  if (cam && item) {
    const loop = playlistLoopCount > 0 ? ` · LOOP ${playlistLoopCount + 1}` : '';
    cam.textContent = `${item.label.toUpperCase()} — LIVE${loop}`;
  }
}

async function waitReady(video, ms = 15000) {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 2) return resolve();
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    video.addEventListener('loadeddata', () => { clearTimeout(t); resolve(); }, { once: true });
    video.addEventListener('error', () => { clearTimeout(t); reject(new Error('load error')); }, { once: true });
  });
}

async function safePlay(video) {
  video.muted = true;
  video.playsInline = true;
  video.loop = false;
  try { await video.play(); }
  catch { await new Promise(r => setTimeout(r, 300)); await video.play().catch(() => {}); }
}

async function tryLoadSrc(video, src) {
  video.src = src;
  video.load();
  await waitReady(video);
}

async function loadVideoAtIndex(video, index) {
  const item = playlist[index];
  if (!item) return false;
  currentVideoIndex = index;
  video.pause();
  video.removeAttribute('loop');
  video.loop = false;
  const sources = [item.video, item.fallbackVideo].filter(Boolean);
  let loaded = false;
  for (const src of sources) {
    try {
      await tryLoadSrc(video, src);
      loaded = true;
      break;
    } catch {
      console.warn('[Vercel playback] failed:', src);
    }
  }
  if (!loaded) return false;
  if (video.duration && Number.isFinite(video.duration)) videoDuration = video.duration;
  video.currentTime = 0;
  updateHud();
  return true;
}

async function advanceToNextVideo(video) {
  if (advancing || !playlist.length) return;
  advancing = true;
  try {
    globalTimeOffset += videoDuration || 0;
    const next = (currentVideoIndex + 1) % playlist.length;
    if (next === 0) playlistLoopCount++;
    await loadVideoAtIndex(video, next);
    await safePlay(video);
    tickAnalytics(video);
  } catch (e) {
    console.error('[Vercel playback]', e);
    setTimeout(() => { advancing = false; advanceToNextVideo(video); }, 1000);
    return;
  }
  advancing = false;
}

function bindVideoEvents(video) {
  video.addEventListener('timeupdate', () => {
    tickAnalytics(video);
    if (!advancing && video.duration && video.currentTime >= video.duration - 0.25) {
      advanceToNextVideo(video);
    }
  });
  video.addEventListener('ended', () => advanceToNextVideo(video));
  video.addEventListener('error', () => advanceToNextVideo(video));
}

function isVercelHost() {
  const h = window.location.hostname;
  return h.includes('vercel.app') || h.includes('vercel.sh');
}

async function initVercelPlayback() {
  if (!isVercelHost()) return false;

  const video = document.getElementById('feed-video');
  const placeholder = document.getElementById('video-placeholder');
  if (!video) return false;

  const fallbackBase =
    'https://media.githubusercontent.com/media/Atomo-innovation/singapor/main/singapor/public';
  try {
    const res = await fetch('/api/singapore/playlist', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      playlist = data.videos || [];
    }
  } catch (e) {
    console.warn('[Vercel playback] playlist fetch:', e);
  }
  if (!playlist.length) {
    playlist = ['at1', 'at2', 'at3'].map((id, i) => ({
      id,
      label: `Camera ${i + 1}`,
      video: `${fallbackBase}/${id}_processed.mp4`,
      fallbackVideo: `${fallbackBase}/${id}.avi`,
    }));
  }
  playlistTotalDuration = playlist.length * 12;

  if (!(await loadVideoAtIndex(video, 0))) return false;
  bindVideoEvents(video);
  if (placeholder) placeholder.style.display = 'none';
  await safePlay(video);
  tickAnalytics(video);

  document.body.classList.add('singapore-mode');
  window.SINGAPORE_MODE = true;
  console.log('[Vercel] Playback mode — simulated analytics, no detection JSON');
  return true;
}

window.initVercelPlayback = initVercelPlayback;
