const fs = require('fs');
const path = require('path');

const PLAYLIST_INPUTS = ['at1', 'at2', 'at3'];

function getSingaporDir(root) {
  const base = root || process.cwd();
  return path.join(base, 'singapor', 'public');
}

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

function assetsBase() {
  const base = process.env.ASSETS_BASE_URL || '';
  return base.replace(/\/$/, '');
}

function assetUrl(relativePath) {
  const rel = relativePath.replace(/^\//, '');
  const base = assetsBase();
  return base ? `${base}/${rel}` : `/singapor/${rel}`;
}

function buildPlaylistEntry(name, index, singaporDir) {
  const processed = `${name}_processed.mp4`;
  const telemetry = `${name}_data.json`;
  const videoPath = path.join(singaporDir, processed);
  const dataPath = path.join(singaporDir, telemetry);
  const publicDataPath = path.join(process.cwd(), 'public', 'singapor', telemetry);
  const jsonPath = fs.existsSync(dataPath) ? dataPath : publicDataPath;
  if (!fs.existsSync(jsonPath)) return null;
  const stats = readJsonSafe(jsonPath) || [];
  const hasVideo = fs.existsSync(videoPath);
  return {
    id: name,
    label: `Camera ${index}`,
    video: assetUrl(processed),
    telemetry: assetUrl(telemetry),
    duration: stats[stats.length - 1]?.timestamp || 0,
    frames: stats.length,
    videoVersion: hasVideo ? Math.floor(fileMtime(videoPath)) : Date.now(),
  };
}

function discoverPlaylist(root) {
  const singaporDir = getSingaporDir(root);
  const playlistFile = path.join(singaporDir, 'playlist.json');

  const fromInputs = PLAYLIST_INPUTS
    .map((name, i) => buildPlaylistEntry(name, i + 1, singaporDir))
    .filter(Boolean);
  if (fromInputs.length > 0) return fromInputs;

  if (fs.existsSync(playlistFile)) {
    const saved = readJsonSafe(playlistFile);
    if (saved?.videos?.length) {
      return saved.videos.map((item) => {
        const videoFile = path.basename(item.video || '');
        const dataFile = path.basename(item.telemetry || '');
        const stats = readJsonSafe(path.join(singaporDir, dataFile)) || [];
        return {
          ...item,
          video: assetUrl(videoFile),
          telemetry: assetUrl(dataFile),
          duration: item.duration || stats[stats.length - 1]?.timestamp || 0,
          frames: stats.length,
          videoVersion: fileMtime(path.join(singaporDir, videoFile)) || item.videoVersion,
        };
      });
    }
  }

  return [];
}

function needsReprocess(root) {
  const singaporDir = getSingaporDir(root);
  return PLAYLIST_INPUTS.some((name) => {
    for (const ext of ['.avi', '.mp4']) {
      const inputPath = path.join(singaporDir, `${name}${ext}`);
      const outputPath = path.join(singaporDir, `${name}_processed.mp4`);
      if (fs.existsSync(inputPath) && !fs.existsSync(outputPath)) return true;
      if (fs.existsSync(inputPath) && fs.existsSync(outputPath)) {
        return fileMtime(inputPath) > fileMtime(outputPath);
      }
    }
    return false;
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
    mode: videos.length > 1 ? 'playlist' : 'single',
    videoCount: videos.length,
    video: first?.video || null,
    telemetry: first?.telemetry || null,
    videoVersion: first?.videoVersion || null,
    frames,
    duration,
    playlist: videos.length ? '/api/singapore/playlist' : null,
    needsReprocess: needsReprocess(root),
    assetsBase: assetsBase() || null,
  };
}

module.exports = {
  PLAYLIST_INPUTS,
  discoverPlaylist,
  needsReprocess,
  getStatus,
  assetsBase,
};
