const GITHUB_MEDIA =
  'https://media.githubusercontent.com/media/RAJAT9988/person_detection/main/singapor/public';

const CAMERAS = [
  { id: 'at1', label: 'Camera 1' },
  { id: 'at2', label: 'Camera 2' },
  { id: 'at3', label: 'Camera 3' },
];

function assetsBase() {
  return (process.env.ASSETS_BASE_URL || GITHUB_MEDIA).replace(/\/$/, '');
}

function videoUrls(id) {
  const base = assetsBase();
  return {
    video: `${base}/${id}_processed.mp4`,
    fallbackVideo: `${base}/${id}.avi`,
  };
}

function getPlaybackPlaylist() {
  return {
    version: 1,
    loop: true,
    mode: 'playback',
    videos: CAMERAS.map((cam) => ({
      id: cam.id,
      label: cam.label,
      ...videoUrls(cam.id),
      duration: 0,
      videoVersion: 1,
    })),
  };
}

function getPlaybackStatus() {
  const pl = getPlaybackPlaylist();
  return {
    available: true,
    mode: 'playback',
    videoCount: pl.videos.length,
    video: pl.videos[0]?.video || null,
    videoVersion: 1,
    frames: 0,
    duration: 0,
    playlist: '/api/singapore/playlist',
    needsReprocess: false,
    assetsBase: assetsBase(),
  };
}

module.exports = { getPlaybackPlaylist, getPlaybackStatus, assetsBase };
