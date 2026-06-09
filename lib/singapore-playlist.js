const fs = require('fs');
const path = require('path');

const PLAYLIST_INPUTS = ['at1', 'at2', 'at3'];

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function fileMtime(filePath) {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}

function singaporDir(root) {
  return path.join(root, 'singapor', 'public');
}

function buildPlaylistEntry(dir, name, index) {
  const processed = `${name}_processed.mp4`;
  const telemetry = `${name}_data.json`;
  const videoPath = path.join(dir, processed);
  const dataPath = path.join(dir, telemetry);
  if (!fs.existsSync(videoPath) || !fs.existsSync(dataPath)) return null;
  const stats = readJsonSafe(dataPath) || [];
  return {
    id: name,
    label: `Camera ${index}`,
    video: `/singapor/${processed}`,
    telemetry: `/singapor/${telemetry}`,
    duration: stats[stats.length - 1]?.timestamp || 0,
    frames: stats.length,
    videoVersion: Math.floor(fileMtime(videoPath)),
  };
}

function discoverPlaylist(root) {
  const dir = singaporDir(root);
  if (!fs.existsSync(dir)) return [];

  const fromInputs = PLAYLIST_INPUTS.map((name, i) => buildPlaylistEntry(dir, name, i + 1)).filter(Boolean);
  if (fromInputs.length) return fromInputs;

  const playlistFile = path.join(dir, 'playlist.json');
  if (!fs.existsSync(playlistFile)) return [];

  const saved = readJsonSafe(playlistFile);
  if (!saved?.videos?.length) return [];

  return saved.videos.map((item) => {
    const dataPath = path.join(dir, path.basename(item.telemetry || ''));
    const videoPath = path.join(dir, path.basename(item.video || ''));
    const stats = readJsonSafe(dataPath) || [];
    return {
      ...item,
      duration: item.duration || stats[stats.length - 1]?.timestamp || 0,
      frames: stats.length,
      videoVersion: fileMtime(videoPath) || undefined,
    };
  });
}

function getStatus(root) {
  const videos = discoverPlaylist(root);
  const first = videos[0];
  let frames = 0;
  let duration = 0;
  videos.forEach((v) => {
    frames += v.frames || 0;
    duration += v.duration || 0;
  });
  return {
    available: videos.length > 0,
    mode: videos.length > 1 ? 'playlist' : videos.length ? 'single' : 'none',
    videoCount: videos.length,
    video: first?.video || null,
    telemetry: first?.telemetry || null,
    videoVersion: first?.videoVersion || null,
    frames,
    duration,
    playlist: videos.length ? '/api/singapore/playlist' : null,
    needsReprocess: false,
  };
}

module.exports = { discoverPlaylist, getStatus };
